export function MoneyInput({ className = '', ...props }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        className={`h-11 w-full rounded-xl border border-borderSoft bg-white pl-8 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-indigo focus:ring-4 focus:ring-lavender/60 disabled:bg-page disabled:text-muted ${className}`}
        {...props}
      />
    </span>
  );
}
