import { ShieldAlert } from 'lucide-react';

export function Unauthorized({ navigate }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-white/80 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-navy">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-ink">Unauthorized</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your account does not have permission to open this area.
        </p>
        <button className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-white shadow-card hover:bg-indigo" onClick={() => navigate('/login')}>
          Back to Login
        </button>
      </div>
    </main>
  );
}
