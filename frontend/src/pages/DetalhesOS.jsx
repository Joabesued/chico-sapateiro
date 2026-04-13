import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, MessageCircle, Printer, Trash2, Pencil, Plus, X, Check } from 'lucide-react'
import api from '../api.js'
import { StatusBadge, PagamentoBadge } from '../components/StatusBadge.jsx'
import SeletorPrazo from '../components/SeletorPrazo.jsx'

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LISTA = ['Em andamento', 'Pronto para retirada', 'Entregue']

const SERVICOS = [
  'Retocar', 'Pintar', 'Solado', 'Protetor', 'Capa fixa',
  'Colagem', 'Costura', 'Trocar carrinho (mala)', 'Trocar roda',
  'Alça', 'Cabeçote', 'Ziper', 'Puxador',
]

// ─── Utilitários ───────────────────────────────────────────────────────────────

function formatarData(dt) {
  if (!dt) return '—'
  const s = String(dt).split('T')[0]
  const [ano, mes, dia] = s.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function parseMoeda(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

function itemVazio() {
  return { categoria: '', servicos: [], qtd_rodas: 2, cor: '', descricao: '', valor: '' }
}

function formatarServicosTexto(item) {
  return item.servicos.map(s => {
    if (s === 'Trocar roda' && item.qtd_rodas) return `Trocar roda (${item.qtd_rodas})`
    return s
  }).join(', ')
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function DetalhesOS() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [os, setOs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState(false)

  // Estado de edição
  const [categorias, setCategorias] = useState([])
  const [itensEdit, setItensEdit] = useState([])
  const [entradaEdit, setEntradaEdit] = useState('')
  const [prazoEdit, setPrazoEdit] = useState('')
  const [novaCategoriaModo, setNovaCategoriaModo] = useState(null) // idx do item
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')

  useEffect(() => { carregarOS() }, [id])

  async function carregarOS() {
    try {
      const { data } = await api.get(`/ordens/${id}`)
      setOs(data)
    } catch {
      toast.error('OS não encontrada')
      navigate('/painel')
    } finally {
      setLoading(false)
    }
  }

  async function carregarCategorias() {
    const r = await api.get('/categorias/')
    setCategorias(r.data.map(c => c.nome))
  }

  function iniciarEdicao() {
    carregarCategorias()
    setItensEdit(os.itens.map(i => ({
      categoria: i.categoria,
      servicos: [...(i.servicos || [])],
      qtd_rodas: i.qtd_rodas || 2,
      cor: i.cor || '',
      descricao: i.descricao || '',
      valor: String(i.valor),
    })))
    setEntradaEdit(String(os.entrada))
    setPrazoEdit(os.prazo_entrega || '')
    setEditando(true)
  }

  function setItemEdit(idx, campo, valor) {
    setItensEdit(p => p.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  function toggleServico(idx, s) {
    setItensEdit(p => p.map((it, i) => {
      if (i !== idx) return it
      const tem = it.servicos.includes(s)
      return { ...it, servicos: tem ? it.servicos.filter(x => x !== s) : [...it.servicos, s] }
    }))
  }

  async function addCategoria(nome) {
    try {
      await api.post('/categorias/', { nome })
      await carregarCategorias()
      toast.success(`Categoria "${nome}" criada!`)
      return true
    } catch (err) {
      if (err.response?.status === 409) toast.error('Essa categoria já existe.')
      else toast.error('Erro ao criar categoria.')
      return false
    }
  }

  async function salvarEdicao() {
    for (let i = 0; i < itensEdit.length; i++) {
      if (!itensEdit[i].categoria) { toast.error(`Item ${i + 1}: selecione a categoria`); return }
      if (!itensEdit[i].servicos.length) { toast.error(`Item ${i + 1}: selecione pelo menos um serviço`); return }
    }
    setSalvando(true)
    try {
      const { data } = await api.patch(`/ordens/${id}`, {
        prazo_entrega: prazoEdit || null,
        entrada: parseMoeda(entradaEdit),
        itens: itensEdit.map(it => ({
          categoria: it.categoria,
          servicos: it.servicos,
          qtd_rodas: it.servicos.includes('Trocar roda') ? it.qtd_rodas : null,
          cor: it.cor,
          descricao: it.descricao,
          valor: parseMoeda(it.valor),
        })),
      })
      setOs(data)
      setEditando(false)
      toast.success('OS atualizada!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function atualizarStatus(novoStatus) {
    setSalvando(true)
    try {
      const { data } = await api.patch(`/ordens/${id}`, { status: novoStatus })
      setOs(data)
      toast.success('Status atualizado!')
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setSalvando(false)
    }
  }

  async function deletarOS() {
    if (!confirm('Deseja realmente excluir esta OS?')) return
    try {
      await api.delete(`/ordens/${id}`)
      toast.success('OS excluída')
      navigate('/painel')
    } catch {
      toast.error('Erro ao excluir OS')
    }
  }

  function abrirWhatsApp() {
    if (!os.cliente.telefone) { toast.error('Cliente sem telefone cadastrado'); return }
    const tel = os.cliente.telefone.replace(/\D/g, '')

    const linhasItens = os.itens.map(item => {
      const servs = formatarServicosTexto(item)
      const partes = [item.categoria]
      if (servs) partes.push(servs)
      if (item.cor) partes.push(`Cor: ${item.cor}`)
      if (item.descricao) partes.push(item.descricao)
      partes.push(formatarValor(item.valor))
      return `▪ ${partes.join(' — ')}`
    }).join('\n')

    const msg = encodeURIComponent(
      `🥿 *CHICO SAPATEIRO*\n` +
      `📋 Nota #${String(os.numero).padStart(3, '0')} — ${os.cliente.nome}\n\n` +
      `${linhasItens}\n\n` +
      `💰 Total: ${formatarValor(os.total)}\n` +
      `✅ Entrada: ${formatarValor(os.entrada)}\n` +
      `⏳ Resta: ${formatarValor(os.resta)}\n` +
      (os.prazo_entrega ? `📅 Prazo: ${formatarData(os.prazo_entrega)}\n` : '') +
      `📌 Status: ${os.status}`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  if (loading) return <p className="text-center py-10 text-lg text-gray-500">Carregando...</p>
  if (!os) return null

  const totalEdit = itensEdit.reduce((s, it) => s + parseMoeda(it.valor), 0)
  const entradaEditNum = parseMoeda(entradaEdit)
  const restaEdit = Math.max(0, totalEdit - entradaEditNum)

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 no-print">
        <button onClick={() => navigate('/painel')} className="p-2 rounded-xl hover:bg-amber-100">
          <ArrowLeft size={26} />
        </button>
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800">
            Nota #{String(os.numero).padStart(3, '0')}
          </h2>
          <p className="text-gray-500 text-sm">Criada em {formatarData(os.criado_em)}</p>
        </div>
      </div>

      {/* ── Resumo do cliente ── */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold text-gray-900">{os.cliente.nome}</p>
            {os.cliente.telefone && <p className="text-gray-500">{os.cliente.telefone}</p>}
          </div>
          <StatusBadge status={os.status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PagamentoBadge status={os.status_pagamento} />
          {os.prazo_entrega && (
            <span className="text-sm text-gray-500 font-semibold">
              📅 Prazo: {formatarData(os.prazo_entrega)}
            </span>
          )}
        </div>
      </div>

      {/* ── Itens (visualização) ── */}
      {!editando ? (
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-bold text-gray-700">Itens</h3>
            <button onClick={iniciarEdicao}
              className="flex items-center gap-1 text-amber-700 font-semibold text-sm hover:underline no-print">
              <Pencil size={16} /> Editar
            </button>
          </div>

          {os.itens.map(item => (
            <div key={item.id} className="py-2 border-b last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{item.categoria}</p>
                  <p className="text-sm text-amber-700 font-semibold mt-0.5">
                    {formatarServicosTexto(item)}
                  </p>
                  {item.cor && <p className="text-sm text-gray-500">Cor: {item.cor}</p>}
                  {item.descricao && <p className="text-sm text-gray-400 italic">{item.descricao}</p>}
                </div>
                <p className="font-extrabold text-amber-700 shrink-0">{formatarValor(item.valor)}</p>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs font-semibold">Total</p>
              <p className="font-extrabold text-amber-700 text-lg">{formatarValor(os.total)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs font-semibold">Entrada</p>
              <p className="font-extrabold text-green-700 text-lg">{formatarValor(os.entrada)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs font-semibold">Resta</p>
              <p className="font-extrabold text-orange-600 text-lg">{formatarValor(os.resta)}</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Modo edição ── */
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-bold text-gray-700">Editando OS</h3>
            <button onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-700">
              <X size={22} />
            </button>
          </div>

          {itensEdit.map((item, idx) => (
            <div key={idx} className="border-2 border-gray-200 rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-amber-700 text-sm">Item {idx + 1}</span>
                {itensEdit.length > 1 && (
                  <button type="button" onClick={() => setItensEdit(p => p.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {/* Categoria */}
              <div>
                <p className="font-bold text-gray-700 text-sm mb-2">Categoria</p>
                <div className="flex flex-wrap gap-1.5">
                  {categorias.map(cat => (
                    <button key={cat} type="button" onClick={() => setItemEdit(idx, 'categoria', cat)}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                        (item.categoria === cat
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                      {cat}
                    </button>
                  ))}
                  {novaCategoriaModo === idx ? (
                    <div className="flex items-center gap-1 w-full mt-1">
                      <input autoFocus className="input-field flex-1 py-1.5 text-sm"
                        placeholder="Nova categoria" value={novaCategoriaNome}
                        onChange={e => setNovaCategoriaNome(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const ok = await addCategoria(novaCategoriaNome.trim())
                            if (ok) { setItemEdit(idx, 'categoria', novaCategoriaNome.trim()); setNovaCategoriaModo(null); setNovaCategoriaNome('') }
                          }
                        }}
                      />
                      <button type="button" className="bg-amber-600 text-white p-1.5 rounded-lg"
                        onClick={async () => {
                          const ok = await addCategoria(novaCategoriaNome.trim())
                          if (ok) { setItemEdit(idx, 'categoria', novaCategoriaNome.trim()); setNovaCategoriaModo(null); setNovaCategoriaNome('') }
                        }}>
                        <Check size={16} />
                      </button>
                      <button type="button" className="bg-gray-100 text-gray-500 p-1.5 rounded-lg"
                        onClick={() => { setNovaCategoriaModo(null); setNovaCategoriaNome('') }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setNovaCategoriaModo(idx)}
                      className="px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 flex items-center gap-1">
                      <Plus size={12} /> Nova
                    </button>
                  )}
                </div>
              </div>

              {/* Serviços */}
              <div>
                <p className="font-bold text-gray-700 text-sm mb-2">Serviços</p>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICOS.map(s => (
                    <button key={s} type="button" onClick={() => toggleServico(idx, s)}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                        (item.servicos.includes(s)
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                      {s}
                    </button>
                  ))}
                </div>
                {item.servicos.includes('Trocar roda') && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-semibold text-gray-600">Qtd rodas:</span>
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} type="button" onClick={() => setItemEdit(idx, 'qtd_rodas', n)}
                        className={`w-8 h-8 rounded-lg font-bold text-sm border-2 transition-colors ` +
                          (item.qtd_rodas === n ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input className="input-field text-sm py-2" placeholder="Cor"
                  value={item.cor} onChange={e => setItemEdit(idx, 'cor', e.target.value)} />
                <input className="input-field font-bold text-sm py-2" placeholder="Valor" inputMode="decimal"
                  value={item.valor} onChange={e => setItemEdit(idx, 'valor', e.target.value)} />
              </div>
              <input className="input-field text-sm py-2" placeholder="Observação (opcional)"
                value={item.descricao} onChange={e => setItemEdit(idx, 'descricao', e.target.value)} />
            </div>
          ))}

          <button type="button"
            onClick={() => setItensEdit(p => [...p, itemVazio()])}
            className="w-full border-2 border-dashed border-amber-400 text-amber-700 font-bold py-2 rounded-xl hover:bg-amber-50 flex items-center justify-center gap-2 text-sm">
            <Plus size={16} /> Adicionar item
          </button>

          {/* Prazo */}
          <div>
            <label className="block font-bold text-gray-700 mb-2 text-sm">Prazo de entrega</label>
            <SeletorPrazo value={prazoEdit} onChange={setPrazoEdit} />
          </div>

          {/* Totais */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-amber-50 rounded-xl p-2">
              <p className="text-gray-500 text-xs">Total</p>
              <p className="font-extrabold text-amber-700">{formatarValor(totalEdit)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-gray-500 text-xs">Entrada</p>
              <p className="font-extrabold text-green-700">{formatarValor(entradaEditNum)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-2">
              <p className="text-gray-500 text-xs">Resta</p>
              <p className="font-extrabold text-orange-600">{formatarValor(restaEdit)}</p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1 text-sm">Entrada recebida (R$)</label>
            <input className="input-field text-xl font-bold" inputMode="decimal" placeholder="0,00"
              value={entradaEdit} onChange={e => setEntradaEdit(e.target.value)} />
          </div>

          <button onClick={salvarEdicao} disabled={salvando}
            className="btn-primary w-full flex items-center justify-center gap-2">
            <Check size={20} />
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {/* ── Status da OS ── */}
      <div className="card no-print">
        <h3 className="text-lg font-bold text-gray-700 mb-3">Status da OS</h3>
        <div className="space-y-2">
          {STATUS_LISTA.map(s => (
            <button key={s} onClick={() => atualizarStatus(s)}
              disabled={salvando || os.status === s}
              className={`w-full py-3 px-4 rounded-xl font-bold text-left text-lg border-2 transition-all ` +
                (os.status === s
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400 hover:bg-amber-50')}>
              {os.status === s ? `✓ ${s}` : s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ações ── */}
      <div className="grid grid-cols-2 gap-3 no-print">
        <button onClick={abrirWhatsApp}
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl">
          <MessageCircle size={22} /> WhatsApp
        </button>
        <button onClick={() => window.print()}
          className="flex items-center justify-center gap-2 btn-secondary">
          <Printer size={22} /> Imprimir
        </button>
      </div>

      <button onClick={deletarOS}
        className="flex items-center justify-center gap-2 btn-danger w-full no-print">
        <Trash2 size={20} /> Excluir OS
      </button>
    </div>
  )
}
