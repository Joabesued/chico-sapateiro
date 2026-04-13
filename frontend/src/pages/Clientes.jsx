import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../api.js'

function formatarData(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('pt-BR')
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/clientes/').then(({ data }) => setClientes(data)).finally(() => setLoading(false))
  }, [])

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.telefone && c.telefone.includes(busca))
  )

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-gray-800">Clientes</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
        <input
          className="input-field pl-10"
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500 text-lg">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="text-center py-10 text-gray-400 text-lg">Nenhum cliente encontrado.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/clientes/${c.id}`)}
              className="card w-full text-left hover:shadow-lg active:scale-[0.99] transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-gray-900">{c.nome}</p>
                  <p className="text-gray-500">{c.telefone || 'Sem telefone'}</p>
                  {c.ultima_os && (
                    <p className="text-sm text-gray-400 mt-0.5">
                      Última OS: {formatarData(c.ultima_os)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-amber-600">{c.total_os}</span>
                  <p className="text-sm text-gray-400">
                    {c.total_os === 1 ? 'ordem' : 'ordens'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
