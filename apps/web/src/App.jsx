import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { apiRequest } from './lib/api.js';
import { AuthContext } from './lib/AuthContext.jsx';
import { Dashboard, roleHome } from './pages/Dashboard.jsx';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { Login } from './pages/Login.jsx';
import { ResetPassword } from './pages/ResetPassword.jsx';
import { Signup } from './pages/Signup.jsx';
import { Unauthorized } from './pages/Unauthorized.jsx';

import { ContactsPage } from './pages/master-data/ContactsPage.jsx';
import { ContactDetailPage } from './pages/master-data/ContactDetailPage.jsx';
import { ProductCategoriesPage } from './pages/master-data/ProductCategoriesPage.jsx';
import { ProductsPage } from './pages/master-data/ProductsPage.jsx';
import { ProductDetailPage } from './pages/master-data/ProductDetailPage.jsx';
import { AccountsPage } from './pages/master-data/AccountsPage.jsx';
import { JournalsPage } from './pages/master-data/JournalsPage.jsx';
import { AnalyticAccountsPage } from './pages/master-data/AnalyticAccountsPage.jsx';
import { BudgetsPage } from './pages/master-data/BudgetsPage.jsx';
import { JournalEntriesPage } from './pages/accounting/JournalEntriesPage.jsx';
import { JournalEntryDetailPage } from './pages/accounting/JournalEntryDetailPage.jsx';
import { AccountBalancesPage, LedgerPage } from './pages/accounting/AccountingReportsPage.jsx';
import { PurchaseOrdersPage } from './pages/purchases/PurchaseOrdersPage.jsx';
import { PurchaseOrderDetailPage } from './pages/purchases/PurchaseOrderDetailPage.jsx';
import { VendorBillsPage } from './pages/purchases/VendorBillsPage.jsx';
import { VendorBillDetailPage } from './pages/purchases/VendorBillDetailPage.jsx';
import { SalesOrdersPage } from './pages/sales/SalesOrdersPage.jsx';
import { SalesOrderDetailPage } from './pages/sales/SalesOrderDetailPage.jsx';
import { CustomerInvoicesPage } from './pages/sales/CustomerInvoicesPage.jsx';
import { CustomerInvoiceDetailPage } from './pages/sales/CustomerInvoiceDetailPage.jsx';
import { PaymentsPage } from './pages/payments/PaymentsPage.jsx';
import { InventoryPage } from './pages/inventory/InventoryPage.jsx';
import { InventoryMovementsPage } from './pages/inventory/InventoryMovementsPage.jsx';
import { InventoryProductDetailPage } from './pages/inventory/InventoryProductDetailPage.jsx';
import { ReportsDashboardPage, TrialBalancePage, GeneralLedgerPage, ProfitLossPage, BalanceSheetPage, BudgetReportPage } from './pages/reports/ReportsPage.jsx';
import { AdministrationPage } from './pages/admin/AdministrationPage.jsx';
import { ReceivablesPage, PayablesPage, CashFlowPage, TrendsPage } from './pages/analytics/AnalyticsPages.jsx';

function ProtectedRoute({ roles, user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

function LoginRoute({ user, onLogin }) {
  const navigate = useNavigate();
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return <Login onLogin={onLogin} navigate={navigate} />;
}

function SignupRoute({ onLogin }) {
  const navigate = useNavigate();
  return <Signup onLogin={onLogin} navigate={navigate} />;
}

function ForgotPasswordRoute() {
  const navigate = useNavigate();
  return <ForgotPassword navigate={navigate} />;
}

function ResetPasswordRoute() {
  const navigate = useNavigate();
  return <ResetPassword navigate={navigate} />;
}

function UnauthorizedRoute() {
  const navigate = useNavigate();
  return <Unauthorized navigate={navigate} />;
}

const MASTER_DATA_ROLES = ['ADMIN', 'ACCOUNTANT'];
const DOCUMENT_ROLES = ['ADMIN', 'ACCOUNTANT', 'CONTACT'];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-white/80 bg-white px-8 py-6 text-sm font-semibold text-navy shadow-soft">
          Loading secure workspace...
        </div>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <AuthenticatedApp user={user} setUser={setUser} />
    </BrowserRouter>
  );
}

