import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, RefreshCw, Check, Edit2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api.js'

const TEM_SPEECH = ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const PROMPT = `Você é um assistente de sapataria. Extraia informações do item e serviço descritos e retorne um JSON com:
- categoria: string (tipo do item: Sapato social, Tênis, Sapatênis, Mocassins, Sandália, Bolsa, Mala, Cinto, Carteira, etc., ou null)
- lado: string (Par, Pé esquerdo, Pé direito, ou null — apenas para calçados quando explicitamente mencionado)
- cor: string (cor do item, ou null)
- servicos: array de strings com os serviços mencionados (ex: ["Pintar", "Solado", "Colagem", "Costura", "Retocar", "Protetor", "Ziper", "Trocar roda", "Alça", "Capa fixa"]) — se não mencionado, retornar []
- valor: number (valor em reais sem símbolo, ou null)
- observacao: string (observações extras, ou null)

Responda APENAS com o JSON puro, sem blocos de código, sem texto adicional.`

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1.5px solid #E8D5B0',
  fontSize: 15,
  backgroundColor: '#FFFBF5',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#1A1A1A',
  outline: 'none',
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: '#A0522D', marginBottom: 3 }

export default function NovaOSVoz() {
  const navigate = useNavigate()

  // ── Campos manuais do cliente
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(false)
  const [todosClientes, setTodosClientes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const blurTimer = useRef(null)

  // ── Fluxo de voz
  const [fase, setFase] = useState('inicio') // inicio | gravando | transcricao | interpretando | confirmacao
  const [transcricao, setTranscricao] = useState('')
  const gotResultRef = useRef(false)
  const recognitionRef = useRef(null)

  // ── Campos editáveis na confirmação (preenchidos pela IA)
  const [editCategoria, setEditCategoria] = useState('')
  const [editCor, setEditCor] = useState('')
  const [editLado, setEditLado] = useState('')
  const [editServicos, setEditServicos] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editObs, setEditObs] = useState('')

  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/clientes/').then(r => setTodosClientes(r.data)).catch(() => {})
  }, [])

  // ── Autocomplete de clientes
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

  // ── Gravação de voz
  function iniciarGravacao() {
    if (!TEM_SPEECH) { toast.error('Seu navegador não suporta reconhecimento de voz'); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = false
    gotResultRef.current = false
    recognitionRef.current = r

    r.onresult = (e) => {
      gotResultRef.current = true
      const texto = Array.from(e.results).map(res => res[0].transcript).join(' ')
      setTranscricao(texto)
      setFase('transcricao')
    }
    r.onerror = (e) => { toast.error('Erro no reconhecimento de voz: ' + e.error); setFase('inicio') }
    r.onend = () => { if (!gotResultRef.current) setFase('inicio') }
    r.start()
    setFase('gravando')
  }

  function pararGravacao() { recognitionRef.current?.stop() }

  // ── Interpretação via Claude API
  async function interpretar() {
    setFase('interpretando')
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 256,
          messages: [{ role: 'user', content: `${PROMPT}\n\nTexto: ${transcricao}` }],
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      const texto = json.content[0].text.trim()
      const jsonStr = texto.startsWith('```')
        ? texto.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        : texto
      const ex = JSON.parse(jsonStr)
      setEditCategoria(ex.categoria || '')
      setEditCor(ex.cor || '')
      setEditLado(ex.lado || '')
      setEditServicos(Array.isArray(ex.servicos) ? ex.servicos.join(', ') : '')
      setEditValor(ex.valor != null ? String(ex.valor) : '')
      setEditObs(ex.observacao || '')
      setFase('confirmacao')
    } catch (e) {
      toast.error('Erro ao interpretar: ' + e.message)
      setFase('transcricao')
    }
  }

  // ── Confirmar e criar OS
  async function confirmarECriar() {
    if (!editCategoria.trim()) { toast.error('Informe a categoria do item'); return }
    const servicosArr = editServicos.split(',').map(s => s.trim()).filter(Boolean)
    if (servicosArr.length === 0) { toast.error('Informe pelo menos um serviço'); return }

    setSalvando(true)
    try {
      const item = {
        categoria: editCategoria.trim(),
        subcategoria: '',
        lado: editLado || '',
        servicos: servicosArr,
        servicos_concluidos: [],
        observacao_servico: editObs || '',
        qtd_rodas: 2,
        cor: editCor || '',
        valor: editValor || '',
        foto_url: '',
        quantidade: 1,
        revisao: false,
      }
      await api.post('/ordens/', {
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        prazo_entrega: null,
        entrada: 0,
        desconto: 0,
        urgente: false,
        itens: [item],
      })
      toast.success('OS criada com sucesso!')
      navigate('/painel')
    } catch (e) {
      toast.error('Erro ao criar OS: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSalvando(false)
    }
  }

  function editarAntesDeSalvar() {
    const servicosArr = editServicos.split(',').map(s => s.trim()).filter(Boolean)
    navigate('/nova-os', {
      state: {
        prefill: {
          clienteNome,
          clienteTelefone,
          item: {
            categoria: editCategoria,
            lado: editLado,
            cor: editCor,
            servicos: servicosArr,
            observacao_servico: editObs,
            valor: editValor,
          },
        },
      },
    })
  }

  function reiniciar() {
    setTranscricao('')
    setEditCategoria('')
    setEditCor('')
    setEditLado('')
    setEditServicos('')
    setEditValor('')
    setEditObs('')
    setFase('inicio')
  }

  // ── Estilos de botão
  const btnPrimario = (disabled) => ({
    backgroundColor: disabled ? '#C4956A' : '#3E1F12',
    color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px 20px', fontWeight: 700, fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%',
  })
  const btnSecundario = {
    backgroundColor: '#A0522D', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%',
  }
  const btnTerciario = {
    backgroundColor: '#F5ECD7', color: '#A0522D', border: '1.5px solid #E8D5B0', borderRadius: 12,
    padding: '13px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%',
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', backgroundColor: '#F5ECD7' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', backgroundColor: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0522D', padding: 4, display: 'flex' }}>
            <ArrowLeft size={22} />
          </button>
          <h2 style={{ fontWeight: 800, fontSize: 20, color: '#3E1F12', margin: 0 }}>Criar OS por Voz</h2>
        </div>

        {/* ─── Campos manuais do cliente (sempre visíveis) ─── */}
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1.5px solid #F0E8D8' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#A0522D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Cliente
          </p>

          {/* Nome com autocomplete */}
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={labelStyle}>Nome</span>
              {clienteSelecionado && (
                <span style={{ fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                  <UserCheck size={12} /> Cliente existente
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Digite o nome ou telefone para buscar..."
              value={clienteNome}
              onChange={e => { setClienteNome(e.target.value); setClienteSelecionado(false); setMostrarSugestoes(true) }}
              onFocus={() => { clearTimeout(blurTimer.current); setMostrarSugestoes(true) }}
              onBlur={() => { blurTimer.current = setTimeout(() => setMostrarSugestoes(false), 180) }}
              autoComplete="off"
              style={inputStyle}
            />
            {mostrarSugestoes && sugestoes.length > 0 && (
              <ul style={{
                position: 'absolute', zIndex: 50, left: 0, right: 0, top: '100%', marginTop: 4,
                backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #E8D5B0',
                listStyle: 'none', padding: 0,
              }}>
                {sugestoes.map(c => (
                  <li key={c.id}>
                    <button type="button" onMouseDown={() => selecionarCliente(c)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none',
                        border: 'none', cursor: 'pointer', borderBottom: '1px solid #F5ECD7',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F5ECD7'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontWeight: 700, color: '#1A1A1A', fontSize: 14 }}>{c.nome}</span>
                      <span style={{ color: '#A0522D', fontSize: 13 }}>{c.telefone || 'sem telefone'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Telefone */}
          <div>
            <span style={labelStyle}>Telefone / WhatsApp</span>
            <input
              type="tel"
              placeholder="(11) 99999-9999"
              value={clienteTelefone}
              onChange={e => { setClienteTelefone(e.target.value); setClienteSelecionado(false) }}
              style={{ ...inputStyle, marginTop: 3 }}
            />
          </div>
        </div>

        {/* ─── Seção de serviço por voz ─── */}

        {/* INÍCIO */}
        {fase === 'inicio' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#A0522D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, textAlign: 'left' }}>
              Serviço — descreva por voz
            </p>
            <p style={{ color: '#6B4226', fontSize: 15, marginBottom: 6 }}>
              Descreva o item e o serviço a realizar
            </p>
            <p style={{ color: '#A0522D', fontSize: 13 }}>
              Ex: "Sandália preta, colar" ou "Tênis branco, solado e pintura, 80 reais"
            </p>
            {!TEM_SPEECH && (
              <p style={{ color: '#EF4444', fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                Seu navegador não suporta reconhecimento de voz
              </p>
            )}
            <button onClick={iniciarGravacao} disabled={!TEM_SPEECH} style={{
              width: 120, height: 120, borderRadius: '50%',
              backgroundColor: TEM_SPEECH ? '#A0522D' : '#C4A882',
              color: '#fff', border: 'none', cursor: TEM_SPEECH ? 'pointer' : 'not-allowed',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, margin: '28px auto', boxShadow: '0 4px 16px rgba(160,82,45,0.35)',
            }}>
              <Mic size={44} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Gravar</span>
            </button>
          </div>
        )}

        {/* GRAVANDO */}
        {fase === 'gravando' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#EF4444', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Gravando...</p>
            <p style={{ color: '#6B4226', fontSize: 13 }}>Descreva o item e o serviço</p>
            <button onClick={pararGravacao} style={{
              width: 120, height: 120, borderRadius: '50%',
              backgroundColor: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, margin: '28px auto',
              boxShadow: '0 0 0 10px rgba(239,68,68,0.18)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <MicOff size={44} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Parar</span>
            </button>
            <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 10px rgba(239,68,68,0.18)}50%{box-shadow:0 0 0 18px rgba(239,68,68,0.06)}}`}</style>
          </div>
        )}

        {/* TRANSCRIÇÃO */}
        {fase === 'transcricao' && (
          <div>
            <p style={{ fontWeight: 700, color: '#3E1F12', marginBottom: 8 }}>Texto reconhecido:</p>
            <textarea
              value={transcricao}
              onChange={e => setTranscricao(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <p style={{ fontSize: 12, color: '#A0522D', marginBottom: 16, marginTop: 4 }}>
              Você pode editar o texto antes de interpretar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={btnPrimario(false)} onClick={interpretar}>
                <Check size={18} /> Interpretar com IA
              </button>
              <button style={btnTerciario} onClick={() => setFase('inicio')}>
                <RefreshCw size={16} /> Gravar novamente
              </button>
            </div>
          </div>
        )}

        {/* INTERPRETANDO */}
        {fase === 'interpretando' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 52, height: 52,
              border: '4px solid #E8D5B0', borderTopColor: '#A0522D',
              borderRadius: '50%', margin: '0 auto 20px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: '#6B4226', fontWeight: 600, fontSize: 16 }}>Interpretando com IA...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* CONFIRMAÇÃO */}
        {fase === 'confirmacao' && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#A0522D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Serviço — confirme os dados:
            </p>

            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Categoria *</span>
              <input type="text" value={editCategoria} onChange={e => setEditCategoria(e.target.value)}
                placeholder="Ex: Sandália, Tênis, Bolsa..."
                style={{ ...inputStyle, marginTop: 3 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Cor</span>
              <input type="text" value={editCor} onChange={e => setEditCor(e.target.value)}
                placeholder="Ex: Preto, Branco..."
                style={{ ...inputStyle, marginTop: 3 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={labelStyle}>Lado</span>
                <span style={{ fontSize: 11, color: '#B07850' }}>opcional</span>
              </div>
              <select value={editLado} onChange={e => setEditLado(e.target.value)}
                style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }}>
                <option value="">— não especificado —</option>
                <option value="Par">Par</option>
                <option value="Pé esquerdo">Pé esquerdo</option>
                <option value="Pé direito">Pé direito</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={labelStyle}>Serviços *</span>
                <span style={{ fontSize: 11, color: '#B07850' }}>separados por vírgula</span>
              </div>
              <input type="text" value={editServicos} onChange={e => setEditServicos(e.target.value)}
                placeholder="Ex: Colagem, Solado, Pintar..."
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={labelStyle}>Valor (R$)</span>
                <span style={{ fontSize: 11, color: '#B07850' }}>opcional</span>
              </div>
              <input type="number" min="0" step="0.01" value={editValor}
                onChange={e => setEditValor(e.target.value)}
                placeholder="Ex: 80.00"
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={labelStyle}>Observação</span>
                <span style={{ fontSize: 11, color: '#B07850' }}>opcional</span>
              </div>
              <textarea value={editObs} onChange={e => setEditObs(e.target.value)}
                rows={2} placeholder="Detalhes adicionais..."
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <button style={btnPrimario(salvando)} onClick={confirmarECriar} disabled={salvando}>
                <Check size={18} /> {salvando ? 'Salvando...' : 'Confirmar e criar OS'}
              </button>
              <button style={btnSecundario} onClick={editarAntesDeSalvar}>
                <Edit2 size={16} /> Editar antes de salvar
              </button>
              <button style={btnTerciario} onClick={reiniciar}>
                <RefreshCw size={16} /> Tentar novamente
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
