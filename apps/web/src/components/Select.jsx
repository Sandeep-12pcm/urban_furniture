import { ChevronDown } from 'lucide-react';

export function Select({ className = '', children, ...props }) {
  return (
    <span className="relative block">
      <select
        className={`h-11 w-full appearance-none rounded-xl border border-borderSoft bg-white px-4 pr-10 text-sm text-ink outline-none transition focus:border-indigo focus:ring-4 focus:ring-lavender/60 disabled:bg-page disabled:text-muted ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </span>
  );
}
