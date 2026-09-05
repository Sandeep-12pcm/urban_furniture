// Shared table shell matching the rounded-row style established on the
// Dashboard's Account Directory table, reused across every Master Data list.
export function Table({ minWidth = '760px', children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth, borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }) {
  return <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted ${className}`}>{children}</th>;
}

export function Tr({ children, className = '' }) {
  return <tr className={`rounded-xl bg-page/70 ${className}`}>{children}</tr>;
}

export function Td({ children, className = '', first = false, last = false }) {
  return (
    <td className={`px-3 py-3 align-middle text-ink ${first ? 'rounded-l-xl' : ''} ${last ? 'rounded-r-xl' : ''} ${className}`}>
      {children}
    </td>
  );
}
