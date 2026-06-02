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
  'Em andamento':         { color: '#F59E0B' },
  'Pronto para retirada': { color: '#10B981' },
  'Entregue':             { color: '#6B7280' },
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

  const toggleBtn = (ativo) => ({
    flex: 1,
    padding: '10px 0',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
    backgroundColor: ativo ? '#3E1F12' : 'white',
    color: ativo ? 'white' : '#4B5563',
    borderColor: ativo ? '#3E1F12' : '#F0F0F0',
  })

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold" style={{ color: '#1A1A1A' }}>Relatório Financeiro</h2>

      {/* Filtro */}
      <div className="card space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setGeral(false)} style={toggleBtn(!geral)}>Por mês</button>
          <button onClick={() => setGeral(true)} style={toggleBtn(geral)}>Geral (todos)</button>
        </div>

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
        <p className="text-center py-10 text-lg" style={{ color: '#999999' }}>Carregando...</p>
      ) : dados ? (
        <>
          {/* Cards financeiros */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <p className="font-semibold text-sm" style={{ color: '#999999' }}>Total de OS</p>
              <p className="text-5xl font-black mt-1" style={{ color: '#3E1F12' }}>{dados.total_os}</p>
            </div>
            <div className="card text-center">
              <p className="font-semibold text-sm" style={{ color: '#999999' }}>Total faturado</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: '#1A1A1A' }}>{formatarValor(dados.total_faturado)}</p>
            </div>
            <div className="card text-center">
              <p className="font-semibold text-sm" style={{ color: '#999999' }}>Total recebido</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: '#10B981' }}>{formatarValor(dados.total_recebido)}</p>
            </div>
            <div className="card text-center">
              <p className="font-semibold text-sm" style={{ color: '#999999' }}>Total pendente</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: '#F59E0B' }}>{formatarValor(dados.total_pendente)}</p>
            </div>
          </div>

          {/* Por status */}
          <div className="card">
            <h3 className="font-bold text-lg mb-3" style={{ color: '#1A1A1A' }}>Por status</h3>
            {Object.keys(dados.os_por_status).length === 0 ? (
              <p className="text-center py-2" style={{ color: '#999999' }}>Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(dados.os_por_status).map(([status, qtd]) => (
                  <div key={status} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <span className="font-semibold" style={COR_STATUS[status] || { color: '#4B5563' }}>{status}</span>
                    <span className="text-2xl font-black" style={{ color: '#3E1F12' }}>{qtd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Por pagamento */}
          <div className="card">
            <h3 className="font-bold text-lg mb-3" style={{ color: '#1A1A1A' }}>Por pagamento</h3>
            {Object.keys(dados.os_por_pagamento).length === 0 ? (
              <p className="text-center py-2" style={{ color: '#999999' }}>Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(dados.os_por_pagamento).map(([status, qtd]) => (
                  <div key={status} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <span className={`font-semibold ${COR_PAGAMENTO[status] || 'text-gray-700'}`}>{status}</span>
                    <span className="text-2xl font-black" style={{ color: '#3E1F12' }}>{qtd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OS com pagamento pendente */}
          {dados.os_pendentes.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-lg mb-3" style={{ color: '#1A1A1A' }}>
                Pagamentos pendentes
                <span className="ml-2 text-sm font-semibold" style={{ color: '#F59E0B' }}>
                  ({dados.os_pendentes.length})
                </span>
              </h3>
              <div className="space-y-2">
                {dados.os_pendentes.map(os => (
                  <button
                    key={os.numero}
                    onClick={() => navigate('/painel')}
                    className="w-full text-left py-3 px-1 rounded-lg transition-colors"
                    style={{ borderBottom: '1px solid #F0F0F0' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate" style={{ color: '#1A1A1A' }}>{os.cliente_nome}</p>
                        <div className="flex gap-3 text-sm mt-0.5">
                          <span style={{ color: '#999999' }}>
                            Total: <span className="font-semibold" style={{ color: '#4B5563' }}>{formatarValor(os.total)}</span>
                          </span>
                          <span style={{ color: '#999999' }}>
                            Entrada: <span className="font-semibold" style={{ color: '#10B981' }}>{formatarValor(os.entrada)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm" style={{ color: '#999999' }}>Nota #{String(os.numero).padStart(3, '0')}</p>
                        <p className="font-extrabold" style={{ color: '#F59E0B' }}>{formatarValor(os.resta)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 flex justify-between items-center" style={{ borderTop: '2px solid #F0F0F0' }}>
                <span className="font-bold" style={{ color: '#4B5563' }}>Total a receber</span>
                <span className="text-xl font-extrabold" style={{ color: '#F59E0B' }}>
                  {formatarValor(dados.os_pendentes.reduce((s, o) => s + o.resta, 0))}
                </span>
              </div>
            </div>
          )}

          {dados.os_pendentes.length === 0 && dados.total_os > 0 && (
            <div className="card text-center py-6">
              <p className="text-2xl">🎉</p>
              <p className="font-bold mt-1" style={{ color: '#10B981' }}>Nenhum pagamento pendente!</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
