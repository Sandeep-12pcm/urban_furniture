import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function LoadingTable({ columns = 5, rows = 5 }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3 rounded-xl bg-page/70 px-3 py-4">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <div key={colIndex} className="h-4 flex-1 animate-pulse rounded bg-borderSoft/70" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading data…</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-page px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-muted shadow-card">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-base font-bold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/20 bg-danger/5 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-danger shadow-card">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="text-base font-bold text-ink">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button type="button" variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineSpinner({ label = 'Loading…' }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}
