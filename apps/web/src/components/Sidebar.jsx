import {
  BarChart3,
  Boxes,
  Building2,
  ChevronRight,
  LandmarkIcon,
  LayoutDashboard,
  NotebookText,
  Package,
  Tags,
  Users,
  Wallet,
  BookOpen,
  ShoppingCart,
  ReceiptText,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { roleHome } from '../pages/Dashboard.jsx';
import { canManageMasterData } from '../lib/AuthContext.jsx';

const masterDataLinks = [
  { to: '/master-data/contacts', label: 'Contacts', icon: Users },
  { to: '/master-data/products', label: 'Products', icon: Package },
  { to: '/master-data/categories', label: 'Categories', icon: Boxes },
  { to: '/master-data/accounts', label: 'Chart of Accounts', icon: LandmarkIcon },
  { to: '/master-data/journals', label: 'Journals', icon: NotebookText },
  { to: '/master-data/analytic-accounts', label: 'Analytic Accounts', icon: Tags },
  { to: '/master-data/budgets', label: 'Budgets', icon: Wallet },
];
const accountingLinks = [
  { to: '/accounting/journal-entries', label: 'Journal Entries', icon: BookOpen },
  { to: '/accounting/ledger', label: 'Ledger', icon: NotebookText },
  { to: '/accounting/account-balances', label: 'Account Balances', icon: LandmarkIcon },
];
const purchaseLinks = [
  { to: '/purchases/orders', label: 'Purchase Orders', icon: ShoppingCart },
  { to: '/purchases/bills', label: 'Vendor Bills', icon: NotebookText },
];
const salesLinks = [
  { to: '/sales/orders', label: 'Sales Orders', icon: ShoppingCart },
  { to: '/sales/invoices', label: 'Customer Invoices', icon: ReceiptText },
  { to: '/payments', label: 'Payments', icon: Wallet },
];
const inventoryLinks = [
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/inventory/movements', label: 'Stock Movements', icon: Package },
];
const reportLinks = [
  { to: '/reports', label: 'Report Dashboard', icon: BarChart3 },
  { to: '/reports/profit-loss', label: 'Profit & Loss', icon: BarChart3 },
  { to: '/reports/balance-sheet', label: 'Balance Sheet', icon: LandmarkIcon },
  { to: '/reports/trial-balance', label: 'Trial Balance', icon: BookOpen },
  { to: '/reports/general-ledger', label: 'General Ledger', icon: NotebookText },
  { to: '/reports/budget', label: 'Budget Report', icon: Wallet },
];

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
          isActive ? 'bg-white/15 text-white shadow-inner' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export function Sidebar({ user, open, onClose }) {
  const showMasterData = canManageMasterData(user.role);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy px-4 py-6 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Urban Furniture</p>
              <p className="text-xs text-white/55">Accounting System</p>
            </div>
          </div>
          <button type="button" aria-label="Close navigation" onClick={onClose} className="rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto pb-4">
          <div className="space-y-1">
            <NavItem to={roleHome(user.role)} label="Dashboard" icon={LayoutDashboard} />
          </div>

          {showMasterData && (
            <div>
              <p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Master Data</p>
              <div className="space-y-1">
                {masterDataLinks.map((link) => (
                  <NavItem key={link.to} {...link} />
                ))}
              </div>
            </div>
          )}
          {showMasterData && (
            <div><p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Accounting</p><div className="space-y-1">{accountingLinks.map((link) => <NavItem key={link.to} {...link} />)}</div></div>
          )}
          {showMasterData && (
            <div><p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Purchases</p><div className="space-y-1">{purchaseLinks.map((link) => <NavItem key={link.to} {...link} />)}</div></div>
          )}
          {showMasterData && (
            <div><p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Sales</p><div className="space-y-1">{salesLinks.map((link) => <NavItem key={link.to} {...link} />)}</div></div>
          )}
          {showMasterData && (
            <div><p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Inventory</p><div className="space-y-1">{inventoryLinks.map((link) => <NavItem key={link.to} {...link} />)}</div></div>
          )}
          {showMasterData && (
            <div><p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Reports</p><div className="space-y-1">{reportLinks.map((link) => <NavItem key={link.to} {...link} />)}</div></div>
          )}
          {user.role === 'ADMIN' && (
            <div><p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Administration</p><div className="space-y-1"><NavItem to="/admin/administration" label="System Administration" icon={LandmarkIcon} /></div></div>
          )}

          <div>
            <p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Coming Soon</p>
            <div className="space-y-1">
              <div className="flex cursor-not-allowed items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/35">
                <span className="flex items-center gap-3">
                  <BarChart3 className="h-4 w-4" />
                  Financial Reports
                </span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
