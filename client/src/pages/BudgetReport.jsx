import React, { useState, useEffect } from 'react';
import { Target, Printer, Calendar, BarChart3, TrendingUp } from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  PageHeader,
  LoadingSpinner,
  ErrorState,
} from '../components/ui';
import { formatCurrency, formatDate } from '../utils/currency';

export function BudgetReport() {
  const [budgets, setBudgets] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const list = await api.budgets.list();
        setBudgets(list);
        if (list.length > 0) {
          const firstId = list[0].id;
          setSelectedBudgetId(firstId);
          const reportData = await api.reports.getBudgetReport(firstId);
          setReport(reportData);
        }
      } catch (err) {
        setError(err.message || 'Failed to load budget report.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleBudgetChange(id) {
    setSelectedBudgetId(id);
    setLoading(true);
    try {
      const reportData = await api.reports.getBudgetReport(id);
      setReport(reportData);
    } catch (err) {
      setError(err.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Budget Utilization Report"
        subtitle="Track planned fiscal limits against actual general ledger expenditures."
        breadcrumbs={[{ label: 'Financial Reports' }, { label: 'Budget Report' }]}
        actions={
          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print Report
          </Button>
        }
      />

      {/* Budget Selector */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Select Budget:
            </span>
            <select
              value={selectedBudgetId}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({formatDate(b.dateFrom)} - {formatDate(b.dateTo)})
                </option>
              ))}
            </select>
          </div>

          {report && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                Period: <b>{formatDate(report.dateFrom)}</b> to <b>{formatDate(report.dateTo)}</b>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-24">
          <LoadingSpinner size="lg" message="Compiling budget utilization..." />
        </div>
      ) : error || !report ? (
        <ErrorState message={error || 'Failed to load report.'} onRetry={() => handleBudgetChange(selectedBudgetId)} />
      ) : (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Total Planned Budget
              </span>
              <div className="mt-2 text-2xl font-black font-mono text-slate-900">
                {formatCurrency(report.totalPlanned)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Actual Utilized
              </span>
              <div className="mt-2 text-2xl font-black font-mono text-indigo-900">
                {formatCurrency(report.totalPractical)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Remaining Funds
              </span>
              <div
                className={`mt-2 text-2xl font-black font-mono ${
                  report.totalRemaining >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {formatCurrency(report.totalRemaining)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Overall Utilization
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {report.overallUtilization}%
                </span>
                <span
                  className={`text-xs font-bold ${
                    report.overallUtilization > 90
                      ? 'text-rose-600'
                      : report.overallUtilization > 75
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {report.overallUtilization > 100
                    ? 'Exceeded'
                    : report.overallUtilization > 75
                    ? 'Near Limit'
                    : 'On Track'}
                </span>
              </div>
            </div>
          </div>

          {/* Utilization Lines Table */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Lines & Department Utilization</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow hover={false}>
                    <TableHead>Budget Item</TableHead>
                    <TableHead>GL Account</TableHead>
                    <TableHead align="right">Planned Limit</TableHead>
                    <TableHead align="right">Practical Used</TableHead>
                    <TableHead align="right">Remaining</TableHead>
                    <TableHead align="right" className="w-56">Utilization Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <span className="font-semibold text-slate-900">
                          {line.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-slate-600 font-mono">
                          {line.account}
                        </code>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-slate-900 font-medium">
                          {formatCurrency(line.plannedAmount)}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-slate-700">
                          {formatCurrency(line.practicalAmount)}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span
                          className={`font-mono font-bold ${
                            line.remaining < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrency(line.remaining)}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                line.utilization > 100
                                  ? 'bg-rose-600'
                                  : line.utilization > 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(line.utilization, 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-mono font-bold text-slate-800">
                            {line.utilization}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
