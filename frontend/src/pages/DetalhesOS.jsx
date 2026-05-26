import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, MessageCircle, Printer, Trash2, Pencil, Plus, X, Check, FileText, AlertTriangle, Send } from 'lucide-react'
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
    cor: '', descricao: '', observacao_servico: '',
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
  const [servicosCustomDB, setServicosCustomDB] = useState([])
  const [itensEdit, setItensEdit] = useState([])
  const [entradaEdit, setEntradaEdit] = useState('')
  const [descontoEdit, setDescontoEdit] = useState('')
  const [prazoEdit, setPrazoEdit] = useState('')
  const [novaCategoriaModo, setNovaCategoriaModo] = useState(null) // idx do item
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [servicoCustomModo, setServicoCustomModo] = useState(null) // idx do item
  const [servicoCustomTexto, setServicoCustomTexto] = useState('')

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
      descricao: i.descricao || '',
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
    // Persistir no banco
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
      if (!it.categoria) { toast.error(`Item ${i + 1}: selecione a categoria`); return }
      if (it.categoria === 'Sandália' && !it.subcategoria) {
        toast.error(`Item ${i + 1}: escolha "Rasteira" ou "Com salto"`); return
      }
      if (ehCalcado(it.categoria) && !it.lado) {
        toast.error(`Item ${i + 1}: selecione Par, Pé esquerdo ou Pé direito`); return
      }
      if (!it.servicos.length) { toast.error(`Item ${i + 1}: selecione pelo menos um serviço`); return }
    }
    setSalvando(true)
    try {
      // Preserva checklist e estado de entrega pelos ids/posição.
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
            descricao: it.descricao,
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
      const qtd = item.quantidade || 1
      const partes = [qtd > 1 ? `${qtd}× ${descricaoItem(item)}` : descricaoItem(item)]
      if (item.cor) partes.push(`Cor: ${item.cor}`)
      if (servs) partes.push(servs)
      if (item.observacao_servico) partes.push(`Obs: ${item.observacao_servico}`)
      if (item.descricao) partes.push(item.descricao)
      if (item.revisao) {
        partes.push('Revisão (sem cobrança)')
      } else if (qtd > 1) {
        partes.push(`${formatarValor(item.valor)} cada — Total: ${formatarValor(item.valor * qtd)}`)
      } else {
        partes.push(formatarValor(item.valor))
      }
      return `▪ ${partes.join(' — ')}`
    }).join('\n')

    const desconto = os.desconto || 0
    const linhaDesconto = desconto > 0 ? `🏷️ Desconto: - ${formatarValor(desconto)}\n` : ''

    const msg = encodeURIComponent(
      `🥿 *CHICO SAPATEIRO*\n` +
      `📋 Nota #${String(os.numero).padStart(3, '0')} — ${os.cliente.nome}\n\n` +
      `${linhasItens}\n\n` +
      (desconto > 0 ? `💰 Subtotal: ${formatarValor(os.subtotal)}\n` : '') +
      `${linhaDesconto}` +
      `💰 Total: ${formatarValor(os.total)}\n` +
      `✅ Valor pago: ${formatarValor(os.entrada)}\n` +
      `⏳ Resta: ${formatarValor(os.resta)}\n` +
      (os.prazo_entrega ? `📅 Prazo: ${formatarData(os.prazo_entrega)}\n` : '') +
      `📌 Status: ${os.status}`
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

    // Cabeçalho
    linha('CHICO SAPATEIRO', { size: 20, bold: true, align: 'center', spaceAfter: 2 })
    linha('Ordem de Serviço', { size: 12, align: 'center', spaceAfter: 4 })
    separador()

    // Dados da OS
    linha(`Nota Nº: #${String(os.numero).padStart(3, '0')}`, { size: 12, bold: true, spaceAfter: 2 })
    linha(`Data: ${formatarData(os.criado_em)}`, { size: 11, spaceAfter: 2 })
    if (os.prazo_entrega) linha(`Prazo de entrega: ${formatarData(os.prazo_entrega)}`, { size: 11, spaceAfter: 2 })
    linha(`Status: ${os.status}`, { size: 11, spaceAfter: 4 })

    // Cliente
    linha('CLIENTE', { size: 12, bold: true, spaceAfter: 2 })
    linha(`Nome: ${os.cliente.nome}`, { size: 11, spaceAfter: 2 })
    if (os.cliente.telefone) linha(`Telefone: ${os.cliente.telefone}`, { size: 11, spaceAfter: 4 })
    else y += 2

    separador()

    // Itens
    linha('ITENS', { size: 12, bold: true, spaceAfter: 3 })
    os.itens.forEach((item, idx) => {
      const qtd = item.quantidade || 1
      const tituloItem = qtd > 1
        ? `${idx + 1}. ${qtd}× ${descricaoItem(item)}`
        : `${idx + 1}. ${descricaoItem(item)}`
      linha(tituloItem, { size: 11, bold: true, spaceAfter: 1 })
      const servs = formatarServicosTexto(item)
      if (servs) linha(`Serviços: ${servs}`, { size: 10, indent: 4, spaceAfter: 1 })
      if (item.cor) linha(`Cor: ${item.cor}`, { size: 10, indent: 4, spaceAfter: 1 })
      if (item.observacao_servico) linha(`Observação do serviço: ${item.observacao_servico}`, { size: 10, indent: 4, spaceAfter: 1 })
      if (item.descricao) linha(`Observação: ${item.descricao}`, { size: 10, indent: 4, spaceAfter: 1 })
      if (item.revisao) {
        linha('Revisão (sem cobrança)', { size: 10, indent: 4, bold: true, spaceAfter: 4 })
      } else if (qtd > 1) {
        linha(`Valor unit.: ${formatarValor(item.valor)}  ×  ${qtd}  =  ${formatarValor(item.valor * qtd)}`, { size: 10, indent: 4, bold: true, spaceAfter: 4 })
      } else {
        linha(`Valor: ${formatarValor(item.valor)}`, { size: 10, indent: 4, bold: true, spaceAfter: 4 })
      }
    })

    separador()

    // Pagamento
    linha('PAGAMENTO', { size: 12, bold: true, spaceAfter: 2 })
    const desconto = os.desconto || 0
    if (desconto > 0) {
      linha(`Subtotal: ${formatarValor(os.subtotal)}`, { size: 11, spaceAfter: 1 })
      linha(`Desconto: - ${formatarValor(desconto)}`, { size: 11, spaceAfter: 1 })
    }
    linha(`Total: ${formatarValor(os.total)}`, { size: 11, spaceAfter: 1 })
    linha(`Valor pago: ${formatarValor(os.entrada)}`, { size: 11, spaceAfter: 1 })
    linha(`Resta: ${formatarValor(os.resta)}`, { size: 11, bold: true, spaceAfter: 1 })
    linha(`Situação: ${os.status_pagamento}`, { size: 11, spaceAfter: 4 })

    // Rodapé
    const rodape = 'Chico Sapateiro — Obrigado pela preferência!'
    doc.setFontSize(11)
    doc.setFont('helvetica', 'italic')
    doc.text(rodape, pageWidth / 2, pageHeight - 12, { align: 'center' })

    doc.save(`OS-${String(os.numero).padStart(3, '0')}-${os.cliente.nome.replace(/\s+/g, '_')}.pdf`)
  }

  if (loading) return <p className="text-center py-10 text-lg text-gray-500">Carregando...</p>
  if (!os) return null

  const totalEdit = itensEdit.reduce(
    (s, it) => s + (it.revisao ? 0 : parseMoeda(it.valor) * (it.quantidade || 1)), 0
  )
  const entradaEditNum = parseMoeda(entradaEdit)
  const descontoEditNum = parseMoeda(descontoEdit)
  const totalEditLiquido = Math.max(0, totalEdit - descontoEditNum)
  const restaEdit = Math.max(0, totalEditLiquido - entradaEditNum)
  const entradaEditInvalida = entradaEditNum > totalEditLiquido
  const atraso = estaEmAtraso(os)

  // Progresso de itens
  const totalItens = os.itens.length
  const itensConcluidos = os.itens.filter(it => {
    const s = it.servicos || []
    if (s.length === 0) return false
    return s.every(x => (it.servicos_concluidos || []).includes(x))
  }).length
  const itensEntregues = os.itens.filter(it => it.entregue).length

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

      {/* ── Alerta de atraso ── */}
      {atraso && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-3 flex items-center gap-2 text-red-700 font-bold">
          <AlertTriangle size={22} />
          <span>OS em atraso — prazo era {formatarData(os.prazo_entrega)}</span>
        </div>
      )}

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
            <span className={`text-sm font-semibold ` + (atraso ? 'text-red-600' : 'text-gray-500')}>
              📅 Prazo: {formatarData(os.prazo_entrega)}
            </span>
          )}
          {totalItens > 0 && (
            <span className="text-sm font-semibold text-amber-700">
              ✓ {itensConcluidos}/{totalItens} itens concluídos
            </span>
          )}
          {itensEntregues > 0 && (
            <span className="text-sm font-semibold text-green-700">
              📦 {itensEntregues} de {totalItens} {itensEntregues === 1 ? 'item entregue' : 'itens entregues'}
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

          {os.itens.map(item => {
            const concluidos = item.servicos_concluidos || []
            const servicos = item.servicos || []
            const itemConcluido = servicos.length > 0 && servicos.every(s => concluidos.includes(s))
            const qtd = item.quantidade || 1
            return (
              <div key={item.id} className={`py-2 border-b last:border-0 transition-opacity ${item.entregue ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {qtd > 1 && <span className="font-bold text-blue-700 text-sm">{qtd}×</span>}
                      <p className={`font-bold ${item.entregue ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {descricaoItem(item)}
                      </p>
                      {item.revisao && (
                        <span className="bg-blue-100 text-blue-700 border border-blue-300 rounded-lg px-2 py-0.5 text-xs font-bold">
                          Revisão
                        </span>
                      )}
                      {item.entregue && (
                        <span className="bg-green-100 text-green-700 border border-green-300 rounded-lg px-2 py-0.5 text-xs font-bold">
                          Entregue
                        </span>
                      )}
                    </div>

                    {/* Serviços como texto */}
                    {servicos.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">{formatarServicosTexto(item)}</p>
                    )}

                    {item.cor && <p className="text-sm text-gray-500 mt-1">Cor: {item.cor}</p>}
                    {item.observacao_servico && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-semibold">Obs. serviço:</span> {item.observacao_servico}
                      </p>
                    )}
                    {item.descricao && <p className="text-sm text-gray-400 italic mt-1">{item.descricao}</p>}

                    {/* Checklist simplificado + botão de entrega */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {servicos.length > 0 && !item.entregue && (
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                          <input
                            type="checkbox"
                            checked={itemConcluido}
                            onChange={() => toggleItemConcluido(item.id)}
                            className="w-5 h-5 accent-amber-600 cursor-pointer"
                          />
                          <span className={itemConcluido ? 'line-through text-gray-400' : 'text-amber-700 font-semibold'}>
                            Item concluído
                          </span>
                        </label>
                      )}
                      {!item.entregue ? (
                        <button
                          onClick={() => toggleEntregue(item.id)}
                          className="text-xs font-bold text-green-700 border border-green-400 bg-green-50 rounded-lg px-2.5 py-1 hover:bg-green-100 transition-colors"
                        >
                          Marcar como entregue
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleEntregue(item.id)}
                          className="text-xs font-bold text-gray-500 border border-gray-300 bg-gray-50 rounded-lg px-2.5 py-1 hover:bg-gray-100 transition-colors"
                        >
                          Desfazer entrega
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {item.revisao ? (
                      <p className="font-bold text-blue-600 text-sm">Sem cobrança</p>
                    ) : qtd > 1 ? (
                      <>
                        <p className="text-xs text-gray-500">{formatarValor(item.valor)} cada</p>
                        <p className="font-extrabold text-amber-700">{formatarValor(item.valor * qtd)}</p>
                      </>
                    ) : (
                      <p className="font-extrabold text-amber-700">{formatarValor(item.valor)}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {(os.desconto || 0) > 0 && (
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                <p className="text-gray-500 text-xs font-semibold">Subtotal</p>
                <p className="font-semibold text-gray-700">{formatarValor(os.subtotal)}</p>
              </div>
              <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2">
                <p className="text-red-500 text-xs font-semibold">Desconto</p>
                <p className="font-semibold text-red-600">- {formatarValor(os.desconto)}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs font-semibold">Total</p>
              <p className="font-extrabold text-amber-700 text-lg">{formatarValor(os.total)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs font-semibold">Valor pago</p>
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

          {itensEdit.map((item, idx) => {
            const calcado = ehCalcado(item.categoria)
            const sandalia = item.categoria === 'Sandália'
            const custom = item.servicos.filter(s => !SERVICOS.includes(s))
            return (
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
                            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                              (ativa
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400') +
                              (!isBase ? ' pr-6' : '')}>
                            {cat}
                          </button>
                          {!isBase && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); deletarCategoriaEdit(catObj.id, cat) }}
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir categoria"
                            >
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

                {/* Qual peça — calçados (vem antes das subcategorias) */}
                {calcado && (
                  <div>
                    <p className="font-bold text-gray-700 text-sm mb-2">Qual peça?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LADOS.map(l => (
                        <button key={l} type="button"
                          onClick={() => setItemEdit(idx, 'lado', l)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                            (item.lado === l
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tipo de sandália (vem após qual peça) */}
                {sandalia && (
                  <div>
                    <p className="font-bold text-gray-700 text-sm mb-2">Tipo de sandália</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBCATEGORIAS_SANDALIA.map(sc => (
                        <button key={sc} type="button"
                          onClick={() => setItemEdit(idx, 'subcategoria', sc)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                            (item.subcategoria === sc
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mala — tamanho e material */}
                {ehMala(item.categoria) && (
                  <>
                    <div>
                      <p className="font-bold text-gray-700 text-sm mb-2">Tamanho</p>
                      <div className="flex flex-wrap gap-1.5">
                        {MALA_TAMANHOS.map(t => (
                          <button key={t} type="button"
                            onClick={() => setItemEdit(idx, 'subcategoria', t)}
                            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                              (item.subcategoria === t
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-gray-700 text-sm mb-2">Material</p>
                      <div className="flex flex-wrap gap-1.5">
                        {MALA_MATERIAIS.map(m => (
                          <button key={m} type="button"
                            onClick={() => setItemEdit(idx, 'lado', m)}
                            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
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
                  <p className="font-bold text-gray-700 text-sm mb-2">Serviços</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICOS.map(s => (
                      <button key={s} type="button" onClick={() => toggleServicoEdit(idx, s)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors ` +
                          (item.servicos.includes(s)
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                        {s}
                      </button>
                    ))}
                    {/* Serviços customizados do banco */}
                    {servicosCustomDB.map(sc => (
                      <div key={sc.id} className="relative group">
                        <button type="button" onClick={() => toggleServicoEdit(idx, sc.nome)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 transition-colors pr-6 ` +
                            (item.servicos.includes(sc.nome)
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400')}>
                          {sc.nome}
                        </button>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); deletarServicoCustom(sc.id, sc.nome) }}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Excluir">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                    {/* Serviços orfãos */}
                    {custom.filter(s => !servicosCustomDB.some(sc => sc.nome === s)).map(s => (
                      <button key={s} type="button" onClick={() => toggleServicoEdit(idx, s)}
                        className="px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 bg-amber-600 text-white border-amber-600 flex items-center gap-1">
                        {s} <X size={12} />
                      </button>
                    ))}
                    {servicoCustomModo === idx ? (
                      <div className="flex items-center gap-1 w-full mt-1">
                        <input autoFocus className="input-field flex-1 py-1.5 text-sm"
                          placeholder="Serviço personalizado" value={servicoCustomTexto}
                          onChange={e => setServicoCustomTexto(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              adicionarServicoCustom(idx)
                            }
                          }}
                        />
                        <button type="button" className="bg-amber-600 text-white p-1.5 rounded-lg"
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
                        className="px-2.5 py-1.5 rounded-lg font-semibold text-xs border-2 border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 flex items-center gap-1">
                        <Plus size={12} /> Adicionar serviço
                      </button>
                    )}
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

                  {/* Observação do serviço */}
                  <div className="mt-2">
                    <label className="block font-bold text-gray-700 text-xs mb-1">Observação do serviço</label>
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
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="font-bold text-gray-700 text-xs">Revisão / Garantia (sem cobrança)</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Qtd.</label>
                    <input className="input-field text-sm py-2 text-center font-bold" type="number"
                      inputMode="numeric" min="1" placeholder="1"
                      value={item.quantidade || 1}
                      onChange={e => setItemEdit(idx, 'quantidade', Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <input className="input-field text-sm py-2" placeholder="Cor"
                    value={item.cor} onChange={e => setItemEdit(idx, 'cor', e.target.value)} />
                  <input className="input-field font-bold text-sm py-2" placeholder="Valor unit." inputMode="decimal"
                    disabled={item.revisao}
                    value={item.valor} onChange={e => setItemEdit(idx, 'valor', e.target.value)} />
                </div>
                <input className="input-field text-sm py-2" placeholder="Observação geral do item (opcional)"
                  value={item.descricao} onChange={e => setItemEdit(idx, 'descricao', e.target.value)} />
              </div>
            )
          })}

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

          {/* Total */}
          <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-gray-500 text-xs font-semibold">Total</p>
              {descontoEditNum > 0 && (
                <p className="text-gray-400 text-xs">Subtotal {formatarValor(totalEdit)} − desc. {formatarValor(descontoEditNum)}</p>
              )}
            </div>
            <p className="font-extrabold text-amber-700">{formatarValor(totalEditLiquido)}</p>
          </div>

          {/* Valor pago */}
          <div>
            <label className="block font-bold text-gray-700 mb-1 text-sm">Valor pago (R$)</label>
            <input className={`input-field text-xl font-bold ` + (entradaEditInvalida ? 'border-red-400' : '')}
              inputMode="decimal" placeholder="0,00"
              value={entradaEdit} onChange={e => setEntradaEdit(e.target.value)} />
          </div>

          {/* Desconto */}
          <div>
            <label className="block font-bold text-gray-700 mb-1 text-sm">Desconto (R$)</label>
            <input className="input-field" inputMode="decimal" placeholder="0,00"
              value={descontoEdit} onChange={e => setDescontoEdit(e.target.value)} />
          </div>

          {/* Aviso de entrada inválida */}
          {entradaEditInvalida && (
            <p className="text-red-600 text-sm font-semibold flex items-center gap-1">
              ⚠ O valor pago não pode ser maior que o valor total
            </p>
          )}

          {/* Resta */}
          <div className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2.5">
            <p className="text-gray-500 text-xs font-semibold">Resta</p>
            <p className="font-extrabold text-orange-600">{formatarValor(restaEdit)}</p>
          </div>

          <button onClick={salvarEdicao} disabled={salvando || entradaEditInvalida}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-colors ` +
              (entradaEditInvalida
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'btn-primary')}>
            <Check size={20} />
            {salvando ? 'Salvando...' : entradaEditInvalida ? 'Entrada maior que o total' : 'Salvar alterações'}
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
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-3 rounded-xl">
          <MessageCircle size={18} /> <span className="text-sm">Nota WhatsApp</span>
        </button>
        <button onClick={enviarStatusWhatsApp}
          className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-3 rounded-xl">
          <Send size={18} /> <span className="text-sm">Status WhatsApp</span>
        </button>
        <button onClick={gerarPDF}
          className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-3 rounded-xl">
          <FileText size={18} /> <span className="text-sm">Gerar PDF</span>
        </button>
        <button onClick={enviarPDFWhatsApp}
          className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-3 rounded-xl">
          <FileText size={18} /> <span className="text-sm">Enviar PDF</span>
        </button>
      </div>
      <button onClick={() => window.print()}
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
