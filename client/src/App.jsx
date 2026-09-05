import React, { useEffect, useState } from 'react';
import { api } from './services/api.js';
import { ToastProvider } from './components/ui/Toast.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';

// Auth Pages
import { Login } from './pages/Login.jsx';
import { Signup } from './pages/Signup.jsx';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { ResetPassword } from './pages/ResetPassword.jsx';
import { Unauthorized } from './pages/Unauthorized.jsx';

// Main Pages
import { Dashboard } from './pages/Dashboard.jsx';
import { Contacts } from './pages/Contacts.jsx';
import { Products } from './pages/Products.jsx';
import { Accounts } from './pages/Accounts.jsx';
import { Journals } from './pages/Journals.jsx';
import { AnalyticAccounts } from './pages/AnalyticAccounts.jsx';
import { Budgets } from './pages/Budgets.jsx';
import { SalesOrders } from './pages/SalesOrders.jsx';
import { SalesOrderForm } from './pages/SalesOrderForm.jsx';
import { SalesOrderDetail } from './pages/SalesOrderDetail.jsx';
import { PurchaseOrders } from './pages/PurchaseOrders.jsx';
import { PurchaseOrderForm } from './pages/PurchaseOrderForm.jsx';
import { PurchaseOrderDetail } from './pages/PurchaseOrderDetail.jsx';
import { Invoices } from './pages/Invoices.jsx';
import { InvoiceDetail } from './pages/InvoiceDetail.jsx';
import { VendorBills } from './pages/VendorBills.jsx';
import { VendorBillDetail } from './pages/VendorBillDetail.jsx';
import { Payments } from './pages/Payments.jsx';
import { BalanceSheet } from './pages/BalanceSheet.jsx';
import { ProfitLoss } from './pages/ProfitLoss.jsx';
import { BudgetReport } from './pages/BudgetReport.jsx';
import { Users } from './pages/Users.jsx';

function getPath() {
  return window.location.pathname;
}

export default function App() {
  const [path, setPath] = useState(getPath());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function navigate(nextPath) {
    if (nextPath !== window.location.pathname) {
      window.history.pushState({}, '', nextPath);
    }
    setPath(nextPath);
  }

  function onLogin(nextUser) {
    setUser(nextUser);
    navigate('/dashboard');
  }

  async function onLogout() {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setUser(null);
    navigate('/login');
  }

  useEffect(() => {
    const onPopState = () => setPath(getPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    api.auth
      .me()
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Public unauthenticated routes
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/unauthorized'];

  useEffect(() => {
    if (loading) return;

    if (!user && !publicRoutes.includes(path)) {
      navigate('/login');
      return;
    }

    if (user && (path === '/' || path === '/login')) {
      navigate('/dashboard');
    }
  }, [path, user, loading]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-indigo-900 border-t-transparent" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Loading Accounting Workspace...
          </span>
        </div>
      </main>
    );
  }

  // Render Public Auth Views
  if (!user) {
    if (path === '/signup') return <ToastProvider><Signup onLogin={onLogin} navigate={navigate} /></ToastProvider>;
    if (path === '/forgot-password') return <ToastProvider><ForgotPassword navigate={navigate} /></ToastProvider>;
    if (path === '/reset-password') return <ToastProvider><ResetPassword navigate={navigate} /></ToastProvider>;
    if (path === '/unauthorized') return <ToastProvider><Unauthorized navigate={navigate} /></ToastProvider>;
    return <ToastProvider><Login onLogin={onLogin} navigate={navigate} /></ToastProvider>;
  }

  // Parse Protected Dynamic Routes
  let pageComponent = null;

  if (path === '/dashboard' || path === '/admin/dashboard' || path === '/accountant/dashboard' || path === '/contact/dashboard') {
    pageComponent = <Dashboard user={user} navigate={navigate} />;
  } else if (path === '/contacts') {
    pageComponent = <Contacts navigate={navigate} />;
  } else if (path === '/products') {
    pageComponent = <Products navigate={navigate} />;
  } else if (path === '/accounts') {
    pageComponent = <Accounts navigate={navigate} />;
  } else if (path === '/journals') {
    pageComponent = <Journals navigate={navigate} />;
  } else if (path === '/analytic-accounts') {
    pageComponent = <AnalyticAccounts navigate={navigate} />;
  } else if (path === '/budgets') {
    pageComponent = <Budgets navigate={navigate} />;
  } else if (path === '/sales-orders') {
    pageComponent = <SalesOrders navigate={navigate} />;
  } else if (path === '/sales-orders/new') {
    pageComponent = <SalesOrderForm navigate={navigate} />;
  } else if (path.startsWith('/sales-orders/')) {
    const id = path.replace('/sales-orders/', '');
    pageComponent = <SalesOrderDetail id={id} navigate={navigate} />;
  } else if (path === '/purchase-orders') {
    pageComponent = <PurchaseOrders navigate={navigate} />;
  } else if (path === '/purchase-orders/new') {
    pageComponent = <PurchaseOrderForm navigate={navigate} />;
  } else if (path.startsWith('/purchase-orders/')) {
    const id = path.replace('/purchase-orders/', '');
    pageComponent = <PurchaseOrderDetail id={id} navigate={navigate} />;
  } else if (path === '/invoices') {
    pageComponent = <Invoices navigate={navigate} />;
  } else if (path.startsWith('/invoices/')) {
    const id = path.replace('/invoices/', '');
    pageComponent = <InvoiceDetail id={id} navigate={navigate} />;
  } else if (path === '/vendor-bills') {
    pageComponent = <VendorBills navigate={navigate} />;
  } else if (path.startsWith('/vendor-bills/')) {
    const id = path.replace('/vendor-bills/', '');
    pageComponent = <VendorBillDetail id={id} navigate={navigate} />;
  } else if (path === '/payments') {
    pageComponent = <Payments navigate={navigate} />;
  } else if (path === '/reports/balance-sheet') {
    pageComponent = <BalanceSheet navigate={navigate} />;
  } else if (path === '/reports/profit-loss') {
    pageComponent = <ProfitLoss navigate={navigate} />;
  } else if (path === '/reports/budget') {
    pageComponent = <BudgetReport navigate={navigate} />;
  } else if (path === '/users') {
    pageComponent = <Users navigate={navigate} />;
  } else {
    pageComponent = <Dashboard user={user} navigate={navigate} />;
  }

  return (
    <ToastProvider>
      <AppLayout
        currentPath={path}
        navigate={navigate}
        user={user}
        onLogout={onLogout}
      >
        {pageComponent}
      </AppLayout>
    </ToastProvider>
  );
}
