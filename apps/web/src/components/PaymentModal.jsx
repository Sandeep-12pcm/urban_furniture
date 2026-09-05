import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Calendar, FileText } from 'lucide-react';
import { api } from '../services/api';
import { Button, Input, Select, Modal, useToast } from './ui';
import { formatCurrency } from '../utils/currency';

export function PaymentModal({
  isOpen,
  onClose,
  target, // { targetType: 'INVOICE' | 'BILL', targetId, targetNumber, partnerName, total, paid, outstanding }
  onPaymentSuccess,
}) {
  const { success, error: toastError } = useToast();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Bank');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setAmount(String(target.outstanding ?? '0'));
      setMethod('Bank');
      setDate(new Date().toISOString().split('T')[0]);
      setMemo(`Payment for ${target.targetNumber || 'Document'}`);
      setError('');
    }
  }, [target]);

  if (!target) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return setError('Payment amount must be greater than zero.');
    }
    if (numAmount > target.outstanding + 0.001) {
      return setError(
        `Amount cannot exceed outstanding balance of ${formatCurrency(target.outstanding)}.`
      );
    }

    setSubmitting(true);
    setError('');

    try {
      const payment = await api.payments.create({
        targetType: target.targetType,
        targetId: target.targetId,
        amount: numAmount,
        method,
        date,
        memo,
      });

      success(
        `Payment of ${formatCurrency(numAmount)} registered for ${target.targetNumber}!`
      );
      onPaymentSuccess?.(payment);
      onClose();
    } catch (err) {
      setError(err.message || 'Payment processing failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const isInvoice = target.targetType === 'INVOICE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={isInvoice ? 'Register Customer Payment' : 'Register Vendor Payment'}
      description={`Record incoming/outgoing funds for ${target.targetNumber}.`}
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
          >
            Confirm Payment ({formatCurrency(Number(amount) || 0)})
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Balance Breakdown Banner */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Total
              </span>
              <div className="text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(target.total)}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Paid
              </span>
              <div className="text-sm font-bold text-emerald-600 font-mono">
                {formatCurrency(target.paid)}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Outstanding
              </span>
              <div className="text-sm font-bold text-rose-600 font-mono">
                {formatCurrency(target.outstanding)}
              </div>
            </div>
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Payment Amount ($)"
            type="number"
            step="0.01"
            min="0.01"
            max={target.outstanding}
            required
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            prefix={<DollarSign className="h-4 w-4 text-slate-400" />}
          />

          <Select
            label="Payment Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            options={[
              { value: 'Bank', label: 'Bank Transfer (Chase Checking)' },
              { value: 'Cash', label: 'Cash (Cash Register Drawer)' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Payment Date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <Input
            label="Memo / Reference"
            placeholder="e.g. Check #4029 or Wire Ref"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
