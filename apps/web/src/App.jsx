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
