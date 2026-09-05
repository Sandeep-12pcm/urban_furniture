import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { paymentsApi } from '../../lib/masterDataApi.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'CUSTOMER', label: 'Customer Receipts' },
  { value: 'VENDOR', label: 'Vendor Payments' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const params = { search: debouncedSearch || undefined, type: typeFilter || undefined, status: statusFilter || undefined, page };
  const { data: payments, pagination, loading, error, reload } = useResourceList(paymentsApi, params, 'payments');

  return (
    <div>
      <PageHeader title="Payments" subtitle="Customer receipts and vendor payments, and their accounting entries" />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search payments…" />
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Filter by type" value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={TYPE_OPTIONS} />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={7} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && payments.length === 0 && <EmptyState icon={Wallet} title="No payments recorded yet." />}

        {!loading && !error && payments.length > 0 && (
          <Table minWidth="820px">
            <thead>
              <tr>
                <Th>Payment</Th>
                <Th>Type</Th>
                <Th>Contact</Th>
                <Th>Against</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const targetHref = payment.type === 'CUSTOMER'
                  ? `/sales/invoices/${payment.customerInvoiceId}`
                  : `/purchases/bills/${payment.vendorBillId}`;
                const targetLabel = payment.type === 'CUSTOMER' ? payment.customerInvoiceNumber : payment.vendorBillNumber;
                return (
                  <Tr key={payment.id}>
                    <Td first className="font-semibold text-navy">{payment.paymentNumber}</Td>
                    <Td className="capitalize">{payment.type === 'CUSTOMER' ? 'Receipt' : 'Payment'}</Td>
                    <Td>{payment.contactName}</Td>
                    <Td><Link to={targetHref} className="font-semibold text-indigo hover:underline">{targetLabel}</Link></Td>
                    <Td>{formatDate(payment.paymentDate)}</Td>
                    <Td>{formatMoney(payment.amount)}</Td>
                    <Td last><StatusPill status={payment.status} /></Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
}
