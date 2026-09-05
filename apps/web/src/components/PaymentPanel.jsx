import { Loader2, Plus, Wallet, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './Button.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { EmptyState } from './DataStates.jsx';
import { FormField } from './FormField.jsx';
import { Input } from './Input.jsx';
import { Modal } from './Modal.jsx';
import { Select } from './Select.jsx';
import { StatusPill } from './StatusPill.jsx';
import { Table, Td, Th, Tr } from './Table.jsx';
import { useToast } from './Toast.jsx';
import { formatDate, formatMoney } from '../lib/format.js';
import { paymentsApi, purchasesApi, salesApi } from '../lib/masterDataApi.js';

// Shared by the Customer Invoice and Vendor Bill detail pages: shows the
// outstanding balance, payment history, and a "Record Payment" flow.
export function PaymentPanel({ type, targetId, targetStatus, onChanged }) {
  const { notify } = useToast();
  const [outstanding, setOutstanding] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const isCustomer = type === 'CUSTOMER';
  const outstandingApi = isCustomer ? salesApi.invoiceOutstanding : purchasesApi.billOutstanding;
  const listFilterKey = isCustomer ? 'customerInvoiceId' : 'vendorBillId';

  async function load() {
    setLoading(true);
    try {
      const [o, h] = await Promise.all([
        outstandingApi(targetId),
        paymentsApi.list({ [listFilterKey]: targetId, limit: 50 }),
      ]);
      setOutstanding(o);
      setHistory(h.payments || []);
    } catch (error) {
      notify(error.message || 'Could not load payment history.', { tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

  }, [targetId]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await paymentsApi.cancel(cancelTarget.id);
      notify(`Payment ${cancelTarget.paymentNumber} was cancelled and reversed.`);
      setCancelTarget(null);
      await load();
      onChanged?.();
    } catch (error) {
      notify(error.message || 'Could not cancel payment.', { tone: 'error' });
    } finally {
      setCancelling(false);
    }
  }

  const canRecord = targetStatus === 'POSTED' && outstanding && Number(outstanding.outstandingAmount) > 0;

  return (
    <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Payments</h2>
          {outstanding && (
            <p className="text-sm text-muted">
              Paid {formatMoney(outstanding.amountPaid)} of {formatMoney(outstanding.totalAmount)} · Outstanding{' '}
              <span className="font-bold text-ink">{formatMoney(outstanding.outstandingAmount)}</span>
            </p>
          )}
        </div>
        {canRecord && (
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        )}
      </div>

      {!loading && history.length === 0 && <EmptyState icon={Wallet} title="No payments recorded yet." />}

      {history.length > 0 && (
        <Table minWidth="600px">
          <thead>
            <tr>
              <Th>Payment</Th>
              <Th>Date</Th>
              <Th>Method</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((payment) => (
              <Tr key={payment.id}>
                <Td first className="font-semibold">{payment.paymentNumber}</Td>
                <Td>{formatDate(payment.paymentDate)}</Td>
                <Td className="capitalize">{payment.method?.toLowerCase()}</Td>
                <Td>{formatMoney(payment.amount)}</Td>
                <Td><StatusPill status={payment.status} /></Td>
                <Td last>
                  {payment.status === 'POSTED' && (
                    <button
                      type="button"
                      aria-label="Cancel payment"
                      title="Cancel payment"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                      onClick={() => setCancelTarget(payment)}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <PaymentFormModal
        open={formOpen}
        type={type}
        targetId={targetId}
        outstanding={outstanding}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await load();
          onChanged?.();
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this payment?"
        description={`A reversing accounting entry will be posted for "${cancelTarget?.paymentNumber}". The original entry is never modified.`}
        confirmLabel="Cancel Payment"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function PaymentFormModal({ open, type, targetId, outstanding, onClose, onSaved }) {
  const { notify } = useToast();
  const [form, setForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), method: 'BANK', reference: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ amount: outstanding?.outstandingAmount || '', paymentDate: new Date().toISOString().slice(0, 10), method: 'BANK', reference: '' });
      setError('');
    }
  }, [open, outstanding]);

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError('Payment amount must be greater than zero.');

    setSubmitting(true);
    setError('');
    try {
      const record = type === 'CUSTOMER' ? salesApi.recordInvoicePayment : purchasesApi.recordBillPayment;
      await record(targetId, { amount, paymentDate: form.paymentDate, method: form.method, reference: form.reference.trim() || undefined });
      notify('Payment recorded successfully.');
      onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Could not record payment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Record Payment" subtitle={`Outstanding: ${formatMoney(outstanding?.outstandingAmount)}`} onClose={onClose} width="max-w-md">
      <form className="space-y-5" onSubmit={submit}>
        <FormField label="Amount" required>
          <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </FormField>
        <FormField label="Payment Date" required>
          <Input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
        </FormField>
        <FormField label="Method" required>
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </Select>
        </FormField>
        <FormField label="Reference" hint="Optional — cheque number, transaction id, etc.">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </FormField>

        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
