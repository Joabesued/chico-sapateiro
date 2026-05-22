import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, Check, X, UserCheck, Mic, MicOff, Camera, Edit2 } from 'lucide-react'
import api from '../api.js'
import SeletorPrazo from '../components/SeletorPrazo.jsx'

const CATEGORIAS_BASE = new Set([
  'Sapato social', 'Tênis', 'Sapatênis', 'Mocassins', 'Sandália',
  'Mala', 'Cinto', 'Bolsa', 'Capa de prancha', 'Carteira',
])

// ─── Constantes ────────────────────────────────────────────────────────────────

const SERVICOS = [
  'Retocar', 'Pintar', 'Solado', 'Protetor', 'Capa fixa',
  'Colagem', 'Costura', 'Trocar carrinho (mala)', 'Trocar roda',
  'Alça', 'Cabeçote', 'Ziper', 'Puxador',
]

const CALCADOS = ['Sapato social', 'Tênis', 'Sapatênis', 'Mocassins', 'Sandália']
const LADOS = ['Par', 'Pé esquerdo', 'Pé direito']
const SUBCATEGORIAS_SANDALIA = ['Rasteira', 'Com salto']
const MALA_TAMANHOS = ['Pequena', 'Média', 'Grande']
const MALA_MATERIAIS = ['Fibra', 'Tecido']

const VOZ_SUPORTADA = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

function ehCalcado(cat) { return CALCADOS.includes(cat) }
function ehMala(cat) { return cat === 'Mala' }

// ─── Utilitários ───────────────────────────────────────────────────────────────

