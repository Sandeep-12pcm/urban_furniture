const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export function formatMoney(value) {
  const number = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(number)) return currencyFormatter.format(0);
  return currencyFormatter.format(number);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
