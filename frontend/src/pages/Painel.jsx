import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle, Clock, List } from 'lucide-react'
import api from '../api.js'
import { StatusBadge, PagamentoBadge } from '../components/StatusBadge.jsx'

const STATUS_LISTA = ['Todos', 'Em andamento', 'Pronto para retirada', 'Entregue']

function formatarData(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('pt-BR')
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function hojeISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function estaEmAtraso(os) {
  if (!os.prazo_entrega) return false
  if (os.status === 'Pronto para retirada' || os.status === 'Entregue') return false
  const prazo = String(os.prazo_entrega).split('T')[0]
  return prazo < hojeISO()
}

function ehDeHoje(os) {
  if (!os.criado_em) return false
  const criado = String(os.criado_em).split('T')[0]
  return criado === hojeISO()
}

function diasAtraso(os) {
  if (!os.prazo_entrega) return 0
  const prazo = new Date(String(os.prazo_entrega).split('T')[0])
  const hoje = new Date(hojeISO())
  const diff = hoje - prazo
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function progressoServicos(os) {
  let total = 0
  let feitos = 0
  for (const item of os.itens) {
    const servicos = item.servicos || []
    const concluidos = item.servicos_concluidos || []
    total += servicos.length
    feitos += servicos.filter(s => concluidos.includes(s)).length
  }
  return { total, feitos }
}

function CardOS({ os, atraso }) {
  const navigate = useNavigate()
  const resumo = os.itens.length === 1
    ? `${os.itens[0].categoria} — ${(os.itens[0].servicos || []).join(', ')}`
    : `${os.itens.length} itens`
  const prog = progressoServicos(os)

  return (
    <button
      onClick={() => navigate(`/os/${os.id}`)}
      className={`card w-full text-left hover:shadow-lg active:scale-[0.99] transition-all ` +
        (atraso ? 'border-2 border-red-400 ring-2 ring-red-200' : '')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-amber-700 font-black text-sm">
              #{String(os.numero).padStart(3, '0')}
            </span>
            <StatusBadge status={os.status} />
            <PagamentoBadge status={os.status_pagamento} />
            {atraso && (
              <span className="inline-flex items-center gap-1 bg-red-600 text-white border-2 border-red-700 rounded-lg px-2 py-1 text-xs font-extrabold animate-pulse">
                <AlertTriangle size={14} /> EM ATRASO
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-gray-900 truncate">{os.cliente.nome}</p>
          <p className="text-gray-500 text-sm mt-0.5 truncate">{resumo}</p>
          {prog.total > 0 && (
            <p className="text-sm font-semibold text-amber-700 mt-0.5">
              {prog.feitos}/{prog.total} serviços concluídos
            </p>
          )}
          {os.prazo_entrega && (
            <p className={`text-sm mt-0.5 font-semibold ` +
              (atraso ? 'text-red-600' : 'text-gray-500')}>
              Prazo: {formatarData(os.prazo_entrega)}
              {atraso && ` (${diasAtraso(os)} dia${diasAtraso(os) !== 1 ? 's' : ''} em atraso)`}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-extrabold text-amber-700">{formatarValor(os.total)}</p>
          {os.resta > 0 && (
            <p className="text-sm text-orange-500 font-semibold">
              Resta {formatarValor(os.resta)}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">{formatarData(os.criado_em)}</p>
        </div>
      </div>
    </button>
  )
}

export default function Painel() {
  const [ordens, setOrdens] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarOrdens() }, [])

  async function carregarOrdens() {
    setLoading(true)
    try {
      const { data } = await api.get('/ordens/')
      setOrdens(data)
    } finally {
      setLoading(false)
    }
  }

  const ordensBusca = ordens.filter(o =>
    busca === '' ||
    o.cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
    String(o.numero).includes(busca)
  )

  const ordensEmAtraso = ordensBusca.filter(o => estaEmAtraso(o))
  const ordensHoje = ordensBusca.filter(o => ehDeHoje(o))
  const ordensFiltradas = ordensBusca.filter(o =>
    filtroStatus === 'Todos' || o.status === filtroStatus
  )

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-gray-800">Ordens de Serviço</h2>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
        <input
          className="input-field pl-10"
          type="text"
          placeholder="Buscar por cliente ou nº..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10 text-lg">Carregando...</p>
      ) : (
        <>
          {/* ── Notas em atraso ── */}
          {ordensEmAtraso.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                <h3 className="font-extrabold text-red-700 text-base">
                  Notas em atraso ({ordensEmAtraso.length})
                </h3>
              </div>
              <div className="space-y-2">
                {ordensEmAtraso.map(os => (
                  <CardOS key={os.id} os={os} atraso={true} />
                ))}
              </div>
            </div>
          )}

          {/* ── Notas de hoje ── */}
          {ordensHoje.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                <h3 className="font-extrabold text-blue-700 text-base">
                  Notas de hoje ({ordensHoje.length})
                </h3>
              </div>
              <div className="space-y-2 pl-1 border-l-4 border-blue-200">
                {ordensHoje.map(os => (
                  <CardOS key={os.id} os={os} atraso={estaEmAtraso(os)} />
                ))}
              </div>
            </div>
          )}

          {/* ── Todas as notas ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <List size={18} className="text-gray-600" />
              <h3 className="font-extrabold text-gray-700 text-base">Todas as notas</h3>
            </div>

            {/* Filtros de status */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {STATUS_LISTA.map(s => (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                    (filtroStatus === s
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400')}
                >
                  {s}
                </button>
              ))}
            </div>

            {ordensFiltradas.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-lg">Nenhuma OS encontrada.</p>
            ) : (
              <div className="space-y-3">
                {ordensFiltradas.map(os => (
                  <CardOS key={os.id} os={os} atraso={estaEmAtraso(os)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
