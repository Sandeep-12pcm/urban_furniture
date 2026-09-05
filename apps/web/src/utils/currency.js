export function formatCurrency(amount, currency = 'USD') {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatNumber(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusBadgeVariant(status) {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'PAID':
    case 'APPROVED':
    case 'CONFIRMED':
    case 'POSTED':
    case 'ACTIVE':
    case 'DONE':
      return 'success';

    case 'PARTIALLY_PAID':
    case 'PARTIALLY PAID':
    case 'TO INVOICE':
    case 'WAITING BILLS':
    case 'PENDING':
    case 'RFQ':
    case 'QUOTATION':
      return 'warning';

    case 'DRAFT':
    case 'INACTIVE':
    case 'NOTHING TO INVOICE':
    case 'NOTHING TO BILL':
      return 'neutral';

    case 'CANCELLED':
    case 'REJECTED':
    case 'OVERDUE':
      return 'danger';

    default:
      return 'primary';
  }
}
