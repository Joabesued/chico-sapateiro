import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, MessageCircle, Printer, Trash2, Pencil, Plus, X, Check, FileText, AlertTriangle, Send, ShoppingCart, Zap, Tag } from 'lucide-react'
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

const CALCADOS_BASE = ['Sapato social', 'Tênis', 'Sapatênis', 'Mocassins', 'Sandália']

const EMOJI_CATEGORIA = {
  'Sapato social': '👞', 'Tênis': '👟', 'Sapatênis': '👟', 'Mocassins': '👞',
  'Sandália': '👡', 'Bolsa': '👜', 'Mala': '🧳', 'Carteira': '👛',
  'Cinto': '🔗', 'Capa de prancha': '🏄',
}

const CALCADOS = ['Sapato social', 'Tênis', 'Sapatênis', 'Mocassins', 'Sandália']
const LADOS = ['Par', 'Pé esquerdo', 'Pé direito']
const SUBCATEGORIAS_SANDALIA = ['Rasteira', 'Com salto']
const MALA_TAMANHOS = ['Pequena', 'Média', 'Grande']
const MALA_MATERIAIS = ['Fibra', 'Tecido']

function ehCalcado(cat) { return CALCADOS.includes(cat) }
function ehMala(cat) { return cat === 'Mala' }

const CATEGORIAS_BASE = new Set([
  'Sapato social', 'Tênis', 'Sapatênis', 'Mocassins', 'Sandália',
  'Mala', 'Cinto', 'Bolsa', 'Capa de prancha', 'Carteira',
])

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

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function estaEmAtraso(os) {
  if (!os?.prazo_entrega) return false
  if (os.status === 'Pronto para retirada' || os.status === 'Entregue') return false
  return String(os.prazo_entrega).split('T')[0] < hojeISO()
}

function itemVazio() {
  return {
    categoria: '', subcategoria: '', lado: '',
    servicos: [], qtd_rodas: 2,
    cor: '', observacao_servico: '',
    valor: '',
    quantidade: 1,
    revisao: false,
  }
}

function descricaoItem(item) {
  const partes = [item.categoria]
  if (item.subcategoria) partes.push(item.subcategoria)
  if (item.lado) partes.push(item.lado)
  return partes.filter(Boolean).join(' — ')
}

function formatarServicosTexto(item) {
  return (item.servicos || []).map(s => {
    if (s === 'Trocar roda' && item.qtd_rodas) return `Trocar roda (${item.qtd_rodas})`
    return s
  }).join(', ')
}

const LARGURA_ETIQUETA = 32

