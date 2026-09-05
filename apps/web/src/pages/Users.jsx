import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
  Plus,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
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

export function Users() {
  const { success, error: toastError } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approvingId, setApprovingId] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.users.list();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId) {
    setApprovingId(userId);
    try {
      await api.users.approveAccountant(userId);
      success('Accountant account approved successfully.');
      await loadUsers();
    } catch (err) {
      toastError(err.message || 'Failed to approve accountant.');
    } finally {
      setApprovingId('');
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="User & Access Management"
        subtitle="Manage user permissions, review pending accountant registrations, and audit logins."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
        actions={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={loadUsers}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="py-24">
          <LoadingSpinner size="lg" message="Loading users directory..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadUsers} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No accounts found"
          description="Registered users and accountants will appear here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>User / Login ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Approval Status</TableHead>
              <TableHead>Active Status</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 font-bold text-xs text-slate-700">
                      {(acc.loginId || 'U')[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-900">{acc.loginId}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">{acc.email}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      acc.role === 'ADMIN'
                        ? 'danger'
                        : acc.role === 'ACCOUNTANT'
                        ? 'primary'
                        : 'neutral'
                    }
                  >
                    {acc.accountType || acc.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge status={acc.approvalStatus || 'APPROVED'} />
                </TableCell>
                <TableCell>
                  {acc.isActive ? (
                    <span className="text-xs font-semibold text-emerald-600">Active</span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-600">Inactive</span>
                  )}
                </TableCell>
                <TableCell align="right">
                  {acc.role === 'ACCOUNTANT' && acc.approvalStatus === 'PENDING' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={CheckCircle2}
                      onClick={() => handleApprove(acc.id)}
                      loading={approvingId === acc.id}
                    >
                      Approve
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">No action</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
