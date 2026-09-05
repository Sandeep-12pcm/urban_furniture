import React, { useState, useEffect } from 'react';
import { PieChart, Plus, Search, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Input,
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
import { formatCurrency } from '../utils/currency';

export function AnalyticAccounts() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    partner: 'Internal',
    budget: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAnalyticAccounts();
  }, []);

  async function loadAnalyticAccounts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.analyticAccounts.list();
      setItems(data);
    } catch (err) {
      setError(err.message || 'Failed to load analytic accounts.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingItem(null);
    setFormData({
      name: '',
      code: '',
      partner: 'Internal',
      budget: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function handleOpenEdit(item) {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      code: item.code || '',
      partner: item.partner || 'Internal',
      budget: String(item.budget ?? ''),
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function validateForm() {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Analytic account name is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        budget: Number(formData.budget || 0),
      };

      if (editingItem) {
        const updated = await api.analyticAccounts.update(editingItem.id, payload);
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? updated : i))
        );
        success(`Analytic account "${updated.name}" updated.`);
      } else {
        const created = await api.analyticAccounts.create(payload);
        setItems((prev) => [...prev, created]);
        success(`Analytic account "${created.name}" created.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toastError(err.message || 'Failed to save analytic account.');
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = items.filter((item) => {
    return (
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.partner.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div>
      <PageHeader
        title="Analytic Accounts"
        subtitle="Track costs, project expenses, and revenues across cost centers."
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Analytic Accounts' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            New Cost Center
          </Button>
        }
      />

      <div className="mb-6 w-full sm:w-72">
        <Input
          placeholder="Search analytic accounts..."
          prefix={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading analytic accounts..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadAnalyticAccounts} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No analytic accounts found"
          description="Define cost centers to track project profitability."
          actionText="Add Cost Center"
          onAction={handleOpenCreate}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Cost Center / Project</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Partner / Client</TableHead>
              <TableHead align="right">Allocated Budget</TableHead>
              <TableHead align="right">Spent to Date</TableHead>
              <TableHead align="right">Utilization</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const util =
                item.budget > 0 ? Math.round((item.spent / item.budget) * 100) : 0;

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{item.name}</div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      {item.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-600">{item.partner}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(item.budget)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="text-slate-700">
                      {formatCurrency(item.spent)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            util > 90
                              ? 'bg-rose-500'
                              : util > 75
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(util, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {util}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit2}
                      onClick={() => handleOpenEdit(item)}
                      title="Edit"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingItem ? `Edit Cost Center: ${editingItem.name}` : 'New Cost Center'}
        description="Allocate project tracking budgets and client links."
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
              onClick={handleSave}
              loading={saving}
            >
              {editingItem ? 'Save Changes' : 'Create Cost Center'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Cost Center / Project Name"
            placeholder="e.g. Flagship Showroom Remodel"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Analytic Code"
              placeholder="e.g. AA-SHOWROOM"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
            <Input
              label="Partner / Client (optional)"
              placeholder="e.g. Horizon Tech"
              value={formData.partner}
              onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
            />
          </div>

          <Input
            label="Budget Limit ($)"
            type="number"
            step="0.01"
            placeholder="50000.00"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
