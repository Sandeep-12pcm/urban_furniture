import React, { useState, useEffect } from 'react';
import {
  LineChart as LineChartIcon,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
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
import { formatCurrency } from '../utils/currency';

export function ProfitLoss() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('2026-YTD');

  useEffect(() => {
    loadProfitLoss();
  }, [period]);

  async function loadProfitLoss() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.getProfitLoss(period);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load Profit & Loss statement.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Profit & Loss Statement"
        subtitle="Income Statement: Operating Revenue, Cost of Goods Sold, Expenses, and Net Profit."
        breadcrumbs={[{ label: 'Financial Reports' }, { label: 'Profit & Loss' }]}
        actions={
          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print Statement
          </Button>
        }
      />

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reporting Period:
            </span>
            <div className="flex items-center gap-1.5">
              {[
                { id: '2026-THIS-MONTH', label: 'This Month' },
                { id: '2026-Q1', label: 'Q1 2026' },
                { id: '2026-YTD', label: 'Year to Date 2026' },
                { id: '2025-FULL', label: 'Full Year 2025' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    period === p.id
                      ? 'bg-indigo-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {report && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Net Profit Margin:</span>
              <span
                className={`font-mono text-sm font-bold ${
                  report.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {report.netProfitMargin}%
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-24">
          <LoadingSpinner size="lg" message="Compiling profit & loss figures..." />
        </div>
      ) : error || !report ? (
        <ErrorState message={error || 'Failed to load statement.'} onRetry={loadProfitLoss} />
      ) : (
        <div className="space-y-6">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Operating Income
              </span>
              <div className="mt-2 text-2xl font-black font-mono text-slate-900">
                {formatCurrency(report.totalIncome)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Cost of Goods Sold (COGS)
              </span>
              <div className="mt-2 text-2xl font-black font-mono text-slate-700">
                {formatCurrency(report.totalCogs)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Gross Profit
              </span>
              <div className="mt-2 text-2xl font-black font-mono text-indigo-950">
                {formatCurrency(report.grossProfit)}
              </div>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                report.netProfit >= 0
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                  : 'border-rose-200 bg-rose-50/40 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Net Profit / (Loss)
                </span>
                {report.netProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <div
                className={`mt-2 text-2xl font-black font-mono ${
                  report.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrency(report.netProfit)}
              </div>
            </div>
          </div>

          {/* Statement Grid */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow hover={false}>
                    <TableHead>Account Category / Description</TableHead>
                    <TableHead align="right">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 1. Operating Income */}
                  <TableRow hover={false} className="bg-slate-50/80">
                    <TableCell>
                      <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                        1. Operating Income (Sales)
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-bold font-mono text-slate-900">
                        {formatCurrency(report.totalIncome)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {report.income.map((item, idx) => (
                    <TableRow key={`inc-${idx}`}>
                      <TableCell className="pl-8">
                        <span className="text-slate-700">
                          {item.code} - {item.name}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-slate-700">
                          {formatCurrency(item.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* 2. Cost of Goods Sold */}
                  <TableRow hover={false} className="bg-slate-50/80">
                    <TableCell>
                      <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                        2. Cost of Goods Sold & Direct Material
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-bold font-mono text-slate-900">
                        -{formatCurrency(report.totalCogs)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {report.cogs.map((item, idx) => (
                    <TableRow key={`cogs-${idx}`}>
                      <TableCell className="pl-8">
                        <span className="text-slate-700">
                          {item.code} - {item.name}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-slate-700">
                          {formatCurrency(item.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Gross Profit Subtotal */}
                  <TableRow hover={false} className="bg-indigo-50/40 border-y-2 border-indigo-200">
                    <TableCell>
                      <span className="font-bold text-indigo-950 uppercase text-xs tracking-wider">
                        Gross Profit
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-bold font-mono text-base text-indigo-950">
                        {formatCurrency(report.grossProfit)}
                      </span>
                    </TableCell>
                  </TableRow>

                  {/* 3. Operating Expenses */}
                  <TableRow hover={false} className="bg-slate-50/80">
                    <TableCell>
                      <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                        3. Operating & Administrative Expenses
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-bold font-mono text-slate-900">
                        -{formatCurrency(report.totalExpenses)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {report.expenses.map((item, idx) => (
                    <TableRow key={`exp-${idx}`}>
                      <TableCell className="pl-8">
                        <span className="text-slate-700">
                          {item.code} - {item.name}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-slate-700">
                          {formatCurrency(item.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Final Net Profit Row */}
                  <TableRow
                    hover={false}
                    className="bg-indigo-950 text-white font-black text-base border-t-2 border-indigo-900"
                  >
                    <TableCell className="text-white py-4">
                      <span className="uppercase tracking-wider">
                        Net Profit / (Net Loss)
                      </span>
                    </TableCell>
                    <TableCell align="right" className="py-4">
                      <span
                        className={`font-mono text-xl ${
                          report.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(report.netProfit)}
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
