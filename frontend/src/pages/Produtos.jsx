import { useState, useEffect } from 'react'
import { Package, Plus, X, Check, Trash2, ShoppingCart, AlertTriangle, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api.js'

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function parseMoeda(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

const formVazio = () => ({
  nome: '',
  descricao: '',
  quantidade_estoque: '',
  quantidade_minima: '1',
  preco_custo: '',
  preco_venda: '',
})

export default function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCadastro, setModalCadastro] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState(null)
  const [modalVenda, setModalVenda] = useState(null)
  const [form, setForm] = useState(formVazio())
  const [qtdVenda, setQtdVenda] = useState(1)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const { data } = await api.get('/produtos/')
      setProdutos(data)
    } finally {
      setLoading(false)
    }
  }

  function abrirCadastro() {
    setForm(formVazio())
    setEditandoProduto(null)
    setModalCadastro(true)
  }

  function abrirEdicao(p) {
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      quantidade_estoque: String(p.quantidade_estoque),
      quantidade_minima: String(p.quantidade_minima),
      preco_custo: String(p.preco_custo),
      preco_venda: String(p.preco_venda),
    })
    setEditandoProduto(p)
    setModalCadastro(true)
  }

  async function salvarProduto() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return }
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao,
        quantidade_estoque: parseInt(form.quantidade_estoque) || 0,
        quantidade_minima: parseInt(form.quantidade_minima) || 1,
        preco_custo: parseMoeda(form.preco_custo),
        preco_venda: parseMoeda(form.preco_venda),
      }
      if (editandoProduto) {
        await api.patch(`/produtos/${editandoProduto.id}`, payload)
        toast.success('Produto atualizado!')
      } else {
        await api.post('/produtos/', payload)
        toast.success('Produto cadastrado!')
      }
      setModalCadastro(false)
      setEditandoProduto(null)
      carregar()
    } catch {
      toast.error('Erro ao salvar produto')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarVenda() {
    if (!modalVenda) return
    if (qtdVenda < 1) { toast.error('Quantidade inválida'); return }
    setSalvando(true)
    try {
      await api.post(`/produtos/${modalVenda.id}/venda`, { quantidade: qtdVenda })
      toast.success('Venda registrada!')
      setModalVenda(null)
      setQtdVenda(1)
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao registrar venda')
    } finally {
      setSalvando(false)
    }
  }

  async function deletarProduto(id, nome) {
    if (!confirm(`Excluir o produto "${nome}"?`)) return
    try {
      await api.delete(`/produtos/${id}`)
      toast.success('Produto excluído')
      carregar()
    } catch {
      toast.error('Erro ao excluir produto')
    }
  }

  if (loading) return <p className="text-center py-10 text-gray-500">Carregando...</p>

  const alertas = produtos.filter(p => p.estoque_baixo)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Produtos</h2>
        <button
          onClick={abrirCadastro}
          className="flex items-center gap-2 text-white font-bold py-2 px-4 rounded-xl text-sm"
          style={{ backgroundColor: '#3E1F12' }}
        >
          <Plus size={16} /> Cadastrar
        </button>
      </div>

      {alertas.length > 0 && (
        <div className="rounded-2xl p-3 space-y-1" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }}>
          <p className="font-bold text-sm flex items-center gap-1.5" style={{ color: '#991B1B' }}>
            <AlertTriangle size={16} /> {alertas.length} produto{alertas.length > 1 ? 's' : ''} com estoque baixo
          </p>
          {alertas.map(p => (
            <p key={p.id} className="text-sm pl-6" style={{ color: '#B91C1C' }}>
              {p.nome} — {p.quantidade_estoque} un. (mín. {p.quantidade_minima})
            </p>
          ))}
        </div>
      )}

      {produtos.length === 0 ? (
        <div className="card text-center py-12">
          <Package size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 font-semibold">Nenhum produto cadastrado</p>
          <p className="text-gray-300 text-sm mt-1">Clique em "+ Cadastrar" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {produtos.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-lg" style={{ color: '#1A1A1A' }}>{p.nome}</p>
                    {p.estoque_baixo && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold flex items-center gap-1"
                        style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
                        <AlertTriangle size={10} /> Estoque baixo
                      </span>
                    )}
                  </div>
                  {p.descricao && <p className="text-sm text-gray-400 mt-0.5">{p.descricao}</p>}
                  <div className="flex gap-4 mt-2 flex-wrap text-sm">
                    <span>
                      <span className="text-gray-400">Estoque: </span>
                      <span className={`font-bold ${p.estoque_baixo ? 'text-red-600' : 'text-gray-700'}`}>
                        {p.quantidade_estoque} un.
                      </span>
                    </span>
                    <span>
                      <span className="text-gray-400">Custo: </span>
                      <span className="font-semibold text-gray-700">{formatarValor(p.preco_custo)}</span>
                    </span>
                    <span>
                      <span className="text-gray-400">Venda: </span>
                      <span className="font-bold" style={{ color: '#3E1F12' }}>{formatarValor(p.preco_venda)}</span>
                    </span>
                    <span>
                      <span className="text-gray-400">Margem: </span>
                      <span className={`font-bold ${p.margem > 30 ? 'text-green-600' : p.margem > 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                        {p.margem}%
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => { setModalVenda(p); setQtdVenda(1) }}
                    disabled={p.quantidade_estoque === 0}
                    className="flex items-center gap-1 font-bold py-1.5 px-3 rounded-lg text-sm transition-colors"
                    style={p.quantidade_estoque === 0
                      ? { backgroundColor: '#F3F4F6', color: '#9CA3AF', cursor: 'not-allowed' }
                      : { backgroundColor: '#10B981', color: 'white' }}
                  >
                    <ShoppingCart size={14} /> Vender
                  </button>
                  <button
                    onClick={() => abrirEdicao(p)}
                    className="flex items-center justify-center gap-1 font-bold py-1.5 px-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#F5ECD7', color: '#3E1F12' }}
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    onClick={() => deletarProduto(p.id, p.nome)}
                    className="flex items-center justify-center py-1.5 px-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastrar / Editar */}
      {modalCadastro && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold" style={{ color: '#1A1A1A' }}>
                {editandoProduto ? 'Editar produto' : 'Cadastrar produto'}
              </h3>
              <button onClick={() => setModalCadastro(false)} style={{ color: '#999999' }}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>Nome *</label>
                <input className="input-field" placeholder="Nome do produto"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="block font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>Descrição</label>
                <input className="input-field" placeholder="Descrição opcional"
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>Qtd. em estoque</label>
                  <input className="input-field" type="number" inputMode="numeric" min="0" placeholder="0"
                    value={form.quantidade_estoque}
                    onChange={e => setForm(f => ({ ...f, quantidade_estoque: e.target.value }))} />
                </div>
                <div>
                  <label className="block font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>Qtd. mínima</label>
                  <input className="input-field" type="number" inputMode="numeric" min="1" placeholder="1"
                    value={form.quantidade_minima}
                    onChange={e => setForm(f => ({ ...f, quantidade_minima: e.target.value }))} />
                </div>
                <div>
                  <label className="block font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>Preço de custo (R$)</label>
                  <input className="input-field" inputMode="decimal" placeholder="0,00"
                    value={form.preco_custo}
                    onChange={e => setForm(f => ({ ...f, preco_custo: e.target.value }))} />
                </div>
                <div>
                  <label className="block font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>Preço de venda (R$)</label>
                  <input className="input-field" inputMode="decimal" placeholder="0,00"
                    value={form.preco_venda}
                    onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))} />
                </div>
              </div>
              {parseMoeda(form.preco_venda) > 0 && (
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: '#F5ECD7', color: '#3E1F12' }}>
                  Margem estimada:{' '}
                  <strong>
                    {parseMoeda(form.preco_venda) > 0
                      ? Math.round(((parseMoeda(form.preco_venda) - parseMoeda(form.preco_custo)) / parseMoeda(form.preco_venda)) * 100)
                      : 0}%
                  </strong>
                </div>
              )}
            </div>
            <button onClick={salvarProduto} disabled={salvando}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl mt-4"
              style={{ backgroundColor: '#3E1F12' }}>
              <Check size={20} />
              {salvando ? 'Salvando...' : editandoProduto ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Venda avulsa */}
      {modalVenda && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold" style={{ color: '#1A1A1A' }}>Registrar venda</h3>
              <button onClick={() => setModalVenda(null)} style={{ color: '#999999' }}>
                <X size={24} />
              </button>
            </div>
            <div className="rounded-2xl p-3 mb-4" style={{ backgroundColor: '#F5ECD7', border: '1px solid #E8D5B0' }}>
              <p className="font-bold text-lg" style={{ color: '#3E1F12' }}>{modalVenda.nome}</p>
              <div className="flex gap-4 mt-1 text-sm">
                <span className="text-gray-600">Estoque: <strong>{modalVenda.quantidade_estoque} un.</strong></span>
                <span className="text-gray-600">Valor unit.: <strong>{formatarValor(modalVenda.preco_venda)}</strong></span>
              </div>
            </div>
            <div>
              <label className="block font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Quantidade</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQtdVenda(q => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-xl font-bold text-xl flex items-center justify-center"
                  style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                  −
                </button>
                <input
                  className="input-field text-center font-bold text-xl flex-1"
                  type="number" inputMode="numeric" min="1"
                  max={modalVenda.quantidade_estoque}
                  value={qtdVenda}
                  onChange={e => setQtdVenda(Math.max(1, Math.min(modalVenda.quantidade_estoque, parseInt(e.target.value) || 1)))}
                />
                <button
                  onClick={() => setQtdVenda(q => Math.min(modalVenda.quantidade_estoque, q + 1))}
                  className="w-12 h-12 rounded-xl font-bold text-xl flex items-center justify-center"
                  style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl px-4 py-3 mt-3"
              style={{ backgroundColor: '#D1FAE5' }}>
              <span className="font-semibold text-gray-600">Total da venda</span>
              <span className="font-extrabold text-xl" style={{ color: '#065F46' }}>
                {formatarValor(modalVenda.preco_venda * qtdVenda)}
              </span>
            </div>
            <button
              onClick={confirmarVenda}
              disabled={salvando}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl mt-4"
              style={{ backgroundColor: '#10B981' }}>
              <Check size={20} />
              {salvando ? 'Registrando...' : 'Confirmar venda'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
