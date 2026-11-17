import { useState, useEffect } from 'react'
import { logout } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import UserAvatar from './UserAvatar'

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
)

const BOTTOM_NAV = [
  { key: 'dashboard', label: 'Trang chủ', icon: '📊' },
  { key: 'my-prices', label: 'Giá', icon: '💰' },
  { key: 'orders', label: 'Đơn', icon: '🛒' },
  { key: 'inventory', label: 'Kho', icon: '📦' },
]

export default function Layout({ page, setPage, children, onSpotlight, pendingWebOrdersCount = 0 }) {
  const { user, profile, isAdmin, canManageWeb } = useAuth()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const currentEmail = (user?.email || profile?.email || '').trim().toLowerCase()

  const navItems = [
    { key: 'dashboard',    label: 'Dashboard',         icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { key: 'lists',        label: 'Bảng giá',          icon: 'M3 3h18v4H3zM3 11h18v4H3zM3 19h18v4H3z' },
    { key: 'my-prices',    label: 'Giá của tôi',       icon: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z' },
    { key: 'orders',       label: 'Đơn bán',           icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
    { key: 'revenue',      label: 'Doanh thu',          icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6M22 12h-4m-2 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0' },
    { key: 'cost-prices',  label: 'Giá vốn tính chênh', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { key: 'inventory',    label: 'Tồn kho',           icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },
    { key: 'catalog',      label: 'Catalog',            icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z' },
    { key: 'technical-dossiers', label: 'Hồ sơ kỹ thuật', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
    { key: 'bus',          label: 'Nhà xe',            icon: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v6c0 .6.4 1 1 1h2m3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0M2 10h11M7 5V3' },
    ...(canManageWeb ? [
      {
        key: 'web-manage',
        label: 'Quản lý Web',
        icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm1-13h-2v6h2zm0 8h-2v2h2z',
        badge: pendingWebOrdersCount > 0 ? pendingWebOrdersCount : null,
      }
    ] : []),
    ...(isAdmin ? [
      { key: 'admin-users',  label: 'Quản lý user',    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
      { key: 'admin-import', label: 'Import bảng giá', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
    ] : []),
    { key: 'account',      label: 'Quản lý tài khoản', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  ]

  const currentPage = navItems.find(i => i.key === page)

  const goTo = (key) => {
    setPage(key)
    setMenuOpen(false)
  }

  return (
    <div className={`layout ${isMobile ? 'layout-mobile' : ''}`}>
      {isMobile && menuOpen && (
        <div className="sidebar-backdrop open" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <aside className={`sidebar ${isMobile && menuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="./icons/icon-192.png" alt="T&T" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800 }}>Bảng Giá T&T</div>
            <div className="sub">Quản lý giá sản phẩm</div>
          </div>
        </div>

        <div style={{ padding: '10px 10px 4px' }}>
          <button
            type="button"
            className="sidebar-search-btn"
            onClick={() => { onSpotlight?.(); setMenuOpen(false) }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ flex: 1, textAlign: 'left' }}>Tìm kiếm...</span>
            {!isMobile && (
              <kbd className="sidebar-kbd">⌃K</kbd>
            )}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Menu</div>
          {navItems.map(item => (
            <div
              key={item.key}
              className={`nav-item ${page === item.key ? 'active' : ''}`}
              onClick={() => goTo(item.key)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Icon d={item.icon}/>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
              </div>
              {item.badge != null && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '1.5px 6.5px',
                    borderRadius: 10,
                    marginLeft: 6,
                    minWidth: 18,
                    textAlign: 'center',
                    boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
                  }}
                  title={`${item.badge} đơn mới cần xử lý`}
                >
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            className="sidebar-user-card"
            onClick={() => goTo('account')}
            title="Bấm để mở Quản lý tài khoản"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '8px 10px',
              borderRadius: 8,
              transition: 'background .15s',
              marginBottom: 6,
              background: page === 'account' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: page === 'account' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            }}
            onMouseEnter={(e) => {
              if (page !== 'account') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
            }}
            onMouseLeave={(e) => {
              if (page !== 'account') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
            }}
          >
            <UserAvatar user={{ ...profile, ...user }} size={34} showStatus={true} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                  fontSize: 13,
                  margin: 0,
                  color: '#ffffff',
                  letterSpacing: '0.01em',
                }}
              >
                {profile?.displayName || user?.displayName || profile?.email || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <span>Quản lý tài khoản</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="sidebar-footer-actions">
            <span className={`badge ${isAdmin ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: 10, fontWeight: 700 }}>
              {isAdmin ? 'Admin' : 'User'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className={`theme-toggle ${dark ? 'on' : ''}`}
                onClick={toggle}
                title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              />
            </div>
            <button
              type="button"
              className="btn ghost xs sidebar-logout"
              onClick={logout}
              style={{ fontSize: 11 }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <div className="layout-body">
        {isMobile && (
          <header className="mobile-topbar">
            <button type="button" className="mobile-icon-btn" onClick={() => setMenuOpen(true)} aria-label="Mở menu">
              ☰
            </button>
            <div className="mobile-topbar-title">
              <img src="./icons/icon-192.png" alt="" className="mobile-topbar-logo" />
              <span>{currentPage?.label || 'Bảng Giá T&T'}</span>
            </div>
            <button type="button" className="mobile-icon-btn" onClick={() => onSpotlight?.()} aria-label="Tìm kiếm">
              🔍
            </button>
          </header>
        )}

        <main className="main">
          {children}
        </main>

        {isMobile && (
          <nav className="mobile-bottom-nav">
            {BOTTOM_NAV.map(item => (
              <button
                key={item.key}
                type="button"
                className={`mobile-nav-item ${page === item.key ? 'active' : ''}`}
                onClick={() => goTo(item.key)}
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              className={`mobile-nav-item ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen(true)}
            >
              <span className="mobile-nav-icon">⋯</span>
              <span className="mobile-nav-label">Thêm</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
