import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Building2,
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
import { formatCurrency, formatDate } from '../utils/currency';

export function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.payments.list();
      setPayments(data);
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'INBOUND' && p.type === 'INBOUND') ||
        (activeTab === 'OUTBOUND' && p.type === 'OUTBOUND') ||
        (activeTab === 'BANK' && p.method === 'Bank') ||
        (activeTab === 'CASH' && p.method === 'Cash');

      const matchesSearch =
        searchQuery === '' ||
        p.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.targetNumber && p.targetNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.memo && p.memo.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesTab && matchesSearch;
    });
  }, [payments, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Payments', count: payments.length },
    {
      id: 'INBOUND',
      label: 'Customer Receipts (Inbound)',
      count: payments.filter((p) => p.type === 'INBOUND').length,
    },
    {
      id: 'OUTBOUND',
      label: 'Vendor Disbursements (Outbound)',
      count: payments.filter((p) => p.type === 'OUTBOUND').length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="General ledger cash and bank transaction receipts and disbursements."
        breadcrumbs={[{ label: 'Payments' }]}
      />

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search payment #, partner, memo..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading payment ledger..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadPayments} />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment records found"
          description={
            searchQuery
              ? `No payments matched "${searchQuery}".`
              : 'Payments recorded against invoices and vendor bills will appear here.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Payment Reference</TableHead>
              <TableHead>Flow Type</TableHead>
              <TableHead>Partner / Company</TableHead>
              <TableHead>Target Document</TableHead>
              <TableHead>Payment Method / Journal</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Memo / Note</TableHead>
              <TableHead align="right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-bold text-slate-900 font-mono">
                    {p.paymentNumber}
                  </span>
                </TableCell>
                <TableCell>
                  {p.type === 'INBOUND' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ArrowDownLeft className="h-3.5 w-3.5" /> Inbound
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Outbound
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {p.partnerName}
                  </span>
                </TableCell>
                <TableCell>
                  <code className="text-xs text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
                    {p.targetNumber}
                  </code>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-700">
                    {p.method} ({p.journalName || 'Cash/Bank'})
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {formatDate(p.date)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-500 max-w-xs truncate block">
                    {p.memo || '-'}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span
                    className={`font-mono font-bold ${
                      p.type === 'INBOUND' ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {p.type === 'INBOUND' ? '+' : '-'}
                    {formatCurrency(p.amount)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
