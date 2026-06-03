import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, Check, X, UserCheck, Mic, MicOff, Edit2, Search } from 'lucide-react'
import api from '../api.js'
import SeletorPrazo from '../components/SeletorPrazo.jsx'

const CATEGORIAS_BASE = new Set([
  'Sapato social', 'Tênis', 'Sapatênis', 'Mocassins', 'Sandália',
  'Mala', 'Cinto', 'Bolsa', 'Capa de prancha', 'Carteira',
])

const SERVICOS = [
  'Retocar', 'Pintar', 'Solado', 'Protetor', 'Capa fixa',
  'Colagem', 'Costura', 'Trocar carrinho (mala)', 'Trocar roda',
  'Alça', 'Cabeçote', 'Ziper', 'Puxador',
]

const SERVICO_ICONES = {
  'Retocar': '✏️', 'Pintar': '🎨', 'Solado': '👟', 'Protetor': '🛡️',
  'Capa fixa': '📦', 'Colagem': '🔗', 'Costura': '✂️',
  'Trocar carrinho (mala)': '🧳', 'Trocar roda': '⚙️',
  'Alça': '🪡', 'Cabeçote': '🔧', 'Ziper': '🔒', 'Puxador': '✋',
}

const LADOS = ['Par', 'Pé esquerdo', 'Pé direito']
const SUBCATEGORIAS_SANDALIA = ['Rasteira', 'Com salto']
const MALA_TAMANHOS = ['Pequena', 'Média', 'Grande']
const MALA_MATERIAIS = ['Fibra', 'Tecido']

const VOZ_SUPORTADA = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

function ehMala(cat) { return cat === 'Mala' }

