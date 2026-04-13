const COR_STATUS = {
  'Em andamento':          'bg-blue-100 text-blue-800 border-blue-300',
  'Pronto para retirada':  'bg-green-100 text-green-800 border-green-300',
  'Entregue':              'bg-gray-100 text-gray-700 border-gray-300',
}

const COR_PAGAMENTO = {
  'Não pago':    'bg-red-100 text-red-700 border-red-300',
  'Pago parcial':'bg-orange-100 text-orange-700 border-orange-300',
  'Pago total':  'bg-emerald-100 text-emerald-800 border-emerald-300',
}

export function StatusBadge({ status }) {
  const cor = COR_STATUS[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block border-2 rounded-lg px-3 py-1 text-sm font-bold ${cor}`}>
      {status}
    </span>
  )
}

export function PagamentoBadge({ status }) {
  const cor = COR_PAGAMENTO[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block border-2 rounded-lg px-3 py-1 text-sm font-bold ${cor}`}>
      {status}
    </span>
  )
}

export default StatusBadge
