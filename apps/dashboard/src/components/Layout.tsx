import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'Overview', authRequired: true },
  { to: '/events', label: 'Events', authRequired: true },
  { to: '/projects', label: 'Projects', authRequired: true },
  { to: '/branches', label: 'Branches', authRequired: true },
  { to: '/agents', label: 'Agents', authRequired: true },
  { to: '/skills', label: 'Skills', authRequired: true },
  { to: '/users', label: 'Users', authRequired: true },
  { to: '/sessions', label: 'Sessions', authRequired: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-16 shrink-0 border-r border-gray-200 bg-white p-3 sm:w-56 sm:p-4">
        <h1 className="mb-6 hidden text-lg font-bold text-gray-900 sm:block">Agent Analytics</h1>
        <nav className="flex flex-col gap-1">
          {navItems
            .filter((item) => !item.authRequired || user)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <span className="sm:hidden">{item.label.charAt(0)}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
        </nav>
        {user && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <p className="mb-2 hidden text-xs text-gray-500 sm:block">{user.name}</p>
            <button
              onClick={handleLogout}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="sm:hidden">⏻</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
