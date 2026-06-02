import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api.js'
const _logoFiles = import.meta.glob('../assets/logo.png', { eager: true, import: 'default' })
const logo = Object.values(_logoFiles)[0] || null

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [backendOk, setBackendOk] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    verificarBackend()
  }, [])

  async function verificarBackend() {
    try {
      await api.get('/auth/ping', { timeout: 3000 })
      setBackendOk(true)
    } catch (err) {
      if (err.response) {
        setBackendOk(true)
      } else {
        setBackendOk(false)
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.password) {
      toast.error('Preencha usuário e senha')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('usuario', data.nome_usuario)
      navigate('/painel')
    } catch (err) {
      if (!err.response) {
        toast.error('Servidor não encontrado. Verifique se o backend está rodando.')
        setBackendOk(false)
      } else if (err.response.status === 401) {
        toast.error('Usuário ou senha incorretos')
      } else {
        toast.error('Erro ao conectar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="bg-white w-full max-w-sm" style={{ borderRadius: 20, boxShadow: '0 4px 32px rgba(0,0,0,0.10)', padding: 32 }}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {logo ? (
              <img
                src={logo}
                alt="Chico Sapateiro"
                style={{ height: 72, width: 'auto', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ backgroundColor: '#3E1F12', borderRadius: 16, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                👟
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>
            Chico <span style={{ color: '#A0522D' }}>Sapateiro</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#999999' }}>Sistema de Gestão</p>
        </div>

        {backendOk === false && (
          <div className="mb-4 rounded-xl p-3 text-center" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }}>
            <p className="font-bold text-sm" style={{ color: '#991B1B' }}>Backend desligado</p>
            <p className="text-xs mt-1" style={{ color: '#b91c1c' }}>
              Inicie o servidor antes de fazer login.
              <br />Execute o arquivo <strong>iniciar.bat</strong>
            </p>
          </div>
        )}
        {backendOk === true && (
          <div className="mb-4 rounded-xl p-2 text-center" style={{ backgroundColor: '#D1FAE5', border: '1px solid #A7F3D0' }}>
            <p className="font-semibold text-sm" style={{ color: '#065F46' }}>Servidor conectado</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#1A1A1A' }}>Usuário</label>
            <input
              className="input-field"
              type="text"
              placeholder="Digite seu usuário"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#1A1A1A' }}>Senha</label>
            <input
              className="input-field"
              type="password"
              placeholder="Digite sua senha"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={loading || backendOk === false}
            className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
