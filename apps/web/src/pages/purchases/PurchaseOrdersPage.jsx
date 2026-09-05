import { Eye, Loader2, Plus, ShoppingCart, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function PurchaseOrdersPage() {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingId, setConfirmingId] = useState('');

  const ordersApi = { list: purchasesApi.orders, listKey: 'purchaseOrders' };
  const params = { search: debouncedSearch || undefined, status: statusFilter || undefined, page };
  const { data: orders, pagination, loading, error, reload } = useResourceList(ordersApi, params, 'purchaseOrders');

  async function confirmOrder(order) {
    setConfirmingId(order.id);
    try {
      await purchasesApi.confirmOrder(order.id);
      notify(`Purchase Order ${order.orderNumber} confirmed.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not confirm order.', { tone: 'error' });
    } finally {
      setConfirmingId('');
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await purchasesApi.cancelOrder(cancelTarget.id);
      notify(`Purchase Order ${cancelTarget.orderNumber} cancelled.`);
      setCancelTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not cancel order.', { tone: 'error' });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Vendor orders before supplier billing"
        actions={
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search orders…" />
          <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} />
        </Toolbar>

        {loading && <LoadingTable columns={5} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && orders.length === 0 && (
          <EmptyState icon={ShoppingCart} title="No purchase orders found." action={<Button type="button" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />New Purchase Order</Button>} />
        )}

        {!loading && !error && orders.length > 0 && (
          <Table minWidth="760px">
            <thead>
              <tr>
                <Th>PO Number</Th>
                <Th>Vendor</Th>
                <Th>Date</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Tr key={order.id}>
                  <Td first className="font-semibold text-navy">{order.orderNumber}</Td>
                  <Td>{order.vendorName}</Td>
                  <Td>{formatDate(order.orderDate)}</Td>
                  <Td>{formatMoney(order.totalAmount)}</Td>
                  <Td><StatusPill status={order.status} /></Td>
                  <Td last>
                    <RowActions>
                      <Link to={`/purchases/orders/${order.id}`}>
                        <RowActionButton label="View order" icon={Eye} onClick={() => {}} />
                      </Link>
                      {order.status === 'DRAFT' && (
                        <>
                          <RowActionButton
                            label="Confirm order"
                            icon={confirmingId === order.id ? Loader2 : ShoppingCart}
                            onClick={() => confirmOrder(order)}
                          />
                          <RowActionButton label="Cancel order" icon={XCircle} tone="danger" onClick={() => setCancelTarget(order)} />
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

      <PurchaseOrderFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); reload(); }} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Purchase Order?"
        description={`"${cancelTarget?.orderNumber}" will be cancelled. Only Draft orders can be cancelled.`}
        confirmLabel="Cancel Order"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function PurchaseOrderFormModal({ open, onClose, onSaved }) {
  const { notify } = useToast();
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ vendorId: '', orderDate: new Date().toISOString().slice(0, 10), expectedDate: '', reference: '', lines: [emptyLine()] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      contactsApi.list({ type: 'VENDOR', status: 'ACTIVE', limit: 100 }).then((d) => setVendors(d.contacts || []));
      contactsApi.list({ type: 'BOTH', status: 'ACTIVE', limit: 100 }).then((d) => setVendors((current) => [...current, ...(d.contacts || [])]));
      productsApi.list({ status: 'ACTIVE', limit: 200 }).then((d) => setProducts(d.products || []));
      setForm({ vendorId: '', orderDate: new Date().toISOString().slice(0, 10), expectedDate: '', reference: '', lines: [emptyLine()] });
      setError('');
    }
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    if (!form.vendorId) return setError('Vendor is required.');
    if (form.lines.some((l) => !l.productId)) return setError('Every line must have a product selected.');

    setSubmitting(true);
    setError('');
    try {
      await purchasesApi.createOrder({
        vendorId: form.vendorId,
        orderDate: form.orderDate,
        expectedDate: form.expectedDate || undefined,
        reference: form.reference.trim() || undefined,
        lines: form.lines.map((l) => ({ productId: l.productId, description: l.description || undefined, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) })),
      });
      notify('Purchase Order created successfully.');
      onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Could not create Purchase Order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="New Purchase Order" onClose={onClose} width="max-w-3xl">
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Vendor" required>
            <Select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">Select a vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Order Date" required>
            <Input type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          </FormField>
          <FormField label="Expected Date">
            <Input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Reference">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </FormField>

        <LineItemsEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} products={products} />

        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Purchase Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
