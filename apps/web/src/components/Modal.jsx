import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function Modal({ open, title, subtitle, onClose, children, width = 'max-w-lg' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 px-4 py-8 backdrop-blur-sm sm:items-center">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} rounded-2xl border border-white/80 bg-white p-6 shadow-soft outline-none sm:p-7`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-page hover:text-ink focus:outline-none focus:ring-2 focus:ring-indigo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
