import { Search } from 'lucide-react';
import { Select } from './Select.jsx';

export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <span className="relative block w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-xl border border-borderSoft bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-indigo focus:ring-4 focus:ring-lavender/60"
      />
    </span>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block text-sm">
      <span className="sr-only">{label}</span>
      <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-[9.5rem]">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function Toolbar({ children }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">{children}</div>;
}
