import { Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { apiRequest } from '../lib/api.js';
import { validateReset } from '../lib/validation.js';

export function ResetPassword({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const [form, setForm] = useState({ token: params.get('token') || '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const validationError = validateReset(form);
    if (validationError) return setError(validationError);

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await apiRequest('/auth/reset-password', { method: 'POST', body: form });
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset Password" subtitle="Use your secure reset token before it expires.">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink">
          Reset Token
          <div className="mt-2">
            <Input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
          </div>
        </label>
        <PasswordField label="Password" show={showPassword} setShow={setShowPassword} value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        <PasswordField label="Re-enter Password" show={showConfirm} setShow={setShowConfirm} value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
        {message && <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{message}</div>}
        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset Password
        </Button>
        <p className="text-center text-sm">
          <button type="button" className="font-semibold text-navy hover:text-indigo" onClick={() => navigate('/login')}>
            Return to Login
          </button>
        </p>
      </form>
    </AuthShell>
  );
}

function PasswordField({ label, show, setShow, value, onChange }) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <span className="relative mt-2 block">
        <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="absolute right-3 top-1/2 rounded-md p-1 text-muted transition hover:text-navy" onClick={() => setShow((current) => !current)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
    </label>
  );
}
