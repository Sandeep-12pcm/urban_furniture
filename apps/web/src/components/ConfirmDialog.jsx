import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} width="max-w-md">
      <div className="flex gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-lavender/40 text-navy'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="mt-7 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={tone === 'danger' ? 'bg-danger hover:bg-danger/90' : ''}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
