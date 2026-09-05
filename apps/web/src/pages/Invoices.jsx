import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Eye,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  Tabs,
} from '../components/ui';
import { PaymentModal } from '../components/PaymentModal';
import { formatCurrency, formatDate } from '../utils/currency';

export function Invoices({ navigate }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Modal State
  const [paymentTarget, setPaymentTarget] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.invoices.list();
      setInvoices(data);
    } catch (err) {
      setError(err.message || 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'UNPAID' && inv.status !== 'PAID' && inv.status !== 'CANCELLED') ||
        (activeTab === 'PAID' && inv.status === 'PAID') ||
        (activeTab === 'DRAFT' && inv.status === 'DRAFT');

      const matchesSearch =
        searchQuery === '' ||
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [invoices, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Invoices', count: invoices.length },
    {
      id: 'UNPAID',
      label: 'To Pay / Outstanding',
      count: invoices.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED').length,
    },
    {
      id: 'PAID',
      label: 'Paid',
      count: invoices.filter((i) => i.status === 'PAID').length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customer Invoices"
        subtitle="Manage accounts receivable, customer billings, payment tracking, and collections."
        breadcrumbs={[{ label: 'Sales' }, { label: 'Customer Invoices' }]}
      />

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search invoice # or customer..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading invoices..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadInvoices} />
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={
            searchQuery
              ? `No invoices matched "${searchQuery}".`
              : 'Create a sales order and generate an invoice to start billing.'
          }
          actionText="Go to Sales Orders"
          onAction={() => navigate('/sales-orders')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Total</TableHead>
              <TableHead align="right">Paid</TableHead>
              <TableHead align="right">Outstanding</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((inv) => (
              <TableRow
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <TableCell>
                  <span className="font-bold text-indigo-950 hover:underline">
                    {inv.invoiceNumber}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {inv.customerName}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {formatDate(inv.invoiceDate)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {formatDate(inv.dueDate)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge status={inv.status} />
                </TableCell>
                <TableCell align="right">
                  <span className="font-semibold text-slate-900 font-mono">
                    {formatCurrency(inv.total)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span className="font-mono text-emerald-600">
                    {formatCurrency(inv.paid)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span
                    className={`font-mono font-bold ${
                      inv.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {formatCurrency(inv.outstanding)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1">
                    {inv.outstanding > 0 && inv.status !== 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CreditCard}
                        className="text-emerald-700 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentTarget({
                            targetType: 'INVOICE',
                            targetId: inv.id,
                            targetNumber: inv.invoiceNumber,
                            partnerName: inv.customerName,
                            total: inv.total,
                            paid: inv.paid,
                            outstanding: inv.outstanding,
                          });
                        }}
                      >
                        Pay
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Eye}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/invoices/${inv.id}`);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={Boolean(paymentTarget)}
        onClose={() => setPaymentTarget(null)}
        target={paymentTarget}
        onPaymentSuccess={loadInvoices}
      />
    </div>
  );
}
