import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { apiRequest } from '../lib/api.js';
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
      const data = await apiRequest('/auth/login', { method: 'POST', body: form });
      onLogin(data.user);
    } catch (requestError) {
      setError(requestError.message || 'Invalid Login ID or Password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to continue to your accounting workspace.">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink">
          Login ID
          <div className="mt-2">
            <Input autoComplete="username" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} />
          </div>
        </label>

        <label className="block text-sm font-semibold text-ink">
          Password
          <span className="relative mt-2 block">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 rounded-md p-1 text-muted transition hover:text-navy"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
        </label>

        <div className="flex justify-end">
          <button type="button" className="text-sm font-semibold text-navy hover:text-indigo" onClick={() => navigate('/forgot-password')}>
            Forgot Password?
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          SIGN IN
        </Button>

        <p className="text-center text-sm text-muted">
          Need an account?{' '}
          <button type="button" className="font-semibold text-navy hover:text-indigo" onClick={() => navigate('/signup')}>
            Sign Up
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
