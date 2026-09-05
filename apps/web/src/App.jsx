import { useEffect, useState } from 'react';
import { apiRequest } from './lib/api.js';
import { Dashboard, roleHome } from './pages/Dashboard.jsx';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { Login } from './pages/Login.jsx';
import { ResetPassword } from './pages/ResetPassword.jsx';
import { Signup } from './pages/Signup.jsx';
import { Unauthorized } from './pages/Unauthorized.jsx';

const protectedRoutes = {
  '/admin/dashboard': 'ADMIN',
  '/accountant/dashboard': 'ACCOUNTANT',
  '/contact/dashboard': 'CONTACT',
};

function getPath() {
  return window.location.pathname;
}

export default function App() {
  const [path, setPath] = useState(getPath());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function navigate(nextPath) {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }

  function onLogin(nextUser) {
    setUser(nextUser);
    navigate(roleHome(nextUser.role));
  }

  useEffect(() => {
    const onPopState = () => setPath(getPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (path === '/') navigate('/login');
    if (protectedRoutes[path] && !user) navigate('/login');
    if (protectedRoutes[path] && user && protectedRoutes[path] !== user.role) navigate('/unauthorized');
  }, [path, user, loading]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-white/80 bg-white px-8 py-6 text-sm font-semibold text-navy shadow-soft">
          Loading secure workspace...
        </div>
      </main>
    );
  }

  if (path === '/signup') return <Signup onLogin={onLogin} navigate={navigate} />;
  if (path === '/forgot-password') return <ForgotPassword navigate={navigate} />;
  if (path === '/reset-password') return <ResetPassword navigate={navigate} />;
  if (path === '/unauthorized') return <Unauthorized navigate={navigate} />;
  if (protectedRoutes[path] && user) return <Dashboard user={user} navigate={navigate} setUser={setUser} />;
  return <Login onLogin={onLogin} navigate={navigate} />;
}
