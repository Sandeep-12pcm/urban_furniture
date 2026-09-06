import { Download, Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { useToast } from '../../components/Toast.jsx';
import { downloadFile } from '../../lib/api.js';
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
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const params = { search: debouncedSearch || undefined, type: typeFilter || undefined, status: statusFilter || undefined, page };
  const { data: payments, pagination, loading, error, reload } = useResourceList(paymentsApi, params, 'payments');

  async function downloadReceipt(payment) {
    setDownloadingId(payment.id);
    try {
      await downloadFile(`/payments/${payment.id}/receipt/pdf`, `RECEIPT-${payment.paymentNumber}.pdf`);
      notify(`Receipt for ${payment.paymentNumber} downloaded.`);
    } catch (err) {
      notify(err.message || 'Failed to download receipt PDF.', { tone: 'error' });
    } finally {
      setDownloadingId('');
    }
  }

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

        {loading && <LoadingTable columns={8} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && payments.length === 0 && <EmptyState icon={Wallet} title="No payments recorded yet." />}

        {!loading && !error && payments.length > 0 && (
          <Table minWidth="880px">
            <thead>
              <tr>
                <Th>Payment</Th>
                <Th>Type</Th>
                <Th>Contact</Th>
                <Th>Against</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th className="text-right">Receipt</Th>
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
                    <Td>
                      {targetLabel ? (
                        <Link to={targetHref} className="font-semibold text-indigo hover:underline">{targetLabel}</Link>
                      ) : '—'}
                    </Td>
                    <Td>{formatDate(payment.paymentDate)}</Td>
                    <Td>{formatMoney(payment.amount)}</Td>
                    <Td><StatusPill status={payment.status} /></Td>
                    <Td last className="text-right">
                      <button
                        type="button"
                        aria-label="Download receipt"
                        title="Download receipt"
                        onClick={() => downloadReceipt(payment)}
                        disabled={downloadingId === payment.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy hover:bg-slate-100"
                      >
                        {downloadingId === payment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                    </Td>
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