function AuthenticatedApp({ user, setUser }) {
  const navigate = useNavigate();

  function onLogin(nextUser) {
    setUser(nextUser);
    navigate(roleHome(nextUser.role));
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute user={user} onLogin={onLogin} />} />
          <Route path="/signup" element={<SignupRoute onLogin={onLogin} />} />
          <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
          <Route path="/reset-password" element={<ResetPasswordRoute />} />
          <Route path="/unauthorized" element={<UnauthorizedRoute />} />

          <Route element={<ProtectedRoute user={user} />}>
            <Route element={<AppLayout />}>
              <Route element={<ProtectedRoute user={user} roles={['ADMIN']} />}>
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/administration" element={<AdministrationPage />} />
              </Route>
              <Route element={<ProtectedRoute user={user} roles={['ACCOUNTANT']} />}>
                <Route path="/accountant/dashboard" element={<Dashboard />} />
              </Route>
              <Route element={<ProtectedRoute user={user} roles={['CONTACT']} />}>
                <Route path="/contact/dashboard" element={<Dashboard />} />
              </Route>

              <Route element={<ProtectedRoute user={user} roles={MASTER_DATA_ROLES} />}>
                <Route path="/master-data/contacts" element={<ContactsPage />} />
                <Route path="/master-data/contacts/:id" element={<ContactDetailPage />} />
                <Route path="/master-data/categories" element={<ProductCategoriesPage />} />
                <Route path="/master-data/products" element={<ProductsPage />} />
                <Route path="/master-data/products/:id" element={<ProductDetailPage />} />
                <Route path="/master-data/accounts" element={<AccountsPage />} />
                <Route path="/master-data/journals" element={<JournalsPage />} />
                <Route path="/master-data/analytic-accounts" element={<AnalyticAccountsPage />} />
                <Route path="/master-data/budgets" element={<BudgetsPage />} />
                <Route path="/accounting/journal-entries" element={<JournalEntriesPage />} />
                <Route path="/accounting/journal-entries/:id" element={<JournalEntryDetailPage />} />
                <Route path="/accounting/ledger" element={<LedgerPage />} />
                <Route path="/accounting/account-balances" element={<AccountBalancesPage />} />
                <Route path="/purchases/orders" element={<PurchaseOrdersPage />} />
                <Route path="/purchases/orders/:id" element={<PurchaseOrderDetailPage />} />
                <Route path="/sales/orders" element={<SalesOrdersPage />} />
                <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/inventory/movements" element={<InventoryMovementsPage />} />
                <Route path="/inventory/products/:id" element={<InventoryProductDetailPage />} />
                <Route path="/reports" element={<ReportsDashboardPage />} />
                <Route path="/reports/trial-balance" element={<TrialBalancePage />} />
                <Route path="/reports/general-ledger" element={<GeneralLedgerPage />} />
                <Route path="/reports/profit-loss" element={<ProfitLossPage />} />
                <Route path="/reports/balance-sheet" element={<BalanceSheetPage />} />
                <Route path="/reports/budget" element={<BudgetReportPage />} />
                <Route path="/analytics/receivables" element={<ReceivablesPage />} /><Route path="/analytics/payables" element={<PayablesPage />} /><Route path="/analytics/cash-flow" element={<CashFlowPage />} /><Route path="/analytics/trends" element={<TrendsPage />} />
              </Route>

              <Route element={<ProtectedRoute user={user} roles={DOCUMENT_ROLES} />}>
                <Route path="/purchases/bills" element={<VendorBillsPage />} />
                <Route path="/purchases/bills/:id" element={<VendorBillDetailPage />} />
                <Route path="/sales/invoices" element={<CustomerInvoicesPage />} />
                <Route path="/sales/invoices/:id" element={<CustomerInvoiceDetailPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to={user ? roleHome(user.role) : '/login'} replace />} />
          <Route path="*" element={<Navigate to={user ? roleHome(user.role) : '/login'} replace />} />
        </Routes>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
