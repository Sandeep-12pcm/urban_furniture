import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
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

export function VendorBills({ navigate }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Modal
  const [paymentTarget, setPaymentTarget] = useState(null);

  useEffect(() => {
    loadBills();
  }, []);

  async function loadBills() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.vendorBills.list();
      setBills(data);
    } catch (err) {
      setError(err.message || 'Failed to load vendor bills.');
    } finally {
      setLoading(false);
    }
  }

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'UNPAID' && b.status !== 'PAID' && b.status !== 'CANCELLED') ||
        (activeTab === 'PAID' && b.status === 'PAID');

      const matchesSearch =
        searchQuery === '' ||
        b.billNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.vendorName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [bills, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Bills', count: bills.length },
    {
      id: 'UNPAID',
      label: 'To Pay / Outstanding',
      count: bills.filter((b) => b.status !== 'PAID' && b.status !== 'CANCELLED').length,
    },
    {
      id: 'PAID',
      label: 'Paid',
      count: bills.filter((b) => b.status === 'PAID').length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vendor Bills"
        subtitle="Manage accounts payable, supplier invoices, payment disbursement, and dues."
        breadcrumbs={[{ label: 'Purchases' }, { label: 'Vendor Bills' }]}
      />

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search bill # or vendor..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading vendor bills..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadBills} />
      ) : filteredBills.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No vendor bills found"
          description={
            searchQuery
              ? `No bills matched "${searchQuery}".`
              : 'Create a purchase order and convert it to a bill to track payables.'
          }
          actionText="Go to Purchase Orders"
          onAction={() => navigate('/purchase-orders')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Bill #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Total</TableHead>
              <TableHead align="right">Paid</TableHead>
              <TableHead align="right">Outstanding</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBills.map((bill) => (
              <TableRow
                key={bill.id}
                onClick={() => navigate(`/vendor-bills/${bill.id}`)}
              >
                <TableCell>
                  <span className="font-bold text-indigo-950 hover:underline">
                    {bill.billNumber}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {bill.vendorName}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {formatDate(bill.billDate)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {formatDate(bill.dueDate)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge status={bill.status} />
                </TableCell>
                <TableCell align="right">
                  <span className="font-semibold text-slate-900 font-mono">
                    {formatCurrency(bill.total)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span className="font-mono text-emerald-600">
                    {formatCurrency(bill.paid)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span
                    className={`font-mono font-bold ${
                      bill.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {formatCurrency(bill.outstanding)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1">
                    {bill.outstanding > 0 && bill.status !== 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CreditCard}
                        className="text-emerald-700 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentTarget({
                            targetType: 'BILL',
                            targetId: bill.id,
                            targetNumber: bill.billNumber,
                            partnerName: bill.vendorName,
                            total: bill.total,
                            paid: bill.paid,
                            outstanding: bill.outstanding,
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
                        navigate(`/vendor-bills/${bill.id}`);
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
        onPaymentSuccess={loadBills}
      />
    </div>
  );
}
