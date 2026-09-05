export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = variant === 'secondary'
    ? 'border border-borderSoft bg-white text-navy hover:bg-page'
    : 'bg-navy text-white shadow-card hover:bg-indigo';

  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
