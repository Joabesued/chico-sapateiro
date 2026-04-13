import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const COR_PAGAMENTO = {
  'Não pago':    'text-red-600',
  'Pago parcial':'text-orange-500',
  'Pago total':  'text-emerald-600',
}

const COR_STATUS = {
  'Em andamento':         'text-blue-600',
  'Pronto para retirada': 'text-green-600',
  'Entregue':             'text-gray-500',
}

export default function Relatorio() {
  const hoje = new Date()
  const [geral, setGeral] = useState(false)
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i)

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold text-gray-800">Relatório Financeiro</h2>

      {/* Filtro */}
      <div className="card space-y-3">
        {/* Toggle Geral / Por mês */}
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

        {/* Seletores mês/ano — ocultados no modo Geral */}
        {!geral && (
          <div className="flex gap-3">
            <select className="input-field flex-1" value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select className="input-field w-28" value={ano} onChange={e => setAno(Number(e.target.value))}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-center py-10 text-gray-500 text-lg">Carregando...</p>
      ) : dados ? (
        <>
          {/* ── Cards financeiros ── */}
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

          {/* ── Por status ── */}
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

          {/* ── Por pagamento ── */}
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

          {/* ── OS com pagamento pendente ── */}
          {dados.os_pendentes.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-gray-700 text-lg mb-3">
                Pagamentos pendentes
                <span className="ml-2 text-sm font-semibold text-orange-500">
                  ({dados.os_pendentes.length})
                </span>
              </h3>
              <div className="space-y-2">
                {dados.os_pendentes.map(os => (
                  <button
                    key={os.numero}
                    onClick={() => navigate(`/painel`)}
                    className="w-full text-left py-3 px-1 border-b border-gray-100 last:border-0 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{os.cliente_nome}</p>
                        <div className="flex gap-3 text-sm mt-0.5">
                          <span className="text-gray-400">
                            Total: <span className="font-semibold text-gray-700">{formatarValor(os.total)}</span>
                          </span>
                          <span className="text-gray-400">
                            Entrada: <span className="font-semibold text-green-600">{formatarValor(os.entrada)}</span>
                          </span>
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

              {/* Total da coluna resta */}
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
