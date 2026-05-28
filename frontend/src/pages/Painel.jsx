import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Calendar } from 'lucide-react'
import api from '../api.js'
import { StatusBadge } from '../components/StatusBadge.jsx'

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function estaEmAtraso(os) {
  if (!os.prazo_entrega) return false
  if (os.status === 'Pronto para retirada' || os.status === 'Entregue') return false
  return String(os.prazo_entrega).split('T')[0] < hojeISO()
}

function foiCriadaHoje(os) {
  if (!os.criado_em) return false
  const criado = new Date(os.criado_em)
  const d = `${criado.getFullYear()}-${String(criado.getMonth() + 1).padStart(2, '0')}-${String(criado.getDate()).padStart(2, '0')}`
  return d === hojeISO()
}

function temPrazoHoje(os) {
  if (!os.prazo_entrega) return false
  if (os.status === 'Entregue') return false
  return String(os.prazo_entrega).split('T')[0] === hojeISO()
}

function diasAtraso(os) {
  if (!os.prazo_entrega) return 0
  const prazo = new Date(String(os.prazo_entrega).split('T')[0] + 'T12:00:00')
  const hoje = new Date(hojeISO() + 'T12:00:00')
  return Math.floor((hoje - prazo) / (1000 * 60 * 60 * 24))
}

function tempoRelativo(dt) {
  if (!dt) return ''
  const diff = Date.now() - new Date(dt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min atrás`
  const horas = Math.floor(mins / 60)
  if (horas < 24) return `${horas}h atrás`
  return `${Math.floor(horas / 24)}d atrás`
}

function resumoItens(os) {
  if (os.itens.length === 0) return '—'
  if (os.itens.length === 1) {
    const item = os.itens[0]
    const partes = [item.categoria]
    if (item.subcategoria) partes.push(item.subcategoria)
    const svcs = (item.servicos || []).slice(0, 2).join(', ')
    return svcs ? `${partes.join(' — ')} · ${svcs}` : partes.join(' — ')
  }
  return `${os.itens.length} itens`
}

function CardAtraso({ os }) {
  const navigate = useNavigate()
  const dias = diasAtraso(os)
  return (
    <button
      onClick={() => navigate(`/os/${os.id}`)}
      className="card w-full text-left hover:shadow-lg active:scale-[0.99] transition-all border-l-4 border-red-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-amber-700 font-black text-sm">#{String(os.numero).padStart(3, '0')}</span>
            <span className="inline-flex items-center gap-1 bg-red-600 text-white rounded-lg px-2 py-0.5 text-xs font-extrabold">
              <AlertTriangle size={11} /> Atrasado
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">{os.cliente.nome}</p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{resumoItens(os)}</p>
          <p className="text-sm text-red-600 font-semibold mt-0.5">
            {dias} dia{dias !== 1 ? 's' : ''} em atraso
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold text-amber-700">{formatarValor(os.total)}</p>
        </div>
      </div>
    </button>
  )
}

function CardHoje({ os }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/os/${os.id}`)}
      className="card w-full text-left hover:shadow-lg active:scale-[0.99] transition-all border-l-4"
      style={{ borderLeftColor: '#A0522D' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-amber-700 font-black text-sm">#{String(os.numero).padStart(3, '0')}</span>
            <span className="text-xs text-gray-400">{tempoRelativo(os.criado_em)}</span>
            <StatusBadge status={os.status} />
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">{os.cliente.nome}</p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{resumoItens(os)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold text-amber-700">{formatarValor(os.total)}</p>
          {os.resta > 0 && (
            <p className="text-xs text-orange-500 font-semibold">Resta {formatarValor(os.resta)}</p>
          )}
        </div>
      </div>
    </button>
  )
}

function CardPrazoHoje({ os }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/os/${os.id}`)}
      className="card w-full text-left hover:shadow-lg active:scale-[0.99] transition-all border-l-4 border-orange-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-amber-700 font-black text-sm">#{String(os.numero).padStart(3, '0')}</span>
            <StatusBadge status={os.status} />
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">{os.cliente.nome}</p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{resumoItens(os)}</p>
        </div>
      </div>
    </button>
  )
}

export default function Painel() {
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ordens/').then(r => setOrdens(r.data)).finally(() => setLoading(false))
  }, [])

  const emAtraso = ordens.filter(o => estaEmAtraso(o))
  const notasHoje = ordens.filter(o => foiCriadaHoje(o))
  const prazoHoje = ordens.filter(o => temPrazoHoje(o) && !foiCriadaHoje(o))

  if (loading) return <p className="text-center text-gray-500 py-10 text-lg">Carregando...</p>

  const semNada = emAtraso.length === 0 && notasHoje.length === 0 && prazoHoje.length === 0

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold text-gray-800">Painel</h2>

      {semNada && (
        <div className="card text-center py-10">
          <p className="text-4xl">🥿</p>
          <p className="text-gray-500 mt-2 font-semibold">Nenhuma atividade para hoje</p>
          <p className="text-gray-400 text-sm mt-1">Veja todas as notas no Arquivo</p>
        </div>
      )}

      {/* Seção 1: Em atraso */}
      {emAtraso.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600" />
            <h3 className="font-extrabold text-red-700 text-base flex items-center gap-2">
              Em atraso
              <span className="bg-red-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">
                {emAtraso.length}
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {emAtraso.map(os => <CardAtraso key={os.id} os={os} />)}
          </div>
        </div>
      )}

      {/* Seção 2: Notas de hoje */}
      {notasHoje.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={18} style={{ color: '#A0522D' }} />
            <h3 className="font-extrabold text-base flex items-center gap-2" style={{ color: '#A0522D' }}>
              Notas de hoje
              <span className="text-white rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: '#A0522D' }}>
                {notasHoje.length}
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {notasHoje.map(os => <CardHoje key={os.id} os={os} />)}
          </div>
        </div>
      )}

      {/* Seção 3: Prazo hoje */}
      {prazoHoje.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-orange-500" />
            <h3 className="font-extrabold text-orange-600 text-base flex items-center gap-2">
              Prazo hoje
              <span className="bg-orange-500 text-white rounded-full px-2 py-0.5 text-xs font-bold">
                {prazoHoje.length}
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {prazoHoje.map(os => <CardPrazoHoje key={os.id} os={os} />)}
          </div>
        </div>
      )}
    </div>
  )
}
