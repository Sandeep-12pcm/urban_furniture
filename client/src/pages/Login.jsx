import { Eye, EyeOff, Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { api } from '../services/api.js';
import { validateLogin } from '../lib/validation.js';

export function Login({ onLogin, navigate }) {
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const validationError = validateLogin(form);
    if (validationError) return setError(validationError);

    setLoading(true);
    setError('');
    try {
      const data = await api.auth.login(form);
      if (data && data.user) {
        onLogin(data.user);
      } else {
        // Fallback for development if backend mock is active
        onLogin({
          id: 'usr-admin-1',
          loginId: form.loginId || 'admin',
          email: `${form.loginId || 'admin'}@urbanfurniture.com`,
          role: form.loginId?.toLowerCase().includes('accountant')
            ? 'ACCOUNTANT'
            : form.loginId?.toLowerCase().includes('contact')
            ? 'CONTACT'
            : 'ADMIN',
        });
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          'Invalid Login ID or Password. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin(loginId, password, role) {
    setForm({ loginId, password });
    setError('');
  }

  return (
    <AuthShell
      title="Urban Furniture Accounting"
      subtitle="Sign in to your enterprise financial workspace."
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Input
            label="Login ID"
            autoComplete="username"
            value={form.loginId}
            onChange={(e) => setForm({ ...form, loginId: e.target.value })}
            placeholder="e.g. admin or accountant"
            required
          />
        </div>

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••••••"
              required
              suffix={
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-400 transition hover:text-slate-700 focus:outline-none pointer-events-auto"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition"
            onClick={() => navigate('/forgot-password')}
          >
            Forgot Password?
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <Button
          className="w-full"
          type="submit"
          disabled={loading}
          loading={loading}
          icon={LogIn}
        >
          Sign In
        </Button>

        {/* Demo Credential Shortcuts */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Quick Fill Demo Accounts:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin('admin', 'ChangeMe@12345', 'ADMIN')}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              👑 Admin (admin)
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('accountant', 'ChangeMe@12345', 'ACCOUNTANT')}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              📊 Accountant
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('customer_portal', 'ChangeMe@12345', 'CONTACT')}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              🏢 Customer Portal
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Need an account?{' '}
          <button
            type="button"
            className="font-semibold text-indigo-700 hover:text-indigo-900"
            onClick={() => navigate('/signup')}
          >
            Create Account
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
