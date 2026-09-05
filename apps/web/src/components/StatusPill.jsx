const STYLES = {
  DRAFT: 'bg-lavender/50 text-navy',
  CONFIRMED: 'bg-skysoft/60 text-navy',
  POSTED: 'bg-success/10 text-success',
  CANCELLED: 'bg-page text-muted',
  UNPAID: 'bg-danger/10 text-danger',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-success/10 text-success',
  OVERDUE: 'bg-danger/10 text-danger',
};

export function StatusPill({ status }) {
  const label = String(status || '').replaceAll('_', ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STYLES[status] || 'bg-page text-ink'}`}>
      {label}
    </span>
  );
}
