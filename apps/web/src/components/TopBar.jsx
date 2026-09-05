import { LogOut, Menu } from 'lucide-react';
import { Button } from './Button.jsx';

export function TopBar({ user, onMenuClick, onLogout }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-borderSoft bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-navy hover:bg-page lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Welcome back</p>
          <p className="text-sm font-bold text-ink">{user.loginId}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden rounded-full bg-lavender/40 px-3 py-1 text-xs font-bold text-navy sm:inline-block">
          {user.role}
        </span>
        <Button type="button" variant="secondary" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
