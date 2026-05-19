import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_COMPLETOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

// ─── Tab: Dashboard ─────────────────────────────────────────────────────────────

function TabDashboard() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/relatorios/dashboard').then(r => setDados(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center py-10 text-gray-500">Carregando...</p>
  if (!dados) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center border-l-4 border-blue-400">
          <p className="text-gray-500 font-semibold text-sm">OS abertas hoje</p>
          <p className="text-5xl font-black text-blue-600 mt-1">{dados.os_abertas_hoje}</p>
        </div>
        <div className={`card text-center border-l-4 ${dados.os_em_atraso > 0 ? 'border-red-400' : 'border-green-400'}`}>
          <p className="text-gray-500 font-semibold text-sm">Em atraso</p>
          <p className={`text-5xl font-black mt-1 ${dados.os_em_atraso > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {dados.os_em_atraso}
          </p>
        </div>
        <div className="card text-center border-l-4 border-amber-400">
          <p className="text-gray-500 font-semibold text-sm">Faturado no mês</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1">{formatarValor(dados.faturado_mes)}</p>
        </div>
        <div className="card text-center border-l-4 border-green-400">
          <p className="text-gray-500 font-semibold text-sm">Recebido no mês</p>
          <p className="text-xl font-extrabold text-green-600 mt-1">{formatarValor(dados.recebido_mes)}</p>
        </div>
      </div>
      <div className="card text-center border-l-4 border-orange-400">
        <p className="text-gray-500 font-semibold text-sm">Total pendente a receber</p>
        <p className="text-2xl font-extrabold text-orange-500 mt-1">{formatarValor(dados.pendente_total)}</p>
      </div>
    </div>
  )
}

// ─── Tab: Relatório ──────────────────────────────────────────────────────────────

function TabRelatorio() {
  const hoje = new Date()
  const [geral, setGeral] = useState(false)
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i)

  useEffect(() => { buscar() }, [mes, ano, geral])

  async function buscar() {
    setLoading(true)
    try {
      const params = geral ? {} : { mes, ano }
      const { data } = await api.get('/relatorios/resumo', { params })
      setDados(data)
    } finally {
      setLoading(false)
    }
  }

  const COR_PAGAMENTO = {
    'Não pago': 'text-red-600',
    'Pago parcial': 'text-orange-500',
    'Pago total': 'text-emerald-600',
  }
  const COR_STATUS = {
    'Em andamento': 'text-blue-600',
    'Pronto para retirada': 'text-green-600',
    'Entregue': 'text-gray-500',
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setGeral(false)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-colors ` +
              (!geral ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400')}
          >
            Por mês
          </button>
          <button
            onClick={() => setGeral(true)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-colors ` +
              (geral ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400')}
          >
            Geral (todos)
          </button>
        </div>
        {!geral && (
          <div className="flex gap-3">
            <select className="input-field flex-1" value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES_COMPLETOS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select className="input-field w-28" value={ano} onChange={e => setAno(Number(e.target.value))}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500">Carregando...</p>
      ) : dados ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <p className="text-gray-500 font-semibold text-sm">Total de OS</p>
              <p className="text-5xl font-black text-amber-700 mt-1">{dados.total_os}</p>
            </div>
            <div className="card text-center">
              <p className="text-gray-500 font-semibold text-sm">Total faturado</p>
              <p className="text-2xl font-extrabold text-gray-800 mt-1">{formatarValor(dados.total_faturado)}</p>
            </div>
            <div className="card text-center">
              <p className="text-gray-500 font-semibold text-sm">Total recebido</p>
              <p className="text-2xl font-extrabold text-green-600 mt-1">{formatarValor(dados.total_recebido)}</p>
            </div>
            <div className="card text-center">
              <p className="text-gray-500 font-semibold text-sm">Total pendente</p>
              <p className="text-2xl font-extrabold text-orange-500 mt-1">{formatarValor(dados.total_pendente)}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-700 text-lg mb-3">Por status</h3>
            {Object.keys(dados.os_por_status).length === 0 ? (
              <p className="text-gray-400 text-center py-2">Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(dados.os_por_status).map(([status, qtd]) => (
                  <div key={status} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className={`font-semibold ${COR_STATUS[status] || 'text-gray-700'}`}>{status}</span>
                    <span className="text-2xl font-black text-amber-700">{qtd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-700 text-lg mb-3">Por pagamento</h3>
            {Object.keys(dados.os_por_pagamento).length === 0 ? (
              <p className="text-gray-400 text-center py-2">Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(dados.os_por_pagamento).map(([status, qtd]) => (
                  <div key={status} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className={`font-semibold ${COR_PAGAMENTO[status] || 'text-gray-700'}`}>{status}</span>
                    <span className="text-2xl font-black text-amber-700">{qtd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dados.os_pendentes.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-gray-700 text-lg mb-3">
                Pagamentos pendentes
                <span className="ml-2 text-sm font-semibold text-orange-500">({dados.os_pendentes.length})</span>
              </h3>
              <div className="space-y-2">
                {dados.os_pendentes.map(os => (
                  <button
                    key={os.numero}
                    onClick={() => navigate('/painel')}
                    className="w-full text-left py-3 px-1 border-b border-gray-100 last:border-0 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{os.cliente_nome}</p>
                        <div className="flex gap-3 text-sm mt-0.5">
                          <span className="text-gray-400">Total: <span className="font-semibold text-gray-700">{formatarValor(os.total)}</span></span>
                          <span className="text-gray-400">Entrada: <span className="font-semibold text-green-600">{formatarValor(os.entrada)}</span></span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-gray-400">Nota #{String(os.numero).padStart(3, '0')}</p>
                        <p className="font-extrabold text-orange-500">{formatarValor(os.resta)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t-2 border-gray-200 flex justify-between items-center">
                <span className="font-bold text-gray-600">Total a receber</span>
                <span className="text-xl font-extrabold text-orange-500">
                  {formatarValor(dados.os_pendentes.reduce((s, o) => s + o.resta, 0))}
                </span>
              </div>
            </div>
          )}

          {dados.os_pendentes.length === 0 && dados.total_os > 0 && (
            <div className="card text-center py-6">
              <p className="text-2xl">🎉</p>
              <p className="font-bold text-green-600 mt-1">Nenhum pagamento pendente!</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ─── Tab: Ranking de Serviços ────────────────────────────────────────────────────

function TabRanking() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i)

  useEffect(() => { buscar() }, [mes, ano])

  async function buscar() {
    setLoading(true)
    try {
      const { data } = await api.get('/relatorios/ranking', { params: { mes, ano } })
      setDados(data)
    } finally {
      setLoading(false)
    }
  }

  const maxQtd = dados?.ranking_quantidade[0]?.quantidade || 1
  const maxVal = dados?.ranking_valor[0]?.total || 1

  const medalha = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex gap-3">
          <select className="input-field flex-1" value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES_COMPLETOS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="input-field w-28" value={ano} onChange={e => setAno(Number(e.target.value))}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500">Carregando...</p>
      ) : dados ? (
        <>
          <div className="card">
            <h3 className="font-bold text-gray-700 text-lg mb-4">Ranking por quantidade</h3>
            {dados.ranking_quantidade.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Sem dados para este período.</p>
            ) : (
              <div className="space-y-3">
                {dados.ranking_quantidade.map((item, i) => (
                  <div key={item.servico}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800 text-sm">
                        {medalha(i)} {item.servico}
                      </span>
                      <span className="font-black text-amber-700">{item.quantidade}×</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{ width: `${(item.quantidade / maxQtd) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-700 text-lg mb-4">Ranking por valor gerado</h3>
            {dados.ranking_valor.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Sem dados para este período.</p>
            ) : (
              <div className="space-y-3">
                {dados.ranking_valor.map((item, i) => (
                  <div key={item.servico}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800 text-sm">
                        {medalha(i)} {item.servico}
                      </span>
                      <span className="font-black text-green-700">{formatarValor(item.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(item.total / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Tab: Estatísticas ───────────────────────────────────────────────────────────

function TabEstatisticas() {
  const hoje = new Date()
  const [dadosMeses, setDadosMeses] = useState([])
  const [ranking, setRanking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const periodos = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      return { mes: d.getMonth() + 1, ano: d.getFullYear() }
    }).reverse()

    const mesPadrao = hoje.getMonth() + 1
    const anoPadrao = hoje.getFullYear()

    Promise.all([
      Promise.all(
        periodos.map(({ mes, ano }) =>
          api.get('/relatorios/resumo', { params: { mes, ano } })
            .then(r => ({ mes, ano, ...r.data }))
            .catch(() => ({ mes, ano, total_faturado: 0, total_os: 0 }))
        )
      ),
      api.get('/relatorios/ranking', { params: { mes: mesPadrao, ano: anoPadrao } })
        .then(r => r.data)
        .catch(() => null),
    ]).then(([meses, rank]) => {
      setDadosMeses(meses)
      setRanking(rank)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center py-10 text-gray-500">Carregando...</p>

  const maxFaturado = Math.max(...dadosMeses.map(d => d.total_faturado), 1)
  const servicoTop = ranking?.ranking_quantidade[0]?.servico

  return (
    <div className="space-y-4">
      {/* Gráfico de barras */}
      <div className="card">
        <h3 className="font-bold text-gray-700 text-lg mb-4">Faturamento — últimos 6 meses</h3>
        <div className="space-y-3">
          {dadosMeses.map(d => (
            <div key={`${d.mes}-${d.ano}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-600">
                  {MESES_NOMES[d.mes - 1]}/{d.ano}
                </span>
                <div className="text-right">
                  <span className="text-sm font-black text-amber-700">{formatarValor(d.total_faturado)}</span>
                  <span className="text-xs text-gray-400 ml-2">{d.total_os} OS</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="bg-amber-500 h-4 rounded-full"
                  style={{
                    width: d.total_faturado > 0
                      ? `${Math.max((d.total_faturado / maxFaturado) * 100, 2)}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Serviço top do mês */}
      {servicoTop && (
        <div className="card text-center bg-amber-50 border-2 border-amber-200">
          <p className="text-gray-500 font-semibold text-sm">Serviço mais realizado este mês</p>
          <p className="text-2xl font-black text-amber-700 mt-1">🏆 {servicoTop}</p>
          <p className="text-gray-400 text-sm mt-0.5">
            {ranking.ranking_quantidade[0].quantidade} vez{ranking.ranking_quantidade[0].quantidade > 1 ? 'es' : ''}
          </p>
        </div>
      )}

      {/* Valor por serviço do mês */}
      {ranking && ranking.ranking_valor.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-700 text-lg mb-3">
            Receita por serviço — {MESES_COMPLETOS[hoje.getMonth()]}
          </h3>
          <div className="space-y-2">
            {ranking.ranking_valor.slice(0, 5).map((item, i) => (
              <div key={item.servico} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="font-semibold text-gray-700 text-sm">{i + 1}. {item.servico}</span>
                <span className="font-black text-green-700">{formatarValor(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OS por mês */}
      <div className="card">
        <h3 className="font-bold text-gray-700 text-lg mb-3">OS por mês</h3>
        <div className="space-y-2">
          {[...dadosMeses].reverse().map(d => (
            <div key={`${d.mes}-${d.ano}`} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="font-semibold text-gray-700 text-sm">{MESES_COMPLETOS[d.mes - 1]} / {d.ano}</span>
              <div className="text-right">
                <span className="font-black text-amber-700 text-lg">{d.total_os}</span>
                <span className="text-gray-400 text-sm ml-1">OS</span>
                <span className="ml-3 font-semibold text-gray-600 text-sm">{formatarValor(d.total_faturado)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────────

export default function Admin() {
  const [aba, setAba] = useState('dashboard')

  const abas = [
    { id: 'dashboard', label: 'Resumo' },
    { id: 'relatorio', label: 'Relatório' },
    { id: 'ranking', label: 'Ranking' },
    { id: 'estatisticas', label: 'Estatísticas' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-gray-800">Área Administrativa</h2>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap border-2 transition-colors shrink-0 ` +
              (aba === a.id
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400')}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'dashboard' && <TabDashboard />}
      {aba === 'relatorio' && <TabRelatorio />}
      {aba === 'ranking' && <TabRanking />}
      {aba === 'estatisticas' && <TabEstatisticas />}
    </div>
  )
}
