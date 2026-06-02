export const STATUS_BAR_COLOR = {
  'Em andamento':         '#F59E0B',
  'Pronto para retirada': '#10B981',
  'Entregue':             '#6B7280',
  'Atrasado':             '#EF4444',
}

const STATUS_COR = {
  'Em andamento':         { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'Pronto para retirada': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  'Entregue':             { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' },
}

const PAGAMENTO_COR = {
  'Não pago':    { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  'Pago parcial':{ bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  'Pago total':  { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
}

export function StatusBadge({ status }) {
  const cor = STATUS_COR[status] || { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' }
  return (
    <span
      style={{ backgroundColor: cor.bg, color: cor.text, borderColor: cor.border, border: `1px solid ${cor.border}` }}
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
    >
      {status}
    </span>
  )
}

export function PagamentoBadge({ status }) {
  const cor = PAGAMENTO_COR[status] || { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' }
  return (
    <span
      style={{ backgroundColor: cor.bg, color: cor.text, borderColor: cor.border, border: `1px solid ${cor.border}` }}
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
    >
      {status}
    </span>
  )
}

export default StatusBadge
