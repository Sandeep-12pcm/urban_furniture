import React, { useState, useEffect } from 'react';
import {
  Receipt,
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Calendar,
  Building,
  Printer,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  PageHeader,
  LoadingSpinner,
  ErrorState,
  useToast,
} from '../components/ui';
import { PaymentModal } from '../components/PaymentModal';
import { formatCurrency, formatDate } from '../utils/currency';

export function InvoiceDetail({ id, navigate }) {
  const { success, error: toastError } = useToast();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  async function loadInvoice() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.invoices.get(id);
      setInvoice(data);
    } catch (err) {
      setError(err.message || 'Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePostInvoice() {
    setActionLoading(true);
    try {
      const updated = await api.invoices.post(id);
      setInvoice(updated);
      success(`Invoice "${updated.invoiceNumber}" posted to general ledger!`);
    } catch (err) {
      toastError(err.message || 'Failed to post invoice.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading customer invoice details..." />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div>
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => navigate('/invoices')}
          className="mb-4"
        >
          Back to Invoices
        </Button>
        <ErrorState message={error || 'Invoice not found'} onRetry={loadInvoice} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={invoice.invoiceNumber}
        badge={<Badge status={invoice.status} size="lg" />}
        breadcrumbs={[
          { label: 'Customer Invoices', onClick: () => navigate('/invoices') },
          { label: invoice.invoiceNumber },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/invoices')}
            >
              Back
            </Button>

            {invoice.status === 'DRAFT' && (
              <Button
                variant="primary"
                icon={CheckCircle}
                onClick={handlePostInvoice}
                loading={actionLoading}
              >
                Post Invoice
              </Button>
            )}

            {invoice.outstanding > 0 && invoice.status !== 'DRAFT' && (
              <Button
                variant="success"
                icon={CreditCard}
                onClick={() => setPaymentModalOpen(true)}
              >
                Register Payment
              </Button>
            )}

            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => window.print()}
            >
              Print Invoice
            </Button>
          </div>
        }
      />

      {/* Invoice Key Figures */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Customer</span>
          <div className="mt-1 font-bold text-slate-900 text-sm">{invoice.customerName}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Invoice Date</span>
          <div className="mt-1 font-semibold text-slate-800 text-sm">
            {formatDate(invoice.invoiceDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Due Date</span>
          <div className="mt-1 font-semibold text-slate-800 text-sm">
            {formatDate(invoice.dueDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Amount Paid</span>
          <div className="mt-1 font-bold text-emerald-600 font-mono text-sm">
            {formatCurrency(invoice.paid)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Outstanding Due</span>
          <div className="mt-1 font-bold text-rose-600 font-mono text-base">
            {formatCurrency(invoice.outstanding)}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Invoiced Products & Services</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Description / Product</TableHead>
                <TableHead align="center">Quantity</TableHead>
                <TableHead align="right">Unit Price</TableHead>
                <TableHead align="center">Tax (%)</TableHead>
                <TableHead align="right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.items || []).map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <span className="font-semibold text-slate-900">
                      {item.productName}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <span className="font-mono">{item.quantity}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono text-slate-700">
                      {formatCurrency(item.unitPrice)}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <span className="text-xs text-slate-600">{item.taxPercent}%</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(item.subtotal || item.quantity * item.unitPrice)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals Box */}
      <div className="flex justify-end">
        <div className="w-full sm:w-80 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Untaxed Subtotal:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatCurrency(invoice.subtotal)}
            </span>
          </div>

          <div className="flex justify-between text-sm text-slate-600">
            <span>Taxes:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatCurrency(invoice.tax)}
            </span>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between text-sm text-slate-800 font-bold">
            <span>Total Invoiced:</span>
            <span className="font-mono">{formatCurrency(invoice.total)}</span>
          </div>

          <div className="flex justify-between text-sm text-emerald-700 font-semibold">
            <span>Amount Paid:</span>
            <span className="font-mono">-{formatCurrency(invoice.paid)}</span>
          </div>

          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <span className="text-base font-black text-slate-900">Amount Due:</span>
            <span className="text-2xl font-black font-mono text-rose-600">
              {formatCurrency(invoice.outstanding)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        target={{
          targetType: 'INVOICE',
          targetId: invoice.id,
          targetNumber: invoice.invoiceNumber,
          partnerName: invoice.customerName,
          total: invoice.total,
          paid: invoice.paid,
          outstanding: invoice.outstanding,
        }}
        onPaymentSuccess={() => {
          loadInvoice();
        }}
      />
    </div>
  );
}
