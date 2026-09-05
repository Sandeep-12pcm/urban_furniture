import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/Button.jsx';
import { apiRequest } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';

const sampleData = [
  { name: 'Sales', value: 78 },
  { name: 'Purchases', value: 52 },
  { name: 'Cash', value: 64 },
];

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

      <AccountDirectory currentUser={user} />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <div className="mb-4">
          <p className="text-sm font-semibold text-muted">Visualization Foundation</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Accounting KPI Placeholder</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sampleData}>
              <XAxis dataKey="name" stroke="#6b6f8d" />
              <YAxis stroke="#6b6f8d" />
              <Tooltip />
              <Bar dataKey="value" fill="#545b9a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
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
