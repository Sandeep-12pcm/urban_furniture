import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Target,
  Plus,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
  Building2,
  Wallet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
  PageHeader,
  LoadingSpinner,
  ErrorState,
} from '../components/ui';
import { formatCurrency, formatDate } from '../utils/currency';

export function roleHome(role) {
  return '/dashboard';
}

export function Dashboard({ user, navigate }) {
  const [metrics, setMetrics] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [data, invoicesList, billsList] = await Promise.all([
        api.reports.getDashboardMetrics(),
        api.invoices.list(),
        api.vendorBills.list(),
      ]);
      setMetrics(data);
      setRecentInvoices(invoicesList.slice(0, 5));
      setRecentBills(billsList.slice(0, 5));
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading financial dashboard..." />
      </div>
    );
  }

  if (error || !metrics) {
    return <ErrorState message={error || 'Failed to load dashboard.'} onRetry={loadDashboardData} />;
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Accounting Executive Dashboard"
        subtitle={`Welcome back, ${user?.loginId || 'User'}. Here is your commercial overview.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={ShoppingCart}
              onClick={() => navigate('/sales-orders/new')}
            >
              New Sales Order
            </Button>
            <Button
              variant="primary"
              icon={Truck}
              onClick={() => navigate('/purchase-orders/new')}
            >
              New Purchase Order
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sales"
          value={formatCurrency(metrics.totalSales)}
          subtitle="All confirmed & invoiced sales"
          icon={ShoppingCart}
          color="indigo"
          trend={14.2}
          trendLabel="vs last quarter"
          onClick={() => navigate('/sales-orders')}
        />

        <StatCard
          title="Total Purchases"
          value={formatCurrency(metrics.totalPurchases)}
          subtitle="Procurement & supply costs"
          icon={Truck}
          color="slate"
          trend={-3.8}
          trendLabel="vs last quarter"
          onClick={() => navigate('/purchase-orders')}
        />

        <StatCard
          title="Accounts Receivable"
          value={formatCurrency(metrics.receivables)}
          subtitle="Unpaid customer invoices"
          icon={ArrowDownLeft}
          color="emerald"
          onClick={() => navigate('/invoices')}
        />

        <StatCard
          title="Accounts Payable"
          value={formatCurrency(metrics.payables)}
          subtitle="Unpaid supplier bills"
          icon={ArrowUpRight}
          color="rose"
          onClick={() => navigate('/vendor-bills')}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Cash & Bank Balance"
          value={formatCurrency(metrics.cashBankBalance)}
          subtitle="Chase Checking & Cash Register"
          icon={Wallet}
          color="sky"
          onClick={() => navigate('/accounts')}
        />

        <StatCard
          title="Net Operating Profit"
          value={formatCurrency(metrics.netProfit)}
          subtitle="Gross Revenue less Direct Costs"
          icon={TrendingUp}
          color={metrics.netProfit >= 0 ? 'emerald' : 'rose'}
          onClick={() => navigate('/reports/profit-loss')}
        />

        <StatCard
          title="Budget Utilization"
          value={`${metrics.budgetUtilization}%`}
          subtitle={`${formatCurrency(metrics.totalPracticalBudget)} of ${formatCurrency(metrics.totalPlannedBudget)}`}
          icon={Target}
          color={metrics.budgetUtilization > 85 ? 'amber' : 'indigo'}
          onClick={() => navigate('/reports/budget')}
        />
      </div>

      {/* Revenue & Purchases Monthly Chart */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Revenue vs. Procurement Trend</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly comparison of sales revenues against purchasing expenditures (USD)
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/reports/profit-loss')}
          >
            Full P&L Report
          </Button>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.revenueMonthly}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip
                  formatter={(val) => formatCurrency(val)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                />
                <Legend />
                <Bar dataKey="sales" name="Sales Revenue" fill="#312e81" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases / Costs" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices & Bills Two-Column Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-700" />
              <CardTitle>Recent Customer Invoices</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              onClick={() => navigate('/invoices')}
            >
              All Invoices
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {inv.invoiceNumber}
                    </div>
                    <p className="text-xs text-slate-500">
                      {inv.customerName} • {formatDate(inv.invoiceDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(inv.total)}
                    </div>
                    <Badge status={inv.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Vendor Bills */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-slate-700" />
              <CardTitle>Recent Vendor Bills</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              onClick={() => navigate('/vendor-bills')}
            >
              All Bills
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentBills.map((bill) => (
                <div
                  key={bill.id}
                  onClick={() => navigate(`/vendor-bills/${bill.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {bill.billNumber}
                    </div>
                    <p className="text-xs text-slate-500">
                      {bill.vendorName} • {formatDate(bill.billDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(bill.total)}
                    </div>
                    <Badge status={bill.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
