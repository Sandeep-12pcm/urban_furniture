import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, ArrowLeft, Check } from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  LoadingSpinner,
  useToast,
} from '../components/ui';
import { formatCurrency } from '../utils/currency';

export function PurchaseOrderForm({ navigate }) {
  const { success, error: toastError } = useToast();

  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [vendorId, setVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState('30 Days');

  const [items, setItems] = useState([
    {
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      taxPercent: 0,
    },
  ]);

  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadMasterData() {
      try {
        const [vendorList, productList] = await Promise.all([
          api.contacts.list('VENDOR'),
          api.products.list(),
        ]);
        setVendors(vendorList);
        setProducts(productList);
        if (vendorList.length > 0) {
          setVendorId(vendorList[0].id);
        }
      } catch (err) {
        toastError('Failed to load vendors or products.');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadMasterData();
  }, [toastError]);

  function handleProductChange(index, prodId) {
    const selected = products.find((p) => p.id === prodId);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: prodId,
        productName: selected ? selected.name : '',
        unitPrice: selected ? selected.costPrice : 0,
        taxPercent: 0,
      };
      return copy;
    });
  }

  function updateItem(index, field, val) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        productName: '',
        quantity: 1,
        unitPrice: 0,
        taxPercent: 0,
      },
    ]);
  }

  function removeItem(index) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((acc, it) => {
    return acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
  }, 0);

  const grandTotal = subtotal;

  function validate() {
    const err = {};
    if (!vendorId) err.vendorId = 'Vendor selection is required.';
    if (items.length === 0) err.items = 'At least one line item is required.';

    let hasInvalidLine = false;
    items.forEach((it) => {
      if (!it.productId) hasInvalidLine = true;
      if (!it.quantity || it.quantity <= 0) hasInvalidLine = true;
    });
    if (hasInvalidLine) {
      err.items = 'Please select a product and valid quantity for each line.';
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function handleSubmit(asOrder = false) {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const selectedVendor = vendors.find((v) => v.id === vendorId);
      const payload = {
        vendorId,
        vendorName: selectedVendor ? selectedVendor.name : 'Vendor',
        orderDate,
        paymentTerms,
        status: asOrder ? 'PURCHASE ORDER' : 'RFQ',
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxPercent: 0,
          subtotal: Number(it.quantity) * Number(it.unitPrice),
        })),
        subtotal,
        tax: 0,
        total: grandTotal,
      };

      const created = await api.purchaseOrders.create(payload);
      success(`Purchase Order "${created.orderNumber}" created.`);
      navigate(`/purchase-orders/${created.id}`);
    } catch (err) {
      toastError(err.message || 'Failed to create purchase order.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInitial) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading purchase order workspace..." />
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader
        title="New Purchase Order"
        subtitle="Issue requests for quotation or confirmed purchase orders to suppliers."
        breadcrumbs={[
          { label: 'Purchase Orders', onClick: () => navigate('/purchase-orders') },
          { label: 'New PO' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/purchase-orders')}
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
            >
              Save as RFQ
            </Button>
            <Button
              variant="primary"
              icon={Check}
              onClick={() => handleSubmit(true)}
              loading={submitting}
            >
              Confirm Purchase Order
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Vendor & Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Vendor / Supplier"
                  required
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  options={vendors.map((v) => ({
                    value: v.id,
                    label: `${v.name} (${v.city || 'Vendor'})`,
                  }))}
                  error={errors.vendorId}
                />

                <Input
                  label="Order Date"
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Payment Terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  options={[
                    'Immediate Payment',
                    '15 Days',
                    '30 Days (Net 30)',
                    '60 Days',
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Products & Materials</CardTitle>
                <p className="text-xs text-slate-500">
                  Select furniture raw goods, hardware or finished inventory.
                </p>
              </div>
              <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>
                Add Item
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Product / Material</th>
                      <th className="px-3 py-3 w-24">Qty</th>
                      <th className="px-3 py-3 w-36">Unit Cost ($)</th>
                      <th className="px-4 py-3 w-32 text-right">Subtotal</th>
                      <th className="px-2 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const lineSubtotal =
                        (Number(item.quantity) || 0) *
                        (Number(item.unitPrice) || 0);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <select
                              value={item.productId}
                              onChange={(e) =>
                                handleProductChange(idx, e.target.value)
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">-- Choose Item --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Cost: {formatCurrency(p.costPrice)})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(idx, 'quantity', e.target.value)
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateItem(idx, 'unitPrice', e.target.value)
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-right text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                            {formatCurrency(lineSubtotal)}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-slate-400 hover:text-rose-600 transition"
                                title="Remove line"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {errors.items && (
                <div className="p-4 bg-rose-50 border-t border-rose-100 text-xs text-rose-700 font-medium">
                  {errors.items}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Procurement Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal Untaxed:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-900">Total:</span>
                <span className="text-2xl font-black text-indigo-900 font-mono">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  icon={Check}
                  onClick={() => handleSubmit(true)}
                  loading={submitting}
                >
                  Confirm Purchase Order
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                >
                  Save as RFQ Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
