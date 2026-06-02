import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../api.js'
import { StatusBadge, STATUS_BAR_COLOR } from '../components/StatusBadge.jsx'

const MESES_COMPLETOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const STATUS_LISTA = ['Todos', 'Em andamento', 'Pronto para retirada', 'Entregue']

function formatarData(dt) {
  if (!dt) return '—'
  const s = String(dt).split('T')[0]
  const [ano, mes, dia] = s.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function resumoServicos(os) {
  if (os.itens.length === 0) return '—'
  if (os.itens.length === 1) {
    const item = os.itens[0]
    const partes = [item.categoria]
    if (item.subcategoria) partes.push(item.subcategoria)
    const svcs = (item.servicos || []).slice(0, 2).join(', ')
    return svcs ? `${partes.join(' — ')} · ${svcs}` : partes.join(' — ')
  }
  return `${os.itens.length} itens: ${os.itens.map(i => i.categoria).join(', ')}`
}

export default function Arquivo() {
  const navigate = useNavigate()
  const [ordens, setOrdens] = useState([])
  const [filtro, setFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ordens/').then(r => setOrdens(r.data)).finally(() => setLoading(false))
  }, [])

  const ordensFiltradas = useMemo(() => {
    return ordens.filter(o => {
      const statusOk = filtro === 'Todos' || o.status === filtro
      const buscaOk = busca === '' ||
        o.cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
        String(o.numero).includes(busca)
      return statusOk && buscaOk
    })
  }, [ordens, filtro, busca])

  const grupos = useMemo(() => {
    const g = {}
    ordensFiltradas.forEach(os => {
      const data = os.criado_em ? new Date(os.criado_em) : new Date()
      const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
      if (!g[key]) g[key] = []
      g[key].push(os)
    })
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a))
  }, [ordensFiltradas])

  function tituloGrupo(key) {
    const [ano, mes] = key.split('-')
    return `${MESES_COMPLETOS[parseInt(mes) - 1]} ${ano}`
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Arquivo de Notas</h2>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={22} style={{ color: '#999999' }} />
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
            onClick={() => setFiltro(s)}
            className="whitespace-nowrap px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
            style={filtro === s
              ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
              : { backgroundColor: 'white', color: '#4B5563', border: '1px solid #F0F0F0' }}
          >
            {s === 'Pronto para retirada' ? 'Pronto' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-10 text-lg" style={{ color: '#999999' }}>Carregando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-center py-10 text-lg" style={{ color: '#999999' }}>Nenhuma OS encontrada.</p>
      ) : (
        <div className="space-y-6">
          {grupos.map(([key, oss]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#999999' }}>
                  {tituloGrupo(key)} · {oss.length} {oss.length === 1 ? 'nota' : 'notas'}
                </h3>
              </div>
              <div className="space-y-2">
                {oss.map(os => (
                  <button
                    key={os.id}
                    onClick={() => navigate(`/os/${os.id}`)}
                    className="w-full text-left hover:shadow-md active:scale-[0.99] transition-all overflow-hidden"
                    style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0', display: 'flex' }}
                  >
                    <div style={{ width: 3, backgroundColor: STATUS_BAR_COLOR[os.status] || '#F0F0F0', borderRadius: '14px 0 0 14px', flexShrink: 0 }} />
                    <div className="flex-1 p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-black text-sm" style={{ color: '#A0522D' }}>
                            #{String(os.numero).padStart(3, '0')}
                          </span>
                          <span className="text-xs" style={{ color: '#999999' }}>{formatarData(os.criado_em)}</span>
                          <StatusBadge status={os.status} />
                        </div>
                        <p className="text-lg font-bold truncate" style={{ color: '#1A1A1A' }}>{os.cliente.nome}</p>
                        <p className="text-sm mt-0.5 truncate" style={{ color: '#999999' }}>{resumoServicos(os)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(os.total)}</p>
                        {os.resta > 0 && (
                          <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                            Resta {formatarValor(os.resta)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
