import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
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

export default function Painel() {
  const [ordens, setOrdens] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { carregarOrdens() }, [filtroStatus])

  async function carregarOrdens() {
    setLoading(true)
    try {
      const params = filtroStatus !== 'Todos' ? { status: filtroStatus } : {}
      const { data } = await api.get('/ordens/', { params })
      setOrdens(data)
    } finally {
      setLoading(false)
    }
  }

  const ordensFiltradas = ordens.filter(o =>
    busca === '' ||
    o.cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
    String(o.numero).includes(busca)
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

      {/* Filtros */}
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

      {/* Lista */}
      {loading ? (
        <p className="text-center text-gray-500 py-10 text-lg">Carregando...</p>
      ) : ordensFiltradas.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-lg">Nenhuma OS encontrada.</p>
      ) : (
        <div className="space-y-3">
          {ordensFiltradas.map(os => {
            const resumo = os.itens.length === 1
              ? `${os.itens[0].categoria} — ${(os.itens[0].servicos || []).join(', ')}`
              : `${os.itens.length} itens`

            return (
              <button
                key={os.id}
                onClick={() => navigate(`/os/${os.id}`)}
                className="card w-full text-left hover:shadow-lg active:scale-[0.99] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-amber-700 font-black text-sm">
                        #{String(os.numero).padStart(3, '0')}
                      </span>
                      <StatusBadge status={os.status} />
                      <PagamentoBadge status={os.status_pagamento} />
                    </div>
                    <p className="text-xl font-bold text-gray-900 truncate">{os.cliente.nome}</p>
                    <p className="text-gray-500 text-sm mt-0.5 truncate">{resumo}</p>
                    {os.prazo_entrega && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        Prazo: {formatarData(os.prazo_entrega)}
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
          })}
        </div>
      )}
    </div>
  )
}
