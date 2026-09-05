import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  DollarSign,
  Edit2,
  Trash2,
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
  Tabs,
} from '../components/ui';
import { formatCurrency } from '../utils/currency';

export function Accounts() {
  const { success, error: toastError } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'ASSET',
    currency: 'USD',
    balance: '0',
    reconcilable: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.accounts.list();
      setAccounts(data);
    } catch (err) {
      setError(err.message || 'Failed to load chart of accounts.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingAccount(null);
    setFormData({
      code: '',
      name: '',
      type: activeTab !== 'ALL' ? activeTab : 'ASSET',
      currency: 'USD',
      balance: '0',
      reconcilable: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function handleOpenEdit(acc) {
    setEditingAccount(acc);
    setFormData({
      code: acc.code || '',
      name: acc.name || '',
      type: acc.type || 'ASSET',
      currency: acc.currency || 'USD',
      balance: String(acc.balance ?? '0'),
      reconcilable: Boolean(acc.reconcilable ?? true),
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function validateForm() {
    const errors = {};
    if (!formData.code.trim()) errors.code = 'Account code is required.';
    if (!formData.name.trim()) errors.name = 'Account name is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        balance: Number(formData.balance || 0),
      };

      if (editingAccount) {
        const updated = await api.accounts.update(editingAccount.id, payload);
        setAccounts((prev) =>
          prev.map((a) => (a.id === editingAccount.id ? updated : a))
        );
        success(`Account "${updated.code} - ${updated.name}" updated.`);
      } else {
        const created = await api.accounts.create(payload);
        setAccounts((prev) => [...prev, created]);
        success(`Account "${created.code} - ${created.name}" created.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toastError(err.message || 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.accounts.delete(deleteTarget.id);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      success(`Account "${deleteTarget.code}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toastError(err.message || 'Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchesTab = activeTab === 'ALL' || a.type === activeTab;
      const matchesSearch =
        searchQuery === '' ||
        a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [accounts, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Accounts', count: accounts.length },
    { id: 'ASSET', label: 'Assets', count: accounts.filter((a) => a.type === 'ASSET').length },
    { id: 'LIABILITY', label: 'Liabilities', count: accounts.filter((a) => a.type === 'LIABILITY').length },
    { id: 'EQUITY', label: 'Equity', count: accounts.filter((a) => a.type === 'EQUITY').length },
    { id: 'INCOME', label: 'Income', count: accounts.filter((a) => a.type === 'INCOME').length },
    { id: 'EXPENSE', label: 'Expense', count: accounts.filter((a) => a.type === 'EXPENSE').length },
  ];

  const typeColorMap = {
    ASSET: 'primary',
    LIABILITY: 'warning',
    EQUITY: 'neutral',
    INCOME: 'success',
    EXPENSE: 'danger',
  };

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Standard general ledger accounts, classifications, and current balances."
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Accounts' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            New Account
          </Button>
        }
      />

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by code or account name..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading chart of accounts..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadAccounts} />
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No accounts found"
          description={
            searchQuery
              ? `No accounts matched "${searchQuery}".`
              : 'Add GL accounts to set up your balance sheet and profit & loss.'
          }
          actionText={searchQuery ? 'Clear Search' : 'Add Account'}
          onAction={searchQuery ? () => setSearchQuery('') : handleOpenCreate}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Reconcilable</TableHead>
              <TableHead align="right">Current Balance</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell>
                  <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                    {acc.code}
                  </code>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">{acc.name}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={typeColorMap[acc.type] || 'neutral'}>
                    {acc.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">{acc.currency}</span>
                </TableCell>
                <TableCell>
                  {acc.reconcilable ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">No</span>
                  )}
                </TableCell>
                <TableCell align="right">
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(acc.balance, acc.currency)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit2}
                      onClick={() => handleOpenEdit(acc)}
                      title="Edit account"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => setDeleteTarget(acc)}
                      title="Delete account"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingAccount ? `Edit Account: ${editingAccount.code}` : 'New GL Account'}
        description="Configure chart of accounts entity classification and code."
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
              onClick={handleSaveAccount}
              loading={saving}
            >
              {editingAccount ? 'Save Changes' : 'Create Account'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Account Code"
              placeholder="e.g. 101000"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              error={formErrors.code}
            />
            <Select
              label="Account Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'ASSET', label: 'Asset (Current & Fixed)' },
                { value: 'LIABILITY', label: 'Liability' },
                { value: 'EQUITY', label: 'Equity / Capital' },
                { value: 'INCOME', label: 'Income / Revenue' },
                { value: 'EXPENSE', label: 'Expense / COGS' },
              ]}
            />
          </div>

          <Input
            label="Account Name"
            placeholder="e.g. Operating Checking Account"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Initial / Current Balance ($)"
              type="number"
              step="0.01"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
            />
            <Select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              options={['USD', 'EUR', 'GBP', 'CAD']}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="reconcilable"
              checked={formData.reconcilable}
              onChange={(e) =>
                setFormData({ ...formData, reconcilable: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="reconcilable" className="text-sm text-slate-700 select-none">
              Allow matching & bank reconciliation for this account
            </label>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteAccount}
        loading={deleting}
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteTarget?.code} - ${deleteTarget?.name}"?`}
        confirmText="Delete Account"
        variant="danger"
      />
    </div>
  );
}
