import React, { useState, useEffect } from 'react';
import { Target, Plus, Search, Calendar, ChevronRight, BarChart3 } from 'lucide-react';
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
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  useToast,
} from '../components/ui';
import { formatCurrency, formatDate } from '../utils/currency';

export function Budgets() {
  const { success, error: toastError } = useToast();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedBudget, setSelectedBudget] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    lines: [
      { name: 'Office Rent & Facilities', account: '600000', plannedAmount: 36000, practicalAmount: 18000 },
      { name: 'Direct Material Purchases', account: '500000', plannedAmount: 85000, practicalAmount: 61200 },
    ],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBudgets();
  }, []);

  async function loadBudgets() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.budgets.list();
      setBudgets(data);
      if (data.length > 0 && !selectedBudget) {
        setSelectedBudget(data[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load budgets.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setFormData({
      name: '',
      dateFrom: new Date().getFullYear() + '-01-01',
      dateTo: new Date().getFullYear() + '-12-31',
      lines: [
        { name: 'Operating Expenses', account: '600000', plannedAmount: 50000, practicalAmount: 0 },
      ],
    });
    setIsModalOpen(true);
  }

  function addLine() {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { name: '', account: '', plannedAmount: 0, practicalAmount: 0 },
      ],
    }));
  }

  function updateLine(index, field, val) {
    setFormData((prev) => {
      const copy = [...prev.lines];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, lines: copy };
    });
  }

  function removeLine(index) {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const created = await api.budgets.create(formData);
      setBudgets((prev) => [created, ...prev]);
      setSelectedBudget(created);
      success(`Budget "${created.name}" created.`);
      setIsModalOpen(false);
    } catch (err) {
      toastError(err.message || 'Failed to create budget.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Define fiscal expense targets and track real-time variance and utilization."
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Budgets' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            New Budget
          </Button>
        }
      />

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading budgets..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadBudgets} />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No budgets configured"
          description="Create your first budget to monitor corporate expenditure."
          actionText="Create Budget"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Budget List Selector */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Budget Plans ({budgets.length})
            </h3>
            {budgets.map((b) => {
              const isSelected = selectedBudget?.id === b.id;
              const util =
                b.totalPlanned > 0
                  ? Math.round((b.totalPractical / b.totalPlanned) * 100)
                  : 0;

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBudget(b)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-indigo-600 bg-white shadow-md ring-2 ring-indigo-600/10'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{b.name}</h4>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(b.dateFrom)} - {formatDate(b.dateTo)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        util > 100
                          ? 'bg-rose-100 text-rose-700'
                          : util > 80
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {util}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                    <span>Planned: <b>{formatCurrency(b.totalPlanned)}</b></span>
                    <span>Actual: <b>{formatCurrency(b.totalPractical)}</b></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Budget Lines Detail */}
          <div className="lg:col-span-2">
            {selectedBudget ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{selectedBudget.name}</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Period: {formatDate(selectedBudget.dateFrom)} to{' '}
                      {formatDate(selectedBudget.dateTo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Utilization</span>
                    <span className="text-lg font-bold text-slate-900">
                      {selectedBudget.totalPlanned > 0
                        ? Math.round(
                            (selectedBudget.totalPractical /
                              selectedBudget.totalPlanned) *
                              100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow hover={false}>
                        <TableHead>Budget Item / Category</TableHead>
                        <TableHead>GL Account</TableHead>
                        <TableHead align="right">Planned ($)</TableHead>
                        <TableHead align="right">Actual Used ($)</TableHead>
                        <TableHead align="right">Remaining ($)</TableHead>
                        <TableHead align="right">Utilization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedBudget.lines || []).map((line, idx) => {
                        const remaining = line.plannedAmount - line.practicalAmount;
                        const util =
                          line.plannedAmount > 0
                            ? Math.round(
                                (line.practicalAmount / line.plannedAmount) * 100
                              )
                            : 0;

                        return (
                          <TableRow key={line.id || idx}>
                            <TableCell>
                              <span className="font-semibold text-slate-900">
                                {line.name}
                              </span>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs text-slate-600 font-mono">
                                {line.account || '-'}
                              </code>
                            </TableCell>
                            <TableCell align="right">
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(line.plannedAmount)}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <span className="text-slate-700">
                                {formatCurrency(line.practicalAmount)}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <span
                                className={`font-semibold ${
                                  remaining < 0
                                    ? 'text-rose-600'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {formatCurrency(remaining)}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      util > 100
                                        ? 'bg-rose-500'
                                        : util > 80
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(util, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-700">
                                  {util}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title="Create New Fiscal Budget"
        description="Set expenditure targets for departments and general ledger accounts."
        size="lg"
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
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              Save Budget
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Budget Name"
            placeholder="e.g. FY2026 Commercial Marketing Budget"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Start Date"
              type="date"
              value={formData.dateFrom}
              onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.dateTo}
              onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Budget Allocation Lines
              </h4>
              <Button variant="secondary" size="sm" onClick={addLine} icon={Plus}>
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {formData.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex-1">
                    <Input
                      placeholder="Line Description"
                      value={line.name}
                      onChange={(e) => updateLine(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      placeholder="GL Code"
                      value={line.account}
                      onChange={(e) => updateLine(idx, 'account', e.target.value)}
                    />
                  </div>
                  <div className="w-36">
                    <Input
                      type="number"
                      placeholder="Planned $"
                      value={line.plannedAmount}
                      onChange={(e) =>
                        updateLine(idx, 'plannedAmount', Number(e.target.value))
                      }
                    />
                  </div>
                  {formData.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
