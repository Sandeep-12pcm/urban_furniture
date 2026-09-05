import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Tag,
  Boxes,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Input,
  Select,
  Modal,
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
  ConfirmDialog,
  useToast,
} from '../components/ui';
import { formatCurrency, formatNumber } from '../utils/currency';

export function Products() {
  const { success, error: toastError } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Desks & Workstations',
    salesPrice: '',
    costPrice: '',
    taxPercent: '10',
    stockQuantity: '',
    uom: 'Units',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.products.list();
      setProducts(data);
    } catch (err) {
      setError(err.message || 'Failed to load products catalog.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      category: 'Desks & Workstations',
      salesPrice: '',
      costPrice: '',
      taxPercent: '10',
      stockQuantity: '0',
      uom: 'Units',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function handleOpenEdit(product) {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || 'General',
      salesPrice: String(product.salesPrice ?? ''),
      costPrice: String(product.costPrice ?? ''),
      taxPercent: String(product.taxPercent ?? '10'),
      stockQuantity: String(product.stockQuantity ?? '0'),
      uom: product.uom || 'Units',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function validateForm() {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Product name is required.';
    if (!formData.salesPrice || Number(formData.salesPrice) < 0) {
      errors.salesPrice = 'Sales price must be positive.';
    }
    if (formData.costPrice && Number(formData.costPrice) < 0) {
      errors.costPrice = 'Cost price cannot be negative.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        salesPrice: Number(formData.salesPrice),
        costPrice: Number(formData.costPrice || 0),
        taxPercent: Number(formData.taxPercent || 0),
        stockQuantity: Number(formData.stockQuantity || 0),
      };

      if (editingProduct) {
        const updated = await api.products.update(editingProduct.id, payload);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? updated : p))
        );
        success(`Product "${updated.name}" updated successfully.`);
      } else {
        const created = await api.products.create(payload);
        setProducts((prev) => [created, ...prev]);
        success(`Product "${created.name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toastError(err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.products.delete(deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      success(`Product "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toastError(err.message || 'Failed to delete product.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      return (
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [products, searchQuery]);

  return (
    <div>
      <PageHeader
        title="Products & Inventory"
        subtitle="Catalog of furniture items, raw materials, pricing, and stock levels."
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Products' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            New Product
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search products by SKU, title, category..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content States */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading product catalog..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadProducts} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={
            searchQuery
              ? `No products matched "${searchQuery}".`
              : 'Add your first furniture product or office item to start selling.'
          }
          actionText={searchQuery ? 'Clear Search' : 'Add Product'}
          onAction={searchQuery ? () => setSearchQuery('') : handleOpenCreate}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Product</TableHead>
              <TableHead>SKU / Internal Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead align="right">Sales Price</TableHead>
              <TableHead align="right">Cost Price</TableHead>
              <TableHead align="right">Margin</TableHead>
              <TableHead align="right">On Hand Stock</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const margin =
                product.salesPrice > 0
                  ? Math.round(
                      ((product.salesPrice - product.costPrice) /
                        product.salesPrice) *
                        100
                    )
                  : 0;

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-indigo-700">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="font-semibold text-slate-900">{product.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-mono">
                      {product.sku || '-'}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{product.category}</Badge>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(product.salesPrice)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="text-slate-600">
                      {formatCurrency(product.costPrice)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`text-xs font-semibold ${
                        margin >= 40 ? 'text-emerald-600' : 'text-slate-600'
                      }`}
                    >
                      {margin}%
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        product.stockQuantity < 15
                          ? 'text-amber-600'
                          : 'text-slate-800'
                      }`}
                    >
                      <Boxes className="h-3.5 w-3.5" />
                      {formatNumber(product.stockQuantity)} {product.uom}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit2}
                        onClick={() => handleOpenEdit(product)}
                        title="Edit product"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() => setDeleteTarget(product)}
                        title="Delete product"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'New Product'}
        description="Add or update furniture catalog items with pricing and inventory data."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveProduct}
              loading={saving}
            >
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <Input
            label="Product Name"
            placeholder="e.g. Ergonomic Executive Chair"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="SKU / Item Code"
              placeholder="e.g. CHR-EXEC-01"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            />
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                'Desks & Workstations',
                'Seating',
                'Conference Furniture',
                'Lounge & Reception',
                'Storage',
                'Accessories',
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Sales Price ($)"
              type="number"
              step="0.01"
              placeholder="0.00"
              required
              value={formData.salesPrice}
              onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
              error={formErrors.salesPrice}
            />
            <Input
              label="Cost Price ($)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              error={formErrors.costPrice}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Tax Rate (%)"
              type="number"
              placeholder="10"
              value={formData.taxPercent}
              onChange={(e) => setFormData({ ...formData, taxPercent: e.target.value })}
            />
            <Input
              label="Initial Stock"
              type="number"
              placeholder="0"
              value={formData.stockQuantity}
              onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
            />
            <Select
              label="Unit of Measure"
              value={formData.uom}
              onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
              options={['Units', 'Sets', 'Boxes', 'Meters']}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProduct}
        loading={deleting}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmText="Delete Product"
        variant="danger"
      />
    </div>
  );
}
