import React, { useState, useEffect } from 'react';
import { FolderGit2, Plus, Search, Edit2 } from 'lucide-react';
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
  useToast,
} from '../components/ui';

export function Journals() {
  const { success, error: toastError } = useToast();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'SALE',
    defaultAccount: '',
    shortCode: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadJournals();
  }, []);

  async function loadJournals() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.journals.list();
      setJournals(data);
    } catch (err) {
      setError(err.message || 'Failed to load journals.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingJournal(null);
    setFormData({
      name: '',
      code: '',
      type: 'SALE',
      defaultAccount: '',
      shortCode: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function handleOpenEdit(jnl) {
    setEditingJournal(jnl);
    setFormData({
      name: jnl.name || '',
      code: jnl.code || '',
      type: jnl.type || 'SALE',
      defaultAccount: jnl.defaultAccount || '',
      shortCode: jnl.shortCode || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function validateForm() {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Journal name is required.';
    if (!formData.code.trim()) errors.code = 'Journal code is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveJournal(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingJournal) {
        const updated = await api.journals.update(editingJournal.id, formData);
        setJournals((prev) =>
          prev.map((j) => (j.id === editingJournal.id ? updated : j))
        );
        success(`Journal "${updated.name}" updated.`);
      } else {
        const created = await api.journals.create(formData);
        setJournals((prev) => [...prev, created]);
        success(`Journal "${created.name}" created.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toastError(err.message || 'Failed to save journal.');
    } finally {
      setSaving(false);
    }
  }

  const filteredJournals = journals.filter((j) => {
    return (
      searchQuery === '' ||
      j.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const typeVariant = {
    SALE: 'primary',
    PURCHASE: 'warning',
    BANK: 'success',
    CASH: 'emerald',
    GENERAL: 'neutral',
  };

  return (
    <div>
      <PageHeader
        title="Journals"
        subtitle="Accounting books for recording sales, bills, bank statements, and cash registers."
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Journals' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            New Journal
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6 w-full sm:w-72">
        <Input
          placeholder="Search journals..."
          prefix={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading accounting journals..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadJournals} />
      ) : filteredJournals.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No journals found"
          description="Create your first accounting journal (e.g. Sales, Bank, Cash)."
          actionText="Add Journal"
          onAction={handleOpenCreate}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Journal Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Default Account</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJournals.map((jnl) => (
              <TableRow key={jnl.id}>
                <TableCell>
                  <div className="font-semibold text-slate-900">{jnl.name}</div>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                    {jnl.code}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant={typeVariant[jnl.type] || 'neutral'}>
                    {jnl.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-slate-600">
                    {jnl.defaultAccount || 'None specified'}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit2}
                    onClick={() => handleOpenEdit(jnl)}
                    title="Edit journal"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingJournal ? `Edit Journal: ${editingJournal.name}` : 'New Journal'}
        description="Configure journal details, account assignment, and short codes."
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
              onClick={handleSaveJournal}
              loading={saving}
            >
              {editingJournal ? 'Save Changes' : 'Create Journal'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveJournal} className="space-y-4">
          <Input
            label="Journal Name"
            placeholder="e.g. Customer Invoices"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Journal Code"
              placeholder="e.g. INV"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              error={formErrors.code}
            />
            <Select
              label="Journal Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'SALE', label: 'Sales (Customer Invoices)' },
                { value: 'PURCHASE', label: 'Purchase (Vendor Bills)' },
                { value: 'BANK', label: 'Bank Account' },
                { value: 'CASH', label: 'Cash Drawer' },
                { value: 'GENERAL', label: 'General / Miscellaneous' },
              ]}
            />
          </div>

          <Input
            label="Default GL Account Code"
            placeholder="e.g. 120000 or 102000"
            value={formData.defaultAccount}
            onChange={(e) =>
              setFormData({ ...formData, defaultAccount: e.target.value })
            }
          />
        </form>
      </Modal>
    </div>
  );
}