function parseMoeda(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function itemVazio() {
  return {
    categoria: '',
    subcategoria: '',
    lado: '',
    servicos: [],
    qtd_rodas: 2,
    cor: '',
    descricao: '',
    observacao_servico: '',
    valor: '',
    foto_url: '',
  }
}

async function uploadFotoSupabase(file) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    toast.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para upload de fotos.')
    return null
  }
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const res = await fetch(`${supabaseUrl}/storage/v1/object/os-fotos/${fileName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) throw new Error(await res.text())
  return `${supabaseUrl}/storage/v1/object/public/os-fotos/${fileName}`
}

// ─── Sub-componente: editor de um item ─────────────────────────────────────────

function ItemEditor({ item, categorias, onSet, onConfirm, onCancel, onAddCategoria, onDeleteCategoria, modoEdicao }) {
  const [novaCategoriaModo, setNovaCategoriaModo] = useState(false)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [servicoCustomModo, setServicoCustomModo] = useState(false)
  const [servicoCustomTexto, setServicoCustomTexto] = useState('')
  const [gravando, setGravando] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const recognitionRef = useRef(null)
  const fotoInputRef = useRef(null)

  function toggleServico(s) {
    const tem = item.servicos.includes(s)
    onSet('servicos', tem ? item.servicos.filter(x => x !== s) : [...item.servicos, s])
  }

  function adicionarServicoCustom() {
    const nome = servicoCustomTexto.trim()
    if (!nome) return
    if (item.servicos.includes(nome)) { toast.error('Esse serviço já está na lista.'); return }
    onSet('servicos', [...item.servicos, nome])
    setServicoCustomTexto('')
    setServicoCustomModo(false)
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

  function iniciarVoz() {
    if (!VOZ_SUPORTADA) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = false
    r.onresult = (e) => {
      const texto = e.results[0][0].transcript
      onSet('observacao_servico', (item.observacao_servico ? item.observacao_servico + ' ' : '') + texto)
      setGravando(false)
    }
    r.onerror = () => setGravando(false)
    r.onend = () => setGravando(false)
    r.start()
    recognitionRef.current = r
    setGravando(true)
  }

  function pararVoz() {
    recognitionRef.current?.stop()
    setGravando(false)
  }

  async function handleFotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Foto maior que 5MB. Escolha uma menor.'); return }
    if (!['image/jpeg', 'image/png'].includes(file.type)) { toast.error('Use JPG ou PNG.'); return }
    setUploadandoFoto(true)
    try {
      const url = await uploadFotoSupabase(file)
      if (url) { onSet('foto_url', url); toast.success('Foto adicionada!') }
    } catch {
      toast.error('Erro ao fazer upload da foto.')
    } finally {
      setUploadandoFoto(false)
      e.target.value = ''
    }
  }

  const temTrocarRoda = item.servicos.includes('Trocar roda')
  const calcado = ehCalcado(item.categoria)
  const ehSandalia = item.categoria === 'Sandália'
  const mala = ehMala(item.categoria)
  const servicosCustom = item.servicos.filter(s => !SERVICOS.includes(s))

  return (
    <div className="border-2 border-amber-400 rounded-2xl p-4 space-y-4 bg-amber-50">
      <span className="font-black text-amber-700 text-base">
        {modoEdicao ? 'Editando item' : 'Novo item'}
      </span>

      {/* Categoria */}
      <div>
        <label className="block font-bold text-gray-700 mb-2">Categoria *</label>
        <div className="flex flex-wrap gap-2">
          {categorias.map(catObj => {
            const cat = catObj.nome
            const isBase = CATEGORIAS_BASE.has(cat)
            const ativa = item.categoria === cat
            return (
              <div key={catObj.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    const oldIsMala = ehMala(item.categoria)
                    const newIsMala = ehMala(cat)
                    const newIsCalcado = ehCalcado(cat)
                    onSet('categoria', cat)
                    if (cat !== 'Sandália') onSet('subcategoria', '')
                    if (oldIsMala || newIsMala || (!newIsCalcado && !newIsMala)) onSet('lado', '')
                  }}
                  className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                    (ativa
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400') +
                    (!isBase ? ' pr-7' : '')}
                >
                  {cat}
                </button>
                {!isBase && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onDeleteCategoria(catObj.id, cat) }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir categoria"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
          {!novaCategoriaModo ? (
            <button
              type="button"
              onClick={() => setNovaCategoriaModo(true)}
              className="px-3 py-2 rounded-xl font-semibold text-sm border-2 border-dashed border-amber-400 text-amber-700 hover:bg-white flex items-center gap-1"
            >
              <Plus size={14} /> Nova
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
                className="bg-amber-600 text-white p-2 rounded-xl hover:bg-amber-700"><Check size={18} /></button>
              <button type="button" onClick={() => { setNovaCategoriaModo(false); setNovaCategoriaNome('') }}
                className="bg-gray-100 text-gray-600 p-2 rounded-xl hover:bg-gray-200"><X size={18} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Calçado — qual peça (vem antes das subcategorias) */}
      {calcado && (
        <div>
          <label className="block font-bold text-gray-700 mb-2">Qual peça? *</label>
          <div className="flex flex-wrap gap-2">
            {LADOS.map(l => (
              <button key={l} type="button" onClick={() => onSet('lado', l)}
                className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                  (item.lado === l
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sandália — tipo (vem após qual peça) */}
      {ehSandalia && (
        <div>
          <label className="block font-bold text-gray-700 mb-2">Tipo de sandália *</label>
          <div className="flex flex-wrap gap-2">
            {SUBCATEGORIAS_SANDALIA.map(sc => (
              <button key={sc} type="button" onClick={() => onSet('subcategoria', sc)}
                className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                  (item.subcategoria === sc
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                {sc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mala */}
      {mala && (
        <>
          <div>
            <label className="block font-bold text-gray-700 mb-2">Tamanho *</label>
            <div className="flex flex-wrap gap-2">
              {MALA_TAMANHOS.map(t => (
                <button key={t} type="button" onClick={() => onSet('subcategoria', t)}
                  className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                    (item.subcategoria === t
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-2">Material *</label>
            <div className="flex flex-wrap gap-2">
              {MALA_MATERIAIS.map(m => (
                <button key={m} type="button" onClick={() => onSet('lado', m)}
                  className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                    (item.lado === m
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Serviços */}
      <div>
        <label className="block font-bold text-gray-700 mb-2">
          Serviços * <span className="font-normal text-gray-400 text-sm">(selecione um ou mais)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SERVICOS.map(s => (
            <button key={s} type="button" onClick={() => toggleServico(s)}
              className={`px-3 py-2 rounded-xl font-semibold text-sm border-2 transition-colors ` +
                (item.servicos.includes(s)
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
              {s}
            </button>
          ))}
          {servicosCustom.map(s => (
            <button key={s} type="button" onClick={() => toggleServico(s)}
              className="px-3 py-2 rounded-xl font-semibold text-sm border-2 bg-amber-600 text-white border-amber-600 flex items-center gap-1">
              {s} <X size={14} />
            </button>
          ))}
          {!servicoCustomModo ? (
            <button type="button" onClick={() => setServicoCustomModo(true)}
              className="px-3 py-2 rounded-xl font-semibold text-sm border-2 border-dashed border-amber-400 text-amber-700 hover:bg-white flex items-center gap-1">
              <Plus size={14} /> Adicionar serviço
            </button>
          ) : (
            <div className="flex items-center gap-1 w-full mt-1">
              <input
                autoFocus
                className="input-field flex-1 py-2 text-sm"
                placeholder="Nome do serviço personalizado"
                value={servicoCustomTexto}
                onChange={e => setServicoCustomTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarServicoCustom() } }}
              />
              <button type="button" onClick={adicionarServicoCustom}
                className="bg-amber-600 text-white p-2 rounded-xl hover:bg-amber-700"><Check size={18} /></button>
              <button type="button" onClick={() => { setServicoCustomModo(false); setServicoCustomTexto('') }}
                className="bg-gray-100 text-gray-600 p-2 rounded-xl hover:bg-gray-200"><X size={18} /></button>
            </div>
          )}
        </div>

        {/* Qtd. rodas */}
        {temTrocarRoda && (
          <div className="mt-3 flex items-center gap-3">
            <span className="font-semibold text-gray-700 text-sm">Quantidade de rodas:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" onClick={() => onSet('qtd_rodas', n)}
                  className={`w-10 h-10 rounded-xl font-bold text-base border-2 transition-colors ` +
                    (item.qtd_rodas === n
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Observação com voz */}
        <div className="mt-3">
          <label className="block font-bold text-gray-700 mb-1 text-sm">
            Observação do serviço <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <div className="relative">
            <textarea
              className="input-field text-sm pr-12"
              rows={2}
              placeholder="Descreva livremente o que deve ser feito..."
              value={item.observacao_servico}
              onChange={e => onSet('observacao_servico', e.target.value)}
            />
            {VOZ_SUPORTADA && (
              <button
                type="button"
                onClick={gravando ? pararVoz : iniciarVoz}
                title={gravando ? 'Parar gravação' : 'Ditado por voz (pt-BR)'}
                className={`absolute right-2 top-2 p-2 rounded-xl transition-colors ` +
                  (gravando
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-700')}
              >
                {gravando ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>
          {gravando && (
            <p className="text-red-500 text-xs font-semibold mt-1 animate-pulse">Gravando... fale agora</p>
          )}
        </div>
      </div>

      {/* Cor + Valor */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-bold text-gray-700 mb-1">Cor do material</label>
          <input className="input-field" type="text" placeholder="Ex: Preto, Marrom..."
            value={item.cor} onChange={e => onSet('cor', e.target.value)} />
        </div>
        <div>
          <label className="block font-bold text-gray-700 mb-1">Valor (R$) *</label>
          <input className="input-field font-bold" type="text" inputMode="decimal" placeholder="0,00"
            value={item.valor} onChange={e => onSet('valor', e.target.value)} />
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="block font-bold text-gray-700 mb-1">
          Observação geral <span className="font-normal text-gray-400 text-sm">(opcional)</span>
        </label>
        <input className="input-field" type="text" placeholder="Detalhes adicionais..."
          value={item.descricao} onChange={e => onSet('descricao', e.target.value)} />
      </div>

      {/* Foto */}
      <div>
        <label className="block font-bold text-gray-700 mb-2">
          Foto do item <span className="font-normal text-gray-400 text-sm">(JPG/PNG máx. 5MB)</span>
        </label>
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={handleFotoChange}
        />
        {item.foto_url ? (
          <div className="flex items-center gap-3">
            <img src={item.foto_url} alt="Foto do item"
              className="w-20 h-20 object-cover rounded-xl border-2 border-amber-300" />
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => fotoInputRef.current?.click()}
                className="text-sm font-semibold text-amber-700 hover:underline">
                Trocar foto
              </button>
              <button type="button" onClick={() => onSet('foto_url', '')}
                className="text-sm font-semibold text-red-500 hover:underline">
                Remover foto
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fotoInputRef.current?.click()}
            disabled={uploadandoFoto}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-700 transition-colors font-semibold text-sm"
          >
            <Camera size={18} />
            {uploadandoFoto ? 'Enviando...' : 'Adicionar foto'}
          </button>
        )}
      </div>

      {/* Confirmar + Cancelar */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-base"
        >
          <Check size={20} /> {modoEdicao ? 'Atualizar item' : 'Confirmar item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border-2 border-gray-300 text-gray-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-base hover:bg-gray-50"
        >
          <X size={20} /> Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Card de item confirmado ────────────────────────────────────────────────────

function ItemConfirmadoCard({ item, idx, onEditar, onRemover }) {
  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Check size={16} className="text-green-600 shrink-0" />
            <span className="font-black text-green-700 text-sm">Item {idx + 1}</span>
            <span className="font-bold text-gray-800 text-sm">{item.categoria}</span>
            {item.subcategoria && <span className="text-gray-500 text-xs">· {item.subcategoria}</span>}
            {item.lado && <span className="text-gray-500 text-xs">· {item.lado}</span>}
          </div>
          <p className="text-xs text-gray-600 mt-1 truncate">{item.servicos.join(', ')}</p>
          {item.cor && <p className="text-xs text-gray-400 mt-0.5">Cor: {item.cor}</p>}
          {item.foto_url && (
            <img src={item.foto_url} alt="" className="mt-1 w-12 h-12 object-cover rounded-lg border border-green-300" />
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-extrabold text-amber-700 text-lg">
            {formatarValor(parseMoeda(item.valor))}
          </p>
          <div className="flex gap-1 mt-1 justify-end">
            <button type="button" onClick={() => onEditar(idx)}
              className="p-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">
              <Edit2 size={14} />
            </button>
            <button type="button" onClick={() => onRemover(idx)}
              className="p-1.5 rounded-lg bg-red-100 text-red-500 hover:bg-red-200">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
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
  const [todosClientes, setTodosClientes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const blurTimer = useRef(null)

  // Itens
  const [itensConfirmados, setItensConfirmados] = useState([])
  const [itemAtual, setItemAtual] = useState(itemVazio())
  const [editandoIdx, setEditandoIdx] = useState(null)
  const [feedbackSucesso, setFeedbackSucesso] = useState(false)

  const [prazo, setPrazo] = useState('')
  const [entrada, setEntrada] = useState('')
  const [desconto, setDesconto] = useState('')

  useEffect(() => {
    api.get('/categorias/').then(r => setCategorias(r.data)).catch(() => {})
    api.get('/clientes/').then(r => setTodosClientes(r.data)).catch(() => {})
  }, [])

  // Autocomplete
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

  function setItemField(campo, valor) {
    setItemAtual(prev => ({ ...prev, [campo]: valor }))
  }

  async function addCategoria(nome) {
    try {
      await api.post('/categorias/', { nome })
      const r = await api.get('/categorias/')
      setCategorias(r.data)
      toast.success(`Categoria "${nome}" criada!`)
      return true
    } catch (err) {
      if (err.response?.status === 409) toast.error('Essa categoria já existe.')
      else toast.error('Erro ao criar categoria.')
      return false
    }
  }

  async function deletarCategoria(id, nome) {
    if (!confirm(`Excluir a categoria "${nome}"?`)) return
    try {
      await api.delete(`/categorias/${id}`)
      setCategorias(prev => prev.filter(c => c.id !== id))
      if (itemAtual?.categoria === nome) setItemField('categoria', '')
      toast.success(`Categoria "${nome}" excluída.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir categoria.')
    }
  }

  function validarItemAtual() {
    const it = itemAtual
    if (!it.categoria) { toast.error('Selecione a categoria do item'); return false }
    if (it.categoria === 'Sandália' && !it.subcategoria) {
      toast.error('Escolha "Rasteira" ou "Com salto"'); return false
    }
    if (ehMala(it.categoria)) {
      if (!it.subcategoria) { toast.error('Selecione o tamanho da mala'); return false }
      if (!it.lado) { toast.error('Selecione o material da mala'); return false }
    }
    if (ehCalcado(it.categoria) && !it.lado) {
      toast.error('Selecione Par, Pé esquerdo ou Pé direito'); return false
    }
    if (it.servicos.length === 0) { toast.error('Selecione pelo menos um serviço'); return false }
    if (!it.valor || parseMoeda(it.valor) <= 0) { toast.error('Informe o valor do item'); return false }
    return true
  }

  function confirmarItem() {
    if (!validarItemAtual()) return
    if (editandoIdx !== null) {
      setItensConfirmados(prev => prev.map((it, i) => i === editandoIdx ? itemAtual : it))
      setEditandoIdx(null)
      toast.success('Item atualizado!')
    } else {
      setItensConfirmados(prev => [...prev, itemAtual])
      setFeedbackSucesso(true)
      setTimeout(() => setFeedbackSucesso(false), 2500)
    }
    setItemAtual(null)
  }

  function cancelarItem() {
    setItemAtual(null)
    setEditandoIdx(null)
  }

  function editarItemConfirmado(idx) {
    setItemAtual({ ...itensConfirmados[idx] })
    setEditandoIdx(idx)
  }

  function removerItemConfirmado(idx) {
    if (editandoIdx === idx) {
      setItemAtual(null)
      setEditandoIdx(null)
    } else if (editandoIdx !== null && editandoIdx > idx) {
      setEditandoIdx(prev => prev - 1)
    }
    setItensConfirmados(prev => prev.filter((_, i) => i !== idx))
  }

  const totalConfirmados = itensConfirmados.reduce((s, it) => s + parseMoeda(it.valor), 0)
  const entradaNum = parseMoeda(entrada)
  const descontoNum = parseMoeda(desconto)
  const totalLiquido = Math.max(0, totalConfirmados - descontoNum)
  const resta = Math.max(0, totalLiquido - entradaNum)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!clienteNome.trim()) { toast.error('Informe o nome do cliente'); return }
    if (!prazo) { toast.error('Informe o prazo de entrega'); return }
    if (itemAtual !== null) {
      toast.error('Confirme o item atual antes de criar a OS'); return
    }
    if (itensConfirmados.length === 0) { toast.error('Adicione pelo menos um item'); return }

    setLoading(true)
    try {
      const payload = {
        cliente_nome: clienteNome.trim(),
        cliente_telefone: clienteTelefone.trim() || null,
        prazo_entrega: prazo || null,
        entrada: entradaNum,
        desconto: descontoNum,
        itens: itensConfirmados.map(it => ({
          categoria: it.categoria,
          subcategoria: it.subcategoria || '',
          lado: it.lado || '',
          servicos: it.servicos,
          servicos_concluidos: [],
          observacao_servico: (it.observacao_servico || '').trim(),
          qtd_rodas: it.servicos.includes('Trocar roda') ? it.qtd_rodas : null,
          cor: (it.cor || '').trim(),
          descricao: (it.descricao || '').trim(),
          valor: parseMoeda(it.valor),
          foto_url: it.foto_url || '',
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

  const qtdItens = itensConfirmados.length

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-gray-800">Nova Ordem de Serviço</h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Cliente ── */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Cliente</h3>
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
              onChange={e => { setClienteNome(e.target.value); setClienteSelecionado(false); setMostrarSugestoes(true) }}
              onFocus={() => { clearTimeout(blurTimer.current); setMostrarSugestoes(true) }}
              onBlur={() => { blurTimer.current = setTimeout(() => setMostrarSugestoes(false), 180) }}
              autoComplete="off"
            />
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
                      <span className="text-gray-400 text-sm shrink-0">{c.telefone || 'sem telefone'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">
            Itens {qtdItens > 0 && <span className="text-amber-600">({qtdItens} confirmado{qtdItens > 1 ? 's' : ''})</span>}
          </h3>

          {/* Itens confirmados */}
          {itensConfirmados.map((it, idx) => (
            <ItemConfirmadoCard
              key={idx}
              item={it}
              idx={idx}
              onEditar={editarItemConfirmado}
              onRemover={removerItemConfirmado}
            />
          ))}

          {/* Feedback de sucesso temporário */}
          {feedbackSucesso && (
            <div className="bg-green-100 border-2 border-green-400 rounded-xl p-3 flex items-center gap-2 text-green-700 font-bold">
              <Check size={20} /> Item adicionado ✓
            </div>
          )}

          {/* Editor do item atual */}
          {itemAtual !== null && (
            <ItemEditor
              item={itemAtual}
              categorias={categorias}
              onSet={setItemField}
              onConfirm={confirmarItem}
              onCancel={cancelarItem}
              onAddCategoria={addCategoria}
              onDeleteCategoria={deletarCategoria}
              modoEdicao={editandoIdx !== null}
            />
          )}

          {/* Botão adicionar item — só aparece sem editor aberto */}
          {itemAtual === null && (
            <button
              type="button"
              onClick={() => setItemAtual(itemVazio())}
              className="w-full border-2 border-dashed border-amber-400 text-amber-700 font-bold py-3 rounded-xl hover:bg-amber-50 flex items-center justify-center gap-2"
            >
              <Plus size={20} /> {qtdItens > 0 ? 'Adicionar outro item' : 'Adicionar item'}
            </button>
          )}
        </div>

        {/* ── Prazo ── */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2 mb-4">Prazo de entrega *</h3>
          <SeletorPrazo value={prazo} onChange={setPrazo} />
        </div>

        {/* ── Pagamento ── */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Pagamento</h3>

          {descontoNum > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                <p className="text-gray-500 text-sm font-semibold">Subtotal</p>
                <p className="font-semibold text-gray-700">{formatarValor(totalConfirmados)}</p>
              </div>
              <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2">
                <p className="text-red-500 text-sm font-semibold">Desconto</p>
                <p className="font-semibold text-red-600">- {formatarValor(descontoNum)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-gray-500 text-sm font-semibold">Total</p>
              <p className="font-extrabold text-amber-700 text-xl">{formatarValor(totalLiquido)}</p>
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
            <label className="block font-bold text-gray-700 mb-1">Desconto (R$)</label>
            <input
              className="input-field"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={desconto}
              onChange={e => setDesconto(e.target.value)}
            />
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

        <button
          type="submit"
          disabled={loading || qtdItens === 0}
          className={`w-full text-xl py-4 rounded-xl font-bold transition-colors ` +
            (qtdItens === 0 || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white cursor-pointer')}
        >
          {loading
            ? 'Salvando...'
            : qtdItens === 0
              ? 'Confirme ao menos um item'
              : `Criar OS (${qtdItens} item${qtdItens > 1 ? 's' : ''})`}
        </button>
      </form>
    </div>
  )
}
