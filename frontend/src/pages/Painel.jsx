import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Calendar, Zap } from 'lucide-react'
import api from '../api.js'
import { StatusBadge, STATUS_BAR_COLOR } from '../components/StatusBadge.jsx'

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

function OSCard({ os, barColor }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/os/${os.id}`)}
      className="w-full text-left hover:shadow-md active:scale-[0.99] transition-all overflow-hidden"
      style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0', display: 'flex' }}
    >
      <div style={{ width: 3, backgroundColor: barColor, borderRadius: '14px 0 0 14px', flexShrink: 0 }} />
      <div className="flex-1 p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-sm" style={{ color: '#A0522D' }}>#{String(os.numero).padStart(3, '0')}</span>
            <StatusBadge status={os.status} />
          </div>
          <p className="text-lg font-bold truncate" style={{ color: '#1A1A1A' }}>{os.cliente.nome}</p>
          <p className="text-sm mt-0.5 truncate" style={{ color: '#999999' }}>{resumoItens(os)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(os.total)}</p>
          {os.resta > 0 && (
            <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Resta {formatarValor(os.resta)}</p>
          )}
        </div>
      </div>
    </button>
  )
}

function abrirWhatsAppAtraso(os, mensagens) {
  if (!os.cliente.telefone) return
  const tel = os.cliente.telefone.replace(/\D/g, '')
  const modelo = mensagens.find(m => m.nome === 'Serviço atrasado')
  const numero = String(os.numero).padStart(3, '0')
  const corpo = modelo
    ? modelo.corpo
        .replace(/\[nome\]/g, os.cliente.nome)
        .replace(/\[numero\]/g, '#' + numero)
        .replace(/\[novo_prazo\]/g, os.prazo_entrega ? os.prazo_entrega.split('T')[0].split('-').reverse().join('/') : 'a confirmar')
    : `Olá ${os.cliente.nome}! Pedimos desculpas pelo atraso no serviço #${numero}. Entraremos em contato em breve. 🥿 Chico Sapateiro`
  window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(corpo)}`, '_blank')
}

function CardAtraso({ os, mensagens }) {
  const navigate = useNavigate()
  const dias = diasAtraso(os)
  const temTel = !!os.cliente.telefone
  return (
    <div
      className="w-full text-left hover:shadow-md transition-all overflow-hidden"
      style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0', display: 'flex' }}
    >
      <div style={{ width: 3, backgroundColor: '#EF4444', borderRadius: '14px 0 0 14px', flexShrink: 0 }} />
      <div className="flex-1 p-4 flex items-start justify-between gap-3">
        <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/os/${os.id}`)}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-sm" style={{ color: '#A0522D' }}>#{String(os.numero).padStart(3, '0')}</span>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              <AlertTriangle size={10} /> Atrasado
            </span>
          </div>
          <p className="text-lg font-bold truncate" style={{ color: '#1A1A1A' }}>{os.cliente.nome}</p>
          <p className="text-sm mt-0.5 truncate" style={{ color: '#999999' }}>{resumoItens(os)}</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: '#EF4444' }}>
            {dias} dia{dias !== 1 ? 's' : ''} em atraso
          </p>
          {temTel && (
            <button
              onClick={e => { e.stopPropagation(); abrirWhatsAppAtraso(os, mensagens) }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1"
              style={{ backgroundColor: '#22c55e', color: 'white' }}
            >
              📨 Avisar cliente
            </button>
          )}
        </button>
        <button className="text-right shrink-0" onClick={() => navigate(`/os/${os.id}`)}>
          <p className="text-lg font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(os.total)}</p>
        </button>
      </div>
    </div>
  )
}

