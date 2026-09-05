export function RowActionButton({ label, icon: Icon, onClick, tone = 'default' }) {
  const toneClass = tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-navy hover:bg-lavender/40';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-indigo ${toneClass}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function RowActions({ children }) {
  return <div className="flex items-center gap-1">{children}</div>;
}
