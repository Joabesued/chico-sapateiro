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
  const [dicas, setDicas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/relatorios/dashboard').then(r => r.data).catch(() => null),
      api.get('/relatorios/dicas').then(r => r.data).catch(() => []),
    ]).then(([dash, d]) => {
      if (dash) setDados(dash)
      setDicas(d || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center py-10 text-gray-500">Carregando...</p>
  if (!dados) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center" style={{ borderLeft: '3px solid #F59E0B' }}>
          <p className="font-semibold text-sm" style={{ color: '#999999' }}>OS abertas hoje</p>
          <p className="text-5xl font-black mt-1" style={{ color: '#F59E0B' }}>{dados.os_abertas_hoje}</p>
        </div>
        <div className="card text-center" style={{ borderLeft: `3px solid ${dados.os_em_atraso > 0 ? '#EF4444' : '#10B981'}` }}>
          <p className="font-semibold text-sm" style={{ color: '#999999' }}>Em atraso</p>
          <p className="text-5xl font-black mt-1" style={{ color: dados.os_em_atraso > 0 ? '#EF4444' : '#10B981' }}>
            {dados.os_em_atraso}
          </p>
        </div>
        <div className="card text-center" style={{ borderLeft: '3px solid #A0522D' }}>
          <p className="font-semibold text-sm" style={{ color: '#999999' }}>Faturado no mês</p>
          <p className="text-xl font-extrabold mt-1" style={{ color: '#3E1F12' }}>{formatarValor(dados.faturado_mes)}</p>
        </div>
        <div className="card text-center" style={{ borderLeft: '3px solid #10B981' }}>
          <p className="font-semibold text-sm" style={{ color: '#999999' }}>Recebido no mês</p>
          <p className="text-xl font-extrabold mt-1" style={{ color: '#10B981' }}>{formatarValor(dados.recebido_mes)}</p>
        </div>
      </div>
      <div className="card text-center" style={{ borderLeft: '3px solid #F59E0B' }}>
        <p className="font-semibold text-sm" style={{ color: '#999999' }}>Total pendente a receber</p>
        <p className="text-2xl font-extrabold mt-1" style={{ color: '#F59E0B' }}>{formatarValor(dados.pendente_total)}</p>
      </div>

      {/* Previsão de prazos */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center p-3" style={{ borderLeft: '3px solid #F59E0B' }}>
          <p className="font-semibold text-xs" style={{ color: '#999999' }}>Prazo hoje</p>
          <p className="text-3xl font-black mt-1" style={{ color: '#3E1F12' }}>{dados.os_prazo_hoje}</p>
        </div>
        <div className="card text-center p-3" style={{ borderLeft: '3px solid #F59E0B' }}>
          <p className="font-semibold text-xs" style={{ color: '#999999' }}>Prazo amanhã</p>
          <p className="text-3xl font-black mt-1" style={{ color: '#A0522D' }}>{dados.os_prazo_amanha}</p>
        </div>
        <div className="card text-center p-3" style={{ borderLeft: '3px solid #A0522D' }}>
          <p className="font-semibold text-xs" style={{ color: '#999999' }}>Prazo semana</p>
          <p className="text-3xl font-black mt-1" style={{ color: '#A0522D' }}>{dados.os_prazo_semana}</p>
        </div>
      </div>

      {dicas.length > 0 && (
        <div className="card space-y-2">
          <h3 className="font-bold text-base pb-2" style={{ color: '#1A1A1A', borderBottom: '1px solid #F0F0F0' }}>Dicas de gestão</h3>
          {dicas.map((dica, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: '#F5ECD7', border: '1px solid #E8D5B0' }}>
              <span className="text-base shrink-0">💡</span>
              <p className="text-sm" style={{ color: '#374151' }}>{dica}</p>
            </div>
          ))}
        </div>
      )}
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
            className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors"
            style={!geral
              ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
              : { backgroundColor: 'white', color: '#4B5563', border: '1px solid #F0F0F0' }}
          >
            Por mês
          </button>
          <button
            onClick={() => setGeral(true)}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors"
            style={geral
              ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
              : { backgroundColor: 'white', color: '#4B5563', border: '1px solid #F0F0F0' }}
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
              <p className="text-5xl font-black mt-1" style={{ color: '#3E1F12' }}>{dados.total_os}</p>
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
                    <span className="text-2xl font-black" style={{ color: '#3E1F12' }}>{qtd}</span>
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
                    <span className="text-2xl font-black" style={{ color: '#3E1F12' }}>{qtd}</span>
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
                    className="w-full text-left py-3 px-1 border-b border-gray-100 last:border-0 rounded-lg transition-colors hover:bg-gray-50"
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

const medalha = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`

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
                      <span className="font-black" style={{ color: '#3E1F12' }}>{item.quantidade}×</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ backgroundColor: '#A0522D', width: `${(item.quantidade / maxQtd) * 100}%` }}
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
                  <span className="text-sm font-black" style={{ color: '#3E1F12' }}>{formatarValor(d.total_faturado)}</span>
                  <span className="text-xs text-gray-400 ml-2">{d.total_os} OS</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full"
                  style={{
                    backgroundColor: '#A0522D',
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
        <div className="card text-center" style={{ backgroundColor: '#F5ECD7', border: '1px solid #E8D5B0' }}>
          <p className="text-gray-500 font-semibold text-sm">Serviço mais realizado este mês</p>
          <p className="text-2xl font-black mt-1" style={{ color: '#3E1F12' }}>🏆 {servicoTop}</p>
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
                <span className="font-black text-lg" style={{ color: '#3E1F12' }}>{d.total_os}</span>
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

// ─── Tab: Relatório do Dia ───────────────────────────────────────────────────────

function TabRelatorioDia() {
  const hoje = new Date()
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const [data, setData] = useState(hojeISO)
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { buscar() }, [data])

  async function buscar() {
    setLoading(true)
    try {
      const { data: resp } = await api.get('/relatorios/diario', { params: { data } })
      setDados(resp)
    } finally {
      setLoading(false)
    }
  }

  const COR_PAGAMENTO = {
    'Não pago': 'text-red-600',
    'Pago parcial': 'text-orange-500',
    'Pago total': 'text-emerald-600',
  }

  const dataFormatada = data ? data.split('-').reverse().join('/') : ''

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <label className="block font-bold text-gray-700">Data do relatório</label>
        <input
          type="date"
          className="input-field"
          value={data}
          onChange={e => setData(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500">Carregando...</p>
      ) : dados ? (
        <>
          <div className="card space-y-1 no-print-hide" id="relatorio-dia-conteudo">
            <h3 className="font-extrabold text-gray-800 text-lg text-center border-b pb-2">
              Relatório do Dia — {dataFormatada}
            </h3>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="card text-center border-l-4 border-blue-400 p-3">
                <p className="text-gray-500 font-semibold text-xs">OS Abertas</p>
                <p className="text-4xl font-black text-blue-600 mt-1">{dados.os_abertas}</p>
              </div>
              <div className="card text-center border-l-4 border-green-400 p-3">
                <p className="text-gray-500 font-semibold text-xs">OS Finalizadas</p>
                <p className="text-4xl font-black text-green-600 mt-1">{dados.os_finalizadas}</p>
              </div>
              <div className="card text-center p-3" style={{ borderLeft: '3px solid #A0522D' }}>
                <p className="text-gray-500 font-semibold text-xs">Total Faturado</p>
                <p className="text-xl font-extrabold mt-1" style={{ color: '#3E1F12' }}>{formatarValor(dados.total_faturado)}</p>
              </div>
              <div className="card text-center border-l-4 border-emerald-400 p-3">
                <p className="text-gray-500 font-semibold text-xs">Total Recebido</p>
                <p className="text-xl font-extrabold text-emerald-600 mt-1">{formatarValor(dados.total_recebido)}</p>
              </div>
            </div>

            {dados.ordens.length > 0 ? (
              <div className="card mt-2">
                <h4 className="font-bold text-gray-700 mb-3">OS do dia ({dados.ordens.length})</h4>
                <div className="space-y-2">
                  {dados.ordens.map(os => (
                    <button
                      key={os.numero}
                      onClick={() => navigate('/painel')}
                      className="w-full text-left py-3 px-1 border-b border-gray-100 last:border-0 rounded-lg transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">#{String(os.numero).padStart(3, '0')} — {os.cliente_nome}</p>
                          <div className="flex gap-3 text-xs mt-0.5 flex-wrap">
                            <span className="text-gray-400">{os.qtd_itens} {os.qtd_itens === 1 ? 'item' : 'itens'}</span>
                            <span className={`font-semibold ${COR_PAGAMENTO[os.status_pagamento] || 'text-gray-600'}`}>
                              {os.status_pagamento}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-extrabold" style={{ color: '#A0522D' }}>{formatarValor(os.total)}</p>
                          {os.resta > 0 && (
                            <p className="text-xs text-orange-500 font-semibold">Resta: {formatarValor(os.resta)}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center py-8">
                <p className="text-gray-400 text-lg">Nenhuma OS aberta neste dia.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 rounded-xl no-print"
          >
            🖨️ Imprimir relatório do dia
          </button>
        </>
      ) : null}
    </div>
  )
}

// ─── Tab: Ranking de Categorias ─────────────────────────────────────────────────

function TabRankingCategorias() {
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
      const { data } = await api.get('/relatorios/categorias', { params: { mes, ano } })
      setDados(data)
    } finally {
      setLoading(false)
    }
  }

  const maxQtd = dados?.ranking[0]?.quantidade || 1

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
        <div className="card">
          <h3 className="font-bold text-gray-700 text-lg mb-4">Categorias mais frequentes</h3>
          {dados.ranking.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Sem dados para este período.</p>
          ) : (
            <div className="space-y-3">
              {dados.ranking.map((item, i) => (
                <div key={item.categoria}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800 text-sm">
                      {medalha(i)} {item.categoria}
                    </span>
                    <span className="font-black" style={{ color: '#3E1F12' }}>
                      {item.quantidade} item{item.quantidade !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: '#A0522D', width: `${(item.quantidade / maxQtd) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ─── Tab: Produtividade ──────────────────────────────────────────────────────────

function TabProdutividade() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/relatorios/produtividade')
      .then(r => setDados(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center py-10 text-gray-500">Carregando...</p>
  if (!dados) return null

  const maxQtd = Math.max(...dados.historico_14dias.map(d => d.qtd), 1)
  const tendencia = dados.tendencia_semana

  function formatarDataDia(isoDate) {
    if (!isoDate) return '—'
    const [ano, mes, dia] = isoDate.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function diaSemanaAbrev(isoDate) {
    if (!isoDate) return ''
    const d = new Date(isoDate + 'T12:00:00')
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()]
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center" style={{ borderLeft: '3px solid #A0522D' }}>
          <p className="text-gray-500 font-semibold text-sm">Média notas/dia</p>
          <p className="text-4xl font-black mt-1" style={{ color: '#3E1F12' }}>{dados.media_notas_dia}</p>
          <p className="text-xs text-gray-400 mt-0.5">notas por dia</p>
        </div>
        <div className="card text-center border-l-4 border-blue-400">
          <p className="text-gray-500 font-semibold text-sm">Dias em operação</p>
          <p className="text-4xl font-black text-blue-600 mt-1">{dados.dias_em_operacao}</p>
          <p className="text-xs text-gray-400 mt-0.5">desde a 1ª nota</p>
        </div>
        <div className="card text-center border-l-4 border-green-400">
          <p className="text-gray-500 font-semibold text-sm">Dia mais produtivo</p>
          {dados.dia_mais_produtivo ? (
            <>
              <p className="text-lg font-black text-green-700 mt-1">{formatarDataDia(dados.dia_mais_produtivo)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{dados.dia_mais_produtivo_qtd} notas</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm mt-2">Sem dados</p>
          )}
        </div>
        <div className={`card text-center border-l-4 ${tendencia >= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <p className="text-gray-500 font-semibold text-sm">Tendência da semana</p>
          <p className={`text-2xl font-black mt-1 ${tendencia >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {tendencia >= 0 ? '↑' : '↓'} {Math.abs(tendencia).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {dados.os_semana_atual} esta · {dados.os_semana_passada} anterior
          </p>
        </div>
      </div>

      {/* Gráfico 14 dias */}
      <div className="card">
        <h3 className="font-bold text-gray-700 text-lg mb-4">Notas — últimos 14 dias</h3>
        <div className="space-y-1.5">
          {dados.historico_14dias.map(d => (
            <div key={d.data} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-8 shrink-0 font-semibold">{diaSemanaAbrev(d.data)}</span>
              <span className="text-xs text-gray-300 w-10 shrink-0">{d.data.slice(5).replace('-', '/')}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-5 rounded-full flex items-center justify-end pr-1.5 transition-all"
                  style={{ backgroundColor: '#A0522D', width: d.qtd > 0 ? `${Math.max((d.qtd / maxQtd) * 100, 10)}%` : '0%' }}
                >
                  {d.qtd > 0 && <span className="text-white text-xs font-black">{d.qtd}</span>}
                </div>
              </div>
              {d.qtd === 0 && <span className="text-xs text-gray-300 w-4">0</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Previsão de Serviços ───────────────────────────────────────────────────

function TabPrevisao() {
  const navigate = useNavigate()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/relatorios/previsao', { params: { dias: 7 } })
      .then(r => setDados(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center py-10 text-gray-500">Carregando...</p>
  if (!dados) return null

  function formatarDiaMes(isoDate) {
    if (!isoDate) return '—'
    const [, mes, dia] = isoDate.split('-')
    return `${dia}/${mes}`
  }

  const STATUS_LABEL = {
    'Em andamento': { label: 'Andamento', cls: 'bg-blue-100 text-blue-700' },
    'Pronto para retirada': { label: 'Pronto', cls: 'bg-green-100 text-green-700' },
    'Entregue': { label: 'Entregue', cls: 'bg-gray-100 text-gray-500' },
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-700">Próximos 7 dias</h3>
      <div className="space-y-3">
        {dados.dias.map(dia => (
          <div
            key={dia.data}
            className="card"
            style={dia.destaque
              ? { borderLeft: '3px solid #EF4444', backgroundColor: '#FEF2F2' }
              : { borderLeft: '3px solid #E8D5B0' }}
          >
            {/* Cabeçalho do dia */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-gray-800">
                  {dia.dia_semana}, {formatarDiaMes(dia.data)}
                </span>
                {dia.destaque && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 rounded-lg px-2 py-0.5">
                    Alta demanda
                  </span>
                )}
              </div>
              <span className="text-2xl font-black" style={{ color: dia.destaque ? '#EF4444' : '#3E1F12' }}>
                {dia.qtd_os} OS
              </span>
            </div>

            {dia.qtd_os === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma OS com prazo neste dia</p>
            ) : (
              <>
                {/* Agrupamento por categoria */}
                {dia.categorias.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {dia.categorias.map(cat => (
                      <div key={cat.categoria} className="bg-white rounded-xl p-2.5 border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-800 text-sm">{cat.categoria}</span>
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                            {cat.total_itens} {cat.total_itens === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                        {cat.servicos.length > 0 && (
                          <p className="text-xs text-gray-600">
                            {cat.servicos.map(s => `${s.servico}: ${s.quantidade}`).join(' · ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumo total do dia */}
                {dia.resumo_servicos.length > 0 && (
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: '#F5ECD7', border: '1px solid #E8D5B0' }}>
                    <p className="text-xs font-extrabold mb-1" style={{ color: '#3E1F12' }}>Total do dia:</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {dia.resumo_servicos.map(s => `${s.servico} ${s.quantidade}`).join(' · ')}
                    </p>
                  </div>
                )}

                {/* Lista de OS clicáveis */}
                <div className="mt-2 space-y-1">
                  {dia.ordens.map(os => {
                    const st = STATUS_LABEL[os.status] || { label: os.status, cls: 'bg-gray-100 text-gray-600' }
                    return (
                      <button
                        key={os.id}
                        onClick={() => navigate(`/os/${os.id}`)}
                        className="w-full flex items-center justify-between text-left bg-white rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors border border-gray-100"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-xs shrink-0" style={{ color: '#A0522D' }}>
                            #{String(os.numero).padStart(3, '0')}
                          </span>
                          <span className="text-sm font-semibold text-gray-800 truncate">
                            {os.cliente_nome}
                          </span>
                        </div>
                        <span className={`text-xs font-bold rounded-lg px-2 py-0.5 shrink-0 ml-2 ${st.cls}`}>
                          {st.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Ranking de serviços previstos na semana */}
      {dados.ranking_servicos.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-700 text-lg mb-3">Serviços previstos para a semana</h3>
          <div className="space-y-2">
            {dados.ranking_servicos.map((item, i) => (
              <div key={item.servico} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="font-semibold text-gray-700 text-sm">{i + 1}. {item.servico}</span>
                <span className="font-black" style={{ color: '#3E1F12' }}>{item.quantidade}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────────

export default function Admin() {
  const [aba, setAba] = useState('dashboard')

  const abas = [
    { id: 'dashboard', label: 'Resumo' },
    { id: 'relatorio', label: 'Relatório' },
    { id: 'ranking', label: 'Serviços' },
    { id: 'categorias', label: 'Categorias' },
    { id: 'produtividade', label: 'Produtividade' },
    { id: 'previsao', label: 'Previsão' },
    { id: 'estatisticas', label: 'Estatísticas' },
    { id: 'diario', label: 'Dia' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Área Administrativa</h2>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className="px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors shrink-0"
            style={aba === a.id
              ? { backgroundColor: '#3E1F12', color: 'white', border: '1px solid #3E1F12' }
              : { backgroundColor: 'white', color: '#4B5563', border: '1px solid #F0F0F0' }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'dashboard' && <TabDashboard />}
      {aba === 'relatorio' && <TabRelatorio />}
      {aba === 'ranking' && <TabRanking />}
      {aba === 'categorias' && <TabRankingCategorias />}
      {aba === 'produtividade' && <TabProdutividade />}
      {aba === 'previsao' && <TabPrevisao />}
      {aba === 'estatisticas' && <TabEstatisticas />}
      {aba === 'diario' && <TabRelatorioDia />}
    </div>
  )
}
