import { Eye, FileText, Loader2, Plus, Send, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { LineItemsEditor, emptyLine } from '../../components/LineItemsEditor.jsx';
import { Modal } from '../../components/Modal.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { RowActionButton, RowActions } from '../../components/RowActions.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { contactsApi, productsApi, purchasesApi } from '../../lib/masterDataApi.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function VendorBillsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const isContact = user?.role === 'CONTACT';
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [postingId, setPostingId] = useState('');

  const billsApi = { list: purchasesApi.bills, listKey: 'vendorBills' };
  const params = { search: debouncedSearch || undefined, status: statusFilter || undefined, page };
  const { data: bills, pagination, loading, error, reload } = useResourceList(billsApi, params, 'vendorBills');

  const fromOrder = searchParams.get('fromOrder');
  useEffect(() => {
    if (!fromOrder) return;
    purchasesApi.billFromOrder(fromOrder)
      .then((data) => { setPrefill(data.vendorBill); setFormOpen(true); })
      .catch((error) => notify(error.message || 'Could not load Purchase Order for billing.', { tone: 'error' }))
      .finally(() => setSearchParams({}, { replace: true }));

  }, [fromOrder]);

  async function postBill(bill) {
    setPostingId(bill.id);
    try {
      await purchasesApi.postBill(bill.id);
      notify(`Bill ${bill.billNumber} posted. Accounting entry created.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not post bill.', { tone: 'error' });
    } finally {
      setPostingId('');
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await purchasesApi.cancelBill(cancelTarget.id);
      notify(`Bill ${cancelTarget.billNumber} cancelled.`);
      setCancelTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not cancel bill.', { tone: 'error' });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendor Bills"
        subtitle="Supplier bills and their accounting state"
        actions={
          !isContact && (
            <Button type="button" onClick={() => { setPrefill(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New Bill
            </Button>
          )
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search bills…" />
          <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} />
        </Toolbar>

        {loading && <LoadingTable columns={6} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && bills.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No vendor bills found."
            action={!isContact && <Button type="button" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />New Bill</Button>}
          />
        )}

        {!loading && !error && bills.length > 0 && (
          <Table minWidth="820px">
            <thead>
              <tr>
                <Th>Bill Number</Th>
                <Th>Vendor</Th>
                <Th>Invoice #</Th>
                <Th>Due Date</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <Tr key={bill.id}>
                  <Td first className="font-semibold text-navy">{bill.billNumber}</Td>
                  <Td>{bill.vendorName}</Td>
                  <Td>{bill.vendorInvoiceNumber || '—'}</Td>
                  <Td>{formatDate(bill.dueDate)}</Td>
                  <Td>{formatMoney(bill.totalAmount)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <StatusPill status={bill.status} />
                      {bill.status === 'POSTED' && <StatusPill status={bill.paymentStatus} />}
                    </div>
                  </Td>
                  <Td last>
                    <RowActions>
                      <Link to={`/purchases/bills/${bill.id}`}>
                        <RowActionButton label="View bill" icon={Eye} onClick={() => {}} />
                      </Link>
                      {!isContact && bill.status === 'DRAFT' && (
                        <>
                          <RowActionButton label="Post bill" icon={postingId === bill.id ? Loader2 : Send} onClick={() => postBill(bill)} />
                          <RowActionButton label="Cancel bill" icon={XCircle} tone="danger" onClick={() => setCancelTarget(bill)} />
                        </>
                      )}
                    </RowActions>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      <VendorBillFormModal
        open={formOpen}
        prefill={prefill}
        onClose={() => { setFormOpen(false); setPrefill(null); }}
        onSaved={() => { setFormOpen(false); setPrefill(null); reload(); }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Vendor Bill?"
        description={`"${cancelTarget?.billNumber}" will be cancelled. Only Draft bills can be cancelled.`}
        confirmLabel="Cancel Bill"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function VendorBillFormModal({ open, prefill, onClose, onSaved }) {
  const { notify } = useToast();
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    contactsApi.list({ type: 'VENDOR', status: 'ACTIVE', limit: 100 }).then((vend) => {
      contactsApi.list({ type: 'BOTH', status: 'ACTIVE', limit: 100 }).then((both) => {
        setVendors([...(vend.contacts || []), ...(both.contacts || [])]);
      });
    });
    productsApi.list({ status: 'ACTIVE', limit: 200 }).then((d) => setProducts(d.products || []));

    if (prefill) {
      setForm({
        vendorId: prefill.vendorId,
        purchaseOrderId: prefill.purchaseOrderId,
        vendorInvoiceNumber: '',
        invoiceDate: prefill.invoiceDate,
        dueDate: prefill.dueDate,
        reference: prefill.reference || '',
        lines: prefill.lines.map((l) => ({ productId: l.productId, description: l.description || '', quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })),
      });
    } else {
      setForm({ vendorId: '', purchaseOrderId: null, vendorInvoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), reference: '', lines: [emptyLine()] });
    }
    setError('');
  }, [open, prefill]);

  async function submit(event) {
    event.preventDefault();
    if (!form.vendorId) return setError('Vendor is required.');
    if (form.dueDate < form.invoiceDate) return setError('Due date cannot be before invoice date.');
    if (form.lines.some((l) => !l.productId)) return setError('Every line must have a product selected.');

    setSubmitting(true);
    setError('');
    try {
      await purchasesApi.createBill({
        vendorId: form.vendorId,
        purchaseOrderId: form.purchaseOrderId || undefined,
        vendorInvoiceNumber: form.vendorInvoiceNumber.trim() || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        reference: form.reference.trim() || undefined,
        lines: form.lines.map((l) => ({ productId: l.productId, description: l.description || undefined, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) })),
      });
      notify('Vendor Bill created successfully.');
      onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Could not create Vendor Bill.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) return null;

  return (
    <Modal open={open} title="New Vendor Bill" subtitle={prefill ? 'Prefilled from a confirmed Purchase Order.' : undefined} onClose={onClose} width="max-w-3xl">
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Vendor" required>
            <Select disabled={Boolean(prefill)} value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">Select a vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Vendor Invoice #">
            <Input value={form.vendorInvoiceNumber} onChange={(e) => setForm({ ...form, vendorInvoiceNumber: e.target.value })} />
          </FormField>
          <FormField label="Reference">
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </FormField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Invoice Date" required>
            <Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
          </FormField>
          <FormField label="Due Date" required>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </FormField>
        </div>

        <LineItemsEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} products={products} disabled={Boolean(prefill)} />

        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Bill
          </Button>
        </div>
      </form>
    </Modal>
  );
}
