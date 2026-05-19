import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Trash2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api.js'

function formatarData(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('pt-BR')
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [novoModo, setNovoModo] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [removendoId, setRemovendoId] = useState(null)
  const navigate = useNavigate()

  function carregar() {
    return api.get('/clientes/').then(({ data }) => setClientes(data))
  }

  useEffect(() => {
    carregar().finally(() => setLoading(false))
  }, [])

  async function criarCliente() {
    if (!novoNome.trim()) { toast.error('Informe o nome do cliente'); return }
    setSalvando(true)
    try {
      await api.post('/clientes/', { nome: novoNome.trim(), telefone: novoTelefone.trim() || null })
      await carregar()
      setNovoNome('')
      setNovoTelefone('')
      setNovoModo(false)
      toast.success('Cliente cadastrado!')
    } catch {
      toast.error('Erro ao cadastrar cliente.')
    } finally {
      setSalvando(false)
    }
  }

  async function removerCliente(e, id) {
    e.stopPropagation()
    if (!window.confirm('Remover este cliente? (Clientes com OS vinculadas não podem ser removidos)')) return
    setRemovendoId(id)
    try {
      await api.delete(`/clientes/${id}`)
      setClientes(prev => prev.filter(c => c.id !== id))
      toast.success('Cliente removido.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erro ao remover cliente.'
      toast.error(msg)
    } finally {
      setRemovendoId(null)
    }
  }

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.telefone && c.telefone.includes(busca))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-gray-800">Clientes</h2>
        <button
          onClick={() => setNovoModo(m => !m)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-colors ` +
            (novoModo
              ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700')}
        >
          {novoModo ? <X size={16} /> : <Plus size={16} />}
          {novoModo ? 'Cancelar' : 'Novo cliente'}
        </button>
      </div>

      {/* Formulário de cadastro */}
      {novoModo && (
        <div className="card space-y-3 border-2 border-amber-300">
          <h3 className="font-bold text-gray-700">Cadastrar novo cliente</h3>
          <input
            className="input-field"
            type="text"
            placeholder="Nome do cliente *"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') criarCliente() }}
            autoFocus
          />
          <input
            className="input-field"
            type="tel"
            placeholder="Telefone / WhatsApp (opcional)"
            value={novoTelefone}
            onChange={e => setNovoTelefone(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') criarCliente() }}
          />
          <button
            onClick={criarCliente}
            disabled={salvando}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Check size={18} /> {salvando ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      )}

      {/* Busca */}
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
            <div
              key={c.id}
              className="card hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer"
              onClick={() => navigate(`/clientes/${c.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-gray-900">{c.nome}</p>
                  <p className="text-gray-500">{c.telefone || 'Sem telefone'}</p>
                  {c.ultima_os && (
                    <p className="text-sm text-gray-400 mt-0.5">
                      Última OS: {formatarData(c.ultima_os)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-2">
                  <div className="text-right">
                    <span className="text-3xl font-black text-amber-600">{c.total_os}</span>
                    <p className="text-sm text-gray-400">{c.total_os === 1 ? 'ordem' : 'ordens'}</p>
                  </div>
                  <button
                    onClick={e => removerCliente(e, c.id)}
                    disabled={removendoId === c.id}
                    className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                    title="Remover cliente"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
