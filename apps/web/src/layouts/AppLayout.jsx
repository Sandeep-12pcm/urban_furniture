import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Truck,
  FileSpreadsheet,
  CreditCard,
  Users,
  Package,
  BookOpen,
  FolderGit2,
  PieChart,
  Scale,
  LineChart,
  Target,
  UserCheck,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export function AppLayout({ currentPath, navigate, user, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role || 'ACCOUNTANT';

  const navGroups = [
    {
      title: 'Overview',
      items: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          icon: LayoutDashboard,
          roles: ['ADMIN', 'ACCOUNTANT', 'CONTACT'],
        },
      ],
    },
    {
      title: 'Sales',
      items: [
        {
          label: 'Sales Orders',
          path: '/sales-orders',
          icon: ShoppingCart,
          roles: ['ADMIN', 'ACCOUNTANT', 'CONTACT'],
        },
        {
          label: 'Customer Invoices',
          path: '/invoices',
          icon: Receipt,
          roles: ['ADMIN', 'ACCOUNTANT', 'CONTACT'],
        },
      ],
    },
    {
      title: 'Purchases',
      items: [
        {
          label: 'Purchase Orders',
          path: '/purchase-orders',
          icon: Truck,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Vendor Bills',
          path: '/vendor-bills',
          icon: FileSpreadsheet,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
      ],
    },
    {
      title: 'Payments',
      items: [
        {
          label: 'Payments',
          path: '/payments',
          icon: CreditCard,
          roles: ['ADMIN', 'ACCOUNTANT', 'CONTACT'],
        },
      ],
    },
    {
      title: 'Master Data',
      items: [
        {
          label: 'Contacts',
          path: '/contacts',
          icon: Users,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Products',
          path: '/products',
          icon: Package,
          roles: ['ADMIN', 'ACCOUNTANT', 'CONTACT'],
        },
        {
          label: 'Chart of Accounts',
          path: '/accounts',
          icon: BookOpen,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Journals',
          path: '/journals',
          icon: FolderGit2,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Analytic Accounts',
          path: '/analytic-accounts',
          icon: PieChart,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Budgets',
          path: '/budgets',
          icon: Target,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
      ],
    },
    {
      title: 'Financial Reports',
      items: [
        {
          label: 'Balance Sheet',
          path: '/reports/balance-sheet',
          icon: Scale,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Profit & Loss',
          path: '/reports/profit-loss',
          icon: LineChart,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
        {
          label: 'Budget Report',
          path: '/reports/budget',
          icon: Target,
          roles: ['ADMIN', 'ACCOUNTANT'],
        },
      ],
    },
    ...(role === 'ADMIN'
      ? [
          {
            title: 'Administration',
            items: [
              {
                label: 'User Management',
                path: '/users',
                icon: UserCheck,
                roles: ['ADMIN'],
              },
            ],
          },
        ]
      : []),
  ];

  function handleNav(path) {
    navigate(path);
    setMobileOpen(false);
  }

  const roleColor =
    role === 'ADMIN' ? 'danger' : role === 'ACCOUNTANT' ? 'primary' : 'success';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6">
          <div
            onClick={() => handleNav('/dashboard')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-900 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-bold text-slate-900 leading-tight">
                Urban Furniture
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                Accounting & ERP
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) =>
              item.roles.includes(role)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                <h4 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </h4>
                <nav className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      currentPath === item.path ||
                      (item.path !== '/dashboard' &&
                        currentPath.startsWith(item.path));
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-900 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-slate-700'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        {/* User Footer Profile */}
        <div className="shrink-0 border-t border-slate-200 p-4 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-700">
                {(user?.loginId || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-bold text-slate-900">
                  {user?.loginId || 'User'}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge variant={roleColor} size="sm">
                    {role}
                  </Badge>
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Log out"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Workspace
              </span>
              <h2 className="text-sm font-bold text-slate-800">
                Urban Furniture Ltd. (Main Branch)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Fiscal Year: 2026</span>
              <span className="text-slate-300">|</span>
              <span>Currency: USD ($)</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              icon={LogOut}
              className="text-xs font-semibold text-slate-600 hover:text-rose-600"
            >
              Sign Out
            </Button>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
