import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api.js'
import StatusBadge, { PagamentoBadge, STATUS_BAR_COLOR } from '../components/StatusBadge.jsx'

function formatarData(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('pt-BR')
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function ClienteDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ordens, setOrdens] = useState([])
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '' })

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    try {
      const { data: ords } = await api.get(`/clientes/${id}/ordens`)
      setOrdens(ords)
      if (ords.length > 0) {
        setCliente(ords[0].cliente)
        setForm({ nome: ords[0].cliente.nome, telefone: ords[0].cliente.telefone || '' })
      } else {
        const { data: todos } = await api.get('/clientes/')
        const c = todos.find(x => String(x.id) === id)
        if (c) { setCliente(c); setForm({ nome: c.nome, telefone: c.telefone || '' }) }
      }
    } catch {
      toast.error('Erro ao carregar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function salvarEdicao() {
    try {
      await api.patch(`/clientes/${id}`, form)
      toast.success('Cliente atualizado!')
      setCliente(c => ({ ...c, ...form }))
      setEditando(false)
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  if (loading) return <p className="text-center py-10 text-lg" style={{ color: '#999999' }}>Carregando...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/clientes')}
          className="p-2 rounded-xl transition-colors hover:bg-gray-100"
          style={{ color: '#3E1F12' }}
        >
          <ArrowLeft size={26} />
        </button>
        <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Histórico do Cliente</h2>
      </div>

      {/* Info do cliente */}
      <div className="card space-y-3">
        {editando ? (
          <>
            <input
              className="input-field"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome"
            />
            <input
              className="input-field"
              value={form.telefone}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="Telefone"
            />
            <div className="flex gap-2">
              <button onClick={salvarEdicao} className="btn-primary flex-1">Salvar</button>
              <button onClick={() => setEditando(false)} className="btn-secondary flex-1">Cancelar</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{cliente?.nome}</p>
                <p className="text-lg" style={{ color: '#999999' }}>{cliente?.telefone || 'Sem telefone'}</p>
              </div>
              <button onClick={() => setEditando(true)} className="btn-secondary text-sm py-2 px-3">
                Editar
              </button>
            </div>
            <p style={{ color: '#999999' }}>{ordens.length} {ordens.length === 1 ? 'ordem' : 'ordens'} no total</p>
          </>
        )}
      </div>

      {/* Ordens */}
      <div className="space-y-3">
        {ordens.length === 0 ? (
          <p className="text-center py-8 text-lg" style={{ color: '#999999' }}>Nenhuma OS encontrada.</p>
        ) : ordens.map(os => (
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
                  <StatusBadge status={os.status} />
                  <PagamentoBadge status={os.status_pagamento} />
                </div>
                <p className="font-semibold text-sm truncate" style={{ color: '#4B5563' }}>
                  {os.itens.length === 1
                    ? `${os.itens[0].categoria} — ${(os.itens[0].servicos || []).join(', ')}`
                    : `${os.itens.length} itens`}
                </p>
                <p className="text-sm" style={{ color: '#999999' }}>{formatarData(os.criado_em)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(os.total)}</p>
                {os.resta > 0 && (
                  <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>Resta {formatarValor(os.resta)}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
