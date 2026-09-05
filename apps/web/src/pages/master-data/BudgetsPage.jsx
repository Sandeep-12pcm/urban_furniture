import { Archive, Loader2, Pencil, Plus, RotateCcw, Save, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { useToast } from '../../components/Toast.jsx';
import { canArchiveMasterData, useAuth } from '../../lib/AuthContext.jsx';
import { formatDate, formatMoney, toDateInputValue } from '../../lib/format.js';
import { analyticAccountsApi, budgetsApi, fetchAssignableUsers } from '../../lib/masterDataApi.js';
import { validateBudgetForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

export function BudgetsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [analyticFilter, setAnalyticFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [analyticAccounts, setAnalyticAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  useEffect(() => {
    analyticAccountsApi.list({ status: 'ALL', limit: 500 }).then((data) => setAnalyticAccounts(data.analyticAccounts || [])).catch(() => {});
    fetchAssignableUsers().then((data) => setUsers(data.users || [])).catch(() => {});
  }, []);

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const params = {
    search: debouncedSearch || undefined,
    analyticAccountId: analyticFilter === 'ALL' ? undefined : analyticFilter,
    status: statusFilter,
    page,
    limit: 300,
  };
  const { data: budgets, pagination, loading, error, reload } = useResourceList(budgetsApi, params, 'budgets');

  async function handleArchive() {
    setArchiving(true);
    try {
      await budgetsApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive budget.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(budget) {
    setRestoringId(budget.id);
    try {
      await budgetsApi.restore(budget.id);
      notify(`"${budget.name}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore budget.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Plan spending or income against an Analytic Account and a responsible person"
        actions={
          <Button type="button" onClick={() => setFormState('create')}>
            <Plus className="h-4 w-4" />
            Add Budget
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search budgets…" />
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label="Filter by analytic account"
              value={analyticFilter}
              onChange={(value) => { setAnalyticFilter(value); setPage(1); }}
              options={[{ value: 'ALL', label: 'All Analytic Accounts' }, ...analyticAccounts.map((a) => ({ value: a.id, label: a.name }))]}
            />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={6} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && budgets.length === 0 && (
          <EmptyState icon={Wallet} title="No budgets found." description="Plan your first budget against an analytic account." />
        )}

        {!loading && !error && budgets.length > 0 && (
          <Table minWidth="920px">
            <thead>
              <tr>
                <Th>Budget</Th>
                <Th>Period</Th>
                <Th>Analytic Account</Th>
                <Th>Responsible</Th>
                <Th>Planned Amount</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => (
                <Tr key={budget.id}>
                  <Td first className="font-semibold">{budget.name}</Td>
                  <Td className="text-muted">{formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}</Td>
                  <Td className="text-muted">{budget.analyticAccountName}</Td>
                  <Td className="text-muted">{budget.responsibleUserLoginId}</Td>
                  <Td>{formatMoney(budget.plannedAmount)}</Td>
                  <Td><StatusBadge status={budget.status} /></Td>
                  <Td last>
                    <RowActions>
                      <RowActionButton label="Edit budget" icon={Pencil} onClick={() => setFormState(budget)} />
                      {budget.status === 'ACTIVE' && canArchive && (
                        <RowActionButton label="Archive budget" icon={Archive} tone="danger" onClick={() => setArchiveTarget(budget)} />
                      )}
                      {budget.status === 'ARCHIVED' && canArchive && (
                        <RowActionButton
                          label="Restore budget"
                          icon={restoringId === budget.id ? Loader2 : RotateCcw}
                          onClick={() => handleRestore(budget)}
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

      <BudgetFormModal
        open={Boolean(formState)}
        budget={formState && formState !== 'create' ? formState : null}
        analyticAccounts={analyticAccounts.filter((a) => a.status === 'ACTIVE')}
        users={users}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive budget?"
        description={`"${archiveTarget?.name}" will be archived.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function BudgetFormModal({ open, budget, analyticAccounts, users, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(budget);
  const [form, setForm] = useState({
    name: '',
    periodStart: '',
    periodEnd: '',
    plannedAmount: '',
    analyticAccountId: '',
    responsibleUserId: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: budget?.name || '',
        periodStart: toDateInputValue(budget?.periodStart),
        periodEnd: toDateInputValue(budget?.periodEnd),
        plannedAmount: budget?.plannedAmount ?? '',
        analyticAccountId: budget?.analyticAccountId || analyticAccounts[0]?.id || '',
        responsibleUserId: budget?.responsibleUserId || users[0]?.id || '',
      });
      setErrors({});
      setSubmitError('');
    }

  }, [open, budget]);

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateBudgetForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        name: form.name.trim(),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        plannedAmount: Number(form.plannedAmount),
        analyticAccountId: form.analyticAccountId,
        responsibleUserId: form.responsibleUserId,
      };
      if (isEdit) {
        await budgetsApi.update(budget.id, payload);
        notify('Budget updated successfully.');
      } else {
        await budgetsApi.create(payload);
        notify('Budget created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save budget.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit Budget' : 'Add Budget'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <FormField label="Budget Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q1 Marketing Budget" />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Period Start" required error={errors.periodStart}>
            <Input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
          </FormField>
          <FormField label="Period End" required error={errors.periodEnd}>
            <Input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Analytic Account" required error={errors.analyticAccountId}>
            <Select value={form.analyticAccountId} onChange={(e) => setForm({ ...form, analyticAccountId: e.target.value })}>
              <option value="" disabled>Select an analytic account</option>
              {analyticAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Responsible Person" required error={errors.responsibleUserId}>
            <Select value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })}>
              <option value="" disabled>Select a person</option>
              {users.map((person) => (
                <option key={person.id} value={person.id}>{person.loginId} ({person.role})</option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Planned Amount" required error={errors.plannedAmount}>
          <MoneyInput value={form.plannedAmount} onChange={(e) => setForm({ ...form, plannedAmount: e.target.value })} />
        </FormField>

        {submitError && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{submitError}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Budget'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