function Secao({ titulo, count, corBadge, corTitulo, icon, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-extrabold text-base" style={{ color: corTitulo }}>{titulo}</h3>
          <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: corBadge }}>
            {count}
          </span>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export default function Painel() {
  const [ordens, setOrdens] = useState([])
  const [mensagens, setMensagens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/ordens/').then(r => r.data),
      api.get('/mensagens/').then(r => r.data).catch(() => []),
    ]).then(([ords, msgs]) => {
      setOrdens(ords)
      setMensagens(msgs)
    }).finally(() => setLoading(false))
  }, [])

  const urgentes = ordens.filter(o => o.urgente && o.status !== 'Entregue')
  const emAtraso = ordens.filter(o => estaEmAtraso(o))
  const notasHoje = ordens.filter(o => foiCriadaHoje(o))
  const prazoHoje = ordens.filter(o => temPrazoHoje(o) && !foiCriadaHoje(o))

  const abertas = ordens.filter(o => o.status !== 'Entregue').length
  const prontas = ordens.filter(o => o.status === 'Pronto para retirada').length

  if (loading) return <p className="text-center py-10 text-lg" style={{ color: '#999999' }}>Carregando...</p>

  const semNada = urgentes.length === 0 && emAtraso.length === 0 && notasHoje.length === 0 && prazoHoje.length === 0

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Painel</h2>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center p-4">
          <div className="w-2 h-2 rounded-full mx-auto mb-2" style={{ backgroundColor: '#F59E0B' }} />
          <p className="text-3xl font-black" style={{ color: '#1A1A1A' }}>{abertas}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#999999' }}>Abertas</p>
        </div>
        <div className="card text-center p-4">
          <div className="w-2 h-2 rounded-full mx-auto mb-2" style={{ backgroundColor: '#EF4444' }} />
          <p className="text-3xl font-black" style={{ color: emAtraso.length > 0 ? '#EF4444' : '#1A1A1A' }}>{emAtraso.length}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#999999' }}>Atraso</p>
        </div>
        <div className="card text-center p-4">
          <div className="w-2 h-2 rounded-full mx-auto mb-2" style={{ backgroundColor: '#10B981' }} />
          <p className="text-3xl font-black" style={{ color: '#1A1A1A' }}>{prontas}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#999999' }}>Prontas</p>
        </div>
      </div>

      {semNada && (
        <div className="card text-center py-10">
          <p className="text-4xl">🥿</p>
          <p className="font-semibold mt-2" style={{ color: '#999999' }}>Nenhuma atividade para hoje</p>
          <p className="text-sm mt-1" style={{ color: '#999999' }}>Veja todas as notas no Arquivo</p>
        </div>
      )}

      {urgentes.length > 0 && (
        <Secao
          titulo="Urgentes"
          count={urgentes.length}
          corBadge="#DC2626"
          corTitulo="#DC2626"
          icon={<Zap size={16} color="#DC2626" />}
        >
          {urgentes.map(os => <OSCard key={os.id} os={os} barColor="#DC2626" />)}
        </Secao>
      )}

      {emAtraso.length > 0 && (
        <Secao
          titulo="Em atraso"
          count={emAtraso.length}
          corBadge="#EF4444"
          corTitulo="#EF4444"
          icon={<AlertTriangle size={16} color="#EF4444" />}
        >
          {emAtraso.map(os => <CardAtraso key={os.id} os={os} mensagens={mensagens} />)}
        </Secao>
      )}

      {notasHoje.length > 0 && (
        <Secao
          titulo="Notas de hoje"
          count={notasHoje.length}
          corBadge="#A0522D"
          corTitulo="#A0522D"
          icon={<Clock size={16} color="#A0522D" />}
        >
          {notasHoje.map(os => (
            <OSCard key={os.id} os={os} barColor={STATUS_BAR_COLOR[os.status] || '#F0F0F0'} />
          ))}
        </Secao>
      )}

      {prazoHoje.length > 0 && (
        <Secao
          titulo="Prazo hoje"
          count={prazoHoje.length}
          corBadge="#F59E0B"
          corTitulo="#92400E"
          icon={<Calendar size={16} color="#F59E0B" />}
        >
          {prazoHoje.map(os => (
            <OSCard key={os.id} os={os} barColor={STATUS_BAR_COLOR[os.status] || '#F0F0F0'} />
          ))}
        </Secao>
      )}
    </div>
  )
}
