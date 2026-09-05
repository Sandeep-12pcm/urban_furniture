import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider.');
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, { tone = 'success', duration = 4000 } = {}) => {
      const id = ++counter.current;
      setToasts((current) => [...current, { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-soft sm:w-auto ${
              toast.tone === 'error' ? 'border-danger/20' : 'border-success/20'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            )}
            <p className="flex-1 text-sm font-semibold text-ink">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
