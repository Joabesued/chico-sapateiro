import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, RefreshCw, Check, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api.js'

const TEM_SPEECH = ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const PROMPT = `Você é um assistente que extrai dados de ordens de serviço de sapataria.
Dado um texto em português, extraia os seguintes campos em JSON:
- cliente_nome: string (nome do cliente, ou null)
- cliente_telefone: string (telefone com DDD, ou null)
- categoria: string (tipo do item: Sapato social, Tênis, Sapatênis, Sandália, Bolsa, Mala, Cinto, Carteira, etc., ou null)
- lado: string (Par, Pé esquerdo, Pé direito, ou null — apenas para calçados)
- cor: string (cor do item, ou null)
- servicos: array de strings (ex: ["Pintar", "Solado", "Colagem", "Costura", "Retocar", "Protetor", "Trocar roda"])
- valor: number (valor em reais sem símbolo, ou null)
- observacao: string (observações adicionais, ou null)

Responda APENAS com o JSON puro, sem blocos de código, sem texto adicional.`

export default function NovaOSVoz() {
  const navigate = useNavigate()
  const [fase, setFase] = useState('inicio') // inicio | gravando | transcricao | interpretando | confirmacao
  const [transcricao, setTranscricao] = useState('')
  const [dados, setDados] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const gotResultRef = useRef(false)
  const recognitionRef = useRef(null)

  function iniciarGravacao() {
    if (!TEM_SPEECH) {
      toast.error('Seu navegador não suporta reconhecimento de voz')
      return
    }
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
    r.onerror = (e) => {
      toast.error('Erro no reconhecimento de voz: ' + e.error)
      setFase('inicio')
    }
    r.onend = () => {
      if (!gotResultRef.current) setFase('inicio')
    }
    r.start()
    setFase('gravando')
  }

  function pararGravacao() {
    recognitionRef.current?.stop()
  }

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
          max_tokens: 512,
          messages: [{ role: 'user', content: `${PROMPT}\n\nTexto: ${transcricao}` }],
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      const texto = json.content[0].text.trim()
      const jsonStr = texto.startsWith('```')
        ? texto.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        : texto
      const extraido = JSON.parse(jsonStr)
      setDados(extraido)
      setFase('confirmacao')
    } catch (e) {
      toast.error('Erro ao interpretar: ' + e.message)
      setFase('transcricao')
    }
  }

  async function confirmarECriar() {
    setSalvando(true)
    try {
      const item = {
        categoria: dados.categoria || 'Sapato social',
        subcategoria: '',
        lado: dados.lado || '',
        servicos: dados.servicos || [],
        servicos_concluidos: [],
        observacao_servico: dados.observacao || '',
        qtd_rodas: 2,
        cor: dados.cor || '',
        valor: dados.valor != null ? String(dados.valor) : '',
        foto_url: '',
        quantidade: 1,
        revisao: false,
      }
      await api.post('/ordens/', {
        cliente_nome: dados.cliente_nome || '',
        cliente_telefone: dados.cliente_telefone || '',
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
    navigate('/nova-os', {
      state: {
        prefill: {
          clienteNome: dados.cliente_nome || '',
          clienteTelefone: dados.cliente_telefone || '',
          item: {
            categoria: dados.categoria || '',
            lado: dados.lado || '',
            cor: dados.cor || '',
            servicos: dados.servicos || [],
            observacao_servico: dados.observacao || '',
            valor: dados.valor != null ? String(dados.valor) : '',
          },
        },
      },
    })
  }

  const btnPrimario = (disabled) => ({
    backgroundColor: disabled ? '#C4956A' : '#3E1F12',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 20px',
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  })

  const btnSecundario = {
    backgroundColor: '#A0522D',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 20px',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  }

  const btnTerciario = {
    backgroundColor: '#F5ECD7',
    color: '#A0522D',
    border: '1.5px solid #E8D5B0',
    borderRadius: 12,
    padding: '13px 20px',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
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

        {/* ── INÍCIO ── */}
        {fase === 'inicio' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#6B4226', marginBottom: 6, fontSize: 15 }}>
              Toque no microfone e descreva a OS em voz alta
            </p>
            <p style={{ color: '#A0522D', fontSize: 13, marginBottom: 4 }}>
              Ex: "Cliente João Silva, telefone 99999-9999, tênis branco, solado e colagem, 80 reais"
            </p>
            {!TEM_SPEECH && (
              <p style={{ color: '#EF4444', fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                Seu navegador não suporta reconhecimento de voz
              </p>
            )}
            <button
              onClick={iniciarGravacao}
              disabled={!TEM_SPEECH}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                backgroundColor: TEM_SPEECH ? '#A0522D' : '#C4A882',
                color: '#fff', border: 'none', cursor: TEM_SPEECH ? 'pointer' : 'not-allowed',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, margin: '28px auto',
                boxShadow: '0 4px 16px rgba(160,82,45,0.35)',
              }}
            >
              <Mic size={44} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Gravar</span>
            </button>
          </div>
        )}

        {/* ── GRAVANDO ── */}
        {fase === 'gravando' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#EF4444', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Gravando...</p>
            <p style={{ color: '#6B4226', fontSize: 13 }}>Fale claramente em português</p>
            <button
              onClick={pararGravacao}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                backgroundColor: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, margin: '28px auto',
                boxShadow: '0 0 0 10px rgba(239,68,68,0.18)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              <MicOff size={44} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Parar</span>
            </button>
            <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 10px rgba(239,68,68,0.18)} 50%{box-shadow:0 0 0 18px rgba(239,68,68,0.06)} }`}</style>
          </div>
        )}

        {/* ── TRANSCRIÇÃO ── */}
        {fase === 'transcricao' && (
          <div>
            <p style={{ fontWeight: 700, color: '#3E1F12', marginBottom: 8 }}>Texto reconhecido:</p>
            <textarea
              value={transcricao}
              onChange={e => setTranscricao(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                border: '1.5px solid #E8D5B0', fontSize: 15,
                backgroundColor: '#FFFBF5', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: 12, color: '#A0522D', marginBottom: 16, marginTop: 4 }}>
              Você pode editar o texto antes de interpretar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={btnPrimario(false)} onClick={interpretar}>
                <Check size={18} /> Interpretar
              </button>
              <button style={btnTerciario} onClick={() => setFase('inicio')}>
                <RefreshCw size={16} /> Gravar novamente
              </button>
            </div>
          </div>
        )}

        {/* ── INTERPRETANDO ── */}
        {fase === 'interpretando' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 52, height: 52,
              border: '4px solid #E8D5B0', borderTopColor: '#A0522D',
              borderRadius: '50%', margin: '0 auto 20px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: '#6B4226', fontWeight: 600, fontSize: 16 }}>Interpretando com IA...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── CONFIRMAÇÃO ── */}
        {fase === 'confirmacao' && dados && (
          <div>
            <p style={{ fontWeight: 700, color: '#3E1F12', marginBottom: 16 }}>Dados extraídos — confira:</p>

            {[
              ['Cliente', dados.cliente_nome],
              ['Telefone', dados.cliente_telefone],
              ['Categoria', dados.categoria],
              ['Lado', dados.lado],
              ['Cor', dados.cor],
              ['Serviços', Array.isArray(dados.servicos) && dados.servicos.length > 0 ? dados.servicos.join(', ') : null],
              ['Valor', dados.valor != null ? `R$ ${Number(dados.valor).toFixed(2).replace('.', ',')}` : null],
              ['Observação', dados.observacao],
            ].map(([label, val]) => val ? (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A0522D', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 15, color: '#1A1A1A', padding: '8px 12px', backgroundColor: '#F5ECD7', borderRadius: 8 }}>{val}</div>
              </div>
            ) : null)}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <button style={btnPrimario(salvando)} onClick={confirmarECriar} disabled={salvando}>
                <Check size={18} /> {salvando ? 'Salvando...' : 'Confirmar e criar OS'}
              </button>
              <button style={btnSecundario} onClick={editarAntesDeSalvar}>
                <Edit2 size={16} /> Editar antes de salvar
              </button>
              <button style={btnTerciario} onClick={() => { setDados(null); setTranscricao(''); setFase('inicio') }}>
                <RefreshCw size={16} /> Tentar novamente
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
