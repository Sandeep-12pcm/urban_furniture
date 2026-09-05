import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

export function AppLayout() {
  const { user, setUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      navigate('/login');
    }
  }

  return (
    <div className="min-h-screen bg-page lg:flex">
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar user={user} onMenuClick={() => setSidebarOpen(true)} onLogout={logout} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
