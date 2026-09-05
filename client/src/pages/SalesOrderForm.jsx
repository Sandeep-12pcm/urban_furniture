import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, ArrowLeft, Check } from 'lucide-react';
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

export function SalesOrderForm({ navigate }) {
  const { success, error: toastError } = useToast();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState('');
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
      taxPercent: 10,
    },
  ]);

  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadMasterData() {
      try {
        const [contactList, productList] = await Promise.all([
          api.contacts.list('CUSTOMER'),
          api.products.list(),
        ]);
        setCustomers(contactList);
        setProducts(productList);
        if (contactList.length > 0) {
          setCustomerId(contactList[0].id);
        }
      } catch (err) {
        toastError('Failed to load customers or products.');
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
        unitPrice: selected ? selected.salesPrice : 0,
        taxPercent: selected ? selected.taxPercent : 10,
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
        taxPercent: 10,
      },
    ]);
  }

  function removeItem(index) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Live calculation preview
  const subtotal = items.reduce((acc, it) => {
    return acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
  }, 0);

  const taxTotal = items.reduce((acc, it) => {
    const lineSubtotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    return acc + lineSubtotal * ((Number(it.taxPercent) || 0) / 100);
  }, 0);

  const grandTotal = subtotal + taxTotal;

  function validate() {
    const err = {};
    if (!customerId) err.customerId = 'Customer selection is required.';
    if (items.length === 0) err.items = 'At least one line item is required.';

    let hasInvalidLine = false;
    items.forEach((it, idx) => {
      if (!it.productId) hasInvalidLine = true;
      if (!it.quantity || it.quantity <= 0) hasInvalidLine = true;
    });
    if (hasInvalidLine) {
      err.items = 'Please select a product and valid positive quantity for each line.';
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function handleSubmit(asConfirmed = false) {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      const payload = {
        customerId,
        customerName: selectedCustomer ? selectedCustomer.name : 'Customer',
        orderDate,
        paymentTerms,
        status: asConfirmed ? 'CONFIRMED' : 'QUOTATION',
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxPercent: Number(it.taxPercent),
          subtotal: Number(it.quantity) * Number(it.unitPrice),
        })),
        subtotal,
        tax: taxTotal,
        total: grandTotal,
      };

      const created = await api.salesOrders.create(payload);
      success(`Sales Order "${created.orderNumber}" created successfully!`);
      navigate(`/sales-orders/${created.id}`);
    } catch (err) {
      toastError(err.message || 'Failed to submit sales order.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInitial) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading sales order workspace..." />
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader
        title="New Sales Order"
        subtitle="Create an official customer quotation or confirmed sales order."
        breadcrumbs={[
          { label: 'Sales Orders', onClick: () => navigate('/sales-orders') },
          { label: 'New Order' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/sales-orders')}
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
            >
              Save as Quotation
            </Button>
            <Button
              variant="primary"
              icon={Check}
              onClick={() => handleSubmit(true)}
              loading={submitting}
            >
              Confirm Order
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Form (Left 2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer & Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Customer"
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.city || 'No City'})`,
                  }))}
                  error={errors.customerId}
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

          {/* Line Items Card */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Order Line Items</CardTitle>
                <p className="text-xs text-slate-500">
                  Select furniture products, adjust quantities, and preview pricing.
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
                      <th className="px-4 py-3">Product</th>
                      <th className="px-3 py-3 w-24">Qty</th>
                      <th className="px-3 py-3 w-32">Unit Price ($)</th>
                      <th className="px-3 py-3 w-24">Tax (%)</th>
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
                              <option value="">-- Choose Product --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatCurrency(p.salesPrice)})
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
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={item.taxPercent}
                              onChange={(e) =>
                                updateItem(idx, 'taxPercent', e.target.value)
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

        {/* Totals Summary Panel (Right col) */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal Untaxed:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex justify-between text-sm text-slate-600">
                <span>Estimated Tax:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(taxTotal)}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-900">
                  Total Amount:
                </span>
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
                  Confirm & Finalize Order
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                >
                  Save as Quotation Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
