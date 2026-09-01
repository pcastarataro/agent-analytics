import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/events', label: 'Events' },
  { to: '/projects', label: 'Projects' },
  { to: '/branches', label: 'Branches' },
  { to: '/agents', label: 'Agents' },
  { to: '/skills', label: 'Skills' },
  { to: '/users', label: 'Users' },
  { to: '/sessions', label: 'Sessions' },
];

export function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-16 shrink-0 border-r border-gray-200 bg-white p-3 sm:w-56 sm:p-4">
        <h1 className="mb-6 hidden text-lg font-bold text-gray-900 sm:block">Agent Analytics</h1>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
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
      </aside>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
