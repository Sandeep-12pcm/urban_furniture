import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/Button.jsx';
import { apiRequest } from '../lib/api.js';
import { analyticsApi } from '../lib/masterDataApi.js';
import { formatMoney } from '../lib/format.js';
import { useAuth } from '../lib/AuthContext.jsx';

const dashboardMeta = {
  ADMIN: {
    title: 'Admin Dashboard',
    subtitle: 'Owner access for user management, reports, and future accounting modules.',
    path: '/admin/dashboard',
  },
  ACCOUNTANT: {
    title: 'Accountant Dashboard',
    subtitle: 'Invoicing user access for master data, transactions, and reports.',
    path: '/accountant/dashboard',
  },
  CONTACT: {
    title: 'Contact Portal',
    subtitle: 'Contact access for future invoice, bill, and payment status views.',
    path: '/contact/dashboard',
  },
};

export function roleHome(role) {
  return dashboardMeta[role]?.path || '/login';
}

export function Dashboard() {
  const { user } = useAuth();
  const meta = dashboardMeta[user.role];

  if (user.role === 'CONTACT') return (
    <div className="space-y-6"><div className="rounded-2xl bg-navy px-6 py-8 text-white shadow-card"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Urban Furniture</p><h1 className="mt-2 text-3xl font-bold">{meta.title}</h1><p className="mt-1 text-sm text-white/72">Your portal does not expose internal company analytics.</p></div><AccountDirectory currentUser={user}/></div>
  );
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-navy px-6 py-8 text-white shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Urban Furniture</p>
        <h1 className="mt-2 text-3xl font-bold">{meta.title}</h1>
        <p className="mt-1 text-sm text-white/72">{meta.subtitle}</p>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        <InfoCard label="Signed in as" value={user.loginId} />
        <InfoCard label="Role" value={user.accountType || user.role} />
        <InfoCard label="Status" value="Protected" success />
      </section>

      <ExecutiveAnalytics />

      <AccountDirectory currentUser={user} />

    </div>
  );
}

function ExecutiveAnalytics() {
  const [data,setData]=useState(null); const [error,setError]=useState(''); const [range,setRange]=useState('');
  const load=async()=>{setError('');try{const now=new Date();const params=range==='MONTH'?{startDate:new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),endDate:now.toISOString().slice(0,10)}:{};setData(await analyticsApi.dashboard(params));}catch(e){setError(e.message||'Unable to load analytics.');}};
  useEffect(()=>{load();},[range]);
  if(error)return <div className="rounded-2xl bg-danger/10 p-5 text-danger">Unable to load business analytics. <button className="font-bold underline" onClick={load}>Retry</button></div>;
  if(!data)return <div className="rounded-2xl bg-white p-6 text-muted shadow-card">Loading live business analytics…</div>;
  const cards=[['Revenue',data.kpis.totalRevenue],['Expenses',data.kpis.totalExpenses],['Net Profit',data.kpis.netProfit],['Cash',data.kpis.cashBalance],['Bank',data.kpis.bankBalance],['Receivables',data.kpis.receivables],['Payables',data.kpis.payables],['Inventory Value',data.kpis.inventoryValue]];
  const chart=[{name:'Revenue',value:Number(data.kpis.totalRevenue)},{name:'Expenses',value:Number(data.kpis.totalExpenses)},{name:'Profit',value:Number(data.kpis.netProfit)}];
  return <section className="space-y-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-muted">Live business intelligence</p><h2 className="text-xl font-bold text-ink">Executive overview</h2></div><select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={range} onChange={e=>setRange(e.target.value)}><option value="">All posted history</option><option value="MONTH">This month</option></select></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><InfoCard key={label} label={label} value={formatMoney(value)}/>)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-card"><h3 className="font-bold text-ink">Revenue, expense & profit</h3><div className="h-60"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="name"/><YAxis/><Tooltip formatter={v=>formatMoney(v)}/><Bar dataKey="value" fill="#545b9a" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div></div><div className="rounded-2xl bg-white p-5 shadow-card"><h3 className="font-bold text-ink">Top selling products</h3>{data.sales.topProducts.length?<div className="mt-3 space-y-3">{data.sales.topProducts.map(x=><div key={x.id} className="flex justify-between border-b border-slate-100 pb-2 text-sm"><span>{x.name} · {x.quantity} units</span><b>{formatMoney(x.revenue)}</b></div>)}</div>:<p className="mt-4 text-sm text-muted">No sales recorded for this period.</p>}<h3 className="mt-5 font-bold text-ink">Stock alerts</h3>{data.inventory.alerts.length?<div className="mt-2 space-y-2 text-sm">{data.inventory.alerts.map(x=><div key={x.id} className="flex justify-between"><span>{x.name}</span><b className="text-danger">{x.quantity} remaining</b></div>)}</div>:<p className="mt-2 text-sm text-success">All products are adequately stocked.</p>}</div></div></section>;
}

function AccountDirectory({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState('');
  const [error, setError] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/users');
      setUsers(data.users || []);
    } catch (requestError) {
      setError(requestError.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }

  async function approveAccountant(userId) {
    setApprovingId(userId);
    setError('');
    try {
      await apiRequest(`/users/${userId}/approve-accountant`, { method: 'POST' });
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message || 'Could not approve accountant.');
    } finally {
      setApprovingId('');
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const title = currentUser.role === 'ADMIN'
    ? 'All User and Accountant Accounts'
    : currentUser.role === 'ACCOUNTANT'
      ? 'Your Account and User Accounts'
      : 'Your Account';

  return (
    <div className="mb-5 rounded-2xl border border-white/80 bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Account Access</p>
          <h2 className="text-xl font-bold text-ink">{title}</h2>
        </div>
        <Button type="button" variant="secondary" onClick={loadUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="px-3 py-2 font-semibold">Login ID</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">Account</th>
              <th className="px-3 py-2 font-semibold">Approval</th>
              <th className="px-3 py-2 font-semibold">Active</th>
              {currentUser.role === 'ADMIN' && <th className="px-3 py-2 font-semibold">Action</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((account) => (
              <tr key={account.id} className="rounded-xl bg-page/70">
                <td className="rounded-l-xl px-3 py-3 font-semibold text-ink">{account.loginId}</td>
                <td className="px-3 py-3 text-muted">{account.email}</td>
                <td className="px-3 py-3 text-ink">{account.accountType || account.role}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={account.approvalStatus || 'APPROVED'} />
                </td>
                <td className="px-3 py-3 text-ink">{account.isActive ? 'Yes' : 'No'}</td>
                {currentUser.role === 'ADMIN' && (
                  <td className="rounded-r-xl px-3 py-3">
                    {account.role === 'ACCOUNTANT' && account.approvalStatus === 'PENDING' ? (
                      <Button type="button" onClick={() => approveAccountant(account.id)} disabled={approvingId === account.id}>
                        {approvingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </Button>
                    ) : (
                      <span className="text-muted">No action</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && !loading && (
          <div className="rounded-xl bg-page px-4 py-6 text-center text-sm text-muted">
            No accounts found.
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = status === 'PENDING'
    ? 'bg-amber-100 text-amber-700'
    : status === 'REJECTED'
      ? 'bg-danger/10 text-danger'
      : 'bg-success/10 text-success';

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles}`}>{status}</span>;
}

function InfoCard({ label, value, success = false }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-2 text-xl font-bold ${success ? 'text-success' : 'text-ink'}`}>{value}</p>
    </div>
  );
}
