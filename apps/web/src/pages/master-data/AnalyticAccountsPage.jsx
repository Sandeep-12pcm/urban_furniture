import { Archive, Loader2, Pencil, Plus, RotateCcw, Save, Tags } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { Modal } from '../../components/Modal.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { RowActionButton, RowActions } from '../../components/RowActions.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusBadge, TypeBadge } from '../../components/StatusBadge.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { Textarea } from '../../components/Textarea.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { useToast } from '../../components/Toast.jsx';
import { canArchiveMasterData, useAuth } from '../../lib/AuthContext.jsx';
import { analyticAccountsApi } from '../../lib/masterDataApi.js';
import { validateAnalyticAccountForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

export function AnalyticAccountsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const params = {
    search: debouncedSearch || undefined,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    status: statusFilter,
    page,
    limit: 30,
  };
  const { data: analyticAccounts, pagination, loading, error, reload } = useResourceList(analyticAccountsApi, params, 'analyticAccounts');

  async function handleArchive() {
    setArchiving(true);
    try {
      await analyticAccountsApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive analytic account.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(item) {
    setRestoringId(item.id);
    try {
      await analyticAccountsApi.restore(item.id);
      notify(`"${item.name}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore analytic account.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Analytic Accounts"
        subtitle="Financial markers used to group income or expenses by project, department, or business unit"
        actions={
          <Button type="button" onClick={() => setFormState('create')}>
            <Plus className="h-4 w-4" />
            Add Analytic Account
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(val) => { setSearch(val); setPage(1); }} placeholder="Search analytic accounts…" />
          <div className="flex gap-3">
            <FilterSelect label="Filter by type" value={typeFilter} onChange={(val) => { setTypeFilter(val); setPage(1); }} options={TYPE_OPTIONS} />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(val) => { setStatusFilter(val); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={3} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && analyticAccounts.length === 0 && (
          <EmptyState icon={Tags} title="No analytic accounts found." description="Add one such as Marketing, Operations, or Furniture Manufacturing." />
        )}

        {!loading && !error && analyticAccounts.length > 0 && (
          <Table minWidth="600px">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {analyticAccounts.map((item) => (
                <Tr key={item.id}>
                  <Td first className="font-semibold">{item.name}</Td>
                  <Td><TypeBadge type={item.type} /></Td>
                  <Td><StatusBadge status={item.status} /></Td>
                  <Td last>
                    <RowActions>
                      <RowActionButton label="Edit analytic account" icon={Pencil} onClick={() => setFormState(item)} />
                      {item.status === 'ACTIVE' && canArchive && (
                        <RowActionButton label="Archive analytic account" icon={Archive} tone="danger" onClick={() => setArchiveTarget(item)} />
                      )}
                      {item.status === 'ARCHIVED' && canArchive && (
                        <RowActionButton
                          label="Restore analytic account"
                          icon={restoringId === item.id ? Loader2 : RotateCcw}
                          onClick={() => handleRestore(item)}
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

      <AnalyticAccountFormModal
        open={Boolean(formState)}
        analyticAccount={formState && formState !== 'create' ? formState : null}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive analytic account?"
        description={`"${archiveTarget?.name}" cannot be archived while it is used by an active budget.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function AnalyticAccountFormModal({ open, analyticAccount, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(analyticAccount);
  const [form, setForm] = useState({ name: '', type: 'EXPENSE', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: analyticAccount?.name || '',
        type: analyticAccount?.type || 'EXPENSE',
        description: analyticAccount?.description || '',
      });
      setErrors({});
      setSubmitError('');
    }
  }, [open, analyticAccount]);

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateAnalyticAccountForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = { name: form.name.trim(), type: form.type, description: form.description.trim() || undefined };
      if (isEdit) {
        await analyticAccountsApi.update(analyticAccount.id, payload);
        notify('Analytic account updated successfully.');
      } else {
        await analyticAccountsApi.create(payload);
        notify('Analytic account created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save analytic account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit Analytic Account' : 'Add Analytic Account'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <FormField label="Analytic Account Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Marketing" />
        </FormField>
        <FormField label="Type" required error={errors.type}>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </Select>
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>

        {submitError && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{submitError}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Analytic Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
