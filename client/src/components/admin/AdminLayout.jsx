import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingBag, Users, Settings, Pill, FileText, BarChart3, Wrench, ScrollText } from 'lucide-react'
import Logo from '../Logo'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/blog', label: 'Blog', icon: FileText },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/operations', label: 'Operations', icon: Wrench },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/activity', label: 'Activity Log', icon: ScrollText },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/prescriptions', label: 'Prescriptions', icon: Pill },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Logo size={36} showText={false} to="/admin" className="admin-sidebar-brand" />
          <span className="admin-sidebar-title">Evolve Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <NavLink to="/" className="admin-back-link">← Back to Store</NavLink>
        </div>
      </aside>

      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  )
}
