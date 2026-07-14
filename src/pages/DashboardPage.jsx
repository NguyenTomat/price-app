import { useState, useEffect } from 'react'
import { getDashboardStats, subscribeOrders } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import MobileTableWrap from '../components/MobileTableWrap'

const fmt = n => n != null && !isNaN(n)
  ? Number(n).toLocaleString('vi-VN') + ' ₫'
  : '—'

const fmtShort = n => {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + ' tr'
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + 'k'
  return n.toString()
}

const STATUS_LABELS = {
  pending:   { label: 'Chờ xác nhận', cls: 'pending' },
  confirmed: { label: 'Đã xác nhận',  cls: 'confirmed' },
  delivered: { label: 'Đã giao',      cls: 'delivered' },
  cancelled: { label: 'Đã hủy',       cls: 'cancelled' },
}

export default function DashboardPage({ setPage }) {
  const { user, profile, isAdmin } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats(user.uid).then(s => { setStats(s); setLoading(false) }).catch(() => setLoading(false))
  }, [user.uid])

  useEffect(() => {
    const unsub = subscribeOrders(orders => setRecentOrders(orders.slice(0, 8)), { uid: user.uid })
    return unsub
  }, [user.uid])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  const StatCard = ({ label, value, sub, icon, color = 'var(--accent)', onClick }) => (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.12s, box-shadow 0.12s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = '', e.currentTarget.style.boxShadow = '')}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{loading ? '—' : value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-icon">{icon}</div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header">
        <div>
          <h2>{greeting}, {profile?.displayName?.split(' ').pop() || 'bạn'} 👋</h2>
          <div className="text-muted text-sm" style={{ marginTop: 2 }}>
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Stat cards */}
        <div className="stat-grid">
          <StatCard
            label="Bảng giá" value={stats?.priceLists ?? '—'}
            sub="đang hoạt động" icon="📊" color="var(--accent)"
            onClick={() => setPage('lists')}
          />
          <StatCard
            label="Đơn bán" value={stats?.orders ?? '—'}
            sub={`${stats?.ordersByStatus?.pending ?? 0} chờ xác nhận`}
            icon="🛒" color="var(--warning)"
            onClick={() => setPage('orders')}
          />
          {isAdmin && (
            <StatCard
              label="Doanh thu (đã giao)" value={fmtShort(stats?.totalRevenue)}
              sub="từ đơn hoàn thành" icon="💰" color="var(--success)"
            />
          )}
          {isAdmin && (
            <StatCard
              label="Tài khoản" value={stats?.users ?? '—'}
              sub="người dùng" icon="👥"
              onClick={() => setPage('admin-users')}
            />
          )}
          <StatCard
            label="Tồn kho thấp" value={stats?.lowStock ?? '—'}
            sub="mặt hàng cần nhập thêm" icon="⚠️" color={stats?.lowStock > 0 ? 'var(--danger)' : 'var(--success)'}
            onClick={() => setPage('inventory')}
          />
        </div>

        {/* Order status breakdown */}
        {stats?.ordersByStatus && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 14 }}>Trạng thái đơn hàng</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {Object.entries(STATUS_LABELS).map(([key, { label, cls }]) => (
                <div key={key} style={{
                  textAlign: 'center', padding: '14px 8px',
                  background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    {stats.ordersByStatus[key] ?? 0}
                  </div>
                  <span className={`order-status ${cls}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h3 style={{ flex: 1 }}>Đơn hàng gần đây</h3>
            <button className="btn sm ghost" onClick={() => setPage('orders')}>Xem tất cả →</button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="empty" style={{ padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
              <div>Chưa có đơn hàng nào</div>
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>Đơn bán sẽ xuất hiện tại đây</div>
            </div>
          ) : (
            <MobileTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Sản phẩm</th>
                    <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => {
                    const st = STATUS_LABELS[o.status] || { label: o.status, cls: '' }
                    return (
                      <tr key={o.id} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 500 }}>{o.userName || o.uid?.slice(0, 8) || '—'}</td>
                        <td className="text-sm text-muted">
                          {o.items?.length ?? 0} sản phẩm
                          {o.items?.[0] ? ` · ${o.items[0].name}` : ''}
                          {o.items?.length > 1 ? ` +${o.items.length - 1}` : ''}
                        </td>
                        <td className="td-price" style={{ textAlign: 'right' }}>{fmt(o.total)}</td>
                        <td><span className={`order-status ${st.cls}`}>{st.label}</span></td>
                        <td className="text-sm text-muted">
                          {o.createdAt?.toDate?.()
                            ? o.createdAt.toDate().toLocaleDateString('vi-VN')
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </MobileTableWrap>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => setPage('my-prices')}>
            ⭐ Tính giá của tôi
          </button>
          <button className="btn" onClick={() => setPage('orders')}>
            🛒 Tạo đơn bán
          </button>
          {isAdmin && (
            <button className="btn" onClick={() => setPage('admin-import')}>
              📥 Import bảng giá
            </button>
          )}
          <button className="btn" onClick={() => setPage('inventory')}>
            📦 Quản lý tồn kho
          </button>
        </div>
      </div>
    </div>
  )
}
