import { Archive, ChevronDown, ChevronRight, LandmarkIcon, Loader2, Pencil, Plus, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { Modal } from '../../components/Modal.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { RowActionButton, RowActions } from '../../components/RowActions.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { Textarea } from '../../components/Textarea.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { useToast } from '../../components/Toast.jsx';
import { canArchiveMasterData, useAuth } from '../../lib/AuthContext.jsx';
import { accountsApi } from '../../lib/masterDataApi.js';
import { validateAccountForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'CAPITAL'];
const TYPE_LABELS = { ASSET: 'Assets', LIABILITY: 'Liabilities', INCOME: 'Income', EXPENSE: 'Expenses', CAPITAL: 'Capital' };

const TYPE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'ASSET', label: 'Assets' },
  { value: 'LIABILITY', label: 'Liabilities' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expenses' },
  { value: 'CAPITAL', label: 'Capital' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

function buildTree(accounts) {
  const byId = new Map(accounts.map((account) => [account.id, { ...account, children: [] }]));
  const roots = [];
  byId.forEach((node) => {
    if (node.parentAccountId && byId.has(node.parentAccountId)) {
      byId.get(node.parentAccountId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function AccountsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const [allAccounts, setAllAccounts] = useState([]);
  const loadAllAccounts = () => {
    accountsApi.list({ status: 'ACTIVE' }).then((data) => setAllAccounts(data.accounts || [])).catch(() => {});
  };
  useEffect(loadAllAccounts, []);

  const params = {
    search: debouncedSearch || undefined,
    status: statusFilter,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    page,
    limit: 25,
  };
  const { data: accounts, pagination, loading, error, reload } = useResourceList(accountsApi, params, 'accounts');

  const grouped = useMemo(() => {
    const byType = {};
    TYPE_ORDER.forEach((type) => {
      byType[type] = buildTree(accounts.filter((account) => account.type === type));
    });
    return byType;
  }, [accounts]);

  function toggle(id) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await accountsApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.accountName}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive account.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(account) {
    setRestoringId(account.id);
    try {
      await accountsApi.restore(account.id);
      notify(`"${account.accountName}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore account.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        subtitle="The master list of ledger accounts used to classify financial transactions"
        actions={
          <Button type="button" onClick={() => setFormState('create')}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(val) => { setSearch(val); setPage(1); }} placeholder="Search by code or name…" />
          <div className="flex gap-3">
            <FilterSelect label="Filter by type" value={typeFilter} onChange={(val) => { setTypeFilter(val); setPage(1); }} options={TYPE_FILTER_OPTIONS} />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(val) => { setStatusFilter(val); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={4} rows={7} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && accounts.length === 0 && (
          <EmptyState icon={LandmarkIcon} title="No accounts found." description="Add your first ledger account to build the Chart of Accounts." />
        )}

        {!loading && !error && accounts.length > 0 && (
          <div className="space-y-6">
            {TYPE_ORDER.filter((type) => grouped[type].length > 0).map((type) => (
              <div key={type}>
                <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.2em] text-muted">{TYPE_LABELS[type]}</p>
                <div className="space-y-1">
                  {grouped[type].map((node) => (
                    <AccountRow
                      key={node.id}
                      node={node}
                      depth={0}
                      collapsed={collapsed}
                      onToggle={toggle}
                      canArchive={canArchive}
                      restoringId={restoringId}
                      onEdit={setFormState}
                      onArchive={setArchiveTarget}
                      onRestore={handleRestore}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      <AccountFormModal
        open={Boolean(formState)}
        account={formState && formState !== 'create' ? formState : null}
        accounts={allAccounts.length ? allAccounts : accounts}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
          loadAllAccounts();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive account?"
        description={`"${archiveTarget?.accountName}" will be archived. It cannot be archived if it has active child accounts or is used as a journal's default account.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function AccountRow({ node, depth, collapsed, onToggle, canArchive, restoringId, onEdit, onArchive, onRestore }) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);

  return (
    <div>
      <div
        className="flex items-center justify-between gap-3 rounded-xl bg-page/70 px-3 py-2.5"
        style={{ marginLeft: `${depth * 1.5}rem` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button type="button" aria-label={isCollapsed ? 'Expand' : 'Collapse'} onClick={() => onToggle(node.id)} className="text-muted hover:text-ink">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-navy shadow-card">{node.accountCode}</span>
          <span className="truncate font-semibold text-ink">{node.accountName}</span>
          <StatusBadge status={node.status} />
        </div>
        <RowActions>
          <RowActionButton label="Edit account" icon={Pencil} onClick={() => onEdit(node)} />
          {node.status === 'ACTIVE' && canArchive && (
            <RowActionButton label="Archive account" icon={Archive} tone="danger" onClick={() => onArchive(node)} />
          )}
          {node.status === 'ARCHIVED' && canArchive && (
            <RowActionButton
              label="Restore account"
              icon={restoringId === node.id ? Loader2 : RotateCcw}
              onClick={() => onRestore(node)}
            />
          )}
        </RowActions>
      </div>
      {hasChildren && !isCollapsed && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <AccountRow
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              canArchive={canArchive}
              restoringId={restoringId}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountFormModal({ open, account, accounts, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(account);
  const [form, setForm] = useState({ accountCode: '', accountName: '', type: 'ASSET', description: '', parentAccountId: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        accountCode: account?.accountCode || '',
        accountName: account?.accountName || '',
        type: account?.type || 'ASSET',
        description: account?.description || '',
        parentAccountId: account?.parentAccountId || '',
      });
      setErrors({});
      setSubmitError('');
    }
  }, [open, account]);

  const parentOptions = accounts.filter(
    (candidate) => candidate.type === form.type && candidate.status === 'ACTIVE' && candidate.id !== account?.id,
  );

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateAccountForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        accountCode: form.accountCode.trim(),
        accountName: form.accountName.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        parentAccountId: form.parentAccountId || null,
      };
      if (isEdit) {
        await accountsApi.update(account.id, payload);
        notify('Account updated successfully.');
      } else {
        await accountsApi.create(payload);
        notify('Account created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit Account' : 'Add Account'} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Account Code" required error={errors.accountCode}>
            <Input value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} placeholder="e.g. 1001" />
          </FormField>
          <FormField label="Account Name" required error={errors.accountName}>
            <Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="e.g. Cash" />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Type" required error={errors.type}>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, parentAccountId: '' })}>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="CAPITAL">Capital</option>
            </Select>
          </FormField>
          <FormField label="Parent Account" hint="Optional — same type only.">
            <Select value={form.parentAccountId} onChange={(e) => setForm({ ...form, parentAccountId: e.target.value })}>
              <option value="">No parent (top level)</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.accountCode} · {option.accountName}</option>
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
            {isEdit ? 'Save Changes' : 'Create Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
