import { Archive, Eye, Loader2, Package, Pencil, Plus, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { Modal } from '../../components/Modal.jsx';
import { MoneyInput } from '../../components/MoneyInput.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { RowActionButton, RowActions } from '../../components/RowActions.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusBadge, TypeBadge } from '../../components/StatusBadge.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { useToast } from '../../components/Toast.jsx';
import { canArchiveMasterData, useAuth } from '../../lib/AuthContext.jsx';
import { formatMoney } from '../../lib/format.js';
import { productCategoriesApi, productsApi } from '../../lib/masterDataApi.js';
import { validateProductForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'GOODS', label: 'Goods' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'COMBO', label: 'Combo' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

export function ProductsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [categories, setCategories] = useState([]);
  useEffect(() => {
    productCategoriesApi.list({ status: 'ALL', limit: 100 }).then((data) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const params = {
    search: debouncedSearch || undefined,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    categoryId: categoryFilter === 'ALL' ? undefined : categoryFilter,
    status: statusFilter,
    page,
  };

  const { data: products, pagination, loading, error, reload } = useResourceList(productsApi, params, 'products');

  async function handleArchive() {
    setArchiving(true);
    try {
      await productsApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive product.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(product) {
    setRestoringId(product.id);
    try {
      await productsApi.restore(product.id);
      notify(`"${product.name}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore product.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage furniture products and services"
        actions={
          <>
            <Link to="/master-data/categories">
              <Button type="button" variant="secondary">Manage Categories</Button>
            </Link>
            <Button type="button" onClick={() => setFormState('create')}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search products…" />
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label="Filter by category"
              value={categoryFilter}
              onChange={(value) => { setCategoryFilter(value); setPage(1); }}
              options={[{ value: 'ALL', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FilterSelect label="Filter by type" value={typeFilter} onChange={(value) => { setTypeFilter(value); setPage(1); }} options={TYPE_OPTIONS} />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={6} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && products.length === 0 && (
          <EmptyState
            icon={Package}
            title="No products found."
            description="Add your first product or service to get started."
            action={
              <Button type="button" onClick={() => setFormState('create')}>
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            }
          />
        )}

        {!loading && !error && products.length > 0 && (
          <Table minWidth="880px">
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Type</Th>
                <Th>Category</Th>
                <Th>Sales Price</Th>
                <Th>Purchase Price</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <Tr key={product.id}>
                  <Td first className="font-semibold">{product.name}</Td>
                  <Td><TypeBadge type={product.type} /></Td>
                  <Td className="text-muted">{product.categoryName}</Td>
                  <Td>{formatMoney(product.salesPrice)}</Td>
                  <Td>{formatMoney(product.purchasePrice)}</Td>
                  <Td><StatusBadge status={product.status} /></Td>
                  <Td last>
                    <RowActions>
                      <Link to={`/master-data/products/${product.id}`}>
                        <RowActionButton label="View product" icon={Eye} onClick={() => {}} />
                      </Link>
                      <RowActionButton label="Edit product" icon={Pencil} onClick={() => setFormState(product)} />
                      {product.status === 'ACTIVE' && canArchive && (
                        <RowActionButton label="Archive product" icon={Archive} tone="danger" onClick={() => setArchiveTarget(product)} />
                      )}
                      {product.status === 'ARCHIVED' && canArchive && (
                        <RowActionButton
                          label="Restore product"
                          icon={restoringId === product.id ? Loader2 : RotateCcw}
                          onClick={() => handleRestore(product)}
                        />
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

      <ProductFormModal
        open={Boolean(formState)}
        product={formState && formState !== 'create' ? formState : null}
        categories={categories.filter((c) => c.status === 'ACTIVE')}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive product?"
        description={`"${archiveTarget?.name}" will be moved to Archived and hidden from new transactions. You can restore it later.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function ProductFormModal({ open, product, categories, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(product);
  const [form, setForm] = useState({ name: '', type: 'GOODS', categoryId: '', salesPrice: '', purchasePrice: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: product?.name || '',
        type: product?.type || 'GOODS',
        categoryId: product?.categoryId || categories[0]?.id || '',
        salesPrice: product?.salesPrice ?? '',
        purchasePrice: product?.purchasePrice ?? '',
      });
      setErrors({});
      setSubmitError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateProductForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        categoryId: form.categoryId,
        salesPrice: Number(form.salesPrice),
        purchasePrice: Number(form.purchasePrice),
      };
      if (isEdit) {
        await productsApi.update(product.id, payload);
        notify('Product updated successfully.');
      } else {
        await productsApi.create(payload);
        notify('Product created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save product.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <FormField label="Product Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Executive Chair" />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Type" required error={errors.type}>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="GOODS">Goods</option>
              <option value="SERVICE">Service</option>
              <option value="COMBO">Combo</option>
            </Select>
          </FormField>
          <FormField label="Category" required error={errors.categoryId}>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="" disabled>Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Sales Price" required error={errors.salesPrice}>
            <MoneyInput value={form.salesPrice} onChange={(e) => setForm({ ...form, salesPrice: e.target.value })} />
          </FormField>
          <FormField label="Purchase Price" required error={errors.purchasePrice}>
            <MoneyInput value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          </FormField>
        </div>

        {submitError && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{submitError}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