function removerAcentos(str) {
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function subtrairDia(dataISO) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() - 1)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function gerarTextoEtiqueta(os) {
  const numero = String(os.numero).padStart(3, '0')
  const nome = removerAcentos(os.cliente.nome).toUpperCase()

  const servicos = []
  os.itens.forEach(item => {
    (item.servicos || []).forEach(s => {
      if (!servicos.includes(s)) servicos.push(s)
    })
  })
  const servicosTexto = removerAcentos(servicos.join(', ')).toUpperCase()

  const dataEntrega = os.prazo_entrega
    ? subtrairDia(String(os.prazo_entrega).split('T')[0])
    : '-'

  const pago = (os.resta || 0) <= 0

  const linhas = [
    '='.repeat(LARGURA_ETIQUETA),
    `#${numero}`,
    nome,
    '-'.repeat(LARGURA_ETIQUETA),
    `SERV: ${servicosTexto}`,
    `ENTREGA: ${dataEntrega}`,
    '='.repeat(LARGURA_ETIQUETA),
  ]
  if (pago) {
    linhas.push('PG'.padStart(LARGURA_ETIQUETA))
  }
  return linhas.join('\n')
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function DetalhesOS() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [os, setOs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState(false)

  const [categorias, setCategorias] = useState([])
  const [servicosCustomDB, setServicosCustomDB] = useState([])
  const [itensEdit, setItensEdit] = useState([])
  const [entradaEdit, setEntradaEdit] = useState('')
  const [descontoEdit, setDescontoEdit] = useState('')
  const [prazoEdit, setPrazoEdit] = useState('')
  const [novaCategoriaModo, setNovaCategoriaModo] = useState(null)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [servicoCustomModo, setServicoCustomModo] = useState(null)
  const [servicoCustomTexto, setServicoCustomTexto] = useState('')

  const [vendasProdutos, setVendasProdutos] = useState([])
  const [modalAdicionarProduto, setModalAdicionarProduto] = useState(false)
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([])
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState('')
  const [qtdVendaOS, setQtdVendaOS] = useState(1)
  const [salvandoVenda, setSalvandoVenda] = useState(false)
  const [mensagensProntas, setMensagensProntas] = useState([])
  const etiquetaIframeRef = useRef(null)

  useEffect(() => { carregarOS(); carregarCategorias(); carregarMensagens() }, [id])

  // Limpa o iframe de impressão da etiqueta ao desmontar, evitando vazamento de nó no DOM.
  useEffect(() => {
    return () => {
      if (etiquetaIframeRef.current) {
        etiquetaIframeRef.current.remove()
        etiquetaIframeRef.current = null
      }
    }
  }, [])

  async function carregarOS() {
    try {
      const { data } = await api.get(`/ordens/${id}`)
      setOs(data)
      carregarVendasProdutos()
    } catch {
      toast.error('OS não encontrada')
      navigate('/painel')
    } finally {
      setLoading(false)
    }
  }

  async function carregarVendasProdutos() {
    try {
      const { data } = await api.get('/produtos/vendas', { params: { os_id: id } })
      setVendasProdutos(data)
    } catch {
      setVendasProdutos([])
    }
  }

  async function abrirModalAdicionarProduto() {
    try {
      const { data } = await api.get('/produtos/')
      setProdutosDisponiveis(data.filter(p => p.quantidade_estoque > 0))
      setProdutoSelecionadoId('')
      setQtdVendaOS(1)
      setModalAdicionarProduto(true)
    } catch {
      toast.error('Erro ao carregar produtos')
    }
  }

  async function confirmarVendaOS() {
    if (!produtoSelecionadoId) { toast.error('Selecione um produto'); return }
    setSalvandoVenda(true)
    try {
      await api.post(`/produtos/${produtoSelecionadoId}/venda`, {
        quantidade: qtdVendaOS,
        os_id: parseInt(id),
      })
      toast.success('Produto adicionado!')
      setModalAdicionarProduto(false)
      carregarVendasProdutos()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao registrar venda')
    } finally {
      setSalvandoVenda(false)
    }
  }

  async function cancelarVendaOS(vendaId) {
    if (!confirm('Remover este produto da OS? O estoque será devolvido.')) return
    try {
      await api.delete(`/produtos/vendas/${vendaId}`)
      toast.success('Produto removido')
      carregarVendasProdutos()
    } catch {
      toast.error('Erro ao remover produto')
    }
  }

  async function carregarMensagens() {
    try {
      const { data } = await api.get('/mensagens/')
      setMensagensProntas(data)
    } catch {
      setMensagensProntas([])
    }
  }

  async function carregarCategorias() {
    const [catR, svcR] = await Promise.all([
      api.get('/categorias/'),
      api.get('/servicos/').catch(() => ({ data: [] })),
    ])
    setCategorias(catR.data)
    setServicosCustomDB(svcR.data)
  }

  function iniciarEdicao() {
    carregarCategorias()
    setItensEdit(os.itens.map(i => ({
      categoria: i.categoria,
      subcategoria: i.subcategoria || '',
      lado: i.lado || '',
      servicos: [...(i.servicos || [])],
      qtd_rodas: i.qtd_rodas || 2,
      cor: i.cor || '',
      observacao_servico: i.observacao_servico || '',
      valor: String(i.valor),
      quantidade: i.quantidade || 1,
      revisao: i.revisao || false,
    })))
    setEntradaEdit(String(os.entrada))
    setDescontoEdit(os.desconto > 0 ? String(os.desconto) : '')
    setPrazoEdit(os.prazo_entrega || '')
    setEditando(true)
  }

  function setItemEdit(idx, campo, valor) {
    setItensEdit(p => p.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  function toggleServicoEdit(idx, s) {
    setItensEdit(p => p.map((it, i) => {
      if (i !== idx) return it
      const tem = it.servicos.includes(s)
      return { ...it, servicos: tem ? it.servicos.filter(x => x !== s) : [...it.servicos, s] }
    }))
  }

  function adicionarServicoCustom(idx) {
    const nome = servicoCustomTexto.trim()
    if (!nome) return
    setItensEdit(p => p.map((it, i) => {
      if (i !== idx) return it
      if (it.servicos.includes(nome)) {
        toast.error('Esse serviço já está na lista.')
        return it
      }
      return { ...it, servicos: [...it.servicos, nome] }
    }))
    api.post('/servicos/', { nome }).then(r => {
      setServicosCustomDB(prev => {
        if (prev.some(s => s.nome === nome)) return prev
        return [...prev, r.data]
      })
    }).catch(() => {})
    setServicoCustomTexto('')
    setServicoCustomModo(null)
  }

  async function deletarServicoCustom(id, nome) {
    if (!confirm(`Excluir o serviço "${nome}"?`)) return
    try {
      await api.delete(`/servicos/${id}`)
      setServicosCustomDB(prev => prev.filter(s => s.id !== id))
      toast.success(`Serviço "${nome}" excluído.`)
    } catch {
      toast.error('Erro ao excluir serviço.')
    }
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

  async function deletarCategoriaEdit(id, nome) {
    if (!confirm(`Excluir a categoria "${nome}"?`)) return
    try {
      await api.delete(`/categorias/${id}`)
      await carregarCategorias()
      toast.success(`Categoria "${nome}" excluída.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir categoria.')
    }
  }

  async function salvarEdicao() {
    for (let i = 0; i < itensEdit.length; i++) {
      const it = itensEdit[i]
      const isCalcado = CALCADOS.includes(it.categoria) ||
        categorias.some(c => c.nome === it.categoria && c.tipo === 'calcado')
      if (!it.categoria) { toast.error(`Item ${i + 1}: selecione a categoria`); return }
      if (it.categoria === 'Sandália' && !it.subcategoria) {
        toast.error(`Item ${i + 1}: escolha "Rasteira" ou "Com salto"`); return
      }
      if (isCalcado && !it.lado) {
        toast.error(`Item ${i + 1}: selecione Par, Pé esquerdo ou Pé direito`); return
      }
      if (!it.servicos.length) { toast.error(`Item ${i + 1}: selecione pelo menos um serviço`); return }
    }
    setSalvando(true)
    try {
      const estadoAnt = os.itens.map(i => ({
        id: i.id,
        concluidos: i.servicos_concluidos || [],
        entregue: i.entregue || false,
      }))
      const { data } = await api.patch(`/ordens/${id}`, {
        prazo_entrega: prazoEdit || null,
        entrada: parseMoeda(entradaEdit),
        desconto: parseMoeda(descontoEdit),
        itens: itensEdit.map((it, idx) => {
          const ant = estadoAnt[idx]
          const concluidos = (ant?.concluidos || []).filter(s => it.servicos.includes(s))
          const revisao = it.revisao || false
          return {
            categoria: it.categoria,
            subcategoria: it.subcategoria || '',
            lado: it.lado || '',
            servicos: it.servicos,
            servicos_concluidos: concluidos,
            observacao_servico: it.observacao_servico,
            qtd_rodas: it.servicos.includes('Trocar roda') ? it.qtd_rodas : null,
            cor: it.cor,
            valor: revisao ? 0 : parseMoeda(it.valor),
            quantidade: it.quantidade || 1,
            revisao,
            entregue: ant?.entregue || false,
          }
        }),
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

  async function toggleItemConcluido(itemId) {
    const item = os.itens.find(i => i.id === itemId)
    if (!item) return
    const servicos = item.servicos || []
    if (servicos.length === 0) return
    const concluidos = item.servicos_concluidos || []
    const todosFeitos = servicos.every(s => concluidos.includes(s))
    const novos = todosFeitos ? [] : servicos

    const statusAntes = os.status
    try {
      const { data } = await api.patch(
        `/ordens/${id}/itens/${itemId}/checklist`,
        { servicos_concluidos: novos }
      )
      setOs(data)
      if (statusAntes === 'Em andamento' && data.status === 'Pronto para retirada') {
        toast.success('Todos os itens concluídos — OS pronta para retirada!', { duration: 4000 })
      }
    } catch {
      toast.error('Erro ao salvar checklist')
    }
  }

  async function toggleEntregue(itemId) {
    const item = os.itens.find(i => i.id === itemId)
    if (!item) return
    const statusAntes = os.status
    try {
      const { data } = await api.patch(
        `/ordens/${id}/itens/${itemId}/entregar`,
        { entregue: !item.entregue }
      )
      setOs(data)
      if (statusAntes !== 'Entregue' && data.status === 'Entregue') {
        toast.success('Todos os itens entregues — OS finalizada!', { duration: 4000 })
      }
    } catch {
      toast.error('Erro ao salvar entrega')
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

  async function toggleUrgente() {
    setSalvando(true)
    try {
      const { data } = await api.patch(`/ordens/${id}`, { urgente: !os.urgente })
      setOs(data)
      toast.success(data.urgente ? 'OS marcada como urgente!' : 'Urgência removida')
    } catch {
      toast.error('Erro ao atualizar urgência')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleItemUrgente(itemId) {
    const item = os.itens.find(i => i.id === itemId)
    if (!item) return
    try {
      const itensAtualizados = os.itens.map(it => ({
        categoria: it.categoria,
        subcategoria: it.subcategoria || '',
        lado: it.lado || '',
        servicos: it.servicos || [],
        servicos_concluidos: it.servicos_concluidos || [],
        observacao_servico: it.observacao_servico || '',
        cor: it.cor || '',
        qtd_rodas: it.qtd_rodas,
        valor: it.valor,
        foto_url: it.foto_url || '',
        quantidade: it.quantidade || 1,
        revisao: it.revisao || false,
        entregue: it.entregue || false,
        urgente: it.id === itemId ? !it.urgente : (it.urgente || false),
      }))
      const { data } = await api.patch(`/ordens/${id}`, { itens: itensAtualizados })
      setOs(data)
      const novoUrgente = !item.urgente
      toast.success(novoUrgente ? 'Item marcado como urgente!' : 'Urgência do item removida')
    } catch {
      toast.error('Erro ao atualizar urgência do item')
    }
  }

  function abrirWhatsAppModelo(nomeModelo, extras = {}) {
    if (!os.cliente.telefone) { toast.error('Cliente sem telefone cadastrado'); return }
    const tel = os.cliente.telefone.replace(/\D/g, '')
    const modelo = mensagensProntas.find(m => m.nome === nomeModelo)
    const numero = String(os.numero).padStart(3, '0')
    const prazoFormatado = extras.prazo
      ? extras.prazo.split('T')[0].split('-').reverse().join('/')
      : (os.prazo_entrega ? os.prazo_entrega.split('T')[0].split('-').reverse().join('/') : 'a confirmar')
    const corpo = modelo
      ? modelo.corpo
          .replace(/\[nome\]/g, os.cliente.nome)
          .replace(/\[numero\]/g, '#' + numero)
          .replace(/\[novo_prazo\]/g, prazoFormatado)
      : `Olá ${os.cliente.nome}! Ref. serviço #${numero}. 🥿 Chico Sapateiro`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(corpo)}`, '_blank')
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

    const linhasItens = os.itens.map((item, idx) => {
      const isCalcado = CALCADOS_BASE.includes(item.categoria) ||
        categorias.some(c => c.nome === item.categoria && c.tipo === 'calcado')
      const tipoLabel = isCalcado ? 'Calçado' : 'Diversos'
      const emoji = EMOJI_CATEGORIA[item.categoria] || '📦'
      const qtd = item.quantidade || 1
      const servs = formatarServicosTexto(item)

      let linhaCategoria = `${emoji} ${item.categoria}`
      if (item.lado) linhaCategoria += ` · ${item.lado}`
      if (item.subcategoria) linhaCategoria += ` · ${item.subcategoria}`

      const linhas = [
        item.urgente
          ? `*⚡ URGENTE — Item ${idx + 1} — ${tipoLabel}*`
          : `*Item ${idx + 1} — ${tipoLabel}*`,
        linhaCategoria,
      ]
      if (item.cor) linhas.push(`🎨 Cor: ${item.cor}`)
      if (servs) linhas.push(`🔧 ${servs}`)
      if (item.revisao) {
        linhas.push(`💰 Sem cobrança (revisão)`)
      } else if (qtd > 1) {
        linhas.push(`💰 ${qtd}× ${formatarValor(item.valor)} = ${formatarValor(item.valor * qtd)}`)
      } else {
        linhas.push(`💰 ${formatarValor(item.valor)}`)
      }
      if (item.observacao_servico) linhas.push(`📝 ${item.observacao_servico}`)
      return linhas.join('\n')
    }).join('\n\n')

    const desconto = os.desconto || 0
    const msg = encodeURIComponent(
      `🥿 *CHICO SAPATEIRO*\n` +
      `📋 Nota #${String(os.numero).padStart(3, '0')} — ${os.cliente.nome}\n\n` +
      linhasItens + `\n\n` +
      `─────────────────\n` +
      (desconto > 0 ? `💰 Subtotal: ${formatarValor(os.subtotal)}\n🏷️ Desconto: -${formatarValor(desconto)}\n` : '') +
      `💰 Total: ${formatarValor(os.total)}\n` +
      `✅ Valor pago: ${formatarValor(os.entrada)}\n` +
      `⏳ Resta: ${formatarValor(os.resta)}\n` +
      (os.prazo_entrega ? `📅 Prazo: ${formatarData(os.prazo_entrega)}\n` : '') +
      `📌 ${os.status}\n\n` +
      `_Chico Sapateiro · (71) 3264-5659_`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  function enviarStatusWhatsApp() {
    if (!os.cliente.telefone) { toast.error('Cliente sem telefone cadastrado'); return }
    const tel = os.cliente.telefone.replace(/\D/g, '')

    const linhasItens = os.itens.map(item => {
      const servicos = item.servicos || []
      const concluidos = item.servicos_concluidos || []
      const todosFeitos = servicos.length > 0 && servicos.every(s => concluidos.includes(s))
      const statusItem = todosFeitos ? '✅ Pronto' : '⏳ Em andamento'
      const desc = descricaoItem(item)
      const servs = formatarServicosTexto(item)
      return `▪ ${desc}${servs ? ` — ${servs}` : ''}\n  Status: ${statusItem}`
    }).join('\n\n')

    const msg = encodeURIComponent(
      `🥿 *CHICO SAPATEIRO*\n` +
      `📋 Atualização da sua OS #${String(os.numero).padStart(3, '0')} — ${os.cliente.nome}\n\n` +
      `${linhasItens}\n\n` +
      `📌 Status geral: ${os.status}\n\n` +
      `_Chico Sapateiro · (71) 3264-5659_`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  function enviarPDFWhatsApp() {
    if (!os.cliente.telefone) { toast.error('Cliente sem telefone cadastrado'); return }
    gerarPDF()
    const tel = os.cliente.telefone.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Olá ${os.cliente.nome}! Segue sua nota de serviço do Chico Sapateiro 🥿`
    )
    setTimeout(() => {
      window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
    }, 800)
  }

  function imprimirEtiqueta() {
    const texto = gerarTextoEtiqueta(os)
    console.log('[Imprimir etiqueta] conteúdo enviado para impressão:', texto)

    let iframe = etiquetaIframeRef.current
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      etiquetaIframeRef.current = iframe
    }

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiqueta</title>` +
      `<style>body{margin:0;padding:0;font-family:'Courier New',monospace;font-size:12pt;white-space:pre-wrap;}</style>` +
      `</head><body>${escapeHtml(texto)}</body></html>`
    )
    doc.close()

    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  function gerarPDF() {
    const jsPDFCtor = window.jspdf?.jsPDF
    if (!jsPDFCtor) { toast.error('Biblioteca de PDF não carregada.'); return }
    const doc = new jsPDFCtor({ unit: 'mm', format: 'a4' })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let y = 15

    function linha(txt, opts = {}) {
      const { size = 11, bold = false, indent = 0, align = 'left', spaceAfter = 5 } = opts
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const x = align === 'center' ? pageWidth / 2 : 15 + indent
      const opts2 = align === 'center' ? { align: 'center' } : {}
      const linhas = doc.splitTextToSize(txt, pageWidth - 30 - indent)
      linhas.forEach(l => {
        if (y > pageHeight - 20) { doc.addPage(); y = 15 }
        doc.text(l, x, y, opts2)
        y += size * 0.45
      })
      y += spaceAfter
    }

    function separador() {
      if (y > pageHeight - 20) { doc.addPage(); y = 15 }
      doc.setDrawColor(180, 130, 50)
      doc.setLineWidth(0.3)
      doc.line(15, y, pageWidth - 15, y)
      y += 4
    }

    linha('CHICO SAPATEIRO', { size: 20, bold: true, align: 'center', spaceAfter: 2 })
    linha('Ordem de Servico', { size: 12, align: 'center', spaceAfter: 4 })
    separador()

    linha(`Nota N.: #${String(os.numero).padStart(3, '0')}`, { size: 12, bold: true, spaceAfter: 2 })
    linha(`Data: ${formatarData(os.criado_em)}`, { size: 11, spaceAfter: 2 })
    if (os.prazo_entrega) linha(`Prazo: ${formatarData(os.prazo_entrega)}`, { size: 11, spaceAfter: 2 })
    linha(`Status: ${os.status}`, { size: 11, spaceAfter: 4 })

    linha('CLIENTE', { size: 12, bold: true, spaceAfter: 2 })
    linha(`Nome: ${os.cliente.nome}`, { size: 11, spaceAfter: 2 })
    if (os.cliente.telefone) linha(`Telefone: ${os.cliente.telefone}`, { size: 11, spaceAfter: 4 })
    else y += 2

    separador()

    linha('ITENS', { size: 12, bold: true, spaceAfter: 3 })
    os.itens.forEach((item, idx) => {
      const qtd = item.quantidade || 1
      const isCalcado = CALCADOS_BASE.includes(item.categoria) ||
        categorias.some(c => c.nome === item.categoria && c.tipo === 'calcado')
      const tipoLabel = isCalcado ? 'Calcado' : 'Diversos'
      const prefixoUrgente = item.urgente ? 'URGENTE — ' : ''

      linha(`${prefixoUrgente}Item ${idx + 1} — ${tipoLabel}`, { size: 11, bold: true, spaceAfter: 1 })

      const partesCat = [item.categoria]
      if (item.lado) partesCat.push(item.lado)
      if (item.subcategoria) partesCat.push(item.subcategoria)
      linha(partesCat.join(' | '), { size: 11, indent: 4, spaceAfter: 1 })

      if (item.cor) linha(`Cor: ${item.cor}`, { size: 10, indent: 4, spaceAfter: 1 })

      const servs = formatarServicosTexto(item)
      if (servs) linha(`Servicos: ${servs}`, { size: 10, indent: 4, spaceAfter: 1 })

      if (item.revisao) {
        linha('Sem cobranca (revisao)', { size: 10, indent: 4, bold: true, spaceAfter: 1 })
      } else if (qtd > 1) {
        linha(`${qtd}x ${formatarValor(item.valor)} = ${formatarValor(item.valor * qtd)}`, { size: 10, indent: 4, bold: true, spaceAfter: 1 })
      } else {
        linha(`Valor: ${formatarValor(item.valor)}`, { size: 10, indent: 4, bold: true, spaceAfter: 1 })
      }

      if (item.observacao_servico) linha(`Obs. servico: ${item.observacao_servico}`, { size: 10, indent: 4, spaceAfter: 4 })
      else y += 3
    })

    separador()

    linha('PAGAMENTO', { size: 12, bold: true, spaceAfter: 2 })
    const desconto = os.desconto || 0
    if (desconto > 0) {
      linha(`Subtotal: ${formatarValor(os.subtotal)}`, { size: 11, spaceAfter: 1 })
      linha(`Desconto: -${formatarValor(desconto)}`, { size: 11, spaceAfter: 1 })
    }
    linha(`Total: ${formatarValor(os.total)}`, { size: 11, bold: true, spaceAfter: 1 })
    linha(`Valor pago: ${formatarValor(os.entrada)}`, { size: 11, spaceAfter: 1 })
    linha(`Resta: ${formatarValor(os.resta)}`, { size: 11, bold: true, spaceAfter: 1 })
    if (os.prazo_entrega) linha(`Prazo: ${formatarData(os.prazo_entrega)}`, { size: 11, spaceAfter: 1 })
    linha(`Situacao: ${os.status_pagamento}`, { size: 11, spaceAfter: 4 })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'italic')
    doc.text('Chico Sapateiro — Obrigado pela preferencia!', pageWidth / 2, pageHeight - 12, { align: 'center' })

    doc.save(`OS-${String(os.numero).padStart(3, '0')}-${os.cliente.nome.replace(/\s+/g, '_')}.pdf`)
  }

  if (loading) return <p className="text-center py-10 text-lg" style={{ color: '#999999' }}>Carregando...</p>
  if (!os) return null

  function temPrazoHoje() {
    if (!os.prazo_entrega) return false
    const hj = hojeISO()
    return String(os.prazo_entrega).split('T')[0] === hj
  }

  function pronta3Dias() {
    if (os.status !== 'Pronto para retirada') return false
    if (!os.atualizado_em) return false
    const diff = Date.now() - new Date(os.atualizado_em).getTime()
    return diff > 3 * 24 * 60 * 60 * 1000
  }

  const totalEdit = itensEdit.reduce(
    (s, it) => s + (it.revisao ? 0 : parseMoeda(it.valor) * (it.quantidade || 1)), 0
  )
  const entradaEditNum = parseMoeda(entradaEdit)
  const descontoEditNum = parseMoeda(descontoEdit)
  const totalEditLiquido = Math.max(0, totalEdit - descontoEditNum)
  const restaEdit = Math.max(0, totalEditLiquido - entradaEditNum)
  const entradaEditInvalida = entradaEditNum > totalEditLiquido
  const atraso = estaEmAtraso(os)

  const totalItens = os.itens.length
  const itensConcluidos = os.itens.filter(it => {
    const s = it.servicos || []
    if (s.length === 0) return false
    return s.every(x => (it.servicos_concluidos || []).includes(x))
  }).length
  const itensEntregues = os.itens.filter(it => it.entregue).length

  const btnCatEdit = (ativa) => ({
    padding: '6px 10px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 12,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
    backgroundColor: ativa ? '#3E1F12' : 'white',
    color: ativa ? 'white' : '#374151',
    borderColor: ativa ? '#3E1F12' : '#E8D5B0',
  })

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 no-print">
        <button onClick={() => navigate('/painel')}
          className="p-2 rounded-xl transition-colors hover:bg-gray-100"
          style={{ color: '#3E1F12' }}>
          <ArrowLeft size={26} />
        </button>
        <div>
          <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>
            Nota #{String(os.numero).padStart(3, '0')}
          </h2>
          <p className="text-sm" style={{ color: '#999999' }}>Criada em {formatarData(os.criado_em)}</p>
        </div>
      </div>

      {/* ── Alertas ── */}
      {os.urgente && (
        <div className="rounded-2xl p-3 flex items-center gap-2 font-bold"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
          <Zap size={22} />
          <span>OS marcada como URGENTE</span>
        </div>
      )}
      {atraso && (
        <div className="rounded-2xl p-3 flex items-center gap-2 font-bold"
          style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B' }}>
          <AlertTriangle size={22} />
          <span>OS em atraso — prazo era {formatarData(os.prazo_entrega)}</span>
        </div>
      )}

      {/* ── Resumo do cliente ── */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>{os.cliente.nome}</p>
              {os.urgente && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                  <Zap size={10} /> Urgente
                </span>
              )}
            </div>
            {os.cliente.telefone && <p style={{ color: '#999999' }}>{os.cliente.telefone}</p>}
          </div>
          <StatusBadge status={os.status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PagamentoBadge status={os.status_pagamento} />
          {os.prazo_entrega && (
            <span className="text-sm font-semibold" style={{ color: atraso ? '#EF4444' : '#999999' }}>
              📅 Prazo: {formatarData(os.prazo_entrega)}
            </span>
          )}
          {totalItens > 0 && (
            <span className="text-sm font-semibold" style={{ color: '#A0522D' }}>
              ✓ {itensConcluidos}/{totalItens} itens concluídos
            </span>
          )}
          {itensEntregues > 0 && (
            <span className="text-sm font-semibold" style={{ color: '#10B981' }}>
              📦 {itensEntregues} de {totalItens} {itensEntregues === 1 ? 'item entregue' : 'itens entregues'}
            </span>
          )}
        </div>
      </div>

      {/* ── Itens (visualização) ── */}
      {!editando ? (
        <div className="card space-y-3">
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #F0F0F0' }}>
            <h3 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>Itens</h3>
            <button onClick={iniciarEdicao}
              className="flex items-center gap-1 font-semibold text-sm hover:underline no-print"
              style={{ color: '#A0522D' }}>
              <Pencil size={16} /> Editar
            </button>
          </div>

          {os.itens.map(item => {
            const concluidos = item.servicos_concluidos || []
            const servicos = item.servicos || []
            const itemConcluido = servicos.length > 0 && servicos.every(s => concluidos.includes(s))
            const qtd = item.quantidade || 1
            return (
              <div key={item.id} className={`py-2 transition-opacity ${item.entregue ? 'opacity-60' : ''}`}
                style={{ borderBottom: '1px solid #F0F0F0' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {qtd > 1 && <span className="font-bold text-sm" style={{ color: '#1d4ed8' }}>{qtd}×</span>}
                      <p className={`font-bold ${item.entregue ? 'line-through' : ''}`}
                        style={{ color: item.entregue ? '#999999' : '#1A1A1A' }}>
                        {descricaoItem(item)}
                      </p>
                      {item.urgente && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                          <Zap size={9} /> Urgente
                        </span>
                      )}
                      {item.revisao && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: '#DBEAFE', color: '#1d4ed8', border: '1px solid #93C5FD' }}>
                          Revisão
                        </span>
                      )}
                      {item.entregue && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                          Entregue
                        </span>
                      )}
                    </div>

                    {servicos.length > 0 && (
                      <p className="text-sm mt-1" style={{ color: '#999999' }}>{formatarServicosTexto(item)}</p>
                    )}

                    {item.cor && <p className="text-sm mt-1" style={{ color: '#999999' }}>Cor: {item.cor}</p>}
                    {item.observacao_servico && (
                      <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
                        <span className="font-semibold">Obs. serviço:</span> {item.observacao_servico}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {servicos.length > 0 && !item.entregue && (
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                          <input
                            type="checkbox"
                            checked={itemConcluido}
                            onChange={() => toggleItemConcluido(item.id)}
                            className="w-5 h-5 cursor-pointer"
                            style={{ accentColor: '#3E1F12' }}
                          />
                          <span className={itemConcluido ? 'line-through' : 'font-semibold'}
                            style={{ color: itemConcluido ? '#999999' : '#A0522D' }}>
                            Item concluído
                          </span>
                        </label>
                      )}
                      {!item.entregue ? (
                        <button
                          onClick={() => toggleEntregue(item.id)}
                          className="text-xs font-bold rounded-lg px-2.5 py-1 transition-colors"
                          style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}
                        >
                          Marcar como entregue
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleEntregue(item.id)}
                          className="text-xs font-bold rounded-lg px-2.5 py-1 transition-colors"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
                        >
                          Desfazer entrega
                        </button>
                      )}
                      <button
                        onClick={() => toggleItemUrgente(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1 transition-colors"
                        style={item.urgente
                          ? { backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }
                          : { backgroundColor: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }}
                      >
                        <Zap size={11} />
                        {item.urgente ? 'Urgente' : 'Marcar urgente'}
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {item.revisao ? (
                      <p className="font-bold text-sm" style={{ color: '#1d4ed8' }}>Sem cobrança</p>
                    ) : qtd > 1 ? (
                      <>
                        <p className="text-xs" style={{ color: '#999999' }}>{formatarValor(item.valor)} cada</p>
                        <p className="font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(item.valor * qtd)}</p>
                      </>
                    ) : (
                      <p className="font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(item.valor)}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {(os.desconto || 0) > 0 && (
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ backgroundColor: '#F3F4F6' }}>
                <p className="text-xs font-semibold" style={{ color: '#999999' }}>Subtotal</p>
                <p className="font-semibold" style={{ color: '#4B5563' }}>{formatarValor(os.subtotal)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ backgroundColor: '#FEE2E2' }}>
                <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>Desconto</p>
                <p className="font-semibold" style={{ color: '#dc2626' }}>- {formatarValor(os.desconto)}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="rounded-xl p-3" style={{ backgroundColor: '#F5ECD7' }}>
              <p className="text-xs font-semibold" style={{ color: '#999999' }}>Total</p>
              <p className="font-extrabold text-lg" style={{ color: '#3E1F12' }}>{formatarValor(os.total)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: '#D1FAE5' }}>
              <p className="text-xs font-semibold" style={{ color: '#999999' }}>Valor pago</p>
              <p className="font-extrabold text-lg" style={{ color: '#065F46' }}>{formatarValor(os.entrada)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: '#FFF7ED' }}>
              <p className="text-xs font-semibold" style={{ color: '#999999' }}>Resta</p>
              <p className="font-extrabold text-lg" style={{ color: '#F59E0B' }}>{formatarValor(os.resta)}</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Modo edição ── */
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #F0F0F0' }}>
            <h3 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>Editando OS</h3>
            <button onClick={() => setEditando(false)} style={{ color: '#999999' }}>
              <X size={22} />
            </button>
          </div>

          {itensEdit.map((item, idx) => {
            const calcado = ehCalcado(item.categoria) ||
              categorias.some(c => c.nome === item.categoria && c.tipo === 'calcado')
            const sandalia = item.categoria === 'Sandália'
            const custom = item.servicos.filter(s => !SERVICOS.includes(s))
            return (
              <div key={idx} className="rounded-2xl p-3 space-y-3"
                style={{ border: '1px solid #F0F0F0' }}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm" style={{ color: '#A0522D' }}>Item {idx + 1}</span>
                  {itensEdit.length > 1 && (
                    <button type="button" onClick={() => setItensEdit(p => p.filter((_, i) => i !== idx))}
                      style={{ color: '#EF4444' }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                {/* Categoria */}
                <div>
                  <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Categoria</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categorias.map(catObj => {
                      const cat = catObj.nome
                      const isBase = CATEGORIAS_BASE.has(cat)
                      const ativa = item.categoria === cat
                      return (
                        <div key={catObj.id} className="relative group">
                          <button type="button"
                            onClick={() => {
                              const oldIsMala = ehMala(item.categoria)
                              const newIsMala = ehMala(cat)
                              const newIsCalcado = ehCalcado(cat)
                              setItemEdit(idx, 'categoria', cat)
                              if (cat !== 'Sandália') setItemEdit(idx, 'subcategoria', '')
                              if (oldIsMala || newIsMala || (!newIsCalcado && !newIsMala)) setItemEdit(idx, 'lado', '')
                            }}
                            style={{ ...btnCatEdit(ativa), paddingRight: !isBase ? 24 : 10 }}>
                            {cat}
                          </button>
                          {!isBase && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); deletarCategoriaEdit(catObj.id, cat) }}
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: '#EF4444' }}>
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )
                    })}
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
                        <button type="button" className="text-white p-1.5 rounded-lg"
                          style={{ backgroundColor: '#3E1F12' }}
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
                        className="flex items-center gap-1 font-semibold text-xs"
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
                        <Plus size={12} /> Nova
                      </button>
                    )}
                  </div>
                </div>

                {calcado && (
                  <div>
                    <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Qual peça?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LADOS.map(l => (
                        <button key={l} type="button"
                          onClick={() => setItemEdit(idx, 'lado', l)}
                          style={btnCatEdit(item.lado === l)}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sandalia && (
                  <div>
                    <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Tipo de sandália</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBCATEGORIAS_SANDALIA.map(sc => (
                        <button key={sc} type="button"
                          onClick={() => setItemEdit(idx, 'subcategoria', sc)}
                          style={btnCatEdit(item.subcategoria === sc)}>
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {ehMala(item.categoria) && (
                  <>
                    <div>
                      <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Tamanho</p>
                      <div className="flex flex-wrap gap-1.5">
                        {MALA_TAMANHOS.map(t => (
                          <button key={t} type="button"
                            onClick={() => setItemEdit(idx, 'subcategoria', t)}
                            style={btnCatEdit(item.subcategoria === t)}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Material</p>
                      <div className="flex flex-wrap gap-1.5">
                        {MALA_MATERIAIS.map(m => (
                          <button key={m} type="button"
                            onClick={() => setItemEdit(idx, 'lado', m)}
                            style={btnCatEdit(item.lado === m)}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Serviços */}
                <div>
                  <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Serviços</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICOS.map(s => (
                      <button key={s} type="button" onClick={() => toggleServicoEdit(idx, s)}
                        style={btnCatEdit(item.servicos.includes(s))}>
                        {s}
                      </button>
                    ))}
                    {servicosCustomDB.map(sc => (
                      <div key={sc.id} className="relative group">
                        <button type="button" onClick={() => toggleServicoEdit(idx, sc.nome)}
                          style={{ ...btnCatEdit(item.servicos.includes(sc.nome)), paddingRight: 24 }}>
                          {sc.nome}
                        </button>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); deletarServicoCustom(sc.id, sc.nome) }}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: '#EF4444' }}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                    {custom.filter(s => !servicosCustomDB.some(sc => sc.nome === s)).map(s => (
                      <button key={s} type="button" onClick={() => toggleServicoEdit(idx, s)}
                        className="flex items-center gap-1"
                        style={{ padding: '6px 10px', borderRadius: 8, fontWeight: 600, fontSize: 12, backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }}>
                        {s} <X size={12} />
                      </button>
                    ))}
                    {servicoCustomModo === idx ? (
                      <div className="flex items-center gap-1 w-full mt-1">
                        <input autoFocus className="input-field flex-1 py-1.5 text-sm"
                          placeholder="Serviço personalizado" value={servicoCustomTexto}
                          onChange={e => setServicoCustomTexto(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); adicionarServicoCustom(idx) }
                          }}
                        />
                        <button type="button" className="text-white p-1.5 rounded-lg"
                          style={{ backgroundColor: '#3E1F12' }}
                          onClick={() => adicionarServicoCustom(idx)}>
                          <Check size={16} />
                        </button>
                        <button type="button" className="bg-gray-100 text-gray-500 p-1.5 rounded-lg"
                          onClick={() => { setServicoCustomModo(null); setServicoCustomTexto('') }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setServicoCustomModo(idx)}
                        className="flex items-center gap-1 font-semibold text-xs"
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
                        <Plus size={12} /> Adicionar serviço
                      </button>
                    )}
                  </div>
                  {item.servicos.includes('Trocar roda') && (
                    <div className="mt-2">
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#4B5563' }}>Qtd. de rodas (1–8)</label>
                      <div className="flex items-center gap-1.5">
                        <button type="button"
                          onClick={() => setItemEdit(idx, 'qtd_rodas', Math.max(1, (item.qtd_rodas || 2) - 1))}
                          className="w-8 h-9 rounded-lg font-bold text-base flex items-center justify-center shrink-0 transition-colors"
                          style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                          −
                        </button>
                        <input className="input-field text-sm py-2 text-center font-bold flex-1"
                          type="number" inputMode="numeric" min="1" max="8"
                          value={item.qtd_rodas || 2}
                          onChange={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v)) setItemEdit(idx, 'qtd_rodas', Math.min(8, Math.max(1, v)))
                          }}
                        />
                        <button type="button"
                          onClick={() => setItemEdit(idx, 'qtd_rodas', Math.min(8, (item.qtd_rodas || 2) + 1))}
                          className="w-8 h-9 rounded-lg font-bold text-base flex items-center justify-center shrink-0 transition-colors"
                          style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2">
                    <label className="block font-bold text-xs mb-1" style={{ color: '#1A1A1A' }}>Observação do serviço</label>
                    <textarea className="input-field text-sm" rows={2}
                      placeholder="Descreva o que deve ser feito..."
                      value={item.observacao_servico}
                      onChange={e => setItemEdit(idx, 'observacao_servico', e.target.value)} />
                  </div>
                </div>

                {/* Revisão */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.revisao || false}
                      onChange={e => {
                        setItemEdit(idx, 'revisao', e.target.checked)
                        if (e.target.checked) setItemEdit(idx, 'valor', '0')
                      }}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: '#3E1F12' }}
                    />
                    <span className="font-bold text-xs" style={{ color: '#1A1A1A' }}>Revisão / Garantia (sem cobrança)</span>
                  </label>
                </div>

                {/* Quantidade */}
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: '#4B5563' }}>Quantidade</label>
                  <div className="flex items-center gap-1.5">
                    <button type="button"
                      onClick={() => setItemEdit(idx, 'quantidade', Math.max(1, (item.quantidade || 1) - 1))}
                      className="w-8 h-9 rounded-lg font-bold text-base flex items-center justify-center shrink-0 transition-colors"
                      style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                      −
                    </button>
                    <input
                      className="input-field text-sm py-2 text-center font-bold flex-1"
                      type="number" inputMode="numeric" min="1"
                      value={item.quantidade || 1}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        if (!isNaN(v)) setItemEdit(idx, 'quantidade', Math.max(1, v))
                      }}
                    />
                    <button type="button"
                      onClick={() => setItemEdit(idx, 'quantidade', (item.quantidade || 1) + 1)}
                      className="w-8 h-9 rounded-lg font-bold text-base flex items-center justify-center shrink-0 transition-colors"
                      style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                      +
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-field text-sm py-2" placeholder="Cor"
                    value={item.cor} onChange={e => setItemEdit(idx, 'cor', e.target.value)} />
                  <input className="input-field font-bold text-sm py-2" placeholder="Valor unit." inputMode="decimal"
                    disabled={item.revisao}
                    value={item.valor} onChange={e => setItemEdit(idx, 'valor', e.target.value)} />
                </div>
              </div>
            )
          })}

          <button type="button"
            onClick={() => setItensEdit(p => [...p, itemVazio()])}
            className="w-full font-bold py-2 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
            style={{ border: '1px dashed #A0522D', color: '#A0522D', backgroundColor: 'transparent' }}>
            <Plus size={16} /> Adicionar item
          </button>

          {/* Prazo */}
          <div>
            <label className="block font-bold mb-2 text-sm" style={{ color: '#1A1A1A' }}>Prazo de entrega</label>
            <SeletorPrazo value={prazoEdit} onChange={setPrazoEdit} />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ backgroundColor: '#F5ECD7' }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#999999' }}>Total</p>
              {descontoEditNum > 0 && (
                <p className="text-xs" style={{ color: '#999999' }}>Subtotal {formatarValor(totalEdit)} − desc. {formatarValor(descontoEditNum)}</p>
              )}
            </div>
            <p className="font-extrabold" style={{ color: '#3E1F12' }}>{formatarValor(totalEditLiquido)}</p>
          </div>

          <div>
            <label className="block font-bold mb-1 text-sm" style={{ color: '#1A1A1A' }}>Valor pago (R$)</label>
            <input className="input-field text-xl font-bold"
              style={entradaEditInvalida ? { borderColor: '#EF4444' } : {}}
              inputMode="decimal" placeholder="0,00"
              value={entradaEdit} onChange={e => setEntradaEdit(e.target.value)} />
          </div>

          <div>
            <label className="block font-bold mb-1 text-sm" style={{ color: '#1A1A1A' }}>Desconto (R$)</label>
            <input className="input-field" inputMode="decimal" placeholder="0,00"
              value={descontoEdit} onChange={e => setDescontoEdit(e.target.value)} />
          </div>

          {entradaEditInvalida && (
            <p className="text-sm font-semibold flex items-center gap-1" style={{ color: '#EF4444' }}>
              ⚠ O valor pago não pode ser maior que o valor total
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ backgroundColor: '#FFF7ED' }}>
            <p className="text-xs font-semibold" style={{ color: '#999999' }}>Resta</p>
            <p className="font-extrabold" style={{ color: '#F59E0B' }}>{formatarValor(restaEdit)}</p>
          </div>

          <button onClick={salvarEdicao} disabled={salvando || entradaEditInvalida}
            className="w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-colors"
            style={entradaEditInvalida
              ? { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }
              : { backgroundColor: '#3E1F12', color: 'white', cursor: 'pointer' }}>
            <Check size={20} />
            {salvando ? 'Salvando...' : entradaEditInvalida ? 'Entrada maior que o total' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {/* ── Produtos vendidos nesta OS ── */}
      {!editando && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #F0F0F0' }}>
            <h3 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>Produtos vendidos</h3>
            <button
              onClick={abrirModalAdicionarProduto}
              className="flex items-center gap-1 font-semibold text-sm no-print"
              style={{ color: '#A0522D' }}
            >
              <Plus size={16} /> Adicionar produto
            </button>
          </div>

          {vendasProdutos.length === 0 ? (
            <p className="text-sm text-center py-2" style={{ color: '#999999' }}>
              Nenhum produto vinculado a esta OS
            </p>
          ) : (
            <>
              {vendasProdutos.map(v => (
                <div key={v.id} className="flex items-center justify-between py-1.5"
                  style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{v.produto_nome}</p>
                    <p className="text-xs" style={{ color: '#999999' }}>
                      {v.quantidade} × {formatarValor(v.preco_unitario)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-extrabold" style={{ color: '#10B981' }}>{formatarValor(v.total)}</p>
                    <button onClick={() => cancelarVendaOS(v.id)} className="no-print"
                      style={{ color: '#EF4444' }}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl px-4 py-2"
                style={{ backgroundColor: '#D1FAE5' }}>
                <p className="text-sm font-semibold" style={{ color: '#065F46' }}>Subtotal de produtos</p>
                <p className="font-extrabold" style={{ color: '#065F46' }}>
                  {formatarValor(vendasProdutos.reduce((s, v) => s + v.total, 0))}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal adicionar produto na OS */}
      {modalAdicionarProduto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold" style={{ color: '#1A1A1A' }}>Adicionar produto</h3>
              <button onClick={() => setModalAdicionarProduto(false)} style={{ color: '#999999' }}>
                <X size={24} />
              </button>
            </div>

            {produtosDisponiveis.length === 0 ? (
              <p className="text-center py-6 text-gray-400">Nenhum produto com estoque disponível</p>
            ) : (
              <>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {produtosDisponiveis.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setProdutoSelecionadoId(String(p.id)); setQtdVendaOS(1) }}
                      className="w-full text-left rounded-xl p-3 transition-colors"
                      style={String(p.id) === produtoSelecionadoId
                        ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
                        : { backgroundColor: 'white', border: '1px solid #F0F0F0', color: '#1A1A1A' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{p.nome}</span>
                        <span className="text-sm font-semibold">{formatarValor(p.preco_venda)}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{
                        color: String(p.id) === produtoSelecionadoId ? 'rgba(255,255,255,0.7)' : '#999999'
                      }}>
                        Estoque: {p.quantidade_estoque} un.
                      </p>
                    </button>
                  ))}
                </div>

                {produtoSelecionadoId && (() => {
                  const p = produtosDisponiveis.find(x => String(x.id) === produtoSelecionadoId)
                  return p ? (
                    <>
                      <div className="mb-3">
                        <label className="block font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>Quantidade</label>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQtdVendaOS(q => Math.max(1, q - 1))}
                            className="w-12 h-12 rounded-xl font-bold text-xl flex items-center justify-center"
                            style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                            −
                          </button>
                          <input className="input-field text-center font-bold text-xl flex-1"
                            type="number" inputMode="numeric" min="1" max={p.quantidade_estoque}
                            value={qtdVendaOS}
                            onChange={e => setQtdVendaOS(Math.max(1, Math.min(p.quantidade_estoque, parseInt(e.target.value) || 1)))}
                          />
                          <button onClick={() => setQtdVendaOS(q => Math.min(p.quantidade_estoque, q + 1))}
                            className="w-12 h-12 rounded-xl font-bold text-xl flex items-center justify-center"
                            style={{ border: '1px solid #E8D5B0', backgroundColor: 'white', color: '#374151' }}>
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-4"
                        style={{ backgroundColor: '#D1FAE5' }}>
                        <span className="font-semibold text-gray-600">Total</span>
                        <span className="font-extrabold text-xl" style={{ color: '#065F46' }}>
                          {formatarValor(p.preco_venda * qtdVendaOS)}
                        </span>
                      </div>
                    </>
                  ) : null
                })()}

                <button onClick={confirmarVendaOS} disabled={salvandoVenda || !produtoSelecionadoId}
                  className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl"
                  style={!produtoSelecionadoId
                    ? { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }
                    : { backgroundColor: '#10B981' }}>
                  <ShoppingCart size={20} />
                  {salvandoVenda ? 'Adicionando...' : 'Adicionar à OS'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Status da OS ── */}
      <div className="card no-print">
        <h3 className="text-lg font-bold mb-3" style={{ color: '#1A1A1A' }}>Status da OS</h3>
        <div className="space-y-2">
          {STATUS_LISTA.map(s => (
            <button key={s} onClick={() => atualizarStatus(s)}
              disabled={salvando || os.status === s}
              className="w-full py-3 px-4 rounded-xl font-bold text-left text-lg transition-all"
              style={os.status === s
                ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
                : { backgroundColor: 'white', color: '#374151', border: '1px solid #F0F0F0' }}>
              {os.status === s ? `✓ ${s}` : s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Urgência da OS ── */}
      <div className="card no-print transition-colors"
        style={os.urgente
          ? { border: '2px solid #FCA5A5', backgroundColor: '#FEF2F2' }
          : { border: '1px solid #F0F0F0', backgroundColor: 'white' }}>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={os.urgente || false}
            onChange={toggleUrgente}
            disabled={salvando}
            className="w-6 h-6 cursor-pointer shrink-0"
            style={{ accentColor: '#DC2626' }}
          />
          <div>
            <p className="font-extrabold text-base" style={{ color: os.urgente ? '#DC2626' : '#1A1A1A' }}>
              🔴 Marcar como urgente
            </p>
            {os.urgente ? (
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#DC2626' }}>
                OS urgente — aparece no topo do painel
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: '#999999' }}>
                OS urgentes sobem para o topo do painel
              </p>
            )}
          </div>
        </label>
      </div>

      {/* ── Mensagens rápidas WhatsApp ── */}
      {os.cliente.telefone && (
        <div className="card space-y-2 no-print">
          <h3 className="text-base font-bold pb-2" style={{ color: '#1A1A1A', borderBottom: '1px solid #F0F0F0' }}>
            Mensagens rápidas
          </h3>
          <div className="flex flex-col gap-2">
            {atraso && (
              <button onClick={() => abrirWhatsAppModelo('Serviço atrasado')}
                className="flex items-center gap-2 font-bold py-2.5 px-3 rounded-xl text-sm"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
                <AlertTriangle size={16} /> Avisar atraso
              </button>
            )}
            {temPrazoHoje() && os.status === 'Em andamento' && (
              <button onClick={() => abrirWhatsAppModelo('Serviço em andamento')}
                className="flex items-center gap-2 font-bold py-2.5 px-3 rounded-xl text-sm"
                style={{ backgroundColor: '#FFF7ED', color: '#92400E', border: '1px solid #FED7AA' }}>
                <Send size={16} /> Serviço em andamento
              </button>
            )}
            {os.status === 'Pronto para retirada' && !pronta3Dias() && (
              <button onClick={() => abrirWhatsAppModelo('Serviço pronto para retirada')}
                className="flex items-center gap-2 font-bold py-2.5 px-3 rounded-xl text-sm"
                style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                <MessageCircle size={16} /> Avisar que está pronto
              </button>
            )}
            {pronta3Dias() && (
              <button onClick={() => abrirWhatsAppModelo('Lembrete de retirada')}
                className="flex items-center gap-2 font-bold py-2.5 px-3 rounded-xl text-sm"
                style={{ backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                <MessageCircle size={16} /> Lembrete de retirada
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Ações ── */}
      <div className="grid grid-cols-2 gap-3 no-print">
        <button onClick={abrirWhatsApp}
          className="flex items-center justify-center gap-2 text-white font-bold py-3 px-3 rounded-xl"
          style={{ backgroundColor: '#22c55e' }}>
          <MessageCircle size={18} /> <span className="text-sm">Nota WhatsApp</span>
        </button>
        <button onClick={enviarStatusWhatsApp}
          className="flex items-center justify-center gap-2 text-white font-bold py-3 px-3 rounded-xl"
          style={{ backgroundColor: '#14b8a6' }}>
          <Send size={18} /> <span className="text-sm">Status WhatsApp</span>
        </button>
        <button onClick={gerarPDF}
          className="flex items-center justify-center gap-2 text-white font-bold py-3 px-3 rounded-xl"
          style={{ backgroundColor: '#EF4444' }}>
          <FileText size={18} /> <span className="text-sm">Gerar PDF</span>
        </button>
        <button onClick={enviarPDFWhatsApp}
          className="flex items-center justify-center gap-2 text-white font-bold py-3 px-3 rounded-xl"
          style={{ backgroundColor: '#A0522D' }}>
          <FileText size={18} /> <span className="text-sm">Enviar PDF</span>
        </button>
      </div>
      <button onClick={imprimirEtiqueta}
        className="flex items-center justify-center gap-2 text-white font-bold py-3 px-3 rounded-xl w-full no-print"
        style={{ backgroundColor: '#3E1F12' }}>
        <Tag size={18} /> <span className="text-sm">Imprimir etiqueta</span>
      </button>

      <button onClick={() => {
          console.log('[Imprimir nota] imprimindo a página inteira da OS via window.print()')
          window.print()
        }}
        className="flex items-center justify-center gap-2 btn-secondary py-3 px-3 w-full no-print">
        <Printer size={20} /> <span className="text-sm">Imprimir</span>
      </button>

      <button onClick={deletarOS}
        className="flex items-center justify-center gap-2 btn-danger w-full no-print">
        <Trash2 size={20} /> Excluir OS
      </button>
    </div>
  )
}
