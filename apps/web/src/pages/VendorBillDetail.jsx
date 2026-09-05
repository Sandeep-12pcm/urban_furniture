import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
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

export function VendorBillDetail({ id, navigate }) {
  const { success, error: toastError } = useToast();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    loadBill();
  }, [id]);

  async function loadBill() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.vendorBills.get(id);
      setBill(data);
    } catch (err) {
      setError(err.message || 'Failed to load vendor bill.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePostBill() {
    setActionLoading(true);
    try {
      const updated = await api.vendorBills.post(id);
      setBill(updated);
      success(`Vendor Bill "${updated.billNumber}" posted!`);
    } catch (err) {
      toastError(err.message || 'Failed to post vendor bill.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading vendor bill details..." />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div>
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => navigate('/vendor-bills')}
          className="mb-4"
        >
          Back to Bills
        </Button>
        <ErrorState message={error || 'Vendor bill not found'} onRetry={loadBill} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={bill.billNumber}
        badge={<Badge status={bill.status} size="lg" />}
        breadcrumbs={[
          { label: 'Vendor Bills', onClick: () => navigate('/vendor-bills') },
          { label: bill.billNumber },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/vendor-bills')}
            >
              Back
            </Button>

            {bill.status === 'DRAFT' && (
              <Button
                variant="primary"
                icon={CheckCircle}
                onClick={handlePostBill}
                loading={actionLoading}
              >
                Post Bill
              </Button>
            )}

            {bill.outstanding > 0 && bill.status !== 'DRAFT' && (
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
              Print Bill
            </Button>
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Vendor</span>
          <div className="mt-1 font-bold text-slate-900 text-sm">{bill.vendorName}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Bill Date</span>
          <div className="mt-1 font-semibold text-slate-800 text-sm">
            {formatDate(bill.billDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Due Date</span>
          <div className="mt-1 font-semibold text-slate-800 text-sm">
            {formatDate(bill.dueDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Amount Paid</span>
          <div className="mt-1 font-bold text-emerald-600 font-mono text-sm">
            {formatCurrency(bill.paid)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Outstanding Due</span>
          <div className="mt-1 font-bold text-rose-600 font-mono text-base">
            {formatCurrency(bill.outstanding)}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Billed Products & Direct Materials</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Product / Material</TableHead>
                <TableHead align="center">Quantity</TableHead>
                <TableHead align="right">Unit Cost</TableHead>
                <TableHead align="right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(bill.items || []).map((item, idx) => (
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
            <span>Subtotal Untaxed:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatCurrency(bill.subtotal)}
            </span>
          </div>

          <div className="flex justify-between text-sm text-slate-600">
            <span>Taxes:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatCurrency(bill.tax)}
            </span>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between text-sm text-slate-800 font-bold">
            <span>Total Billed:</span>
            <span className="font-mono">{formatCurrency(bill.total)}</span>
          </div>

          <div className="flex justify-between text-sm text-emerald-700 font-semibold">
            <span>Amount Paid:</span>
            <span className="font-mono">-{formatCurrency(bill.paid)}</span>
          </div>

          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <span className="text-base font-black text-slate-900">Amount Due:</span>
            <span className="text-2xl font-black font-mono text-rose-600">
              {formatCurrency(bill.outstanding)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        target={{
          targetType: 'BILL',
          targetId: bill.id,
          targetNumber: bill.billNumber,
          partnerName: bill.vendorName,
          total: bill.total,
          paid: bill.paid,
          outstanding: bill.outstanding,
        }}
        onPaymentSuccess={() => {
          loadBill();
        }}
      />
    </div>
  );
}
