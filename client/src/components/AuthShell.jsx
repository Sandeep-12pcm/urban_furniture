import { Building2 } from 'lucide-react';

export function AuthShell({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_420px]">
        <div className="hidden overflow-hidden rounded-2xl bg-navy text-white shadow-soft lg:block">
          <div className="flex h-full min-h-[580px] flex-col justify-between p-10">
            <div>
              <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                <Building2 className="h-8 w-8" />
              </div>
              <h1 className="max-w-md text-4xl font-bold leading-tight">
                Urban Furniture Accounting System
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-white/75">
                Secure access for owners, accountants, and contact portals.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['Users', 'Roles', 'Audit'].map((label) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/55">{label}</p>
                  <p className="mt-2 text-sm font-semibold">Ready</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[420px] rounded-2xl border border-white/80 bg-white p-7 shadow-soft sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white shadow-card">
              <Building2 className="h-7 w-7" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Urban Furniture</p>
            <h2 className="mt-3 text-2xl font-bold text-ink">{title}</h2>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
