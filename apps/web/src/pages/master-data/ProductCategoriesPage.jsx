import { Archive, Boxes, Loader2, Pencil, Plus, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { Modal } from '../../components/Modal.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { RowActionButton, RowActions } from '../../components/RowActions.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { Textarea } from '../../components/Textarea.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { useToast } from '../../components/Toast.jsx';
import { canArchiveMasterData, useAuth } from '../../lib/AuthContext.jsx';
import { productCategoriesApi } from '../../lib/masterDataApi.js';
import { validateCategoryForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

export function ProductCategoriesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const debouncedSearch = useDebouncedValue(search);
  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const params = { search: debouncedSearch || undefined, status: statusFilter, limit: 100 };
  const { data: categories, loading, error, reload } = useResourceList(productCategoriesApi, params, 'categories');

  async function handleArchive() {
    setArchiving(true);
    try {
      await productCategoriesApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive category.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(category) {
    setRestoringId(category.id);
    try {
      await productCategoriesApi.restore(category.id);
      notify(`"${category.name}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore category.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Product Categories"
        subtitle="Group products into categories such as Chairs, Tables, or Sofas"
        actions={
          <Button type="button" onClick={() => setFormState('create')}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={setSearch} placeholder="Search categories…" />
          <FilterSelect label="Filter by status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        </Toolbar>

        {loading && <LoadingTable columns={3} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && categories.length === 0 && (
          <EmptyState icon={Boxes} title="No categories found." description="Add a category to start organizing products." />
        )}

        {!loading && !error && categories.length > 0 && (
          <Table minWidth="560px">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <Tr key={category.id}>
                  <Td first className="font-semibold">{category.name}</Td>
                  <Td className="text-muted">{category.description || '—'}</Td>
                  <Td><StatusBadge status={category.status} /></Td>
                  <Td last>
                    <RowActions>
                      <RowActionButton label="Edit category" icon={Pencil} onClick={() => setFormState(category)} />
                      {category.status === 'ACTIVE' && canArchive && (
                        <RowActionButton label="Archive category" icon={Archive} tone="danger" onClick={() => setArchiveTarget(category)} />
                      )}
                      {category.status === 'ARCHIVED' && canArchive && (
                        <RowActionButton
                          label="Restore category"
                          icon={restoringId === category.id ? Loader2 : RotateCcw}
                          onClick={() => handleRestore(category)}
                        />
                      )}
                    </RowActions>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <CategoryFormModal
        open={Boolean(formState)}
        category={formState && formState !== 'create' ? formState : null}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive category?"
        description={`"${archiveTarget?.name}" will be archived. It cannot be archived while active products are assigned to it.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function CategoryFormModal({ open, category, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(category);
  const [form, setForm] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: category?.name || '', description: category?.description || '' });
      setErrors({});
      setSubmitError('');
    }
  }, [open, category]);

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateCategoryForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || undefined };
      if (isEdit) {
        await productCategoriesApi.update(category.id, payload);
        notify('Category updated successfully.');
      } else {
        await productCategoriesApi.create(payload);
        notify('Category created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save category.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit Category' : 'Add Category'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <FormField label="Category Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chairs" />
        </FormField>
        <FormField label="Description" error={errors.description}>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>

        {submitError && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{submitError}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
