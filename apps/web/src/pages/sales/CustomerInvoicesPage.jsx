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
import { useAuth } from '../../lib/AuthContext.jsx';
import { contactsApi, productsApi, salesApi } from '../../lib/masterDataApi.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function CustomerInvoicesPage() {
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

  const invoicesApi = { list: salesApi.invoices, listKey: 'customerInvoices' };
  const params = { search: debouncedSearch || undefined, status: statusFilter || undefined, page };
  const { data: invoices, pagination, loading, error, reload } = useResourceList(invoicesApi, params, 'customerInvoices');

  const fromOrder = searchParams.get('fromOrder');
  useEffect(() => {
    if (!fromOrder) return;
    salesApi.invoiceFromOrder(fromOrder)
      .then((data) => {
        setPrefill(data.customerInvoice);
        setFormOpen(true);
      })
      .catch((error) => notify(error.message || 'Could not load Sales Order for invoicing.', { tone: 'error' }))
      .finally(() => setSearchParams({}, { replace: true }));

  }, [fromOrder]);

  async function postInvoice(invoice) {
    setPostingId(invoice.id);
    try {
      await salesApi.postInvoice(invoice.id);
      notify(`Invoice ${invoice.invoiceNumber} posted. Accounting entry created.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not post invoice.', { tone: 'error' });
    } finally {
      setPostingId('');
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await salesApi.cancelInvoice(cancelTarget.id);
      notify(`Invoice ${cancelTarget.invoiceNumber} cancelled.`);
      setCancelTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not cancel invoice.', { tone: 'error' });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customer Invoices"
        subtitle="Draft and posted receivable documents"
        actions={
          !isContact && (
            <Button type="button" onClick={() => { setPrefill(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          )
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search invoices…" />
          <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} />
        </Toolbar>

        {loading && <LoadingTable columns={5} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && invoices.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No customer invoices found."
            action={!isContact && <Button type="button" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />New Invoice</Button>}
          />
        )}

        {!loading && !error && invoices.length > 0 && (
          <Table minWidth="800px">
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <Tr key={invoice.id}>
                  <Td first className="font-semibold text-navy">{invoice.invoiceNumber}</Td>
                  <Td>{invoice.customerName}</Td>
                  <Td>{formatDate(invoice.invoiceDate)}</Td>
                  <Td>{formatMoney(invoice.totalAmount)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <StatusPill status={invoice.status} />
                      {invoice.status === 'POSTED' && <StatusPill status={invoice.paymentStatus} />}
                    </div>
                  </Td>
                  <Td last>
                    <RowActions>
                      <Link to={`/sales/invoices/${invoice.id}`}>
                        <RowActionButton label="View invoice" icon={Eye} onClick={() => {}} />
                      </Link>
                      {!isContact && invoice.status === 'DRAFT' && (
                        <>
                          <RowActionButton label="Post invoice" icon={postingId === invoice.id ? Loader2 : Send} onClick={() => postInvoice(invoice)} />
                          <RowActionButton label="Cancel invoice" icon={XCircle} tone="danger" onClick={() => setCancelTarget(invoice)} />
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

      <CustomerInvoiceFormModal
        open={formOpen}
        prefill={prefill}
        onClose={() => { setFormOpen(false); setPrefill(null); }}
        onSaved={() => { setFormOpen(false); setPrefill(null); reload(); }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Customer Invoice?"
        description={`"${cancelTarget?.invoiceNumber}" will be cancelled. Only Draft invoices can be cancelled.`}
        confirmLabel="Cancel Invoice"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function CustomerInvoiceFormModal({ open, prefill, onClose, onSaved }) {
  const { notify } = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    contactsApi.list({ type: 'CUSTOMER', status: 'ACTIVE', limit: 100 }).then((cust) => {
      contactsApi.list({ type: 'BOTH', status: 'ACTIVE', limit: 100 }).then((both) => {
        setCustomers([...(cust.contacts || []), ...(both.contacts || [])]);
      });
    });
    productsApi.list({ status: 'ACTIVE', limit: 200 }).then((d) => setProducts(d.products || []));

    if (prefill) {
      setForm({
        customerId: prefill.customerId,
        salesOrderId: prefill.salesOrderId,
        invoiceDate: prefill.invoiceDate,
        dueDate: prefill.dueDate,
        reference: prefill.reference || '',
        lines: prefill.items.map((i) => ({ productId: i.productId, description: i.description || '', quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })),
      });
    } else {
      setForm({ customerId: '', salesOrderId: null, invoiceDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), reference: '', lines: [emptyLine()] });
    }
    setError('');
  }, [open, prefill]);

  async function submit(event) {
    event.preventDefault();
    if (!form.customerId) return setError('Customer is required.');
    if (form.dueDate < form.invoiceDate) return setError('Due date cannot be before invoice date.');
    if (form.lines.some((l) => !l.productId)) return setError('Every line must have a product selected.');

    setSubmitting(true);
    setError('');
    try {
      await salesApi.createInvoice({
        customerId: form.customerId,
        salesOrderId: form.salesOrderId || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        reference: form.reference.trim() || undefined,
        items: form.lines.map((l) => ({ productId: l.productId, description: l.description || undefined, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) })),
      });
      notify('Customer Invoice created successfully.');
      onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Could not create invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) return null;

  return (
    <Modal open={open} title="New Customer Invoice" subtitle={prefill ? 'Prefilled from a confirmed Sales Order.' : undefined} onClose={onClose} width="max-w-3xl">
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Customer" required>
            <Select disabled={Boolean(prefill)} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select a customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Invoice Date" required>
            <Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
          </FormField>
          <FormField label="Due Date" required>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Reference">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </FormField>

        <LineItemsEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} products={products} disabled={Boolean(prefill)} />

        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}
