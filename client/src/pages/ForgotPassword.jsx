import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { apiRequest } from '../lib/api.js';

export function ForgotPassword({ navigate }) {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!identifier.trim()) return setError('Login ID or email is required.');

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await apiRequest('/auth/forgot-password', { method: 'POST', body: { identifier } });
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message || 'Could not request password reset.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot Password" subtitle="Enter your Login ID or email to begin reset.">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink">
          Login ID or Email
          <div className="mt-2">
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </div>
        </label>
        {message && <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{message}</div>}
        {error && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send Reset Instructions
        </Button>
        <button type="button" className="mx-auto flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo" onClick={() => navigate('/login')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </button>
      </form>
    </AuthShell>
  );
}
