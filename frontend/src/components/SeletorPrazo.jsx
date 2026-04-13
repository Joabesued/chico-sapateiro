import { useState } from 'react'
import { Calendar } from 'lucide-react'

const OPCOES = [
  { label: 'Hoje',      dias: 0 },
  { label: 'Amanhã',    dias: 1 },
  { label: '3 dias',    dias: 3 },
  { label: '1 semana',  dias: 7 },
  { label: '2 semanas', dias: 14 },
  { label: '1 mês',     meses: 1 },
]

function toISO(d) {
  // Garante formato YYYY-MM-DD no fuso local
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function calcular({ dias, meses }) {
  const d = new Date()
  if (meses) d.setMonth(d.getMonth() + meses)
  else d.setDate(d.getDate() + (dias ?? 0))
  return toISO(d)
}

function formatarData(iso) {
  if (!iso) return ''
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function SeletorPrazo({ value, onChange }) {
  const [modoCalendario, setModoCalendario] = useState(false)

  function selecionar(data) {
    onChange(data)
    setModoCalendario(false)
  }

  return (
    <div className="space-y-3">
      {/* Grid de atalhos */}
      <div className="grid grid-cols-3 gap-2">
        {OPCOES.map(op => {
          const data = calcular(op)
          const ativo = value === data && !modoCalendario
          return (
            <button
              key={op.label}
              type="button"
              onClick={() => selecionar(data)}
              className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ` +
                (ativo
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400 hover:bg-amber-50')}
            >
              {op.label}
            </button>
          )
        })}
      </div>

      {/* Botão calendário */}
      <button
        type="button"
        onClick={() => setModoCalendario(v => !v)}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-colors ` +
          (modoCalendario
            ? 'bg-gray-700 text-white border-gray-700'
            : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:bg-amber-50')}
      >
        <Calendar size={16} />
        {modoCalendario ? 'Fechar calendário' : 'Escolher data'}
      </button>

      {modoCalendario && (
        <input
          className="input-field"
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          autoFocus
        />
      )}

      {/* Data selecionada */}
      {value && (
        <p className="text-center text-amber-700 font-bold text-base">
          📅 {formatarData(value)}
        </p>
      )}
    </div>
  )
}