function parseMoeda(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function itemVazio() {
  return {
    categoria: '', subcategoria: '', lado: '', servicos: [], qtd_rodas: 2,
    cor: '', observacao_servico: '', valor: '',
    foto_url: '', quantidade: 1, revisao: false,
  }
}

// ─── Stepper de criação de item ─────────────────────────────────────────────────

function ItemEditorStepper({
  item, categorias, onSet, onConfirm, onCancel,
  onAddCategoria, onDeleteCategoria, modoEdicao,
  servicosCustomDB, onAddServicoCustom, onDeleteServicoCustom,
}) {
  const [etapa, setEtapa] = useState(1)
  const [buscaServico, setBuscaServico] = useState('')
  const [novaCategoriaModo, setNovaCategoriaModo] = useState(null)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [servicoCustomModo, setServicoCustomModo] = useState(false)
  const [servicoCustomTexto, setServicoCustomTexto] = useState('')
  const [gravando, setGravando] = useState(false)
  const [mostrarObs, setMostrarObs] = useState(!!(item.observacao_servico))
  const recognitionRef = useRef(null)

  const NOMES_ETAPAS = ['Categoria', 'Serviço']

  const categoriasCalcados = categorias.filter(c => c.tipo === 'calcado')
  const categoriasDiversos = categorias.filter(c => c.tipo === 'diverso')

  const calcado = categoriasCalcados.some(c => c.nome === item.categoria)
  const ehSandalia = item.categoria === 'Sandália'
  const mala = ehMala(item.categoria)
  const temTrocarRoda = item.servicos.includes('Trocar roda')
  const valorUnit = parseMoeda(item.valor)
  const qtd = item.quantidade || 1
  const totalItem = valorUnit * qtd

  const customNomes = (servicosCustomDB || []).map(sc => sc.nome)
  const servicosOrfaos = item.servicos.filter(s => !SERVICOS.includes(s) && !customNomes.includes(s))
  const todasDisponiveis = [...SERVICOS, ...customNomes]
  const servicosFiltrados = buscaServico.trim()
    ? todasDisponiveis.filter(s => s.toLowerCase().includes(buscaServico.toLowerCase()))
    : todasDisponiveis
  const customFiltrados = (servicosCustomDB || []).filter(sc =>
    !buscaServico.trim() || sc.nome.toLowerCase().includes(buscaServico.toLowerCase())
  )
  const orfaosFiltrados = servicosOrfaos.filter(s =>
    !buscaServico.trim() || s.toLowerCase().includes(buscaServico.toLowerCase())
  )

  function podeAvancar1() {
    if (!item.categoria) return false
    if (calcado && !item.lado) return false
    if (ehSandalia && !item.subcategoria) return false
    if (mala && (!item.subcategoria || !item.lado)) return false
    return true
  }

  function podeConfirmar() {
    return item.servicos.length > 0
  }

  function handleCat(cat) {
    const oldIsMala = ehMala(item.categoria)
    const newIsMala = ehMala(cat)
    const newIsCalcado = categoriasCalcados.some(c => c.nome === cat)
    onSet('categoria', cat)
    if (cat !== 'Sandália') onSet('subcategoria', '')
    if (oldIsMala || newIsMala || (!newIsCalcado && !newIsMala)) onSet('lado', '')
  }

  function toggleServico(s) {
    const tem = item.servicos.includes(s)
    onSet('servicos', tem ? item.servicos.filter(x => x !== s) : [...item.servicos, s])
  }

  async function adicionarServicoCustom() {
    const nome = servicoCustomTexto.trim()
    if (!nome) return
    if (item.servicos.includes(nome)) { toast.error('Esse serviço já está na lista.'); return }
    onSet('servicos', [...item.servicos, nome])
    await onAddServicoCustom(nome)
    setServicoCustomTexto('')
    setServicoCustomModo(false)
  }

  async function salvarNovaCategoria() {
    const nome = novaCategoriaNome.trim()
    if (!nome) return
    const ok = await onAddCategoria(nome, novaCategoriaModo)
    if (ok) {
      onSet('categoria', nome)
      setNovaCategoriaNome('')
      setNovaCategoriaModo(null)
    }
  }

  function iniciarVoz() {
    if (!VOZ_SUPORTADA) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'pt-BR'; r.continuous = false; r.interimResults = false
    r.onresult = (e) => {
      const texto = e.results[0][0].transcript
      onSet('observacao_servico', (item.observacao_servico ? item.observacao_servico + ' ' : '') + texto)
      setGravando(false)
    }
    r.onerror = () => setGravando(false)
    r.onend = () => setGravando(false)
    r.start(); recognitionRef.current = r; setGravando(true)
  }

  function pararVoz() { recognitionRef.current?.stop(); setGravando(false) }

  const btnCat = (ativa) => ({
    padding: '10px 16px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
    backgroundColor: ativa ? '#3E1F12' : 'white',
    color: ativa ? 'white' : '#374151',
    borderColor: ativa ? '#3E1F12' : '#E8D5B0',
  })

  function InputNovaCategoria() {
    return (
      <div className="flex items-center gap-1 w-full mt-1">
        <input autoFocus className="input-field flex-1 py-2 text-sm"
          placeholder={novaCategoriaModo === 'calcado' ? 'Nome do calçado...' : 'Nome da categoria...'}
          value={novaCategoriaNome}
          onChange={e => setNovaCategoriaNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarNovaCategoria() } }}
        />
        <button type="button" onClick={salvarNovaCategoria}
          className="text-white p-2 rounded-xl" style={{ backgroundColor: '#3E1F12' }}>
          <Check size={18} />
        </button>
        <button type="button" onClick={() => { setNovaCategoriaModo(null); setNovaCategoriaNome('') }}
          className="bg-gray-100 text-gray-600 p-2 rounded-xl hover:bg-gray-200">
          <X size={18} />
        </button>
      </div>
    )
  }

  function ResumoCategoria() {
    const partes = [item.categoria]
    if (item.subcategoria) partes.push(item.subcategoria)
    if (item.lado) partes.push(item.lado)
    return (
      <div className="rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ backgroundColor: '#D1FAE5', border: '1px solid #A7F3D0' }}>
        <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} />
        <span className="font-semibold text-sm" style={{ color: '#065F46' }}>
          {partes.join(' · ')}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-4 space-y-5" style={{ border: '1px solid #E8D5B0', backgroundColor: '#F5ECD7' }}>

      <span className="font-black text-base block" style={{ color: '#3E1F12' }}>
        {modoEdicao ? 'Editando item' : 'Novo item'}
      </span>

      {/* Barra de progresso — 2 etapas */}
      <div className="flex items-start">
        {NOMES_ETAPAS.map((nome, i) => {
          const n = i + 1
          const concluida = etapa > n
          const atual = etapa === n
          return (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors"
                  style={concluida
                    ? { backgroundColor: '#10B981', color: 'white' }
                    : atual
                    ? { backgroundColor: '#3E1F12', color: 'white' }
                    : { backgroundColor: 'white', color: '#999999', border: '1px solid #E8D5B0' }}>
                  {concluida ? <Check size={14} /> : n}
                </div>
                <span className="text-xs font-semibold mt-1 whitespace-nowrap"
                  style={{ color: atual ? '#3E1F12' : '#999999' }}>
                  {nome}
                </span>
              </div>
              {i < 1 && (
                <div className="flex-1 h-0.5 mb-5 mx-2 transition-colors"
                  style={{ backgroundColor: etapa > n ? '#10B981' : '#E8D5B0' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Etapa 1: Categoria ── */}
      {etapa === 1 && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#999999' }}>Calçados</p>
            <div className="flex flex-wrap gap-2">
              {categoriasCalcados.map(catObj => {
                const isBase = CATEGORIAS_BASE.has(catObj.nome)
                return (
                  <div key={catObj.id} className="relative group">
                    <button type="button" onClick={() => handleCat(catObj.nome)}
                      style={{ ...btnCat(item.categoria === catObj.nome), paddingRight: !isBase ? 28 : 16 }}>
                      {catObj.nome}
                    </button>
                    {!isBase && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); onDeleteCategoria(catObj.id, catObj.nome) }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
              {novaCategoriaModo === 'calcado' ? (
                <InputNovaCategoria />
              ) : (
                <button type="button" onClick={() => setNovaCategoriaModo('calcado')}
                  className="flex items-center gap-1 font-semibold text-sm"
                  style={{ padding: '10px 16px', borderRadius: 10, border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
                  <Plus size={14} /> Novo calçado
                </button>
              )}
            </div>
          </div>

          {calcado && (
            <div>
              <label className="block font-bold mb-2" style={{ color: '#1A1A1A' }}>Qual peça? *</label>
              <div className="flex flex-wrap gap-2">
                {LADOS.map(l => (
                  <button key={l} type="button" onClick={() => onSet('lado', l)}
                    style={btnCat(item.lado === l)}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {ehSandalia && (
            <div>
              <label className="block font-bold mb-2" style={{ color: '#1A1A1A' }}>Tipo de sandália *</label>
              <div className="flex flex-wrap gap-2">
                {SUBCATEGORIAS_SANDALIA.map(sc => (
                  <button key={sc} type="button" onClick={() => onSet('subcategoria', sc)}
                    style={btnCat(item.subcategoria === sc)}>{sc}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#999999' }}>Diversos</p>
            <div className="flex flex-wrap gap-2">
              {categoriasDiversos.map(catObj => {
                const isBase = CATEGORIAS_BASE.has(catObj.nome)
                return (
                  <div key={catObj.id} className="relative group">
                    <button type="button" onClick={() => handleCat(catObj.nome)}
                      style={{ ...btnCat(item.categoria === catObj.nome), paddingRight: !isBase ? 28 : 16 }}>
                      {catObj.nome}
                    </button>
                    {!isBase && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); onDeleteCategoria(catObj.id, catObj.nome) }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
              {novaCategoriaModo === 'diverso' ? (
                <InputNovaCategoria />
              ) : (
                <button type="button" onClick={() => setNovaCategoriaModo('diverso')}
                  className="flex items-center gap-1 font-semibold text-sm"
                  style={{ padding: '10px 16px', borderRadius: 10, border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
                  <Plus size={14} /> Novo diverso
                </button>
              )}
            </div>
          </div>

          {mala && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-2" style={{ color: '#1A1A1A' }}>Tamanho *</label>
                <div className="flex flex-wrap gap-2">
                  {MALA_TAMANHOS.map(t => (
                    <button key={t} type="button" onClick={() => onSet('subcategoria', t)}
                      style={btnCat(item.subcategoria === t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-bold mb-2" style={{ color: '#1A1A1A' }}>Material *</label>
                <div className="flex flex-wrap gap-2">
                  {MALA_MATERIAIS.map(m => (
                    <button key={m} type="button" onClick={() => onSet('lado', m)}
                      style={btnCat(item.lado === m)}>{m}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {podeAvancar1() && <ResumoCategoria />}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel}
              className="px-4 py-3 rounded-xl font-bold hover:bg-gray-50 flex items-center gap-1"
              style={{ border: '1px solid #E8D5B0', color: '#4B5563' }}>
              <X size={16} /> Cancelar
            </button>
            <button type="button" onClick={() => setEtapa(2)}
              disabled={!podeAvancar1()}
              className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              style={podeAvancar1()
                ? { backgroundColor: '#3E1F12', color: 'white' }
                : { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 2: Serviço ── */}
      {etapa === 2 && (
        <div className="space-y-4">

          {/* 1. Cor */}
          <div>
            <label className="block font-bold mb-1" style={{ color: '#1A1A1A' }}>Cor do material</label>
            <input className="input-field" type="text" placeholder="Ex: Preto, Marrom..."
              value={item.cor} onChange={e => onSet('cor', e.target.value)} />
          </div>

          {/* 2. Serviços */}
          <div>
            <label className="block font-bold mb-2" style={{ color: '#1A1A1A' }}>Serviços *</label>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#999999' }} />
              <input className="input-field pl-9 text-sm" type="search"
                placeholder="Buscar serviço..." value={buscaServico}
                onChange={e => setBuscaServico(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {orfaosFiltrados.map(s => (
                <button key={s} type="button" onClick={() => toggleServico(s)}
                  className="flex flex-col items-center justify-center p-2 rounded-xl font-semibold text-xs gap-1 min-h-[72px]"
                  style={{ backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }}>
                  <span className="text-xl">🔧</span>
                  <span className="text-center leading-tight break-words w-full">{s}</span>
                </button>
              ))}

              {servicosFiltrados.filter(s => SERVICOS.includes(s)).map(s => (
                <button key={s} type="button" onClick={() => toggleServico(s)}
                  className="flex flex-col items-center justify-center p-2 rounded-xl font-semibold text-xs gap-1 transition-colors min-h-[72px]"
                  style={item.servicos.includes(s)
                    ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
                    : { backgroundColor: 'white', color: '#374151', border: '1px solid #E8D5B0' }}>
                  <span className="text-xl">{SERVICO_ICONES[s] || '🔧'}</span>
                  <span className="text-center leading-tight break-words w-full">{s}</span>
                </button>
              ))}

              {customFiltrados.map(sc => (
                <div key={sc.id} className="relative">
                  <button type="button" onClick={() => toggleServico(sc.nome)}
                    className="w-full flex flex-col items-center justify-center p-2 rounded-xl font-semibold text-xs gap-1 transition-colors min-h-[72px]"
                    style={item.servicos.includes(sc.nome)
                      ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
                      : { backgroundColor: 'white', color: '#374151', border: '1px solid #E8D5B0' }}>
                    <span className="text-xl">⭐</span>
                    <span className="text-center leading-tight break-words w-full">{sc.nome}</span>
                  </button>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onDeleteServicoCustom(sc.id, sc.nome) }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center z-10"
                    style={{ backgroundColor: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}

              {!servicoCustomModo && (
                <button type="button" onClick={() => setServicoCustomModo(true)}
                  className="flex flex-col items-center justify-center p-2 rounded-xl font-semibold text-xs gap-1 min-h-[72px] transition-colors"
                  style={{ border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
                  <Plus size={20} /><span>Adicionar</span>
                </button>
              )}
            </div>

            {servicoCustomModo && (
              <div className="flex items-center gap-1 mt-2">
                <input autoFocus className="input-field flex-1 py-2 text-sm"
                  placeholder="Nome do serviço personalizado"
                  value={servicoCustomTexto}
                  onChange={e => setServicoCustomTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarServicoCustom() } }}
                />
                <button type="button" onClick={adicionarServicoCustom}
                  className="text-white p-2 rounded-xl" style={{ backgroundColor: '#3E1F12' }}>
                  <Check size={18} />
                </button>
                <button type="button" onClick={() => { setServicoCustomModo(false); setServicoCustomTexto('') }}
                  className="bg-gray-100 text-gray-600 p-2 rounded-xl hover:bg-gray-200">
                  <X size={18} />
                </button>
              </div>
            )}

            {buscaServico.trim() && servicosFiltrados.length === 0 && orfaosFiltrados.length === 0 && customFiltrados.length === 0 && (
              <p className="text-center text-sm py-2" style={{ color: '#999999' }}>Nenhum serviço encontrado</p>
            )}
          </div>

          {/* Trocar roda — contador aparece só quando selecionado */}
          {temTrocarRoda && (
            <div>
              <label className="block font-bold mb-1" style={{ color: '#1A1A1A' }}>Quantidade de rodas</label>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => onSet('qtd_rodas', Math.max(1, (item.qtd_rodas || 2) - 1))}
                  className="w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                  −
                </button>
                <input className="input-field font-bold text-center text-xl flex-1"
                  type="number" inputMode="numeric" min="1" max="8"
                  value={item.qtd_rodas || 2}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v)) onSet('qtd_rodas', Math.min(8, Math.max(1, v)))
                  }}
                />
                <button type="button"
                  onClick={() => onSet('qtd_rodas', Math.min(8, (item.qtd_rodas || 2) + 1))}
                  className="w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                  +
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: '#999999' }}>Mínimo 1 · Máximo 8</p>
            </div>
          )}

          {/* 3. Quantidade */}
          <div>
            <label className="block font-bold mb-1" style={{ color: '#1A1A1A' }}>Quantidade</label>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => onSet('quantidade', Math.max(1, qtd - 1))}
                className="w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center shrink-0 transition-colors"
                style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                −
              </button>
              <input className="input-field font-bold text-center text-xl flex-1"
                type="number" inputMode="numeric" min="1" value={qtd}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onSet('quantidade', Math.max(1, v)) }}
              />
              <button type="button"
                onClick={() => onSet('quantidade', qtd + 1)}
                className="w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center shrink-0 transition-colors"
                style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                +
              </button>
            </div>
          </div>

          {/* 4. Observação — checkbox + campo condicional */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={mostrarObs}
                onChange={e => {
                  setMostrarObs(e.target.checked)
                  if (!e.target.checked) onSet('observacao_servico', '')
                }}
                className="w-5 h-5 cursor-pointer" style={{ accentColor: '#3E1F12' }}
              />
              <span className="font-bold" style={{ color: '#1A1A1A' }}>
                Adicionar observação?{' '}
                <span className="font-normal text-sm" style={{ color: '#999999' }}>(opcional)</span>
              </span>
            </label>
            {mostrarObs && (
              <div className="relative mt-2">
                <textarea className="input-field text-sm pr-12" rows={2}
                  placeholder="Descreva o que deve ser feito..."
                  value={item.observacao_servico}
                  onChange={e => onSet('observacao_servico', e.target.value)}
                />
                {VOZ_SUPORTADA && (
                  <button type="button" onClick={gravando ? pararVoz : iniciarVoz}
                    title={gravando ? 'Parar gravação' : 'Ditado por voz (pt-BR)'}
                    className="absolute right-2 top-2 p-2 rounded-xl transition-colors"
                    style={gravando
                      ? { backgroundColor: '#EF4444', color: 'white' }
                      : { backgroundColor: '#F3F4F6', color: '#4B5563' }}>
                    {gravando ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                {gravando && <p className="text-xs font-semibold mt-1 animate-pulse" style={{ color: '#EF4444' }}>Gravando... fale agora</p>}
              </div>
            )}
          </div>

          {/* 5. Valor + revisão */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
              <input type="checkbox" checked={item.revisao}
                onChange={e => { onSet('revisao', e.target.checked); if (e.target.checked) onSet('valor', '0') }}
                className="w-5 h-5 cursor-pointer" style={{ accentColor: '#3E1F12' }}
              />
              <span className="font-bold" style={{ color: '#1A1A1A' }}>Marcar como revisão / garantia</span>
            </label>
            {item.revisao && (
              <p className="text-xs font-semibold mb-2" style={{ color: '#3E1F12' }}>Item sem cobrança — valor zerado automaticamente</p>
            )}
            <label className="block font-bold mb-1" style={{ color: '#1A1A1A' }}>Valor unit. (R$) *</label>
            <input className="input-field font-bold text-xl"
              type="text" inputMode="decimal" placeholder="0,00"
              value={item.valor}
              onChange={e => onSet('valor', e.target.value)}
              disabled={item.revisao}
            />
            {!item.revisao && valorUnit > 0 && qtd > 1 && (
              <p className="text-sm font-semibold mt-1" style={{ color: '#A0522D' }}>
                × {qtd} = {formatarValor(totalItem)}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setEtapa(1)}
              className="px-4 py-3 rounded-xl font-bold hover:bg-gray-50 flex items-center gap-1"
              style={{ border: '1px solid #E8D5B0', color: '#4B5563' }}>
              ← Voltar
            </button>
            <button type="button" onClick={onConfirm}
              disabled={!podeConfirmar()}
              className="flex-1 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-base transition-colors"
              style={podeConfirmar()
                ? { backgroundColor: '#10B981' }
                : { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }}>
              <Check size={20} /> {modoEdicao ? 'Atualizar item' : 'Confirmar item ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card de item confirmado ─────────────────────────────────────────────────────

function ItemConfirmadoCard({ item, idx, onEditar, onRemover }) {
  const valorUnit = parseMoeda(item.valor)
  const qtd = item.quantidade || 1
  const totalItem = valorUnit * qtd

  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: '#D1FAE5', border: '1px solid #A7F3D0' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Check size={16} style={{ color: '#10B981', flexShrink: 0 }} />
            <span className="font-black text-sm" style={{ color: '#065F46' }}>Item {idx + 1}</span>
            {qtd > 1 && <span className="font-bold text-sm" style={{ color: '#1d4ed8' }}>{qtd}×</span>}
            <span className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{item.categoria}</span>
            {item.subcategoria && <span className="text-xs" style={{ color: '#999999' }}>· {item.subcategoria}</span>}
            {item.lado && <span className="text-xs" style={{ color: '#999999' }}>· {item.lado}</span>}
            {item.revisao && (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: '#DBEAFE', color: '#1d4ed8', border: '1px solid #93C5FD' }}>Revisão</span>
            )}
          </div>
          <p className="text-xs mt-1 truncate" style={{ color: '#4B5563' }}>{item.servicos.join(', ')}</p>
          {item.cor && <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Cor: {item.cor}</p>}
          {item.foto_url && (
            <img src={item.foto_url} alt="" className="mt-1 w-12 h-12 object-cover rounded-lg"
              style={{ border: '1px solid #A7F3D0' }} />
          )}
        </div>
        <div className="text-right shrink-0">
          {item.revisao ? (
            <p className="font-bold text-sm" style={{ color: '#1d4ed8' }}>Sem cobrança</p>
          ) : qtd > 1 ? (
            <>
              <p className="text-xs" style={{ color: '#6B7280' }}>{qtd}× · {formatarValor(valorUnit)} cada</p>
              <p className="font-extrabold text-lg" style={{ color: '#A0522D' }}>Total: {formatarValor(totalItem)}</p>
            </>
          ) : (
            <p className="font-extrabold text-lg" style={{ color: '#A0522D' }}>{formatarValor(valorUnit)}</p>
          )}
          <div className="flex gap-1 mt-1 justify-end">
            <button type="button" onClick={() => onEditar(idx)}
              className="p-1.5 rounded-lg" style={{ backgroundColor: '#F5ECD7', color: '#A0522D' }}>
              <Edit2 size={14} />
            </button>
            <button type="button" onClick={() => onRemover(idx)}
              className="p-1.5 rounded-lg" style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────────

export default function NovaOS() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [servicosCustomDB, setServicosCustomDB] = useState([])

  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(false)
  const [todosClientes, setTodosClientes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const blurTimer = useRef(null)

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
    api.get('/servicos/').then(r => setServicosCustomDB(r.data)).catch(() => {})
  }, [])

  const busca = clienteNome.trim().toLowerCase()
  const buscaDig = clienteNome.replace(/\D/g, '')
  const sugestoes = busca.length < 1 ? [] : todosClientes.filter(c => {
    const nomeBate = c.nome.toLowerCase().includes(busca)
    const telBate = buscaDig.length >= 2 && c.telefone && c.telefone.replace(/\D/g, '').includes(buscaDig)
    return nomeBate || telBate
  }).slice(0, 7)

  function selecionarCliente(c) {
    setClienteNome(c.nome); setClienteTelefone(c.telefone || '')
    setClienteSelecionado(true); setMostrarSugestoes(false)
  }

  function setItemField(campo, valor) {
    setItemAtual(prev => ({ ...prev, [campo]: valor }))
  }

  async function addCategoria(nome, tipo = 'diverso') {
    try {
      await api.post('/categorias/', { nome, tipo })
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

  async function addServicoCustom(nome) {
    try {
      const r = await api.post('/servicos/', { nome })
      setServicosCustomDB(prev => {
        if (prev.some(s => s.nome === nome)) return prev
        return [...prev, r.data]
      })
    } catch {}
  }

  async function deletarServicoCustom(id, nome) {
    if (!confirm(`Excluir o serviço "${nome}"?`)) return
    try {
      await api.delete(`/servicos/${id}`)
      setServicosCustomDB(prev => prev.filter(s => s.id !== id))
      if (itemAtual?.servicos.includes(nome)) {
        setItemField('servicos', itemAtual.servicos.filter(s => s !== nome))
      }
      toast.success(`Serviço "${nome}" excluído.`)
    } catch { toast.error('Erro ao excluir serviço.') }
  }

  function validarItemAtual() {
    const it = itemAtual
    const catCalcado = categorias.some(c => c.nome === it.categoria && c.tipo === 'calcado')
    if (!it.categoria) { toast.error('Selecione a categoria do item'); return false }
    if (it.categoria === 'Sandália' && !it.subcategoria) {
      toast.error('Escolha "Rasteira" ou "Com salto"'); return false
    }
    if (it.categoria === 'Mala') {
      if (!it.subcategoria) { toast.error('Selecione o tamanho da mala'); return false }
      if (!it.lado) { toast.error('Selecione o material da mala'); return false }
    }
    if (catCalcado && !it.lado) {
      toast.error('Selecione Par, Pé esquerdo ou Pé direito'); return false
    }
    if (it.servicos.length === 0) { toast.error('Selecione pelo menos um serviço'); return false }
    if (!it.revisao && (!it.valor || parseMoeda(it.valor) <= 0)) {
      toast.error('Informe o valor do item'); return false
    }
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

  function cancelarItem() { setItemAtual(null); setEditandoIdx(null) }

  function editarItemConfirmado(idx) {
    setItemAtual({ ...itensConfirmados[idx] }); setEditandoIdx(idx)
  }

  function removerItemConfirmado(idx) {
    if (editandoIdx === idx) { setItemAtual(null); setEditandoIdx(null) }
    else if (editandoIdx !== null && editandoIdx > idx) setEditandoIdx(prev => prev - 1)
    setItensConfirmados(prev => prev.filter((_, i) => i !== idx))
  }

  const qtdItens = itensConfirmados.length
  const totalConfirmados = itensConfirmados.reduce(
    (s, it) => s + parseMoeda(it.valor) * (it.quantidade || 1), 0
  )
  const entradaNum = parseMoeda(entrada)
  const descontoNum = parseMoeda(desconto)
  const totalLiquido = Math.max(0, totalConfirmados - descontoNum)
  const resta = Math.max(0, totalLiquido - entradaNum)
  const entradaInvalida = qtdItens > 0 && entradaNum > totalLiquido

  async function handleSubmit(e) {
    e.preventDefault()
    if (!clienteNome.trim()) { toast.error('Informe o nome do cliente'); return }
    if (!prazo) { toast.error('Informe o prazo de entrega'); return }
    if (itemAtual !== null) { toast.error('Confirme o item atual antes de criar a OS'); return }
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
          valor: it.revisao ? 0 : parseMoeda(it.valor),
          foto_url: it.foto_url || '',
          quantidade: it.quantidade || 1,
          revisao: it.revisao || false,
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
      <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Nova Ordem de Serviço</h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Cliente ── */}
        <div className="card space-y-4">
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#999999', borderBottom: '1px solid #F0F0F0', paddingBottom: 8 }}>
            Cliente
          </h3>
          <div className="relative">
            <label className="block font-bold mb-1 text-sm" style={{ color: '#1A1A1A' }}>
              Nome do cliente *
              {clienteSelecionado && (
                <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#10B981' }}>
                  <UserCheck size={15} /> Cliente existente
                </span>
              )}
            </label>
            <input className="input-field" type="text"
              placeholder="Digite o nome ou telefone para buscar..."
              value={clienteNome}
              onChange={e => { setClienteNome(e.target.value); setClienteSelecionado(false); setMostrarSugestoes(true) }}
              onFocus={() => { clearTimeout(blurTimer.current); setMostrarSugestoes(true) }}
              onBlur={() => { blurTimer.current = setTimeout(() => setMostrarSugestoes(false), 180) }}
              autoComplete="off"
            />
            {mostrarSugestoes && sugestoes.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl overflow-hidden"
                style={{ border: '1px solid #E8D5B0' }}>
                {sugestoes.map(c => (
                  <li key={c.id}>
                    <button type="button" onMouseDown={() => selecionarCliente(c)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors"
                      style={{ borderBottom: '1px solid #F0F0F0' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F5ECD7'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                      <span className="font-bold" style={{ color: '#1A1A1A' }}>{c.nome}</span>
                      <span className="text-sm shrink-0" style={{ color: '#999999' }}>{c.telefone || 'sem telefone'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block font-bold mb-1 text-sm" style={{ color: '#1A1A1A' }}>Telefone / WhatsApp</label>
            <input className="input-field" type="tel" placeholder="(11) 99999-9999"
              value={clienteTelefone}
              onChange={e => { setClienteTelefone(e.target.value); setClienteSelecionado(false) }}
            />
          </div>
        </div>

        {/* ── Itens ── */}
        <div className="card space-y-4">
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#999999', borderBottom: '1px solid #F0F0F0', paddingBottom: 8 }}>
            Itens {qtdItens > 0 && <span style={{ color: '#A0522D' }}>({qtdItens} confirmado{qtdItens > 1 ? 's' : ''})</span>}
          </h3>

          {itensConfirmados.map((it, idx) => (
            <ItemConfirmadoCard key={idx} item={it} idx={idx}
              onEditar={editarItemConfirmado} onRemover={removerItemConfirmado} />
          ))}

          {feedbackSucesso && (
            <div className="rounded-xl p-3 flex items-center gap-2 font-bold"
              style={{ backgroundColor: '#D1FAE5', border: '1px solid #A7F3D0', color: '#065F46' }}>
              <Check size={20} /> Item adicionado ✓
            </div>
          )}

          {itemAtual !== null && (
            <ItemEditorStepper
              item={itemAtual}
              categorias={categorias}
              onSet={setItemField}
              onConfirm={confirmarItem}
              onCancel={cancelarItem}
              onAddCategoria={addCategoria}
              onDeleteCategoria={deletarCategoria}
              modoEdicao={editandoIdx !== null}
              servicosCustomDB={servicosCustomDB}
              onAddServicoCustom={addServicoCustom}
              onDeleteServicoCustom={deletarServicoCustom}
            />
          )}

          {itemAtual === null && (
            <button type="button" onClick={() => setItemAtual(itemVazio())}
              className="w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              style={{ border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
              <Plus size={20} /> {qtdItens > 0 ? 'Adicionar outro item' : 'Adicionar item'}
            </button>
          )}
        </div>

        {/* ── Prazo ── */}
        <div className="card">
          <h3 className="text-base font-bold uppercase tracking-wide mb-4" style={{ color: '#999999', borderBottom: '1px solid #F0F0F0', paddingBottom: 8 }}>
            Prazo de entrega *
          </h3>
          <SeletorPrazo value={prazo} onChange={setPrazo} />
        </div>

        {/* ── Pagamento ── */}
        <div className="card space-y-3">
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#999999', borderBottom: '1px solid #F0F0F0', paddingBottom: 8 }}>
            Pagamento
          </h3>
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: '#F5ECD7' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#999999' }}>Total</p>
              {descontoNum > 0 && (
                <p className="text-xs" style={{ color: '#999999' }}>Subtotal {formatarValor(totalConfirmados)} − desconto {formatarValor(descontoNum)}</p>
              )}
            </div>
            <p className="font-extrabold text-xl" style={{ color: '#3E1F12' }}>{formatarValor(totalLiquido)}</p>
          </div>
          <div>
            <label className="block font-bold mb-1 text-sm" style={{ color: '#1A1A1A' }}>Valor pago (R$)</label>
            <input className="input-field text-xl font-bold"
              style={entradaInvalida ? { borderColor: '#EF4444' } : {}}
              type="text" inputMode="decimal" placeholder="0,00"
              value={entrada} onChange={e => setEntrada(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 text-sm" style={{ color: '#1A1A1A' }}>Desconto (R$)</label>
            <input className="input-field" type="text" inputMode="decimal" placeholder="0,00"
              value={desconto} onChange={e => setDesconto(e.target.value)}
            />
          </div>
          {entradaInvalida && (
            <p className="text-sm font-semibold flex items-center gap-1" style={{ color: '#EF4444' }}>
              ⚠ O valor pago não pode ser maior que o total
            </p>
          )}
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: '#FFF7ED' }}>
            <p className="text-sm font-semibold" style={{ color: '#999999' }}>Resta</p>
            <p className="font-extrabold text-xl" style={{ color: '#F59E0B' }}>{formatarValor(resta)}</p>
          </div>
        </div>

        <button type="submit"
          disabled={loading || qtdItens === 0 || entradaInvalida}
          className="w-full text-xl py-4 rounded-xl font-bold transition-colors"
          style={qtdItens === 0 || loading || entradaInvalida
            ? { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }
            : { backgroundColor: '#3E1F12', color: 'white', cursor: 'pointer' }}>
          {loading
            ? 'Salvando...'
            : entradaInvalida
              ? 'Valor pago maior que o total'
              : qtdItens === 0
              ? 'Confirme ao menos um item'
              : `Criar OS (${qtdItens} item${qtdItens > 1 ? 's' : ''})`}
        </button>
      </form>
    </div>
  )
}
