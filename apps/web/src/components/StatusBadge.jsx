import { Archive, CheckCircle2 } from 'lucide-react';

// Icon + text, never color alone, so status is legible without relying on hue.
export function StatusBadge({ status }) {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        isActive ? 'bg-success/10 text-success' : 'bg-muted/15 text-muted'
      }`}
    >
      {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
      {isActive ? 'Active' : 'Archived'}
    </span>
  );
}

const TYPE_STYLES = {
  CUSTOMER: 'bg-skysoft/50 text-navy',
  VENDOR: 'bg-lavender/50 text-navy',
  BOTH: 'bg-indigo/15 text-indigo',
  GOODS: 'bg-skysoft/50 text-navy',
  SERVICE: 'bg-lavender/50 text-navy',
  COMBO: 'bg-indigo/15 text-indigo',
  INCOME: 'bg-success/10 text-success',
  EXPENSE: 'bg-danger/10 text-danger',
  ASSET: 'bg-skysoft/50 text-navy',
  LIABILITY: 'bg-amber-100 text-amber-700',
  CAPITAL: 'bg-indigo/15 text-indigo',
  SALES: 'bg-skysoft/50 text-navy',
  PURCHASE: 'bg-lavender/50 text-navy',
  BANK: 'bg-indigo/15 text-indigo',
  CASH: 'bg-success/10 text-success',
};

export function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ${TYPE_STYLES[type] || 'bg-page text-ink'}`}>
      {type?.toLowerCase()}
    </span>
  );
}
