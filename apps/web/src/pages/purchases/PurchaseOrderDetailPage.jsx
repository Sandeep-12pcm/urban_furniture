import { ArrowLeft, FileText, Loader2, Pencil, Save, ShoppingCart, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { ErrorState, InlineSpinner } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { LineItemsEditor } from '../../components/LineItemsEditor.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { contactsApi, productsApi, purchasesApi } from '../../lib/masterDataApi.js';

export function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await purchasesApi.order(id);
      setOrder(data.purchaseOrder);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load this Purchase Order.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setEditForm({
      vendorId: order.vendorId,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate || '',
      reference: order.reference || '',
      lines: order.items.map((i) => ({ productId: i.productId, description: i.description || '', quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })),
    });
    Promise.all([
      contactsApi.list({ type: 'VENDOR', status: 'ACTIVE', limit: 100 }),
      contactsApi.list({ type: 'BOTH', status: 'ACTIVE', limit: 100 }),
      productsApi.list({ status: 'ACTIVE', limit: 200 }),
    ]).then(([vend, both, prod]) => {
      setVendors([...(vend.contacts || []), ...(both.contacts || [])]);
      setProducts(prod.products || []);
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const data = await purchasesApi.updateOrder(id, {
        vendorId: editForm.vendorId,
        orderDate: editForm.orderDate,
        expectedDate: editForm.expectedDate || undefined,
        reference: editForm.reference.trim() || undefined,
        lines: editForm.lines.map((l) => ({ productId: l.productId, description: l.description || undefined, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) })),
      });
      setOrder(data.purchaseOrder);
      notify('Purchase Order updated successfully.');
      setEditing(false);
    } catch (requestError) {
      notify(requestError.message || 'Could not update Purchase Order.', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmOrder() {
    setActing('confirm');
    try {
      const data = await purchasesApi.confirmOrder(id);
      setOrder(data.purchaseOrder);
      notify('Purchase Order confirmed.');
    } catch (requestError) {
      notify(requestError.message || 'Could not confirm order.', { tone: 'error' });
    } finally {
      setActing('');
    }
  }

  async function cancelOrder() {
    setActing('cancel');
    try {
      const data = await purchasesApi.cancelOrder(id);
      setOrder(data.purchaseOrder);
      notify('Purchase Order cancelled.');
      setCancelOpen(false);
    } catch (requestError) {
      notify(requestError.message || 'Could not cancel order.', { tone: 'error' });
    } finally {
      setActing('');
    }
  }

  return (
    <div>
      <button type="button" onClick={() => navigate('/purchases/orders')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo">
        <ArrowLeft className="h-4 w-4" />
        Back to Purchase Orders
      </button>

      {loading && <div className="rounded-2xl border border-white/80 bg-white p-8 shadow-card"><InlineSpinner label="Loading Purchase Order…" /></div>}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && order && (
        <div className="space-y-6">
          <PageHeader
            title={order.orderNumber}
            subtitle={`${order.vendorName} · ${formatDate(order.orderDate)}`}
            actions={
              <>
                <StatusPill status={order.status} />
                {order.status === 'DRAFT' && !editing && (
                  <>
                    <Button type="button" variant="secondary" onClick={startEdit}><Pencil className="h-4 w-4" />Edit</Button>
                    <Button type="button" variant="secondary" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4" />Cancel</Button>
                    <Button type="button" onClick={confirmOrder} disabled={acting === 'confirm'}>
                      {acting === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                      Confirm Order
                    </Button>
                  </>
                )}
                {order.status === 'CONFIRMED' && (
                  <Button type="button" onClick={() => navigate(`/purchases/bills?fromOrder=${id}`)}>
                    <FileText className="h-4 w-4" />
                    Create Vendor Bill
                  </Button>
                )}
              </>
            }
          />

          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
            {editing ? (
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-3">
                  <FormField label="Vendor" required>
                    <Select value={editForm.vendorId} onChange={(e) => setEditForm({ ...editForm, vendorId: e.target.value })}>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Order Date" required>
                    <Input type="date" value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })} />
                  </FormField>
                  <FormField label="Expected Date">
                    <Input type="date" value={editForm.expectedDate} onChange={(e) => setEditForm({ ...editForm, expectedDate: e.target.value })} />
                  </FormField>
                </div>
                <LineItemsEditor lines={editForm.lines} onChange={(lines) => setEditForm({ ...editForm, lines })} products={products} />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}><X className="h-4 w-4" />Discard</Button>
                  <Button type="button" onClick={saveEdit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Table minWidth="600px">
                  <thead>
                    <tr>
                      <Th>Product</Th>
                      <Th>Qty</Th>
                      <Th>Unit Price</Th>
                      <Th>Tax</Th>
                      <Th>Line Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <Tr key={item.id}>
                        <Td first className="font-semibold">{item.productName}</Td>
                        <Td>{item.quantity}</Td>
                        <Td>{formatMoney(item.unitPrice)}</Td>
                        <Td>{item.taxRate}%</Td>
                        <Td last className="font-semibold">{formatMoney(item.lineTotal)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                <div className="mt-5 flex flex-wrap justify-end gap-6 rounded-xl bg-page p-4 text-sm font-semibold">
                  <span>Subtotal {formatMoney(order.subtotal)}</span>
                  <span>Tax {formatMoney(order.taxAmount)}</span>
                  <span className="text-ink">Total {formatMoney(order.totalAmount)}</span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-lg font-bold text-ink">Record History</h2>
            <dl className="grid gap-4 sm:grid-cols-3 text-sm">
              <div><dt className="text-xs font-bold uppercase text-muted">Reference</dt><dd className="mt-1 font-semibold">{order.reference || '—'}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-muted">Created By</dt><dd className="mt-1 font-semibold">{order.createdBy}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-muted">Confirmed By</dt><dd className="mt-1 font-semibold">{order.confirmedBy || '—'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Purchase Order?"
        description={`"${order?.orderNumber}" will be cancelled and can no longer be confirmed or billed.`}
        confirmLabel="Cancel Order"
        loading={acting === 'cancel'}
        onConfirm={cancelOrder}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
