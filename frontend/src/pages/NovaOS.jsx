import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, Check, X, UserCheck } from 'lucide-react'
import api from '../api.js'
import SeletorPrazo from '../components/SeletorPrazo.jsx'

// ─── Constantes ────────────────────────────────────────────────────────────────

const SERVICOS = [
  'Retocar', 'Pintar', 'Solado', 'Protetor', 'Capa fixa',
  'Colagem', 'Costura', 'Trocar carrinho (mala)', 'Trocar roda',
  'Alça', 'Cabeçote', 'Ziper', 'Puxador',
]

// ─── Utilitários ───────────────────────────────────────────────────────────────

function parseMoeda(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function itemVazio() {
  return { categoria: '', servicos: [], qtd_rodas: 2, cor: '', descricao: '', valor: '' }
}

// ─── Sub-componente: editor de um item ─────────────────────────────────────────

function ItemEditor({ item, idx, total, categorias, onSet, onRemove, onAddCategoria }) {
  const [novaCategoriaModo, setNovaCategoriaModo] = useState(false)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')

  function toggleServico(s) {
    const tem = item.servicos.includes(s)
    onSet('servicos', tem ? item.servicos.filter(x => x !== s) : [...item.servicos, s])
  }

  async function salvarNovaCategoria() {
    const nome = novaCategoriaNome.trim()
    if (!nome) return
    const ok = await onAddCategoria(nome)
    if (ok) {
      onSet('categoria', nome)
      setNovaCategoriaNome('')
      setNovaCategoriaModo(false)
    }
  }

  const temTrocarRoda = item.servicos.includes('Trocar roda')

  return (
    <div className="border-2 border-gray-200 rounded-2xl p-4 space-y-4">

      {/* Cabeçalho do item */}
      <div className="flex items-center justify-between">
        <span className="font-black text-amber-700 text-base">Item {idx + 1}</span>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 p-1">
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {/* Categoria */}
      <div>
        <label className="block font-bold text-gray-700 mb-2">Categoria *</label>
        <div className="flex flex-wrap gap-2">
          {categorias.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => onSet('categoria', cat)}
              className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                (item.categoria === cat
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}
            >
              {cat}
            </button>
          ))}

          {/* Botão nova categoria */}
          {!novaCategoriaModo ? (
            <button
              type="button"
              onClick={() => setNovaCategoriaModo(true)}
              className="px-3 py-2 rounded-xl font-semibold text-sm border-2 border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 flex items-center gap-1"
            >
              <Plus size={14} /> Nova categoria
            </button>
          ) : (
            <div className="flex items-center gap-1 w-full mt-1">
              <input
                autoFocus
                className="input-field flex-1 py-2 text-sm"
                placeholder="Nome da categoria"
                value={novaCategoriaNome}
                onChange={e => setNovaCategoriaNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarNovaCategoria() } }}
              />
              <button type="button" onClick={salvarNovaCategoria}
                className="bg-amber-600 text-white p-2 rounded-xl hover:bg-amber-700">
                <Check size={18} />
              </button>
              <button type="button" onClick={() => { setNovaCategoriaModo(false); setNovaCategoriaNome('') }}
                className="bg-gray-100 text-gray-600 p-2 rounded-xl hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Serviços */}
      <div>
        <label className="block font-bold text-gray-700 mb-2">Serviços * <span className="font-normal text-gray-400 text-sm">(selecione um ou mais)</span></label>
        <div className="flex flex-wrap gap-2">
          {SERVICOS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleServico(s)}
              className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                (item.servicos.includes(s)
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Qtd. rodas */}
        {temTrocarRoda && (
          <div className="mt-3 flex items-center gap-3">
            <span className="font-semibold text-gray-700 text-sm">Quantidade de rodas:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSet('qtd_rodas', n)}
                  className={`w-10 h-10 rounded-xl font-bold text-base border-2 transition-colors ` +
                    (item.qtd_rodas === n
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cor + Valor */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-bold text-gray-700 mb-1">Cor do material</label>
          <input
            className="input-field"
            type="text"
            placeholder="Ex: Preto, Marrom..."
            value={item.cor}
            onChange={e => onSet('cor', e.target.value)}
          />
        </div>
        <div>
          <label className="block font-bold text-gray-700 mb-1">Valor (R$) *</label>
          <input
            className="input-field font-bold"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={item.valor}
            onChange={e => onSet('valor', e.target.value)}
          />
        </div>
      </div>

      {/* Descrição livre */}
      <div>
        <label className="block font-bold text-gray-700 mb-1">
          Observação <span className="font-normal text-gray-400 text-sm">(opcional)</span>
        </label>
        <input
          className="input-field"
          type="text"
          placeholder="Detalhes adicionais..."
          value={item.descricao}
          onChange={e => onSet('descricao', e.target.value)}
        />
      </div>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function NovaOS() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState([])

  // Cliente
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(false)

  // Autocomplete
  const [todosClientes, setTodosClientes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const blurTimer = useRef(null)

  const [itens, setItens] = useState([itemVazio()])
  const [prazo, setPrazo] = useState('')
  const [entrada, setEntrada] = useState('')

  useEffect(() => {
    api.get('/categorias/').then(r => setCategorias(r.data.map(c => c.nome))).catch(() => {})
    api.get('/clientes/').then(r => setTodosClientes(r.data)).catch(() => {})
  }, [])

  // Filtra sugestões: por nome ou telefone (dígitos)
  const busca = clienteNome.trim().toLowerCase()
  const buscaDig = clienteNome.replace(/\D/g, '')
  const sugestoes = busca.length < 1 ? [] : todosClientes.filter(c => {
    const nomeBate = c.nome.toLowerCase().includes(busca)
    const telBate = buscaDig.length >= 2 && c.telefone && c.telefone.replace(/\D/g, '').includes(buscaDig)
    return nomeBate || telBate
  }).slice(0, 7)

  function selecionarCliente(c) {
    setClienteNome(c.nome)
    setClienteTelefone(c.telefone || '')
    setClienteSelecionado(true)
    setMostrarSugestoes(false)
  }

  function handleNomeChange(e) {
    setClienteNome(e.target.value)
    setClienteSelecionado(false)
    setMostrarSugestoes(true)
  }

  function handleNomeFocus() {
    clearTimeout(blurTimer.current)
    setMostrarSugestoes(true)
  }

  function handleNomeBlur() {
    // Delay para permitir o clique na sugestão antes de fechar
    blurTimer.current = setTimeout(() => setMostrarSugestoes(false), 180)
  }

  function setItem(idx, campo, valor) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  async function addCategoria(nome) {
    try {
      await api.post('/categorias/', { nome })
      const r = await api.get('/categorias/')
      setCategorias(r.data.map(c => c.nome))
      toast.success(`Categoria "${nome}" criada!`)
      return true
    } catch (err) {
      if (err.response?.status === 409) toast.error('Essa categoria já existe.')
      else toast.error('Erro ao criar categoria.')
      return false
    }
  }

  const total = itens.reduce((s, it) => s + parseMoeda(it.valor), 0)
  const entradaNum = parseMoeda(entrada)
  const resta = Math.max(0, total - entradaNum)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!clienteNome.trim()) { toast.error('Informe o nome do cliente'); return }

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      if (!it.categoria) { toast.error(`Item ${i + 1}: selecione a categoria`); return }
      if (it.servicos.length === 0) { toast.error(`Item ${i + 1}: selecione pelo menos um serviço`); return }
      if (!it.valor || parseMoeda(it.valor) <= 0) { toast.error(`Item ${i + 1}: informe o valor`); return }
    }

    setLoading(true)
    try {
      const payload = {
        cliente_nome: clienteNome.trim(),
        cliente_telefone: clienteTelefone.trim() || null,
        prazo_entrega: prazo || null,
        entrada: entradaNum,
        itens: itens.map(it => ({
          categoria: it.categoria,
          servicos: it.servicos,
          qtd_rodas: it.servicos.includes('Trocar roda') ? it.qtd_rodas : null,
          cor: it.cor.trim(),
          descricao: it.descricao.trim(),
          valor: parseMoeda(it.valor),
        })),
      }
      const { data } = await api.post('/ordens/', payload)
      toast.success(`Nota #${String(data.numero).padStart(3, '0')} criada!`)
      navigate(`/os/${data.id}`)
    } catch {
      toast.error('Erro ao criar OS. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-gray-800">Nova Ordem de Serviço</h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Cliente ── */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Cliente</h3>

          {/* Nome com autocomplete */}
          <div className="relative">
            <label className="block font-bold text-gray-700 mb-1">
              Nome do cliente *
              {clienteSelecionado && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-semibold text-sm">
                  <UserCheck size={15} /> Cliente existente
                </span>
              )}
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="Digite o nome ou telefone para buscar..."
              value={clienteNome}
              onChange={handleNomeChange}
              onFocus={handleNomeFocus}
              onBlur={handleNomeBlur}
              autoComplete="off"
            />

            {/* Dropdown de sugestões */}
            {mostrarSugestoes && sugestoes.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-amber-300 rounded-xl shadow-xl overflow-hidden">
                {sugestoes.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={() => selecionarCliente(c)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 active:bg-amber-100 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0"
                    >
                      <span className="font-bold text-gray-900">{c.nome}</span>
                      <span className="text-gray-400 text-sm shrink-0">
                        {c.telefone || 'sem telefone'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Telefone */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
            <input
              className="input-field"
              type="tel"
              placeholder="(11) 99999-9999"
              value={clienteTelefone}
              onChange={e => { setClienteTelefone(e.target.value); setClienteSelecionado(false) }}
            />
          </div>
        </div>

        {/* ── Itens ── */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Itens</h3>

          {itens.map((item, idx) => (
            <ItemEditor
              key={idx}
              item={item}
              idx={idx}
              total={itens.length}
              categorias={categorias}
              onSet={(campo, valor) => setItem(idx, campo, valor)}
              onRemove={() => setItens(p => p.filter((_, i) => i !== idx))}
              onAddCategoria={addCategoria}
            />
          ))}

          <button
            type="button"
            onClick={() => setItens(p => [...p, itemVazio()])}
            className="w-full border-2 border-dashed border-amber-400 text-amber-700 font-bold py-3 rounded-xl hover:bg-amber-50 flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Adicionar item
          </button>
        </div>

        {/* ── Prazo de entrega ── */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2 mb-4">Prazo de entrega</h3>
          <SeletorPrazo value={prazo} onChange={setPrazo} />
        </div>

        {/* ── Pagamento ── */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Pagamento</h3>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-gray-500 text-sm font-semibold">Total</p>
              <p className="font-extrabold text-amber-700 text-xl">{formatarValor(total)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-gray-500 text-sm font-semibold">Entrada</p>
              <p className="font-extrabold text-green-700 text-xl">{formatarValor(entradaNum)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-gray-500 text-sm font-semibold">Resta</p>
              <p className="font-extrabold text-orange-600 text-xl">{formatarValor(resta)}</p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Entrada recebida (R$)</label>
            <input
              className="input-field text-xl font-bold"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={entrada}
              onChange={e => setEntrada(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full text-xl py-4">
          {loading ? 'Salvando...' : 'Criar Ordem de Serviço'}
        </button>
      </form>
    </div>
  )
}
