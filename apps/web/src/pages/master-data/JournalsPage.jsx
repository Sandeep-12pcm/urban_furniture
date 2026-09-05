import { Archive, Loader2, NotebookText, Pencil, Plus, RotateCcw, Save } from 'lucide-react';
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
import { accountsApi, journalsApi } from '../../lib/masterDataApi.js';
import { validateJournalForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'SALES', label: 'Sales' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

export function JournalsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    accountsApi.list({ status: 'ACTIVE' }).then((data) => setAccounts(data.accounts || [])).catch(() => {});
  }, []);

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const params = {
    search: debouncedSearch || undefined,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    status: statusFilter,
    page,
    limit: 10,
  };
  const { data: journals, pagination, loading, error, reload } = useResourceList(journalsApi, params, 'journals');

  async function handleArchive() {
    setArchiving(true);
    try {
      await journalsApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive journal.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(journal) {
    setRestoringId(journal.id);
    try {
      await journalsApi.restore(journal.id);
      notify(`"${journal.name}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore journal.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Journals"
        subtitle="Groups of similar financial activities, ready for future Journal Entries"
        actions={
          <Button type="button" onClick={() => setFormState('create')}>
            <Plus className="h-4 w-4" />
            Add Journal
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(val) => { setSearch(val); setPage(1); }} placeholder="Search journals…" />
          <div className="flex gap-3">
            <FilterSelect label="Filter by type" value={typeFilter} onChange={(val) => { setTypeFilter(val); setPage(1); }} options={TYPE_OPTIONS} />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(val) => { setStatusFilter(val); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={4} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && journals.length === 0 && (
          <EmptyState icon={NotebookText} title="No journals found." description="Add a journal such as Sales, Purchase, Bank, or Cash." />
        )}

        {!loading && !error && journals.length > 0 && (
          <Table minWidth="680px">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Default Account</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {journals.map((journal) => (
                <Tr key={journal.id}>
                  <Td first className="font-semibold">{journal.name}</Td>
                  <Td><TypeBadge type={journal.type} /></Td>
                  <Td className="text-muted">{journal.defaultAccountCode} · {journal.defaultAccountName}</Td>
                  <Td><StatusBadge status={journal.status} /></Td>
                  <Td last>
                    <RowActions>
                      <RowActionButton label="Edit journal" icon={Pencil} onClick={() => setFormState(journal)} />
                      {journal.status === 'ACTIVE' && canArchive && (
                        <RowActionButton label="Archive journal" icon={Archive} tone="danger" onClick={() => setArchiveTarget(journal)} />
                      )}
                      {journal.status === 'ARCHIVED' && canArchive && (
                        <RowActionButton
                          label="Restore journal"
                          icon={restoringId === journal.id ? Loader2 : RotateCcw}
                          onClick={() => handleRestore(journal)}
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

      <JournalFormModal
        open={Boolean(formState)}
        journal={formState && formState !== 'create' ? formState : null}
        accounts={accounts}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive journal?"
        description={`"${archiveTarget?.name}" will be archived and hidden from new use.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function JournalFormModal({ open, journal, accounts, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(journal);
  const [form, setForm] = useState({ name: '', type: 'SALES', defaultAccountId: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: journal?.name || '',
        type: journal?.type || 'SALES',
        defaultAccountId: journal?.defaultAccountId || accounts[0]?.id || '',
        description: journal?.description || '',
      });
      setErrors({});
      setSubmitError('');
    }

  }, [open, journal]);

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateJournalForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        defaultAccountId: form.defaultAccountId,
        description: form.description.trim() || undefined,
      };
      if (isEdit) {
        await journalsApi.update(journal.id, payload);
        notify('Journal updated successfully.');
      } else {
        await journalsApi.create(payload);
        notify('Journal created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save journal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit Journal' : 'Add Journal'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <FormField label="Journal Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales Journal" />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Type" required error={errors.type}>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="SALES">Sales</option>
              <option value="PURCHASE">Purchase</option>
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
            </Select>
          </FormField>
          <FormField label="Default Account" required error={errors.defaultAccountId}>
            <Select value={form.defaultAccountId} onChange={(e) => setForm({ ...form, defaultAccountId: e.target.value })}>
              <option value="" disabled>Select an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.accountCode} · {account.accountName}</option>
              ))}
            </Select>
          </FormField>
        </div>

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
            {isEdit ? 'Save Changes' : 'Create Journal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
