import React, { useState, useEffect } from 'react';
import {
  Truck,
  ArrowLeft,
  CheckCircle,
  Receipt,
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
import { formatCurrency, formatDate } from '../utils/currency';

export function PurchaseOrderDetail({ id, navigate }) {
  const { success, error: toastError } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function loadOrder() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.purchaseOrders.get(id);
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase order.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setActionLoading(true);
    try {
      const updated = await api.purchaseOrders.confirm(id);
      setOrder(updated);
      success(`Purchase Order "${updated.orderNumber}" confirmed!`);
    } catch (err) {
      toastError(err.message || 'Failed to confirm purchase order.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConvertToBill() {
    setActionLoading(true);
    try {
      const bill = await api.purchaseOrders.convertToBill(id);
      success(`Vendor Bill "${bill.billNumber}" created from purchase order!`);
      navigate(`/vendor-bills/${bill.id}`);
    } catch (err) {
      toastError(err.message || 'Failed to convert to vendor bill.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading purchase order details..." />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => navigate('/purchase-orders')}
          className="mb-4"
        >
          Back to Purchase Orders
        </Button>
        <ErrorState message={error || 'Purchase order not found'} onRetry={loadOrder} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={order.orderNumber}
        badge={<Badge status={order.status} size="lg" />}
        breadcrumbs={[
          { label: 'Purchase Orders', onClick: () => navigate('/purchase-orders') },
          { label: order.orderNumber },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/purchase-orders')}
            >
              Back
            </Button>

            {order.status === 'RFQ' && (
              <Button
                variant="primary"
                icon={CheckCircle}
                onClick={handleConfirm}
                loading={actionLoading}
              >
                Confirm Purchase Order
              </Button>
            )}

            {order.status === 'PURCHASE ORDER' && order.billStatus !== 'FULLY BILLED' && (
              <Button
                variant="success"
                icon={Receipt}
                onClick={handleConvertToBill}
                loading={actionLoading}
              >
                Convert to Bill
              </Button>
            )}

            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>
        }
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Vendor</span>
          <div className="mt-1 font-bold text-slate-900 text-base">{order.vendorName}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Order Date</span>
          <div className="mt-1 font-semibold text-slate-800 text-sm">
            {formatDate(order.orderDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Payment Terms</span>
          <div className="mt-1 font-semibold text-slate-800 text-sm">{order.paymentTerms}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase">Billing Status</span>
          <div className="mt-1">
            <Badge
              variant={
                order.billStatus === 'FULLY BILLED'
                  ? 'success'
                  : order.billStatus === 'WAITING BILLS'
                  ? 'warning'
                  : 'neutral'
              }
            >
              {order.billStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Procured Items & Materials</CardTitle>
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
              {(order.items || []).map((item, idx) => (
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

      {/* Totals Breakdown */}
      <div className="flex justify-end">
        <div className="w-full sm:w-80 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatCurrency(order.subtotal)}
            </span>
          </div>

          <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
            <span className="text-base font-bold text-slate-900">Total:</span>
            <span className="text-2xl font-black font-mono text-indigo-950">
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
