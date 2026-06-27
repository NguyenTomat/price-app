import { logout } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
)

export default function Layout({ page, setPage, children, onSpotlight }) {
  const { profile, isAdmin } = useAuth()
  const { dark, toggle } = useTheme()

  const navItems = [
    { key: 'dashboard',    label: 'Dashboard',         icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { key: 'lists',        label: 'Bảng giá',          icon: 'M3 3h18v4H3zM3 11h18v4H3zM3 19h18v4H3z' },
    { key: 'my-prices',    label: 'Giá của tôi',       icon: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z' },
    { key: 'orders',       label: 'Đơn bán',           icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
    { key: 'cost-prices',  label: 'Giá vốn tính chênh', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { key: 'inventory',    label: 'Tồn kho',           icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },
    ...(isAdmin ? [
      { key: 'admin-users',  label: 'Quản lý user',    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
      { key: 'admin-import', label: 'Import bảng giá', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
    ] : []),
  ]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div>📊 Bảng Giá T&T</div>
          <div className="sub">Quản lý giá sản phẩm</div>
        </div>

        {/* Spotlight button */}
        <div style={{ padding: '10px 10px 4px' }}>
          <button
            onClick={onSpotlight}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12,
              fontFamily: 'var(--sans)', transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ flex: 1, textAlign: 'left' }}>Tìm kiếm...</span>
            <kbd style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 3, padding: '1px 4px', fontSize: 10, fontFamily: 'var(--mono)',
              color: 'rgba(255,255,255,0.4)',
            }}>⌃K</kbd>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Menu</div>
          {navItems.map(item => (
            <div
              key={item.key}
              className={`nav-item ${page === item.key ? 'active' : ''}`}
              onClick={() => setPage(item.key)}
            >
              <Icon d={item.icon}/>
              {item.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-name">{profile?.displayName || profile?.email || 'User'}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
            <span className={`badge ${isAdmin ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: 10 }}>
              {isAdmin ? '👑 Admin' : '👤 User'}
            </span>

            {/* Dark mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{dark ? '🌙' : '☀️'}</span>
              <div className={`theme-toggle ${dark ? 'on' : ''}`} onClick={toggle} title="Đổi giao diện"/>
            </div>

            <button
              className="btn ghost xs"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, border: 'none', padding: '2px 6px' }}
              onClick={logout}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        {children}
      </main>
    </div>
  )
}
