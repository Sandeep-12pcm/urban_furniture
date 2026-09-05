import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { apiRequest } from '../lib/api.js';
import { validateSignup } from '../lib/validation.js';

const signupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === 'true';

export function Signup({ onLogin, navigate }) {
  const [form, setForm] = useState({
    loginId: '',
    email: '',
    accountType: 'CUSTOMER',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    alert('Signup is disabled in this demo. Please contact the administrator to enable it.');
    if (!signupEnabled) return setError('Public signup is disabled. Please contact the administrator.');

    const validationError = validateSignup(form);
    if (validationError) return setError(validationError);

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest('/auth/signup', { method: 'POST', body: form });
      if (data.pendingApproval) {
        setSuccess(data.message);
        setForm({ loginId: '', email: '', accountType: 'CUSTOMER', password: '', confirmPassword: '' });
        return;
      }
      onLogin(data.user);
    } catch (requestError) {
      setError(requestError.message || 'Account creation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create Account" subtitle="Accountant access needs approval. Customer and Vendor accounts are active immediately.">
      <form className="space-y-5" onSubmit={submit}>
        {!signupEnabled && (
          <div className="rounded-xl border border-lavender bg-lavender/35 px-4 py-3 text-sm text-navy">
            Public signup is disabled by configuration.
          </div>
        )}
        <label className="block text-sm font-semibold text-ink">
          Login ID
          <div className="mt-2">
            <Input disabled={!signupEnabled} value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} />
          </div>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email
          <div className="mt-2">
            <Input type="email" disabled={!signupEnabled} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Account Type
          <select
            className="mt-2 h-11 w-full rounded-xl border border-borderSoft bg-white px-4 text-sm text-ink outline-none transition focus:border-indigo focus:ring-4 focus:ring-lavender/60 disabled:bg-page disabled:text-muted"
            disabled={!signupEnabled}
            value={form.accountType}
            onChange={(e) => setForm({ ...form, accountType: e.target.value })}
          >
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
            <option value="ACCOUNTANT">Accountant</option>
          </select>
        </label>
        <PasswordField label="Password" show={showPassword} setShow={setShowPassword} disabled={!signupEnabled} value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        <PasswordField label="Re-enter Password" show={showConfirm} setShow={setShowConfirm} disabled={!signupEnabled} value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />

        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
        {success && <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{success}</div>}

        <div className="grid grid-cols-2 gap-3">
          <Button type="submit" disabled={loading || !signupEnabled}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/login')}>
            Cancel
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

function PasswordField({ label, show, setShow, disabled, value, onChange }) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <span className="relative mt-2 block">
        <Input type={show ? 'text' : 'password'} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          disabled={disabled}
          className="absolute right-3 top-1/2 rounded-md p-1 text-muted transition hover:text-navy disabled:opacity-40"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
    </label>
  );
}
