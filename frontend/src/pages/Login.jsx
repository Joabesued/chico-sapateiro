import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api.js'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [backendOk, setBackendOk] = useState(null) // null=verificando, true=ok, false=off
  const navigate = useNavigate()

  useEffect(() => {
    verificarBackend()
  }, [])

  async function verificarBackend() {
    try {
      await api.get('/auth/ping', { timeout: 3000 })
      setBackendOk(true)
    } catch (err) {
      // 401/422 significa que o backend respondeu (está rodando)
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
        // Sem resposta = backend desligado ou timeout
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
    <div className="min-h-screen bg-amber-700 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">👞</div>
          <h1 className="text-3xl font-extrabold text-amber-800">Chico Sapateiro</h1>
          <p className="text-gray-500 mt-1">Sistema de Gestão</p>
        </div>

        {/* Indicador de status do backend */}
        {backendOk === false && (
          <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-3 text-center">
            <p className="text-red-700 font-bold text-sm">Backend desligado</p>
            <p className="text-red-500 text-xs mt-1">
              Inicie o servidor antes de fazer login.
              <br />Execute o arquivo <strong>iniciar.bat</strong>
            </p>
          </div>
        )}
        {backendOk === true && (
          <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-xl p-2 text-center">
            <p className="text-green-600 font-semibold text-sm">Servidor conectado</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">Usuário</label>
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
            <label className="block text-lg font-bold text-gray-700 mb-2">Senha</label>
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
