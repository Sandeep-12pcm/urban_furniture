import React, { useState, useEffect } from 'react';
import {
  Scale,
  Calendar,
  CheckCircle2,
  Printer,
  Download,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Select,
  Input,
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

export function BalanceSheet() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    loadBalanceSheet();
  }, [asOfDate]);

  async function loadBalanceSheet() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.getBalanceSheet(asOfDate);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load balance sheet.');
    } finally {
      setLoading(false);
    }
  }

  function handlePeriodShortcut(val) {
    const today = new Date();
    if (val === 'today') {
      setAsOfDate(today.toISOString().split('T')[0]);
    } else if (val === 'last_month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 0);
      setAsOfDate(d.toISOString().split('T')[0]);
    } else if (val === 'last_year') {
      setAsOfDate(`${today.getFullYear() - 1}-12-31`);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Balance Sheet"
        subtitle="Statement of Financial Position: Assets, Liabilities, and Equity."
        breadcrumbs={[{ label: 'Financial Reports' }, { label: 'Balance Sheet' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => window.print()}
            >
              Print Statement
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Statement As Of:
            </span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePeriodShortcut('today')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePeriodShortcut('last_month')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                End of Last Month
              </button>
              <button
                type="button"
                onClick={() => handlePeriodShortcut('last_year')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Prior Year End
              </button>
            </div>
          </div>

          {report && (
            <div className="flex items-center gap-2">
              {report.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Equation Balanced: Assets = Liabilities + Equity
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                  <AlertCircle className="h-4 w-4" />
                  Warning: Statement Out of Balance
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-24">
          <LoadingSpinner size="lg" message="Calculating balance sheet balances..." />
        </div>
      ) : error || !report ? (
        <ErrorState message={error || 'Failed to load report.'} onRetry={loadBalanceSheet} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ASSETS Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-indigo-950 font-bold">
                  Assets
                </CardTitle>
                <span className="text-xs font-bold font-mono text-indigo-950">
                  Total: {formatCurrency(report.totalAssets)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow hover={false}>
                      <TableHead>Account</TableHead>
                      <TableHead align="right">Balance (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.assets.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-slate-500">
                              {item.code}
                            </code>
                            <span className="font-semibold text-slate-800">
                              {item.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-mono font-medium text-slate-900">
                            {formatCurrency(item.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow hover={false} className="bg-slate-50/70 font-bold">
                      <TableCell>
                        <span className="text-slate-900 uppercase text-xs tracking-wider">
                          Total Assets
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-base text-indigo-950">
                          {formatCurrency(report.totalAssets)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* LIABILITIES & EQUITY Column */}
          <div className="space-y-6">
            {/* Liabilities */}
            <Card>
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-slate-900 font-bold">
                  Liabilities
                </CardTitle>
                <span className="text-xs font-bold font-mono text-slate-900">
                  Total: {formatCurrency(report.totalLiabilities)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow hover={false}>
                      <TableHead>Account</TableHead>
                      <TableHead align="right">Balance (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.liabilities.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-slate-500">
                              {item.code}
                            </code>
                            <span className="font-semibold text-slate-800">
                              {item.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-mono font-medium text-slate-900">
                            {formatCurrency(item.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow hover={false} className="bg-slate-50/70 font-bold">
                      <TableCell>
                        <span className="text-slate-900 uppercase text-xs tracking-wider">
                          Total Liabilities
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-base text-slate-900">
                          {formatCurrency(report.totalLiabilities)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Equity / Capital */}
            <Card>
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-slate-900 font-bold">
                  Capital & Equity
                </CardTitle>
                <span className="text-xs font-bold font-mono text-slate-900">
                  Total: {formatCurrency(report.totalEquity)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow hover={false}>
                      <TableHead>Account</TableHead>
                      <TableHead align="right">Balance (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.equity.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-slate-500">
                              {item.code}
                            </code>
                            <span className="font-semibold text-slate-800">
                              {item.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-mono font-medium text-slate-900">
                            {formatCurrency(item.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow hover={false} className="bg-slate-50/70 font-bold">
                      <TableCell>
                        <span className="text-slate-900 uppercase text-xs tracking-wider">
                          Total Equity
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-base text-slate-900">
                          {formatCurrency(report.totalEquity)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Total Liabilities + Equity Summary */}
            <div className="rounded-2xl border-2 border-indigo-900 bg-indigo-950 p-5 text-white flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs uppercase font-bold text-indigo-200 tracking-wider">
                  Total Liabilities & Equity
                </span>
                <p className="text-xs text-indigo-300">
                  Equals Total Assets in double-entry ledger
                </p>
              </div>
              <span className="text-2xl font-black font-mono">
                {formatCurrency(report.totalLiabilitiesAndEquity)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
