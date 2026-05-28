import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../api.js'
import { StatusBadge } from '../components/StatusBadge.jsx'

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
      <h2 className="text-2xl font-extrabold text-gray-800">Arquivo de Notas</h2>

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
            onClick={() => setFiltro(s)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
              (filtro === s
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400')}
          >
            {s === 'Pronto para retirada' ? 'Pronto' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10 text-lg">Carregando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-lg">Nenhuma OS encontrada.</p>
      ) : (
        <div className="space-y-6">
          {grupos.map(([key, oss]) => (
            <div key={key}>
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 px-1">
                {tituloGrupo(key)} · {oss.length} {oss.length === 1 ? 'nota' : 'notas'}
              </h3>
              <div className="space-y-2">
                {oss.map(os => (
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
                          <span className="text-xs text-gray-400">{formatarData(os.criado_em)}</span>
                          <StatusBadge status={os.status} />
                        </div>
                        <p className="text-lg font-bold text-gray-900 truncate">{os.cliente.nome}</p>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{resumoServicos(os)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-extrabold text-amber-700">{formatarValor(os.total)}</p>
                        {os.resta > 0 && (
                          <p className="text-xs text-orange-500 font-semibold">
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
