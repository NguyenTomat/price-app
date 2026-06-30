import { useState, useEffect } from 'react'
import { logout } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

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

export default function Layout({ page, setPage, children, onSpotlight }) {
  const { profile, isAdmin } = useAuth()
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

  const navItems = [
    { key: 'dashboard',    label: 'Dashboard',         icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { key: 'lists',        label: 'Bảng giá',          icon: 'M3 3h18v4H3zM3 11h18v4H3zM3 19h18v4H3z' },
    { key: 'my-prices',    label: 'Giá của tôi',       icon: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z' },
    { key: 'orders',       label: 'Đơn bán',           icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
    { key: 'cost-prices',  label: 'Giá vốn tính chênh', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { key: 'inventory',    label: 'Tồn kho',           icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },
    { key: 'catalog',      label: 'Catalog',            icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z' },
    ...(isAdmin ? [
      { key: 'admin-users',  label: 'Quản lý user',    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
      { key: 'admin-import', label: 'Import bảng giá', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
    ] : []),
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
        <div className="sidebar-logo">
          <div>📊 Bảng Giá T&T</div>
          <div className="sub">Quản lý giá sản phẩm</div>
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
            >
              <Icon d={item.icon}/>
              {item.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-name">{profile?.displayName || profile?.email || 'User'}</div>
          <div className="sidebar-footer-actions">
            <span className={`badge ${isAdmin ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: 10 }}>
              {isAdmin ? '👑 Admin' : '👤 User'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{dark ? '🌙' : '☀️'}</span>
              <div className={`theme-toggle ${dark ? 'on' : ''}`} onClick={toggle} title="Đổi giao diện"/>
            </div>
            <button
              type="button"
              className="btn ghost xs sidebar-logout"
              onClick={logout}
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
