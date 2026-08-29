import { useState, useEffect, useMemo } from 'react'
import { getDashboardStats, subscribeOrders, subscribeExpenses, addExpense, deleteExpense } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
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
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [revenueCollapsed, setRevenueCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin_revenue_collapsed')
    return saved !== null ? saved === 'true' : true
  })

  const toggleRevenueCollapsed = () => {
    setRevenueCollapsed(prev => {
      const next = !prev
      localStorage.setItem('admin_revenue_collapsed', String(next))
      return next
    })
  }

  useEffect(() => {
    getDashboardStats(user.uid).then(s => { setStats(s); setLoading(false) }).catch(() => setLoading(false))
  }, [user.uid])

  useEffect(() => {
    const unsub = subscribeOrders(orders => {
      setAllOrders(orders)
      setRecentOrders(orders.slice(0, 8))
    }, { uid: user.uid })
    return unsub
  }, [user.uid])

  useEffect(() => {
    if (isAdmin) {
      const unsub = subscribeExpenses(setExpenses)
      return unsub
    }
  }, [isAdmin])

  // Custom long Vietnamese currency formatter (e.g. 80,1 triệu ₫)
  const fmtRevenueLong = (n) => {
    if (n == null || isNaN(n)) return '0 ₫'
    const isNeg = n < 0
    const absVal = Math.abs(n)
    if (absVal >= 1_000_000_000) {
      return (isNeg ? '-' : '') + (absVal / 1_000_000_000).toFixed(1).replace('.', ',') + ' tỷ ₫'
    }
    if (absVal >= 1_000_000) {
      return (isNeg ? '-' : '') + (absVal / 1_000_000).toFixed(1).replace('.', ',') + ' triệu ₫'
    }
    if (absVal >= 1_000) {
      return (isNeg ? '-' : '') + (absVal / 1_000).toFixed(0) + 'k ₫'
    }
    return (isNeg ? '-' : '') + absVal.toString() + ' ₫'
  }

  // 6 months calendar calculation
  const months = useMemo(() => {
    const now = new Date()
    const list = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      list.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `T${d.getMonth() + 1}`,
        fullLabel: `Tháng ${d.getMonth() + 1}`
      })
    }
    return list
  }, [])

  const monthlyRevenues = useMemo(() => {
    // 1. Initialize months with 0 values
    const list = months.map(m => ({ ...m, orderProfit: 0, expenseAmount: 0, revenue: 0 }))
    
    // 2. Sum profits from delivered orders
    const deliveredOrders = allOrders.filter(o => o.status === 'delivered')
    deliveredOrders.forEach(o => {
      const t = o.deliveredAt ?? o.updatedAt ?? o.createdAt
      if (!t) return

      let date
      if (typeof t.toDate === 'function') {
        date = t.toDate()
      } else if (t instanceof Date) {
        date = t
      } else if (typeof t === 'string' || typeof t === 'number') {
        date = new Date(t)
      } else if (t.seconds) {
        date = new Date(t.seconds * 1000)
      }

      if (!date || isNaN(date.getTime())) return

      const y = date.getFullYear()
      const m = date.getMonth()

      const found = list.find(item => item.year === y && item.month === m)
      if (found) {
        found.orderProfit += (o.listPriceProfit ?? o.profit ?? 0)
      }
    })

    // 3. Sum expenses for each month
    expenses.forEach(e => {
      if (!e.date) return
      const parts = e.date.split('-')
      if (parts.length < 2) return
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10) - 1

      const found = list.find(item => item.year === y && item.month === m)
      if (found) {
        found.expenseAmount += parseFloat(e.amount) || 0
      }
    })

    // 4. Net Profit = orderProfit - expenseAmount
    list.forEach(item => {
      item.revenue = item.orderProfit - item.expenseAmount
    })

    return list
  }, [allOrders, expenses, months])

  const currentMonthRevenue = monthlyRevenues[5]?.revenue ?? 0
  const prevMonthRevenue = monthlyRevenues[4]?.revenue ?? 0
  const diffAmount = currentMonthRevenue - prevMonthRevenue

  let growthPctStr = ''
  let isGrowthPositive = true
  let isGrowthNoChange = false

  if (prevMonthRevenue === 0) {
    growthPctStr = 'Chưa có dữ liệu tháng trước'
  } else {
    const pct = (diffAmount / prevMonthRevenue) * 100
    isGrowthPositive = pct >= 0
    isGrowthNoChange = pct === 0
    if (isGrowthNoChange) {
      growthPctStr = 'Không thay đổi'
    } else {
      const pctFormatted = pct.toFixed(1).replace('.', ',')
      growthPctStr = `${pct >= 0 ? '+' : ''}${pctFormatted}% so với tháng trước ${pct >= 0 ? '↑' : '↓'}`
    }
  }

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

  // Hiệu ứng "Xin vía" rơi tiền xu/tờ tiền thật
  const [coins, setCoins] = useState([])
  const handleXinVia = () => {
    // Phát âm thanh ting ting bằng AudioContext
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.1, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }
      playTone(987.77, audioCtx.currentTime, 0.08) // Tiếng ting 1
      playTone(1318.51, audioCtx.currentTime + 0.08, 0.25) // Tiếng ting 2
    } catch {}

    // Tạo 40 tờ tiền đô la uốn lượn rơi từ trên xuống
    const newCoins = Array.from({ length: 40 }).map((_, i) => ({
      id: Math.random() + i,
      left: Math.random() * 95 + '%',
      delay: Math.random() * 1.2 + 's',
      duration: (1.5 + Math.random() * 1.5) + 's',
      width: (50 + Math.random() * 40) + 'px',
      rotationStart: Math.random() * 360,
      rotationEnd: Math.random() * 360 + (Math.random() > 0.5 ? 360 : -360)
    }))
    setCoins(prev => [...prev, ...newCoins])
    // Tự dọn dẹp sau khi rơi xong
    setTimeout(() => {
      setCoins(prev => prev.filter(c => !newCoins.includes(c)))
    }, 3200)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Container hiệu ứng rơi tiền uốn lượn */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
        {coins.map(c => (
          <img
            key={c.id}
            src="./dollar.jpg"
            alt="Dollar"
            style={{
              position: 'absolute',
              top: '-60px',
              left: c.left,
              width: c.width,
              height: 'auto',
              borderRadius: '2px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
              transform: `rotate(${c.rotationStart}deg)`,
              animation: `fallAndFlutter ${c.duration} ease-in-out ${c.delay} forwards`,
              userSelect: 'none'
            }}
          />
        ))}
      </div>

      {/* CSS Animation rơi uốn lượn như tờ tiền thật */}
      <style>{`
        @keyframes fallAndFlutter {
          0% {
            top: -60px;
            transform: translateX(0) rotate(0deg) rotateY(0deg);
            opacity: 1;
          }
          25% {
            transform: translateX(25px) rotate(45deg) rotateY(180deg);
          }
          50% {
            transform: translateX(-25px) rotate(-30deg) rotateY(0deg);
          }
          75% {
            transform: translateX(15px) rotate(20deg) rotateY(180deg);
            opacity: 1;
          }
          100% {
            top: 105%;
            transform: translateX(-10px) rotate(-10deg) rotateY(360deg);
            opacity: 0;
          }
        }
        @media (max-width: 900px) {
          .revenue-split-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 24px !important;
          }
          .mom-comparison-panel {
            width: 100% !important;
            box-sizing: border-box;
          }
        }
      `}</style>

      <div className="main-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{greeting}, {profile?.displayName?.split(' ').pop() || 'bạn'} 👋</h2>
          <div className="text-muted text-sm" style={{ marginTop: 2 }}>
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Nút con mèo tài lộc "Xin vía" */}
        <button
          className="btn"
          onClick={handleXinVia}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: '100px',
            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
            cursor: 'pointer',
            transition: 'transform 0.1s, box-shadow 0.1s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1.05)'}
        >
          <img
            src="./lucky_cat.jpg"
            alt="Mèo thần tài"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #fff',
              display: 'inline-block',
              animation: 'waveCat 1.2s infinite ease-in-out'
            }}
          />
          <span>Xin vía 🪙</span>
        </button>

        <style>{`
          @keyframes waveCat {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-15deg); }
          }
        `}</style>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Stat cards */}
        <div className="stat-grid" style={{ gridTemplateColumns: isAdmin ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
          <StatCard
            label="Đơn bán" value={stats?.orders ?? '—'}
            sub={`${stats?.ordersByStatus?.pending ?? 0} chờ xác nhận`}
            icon="🛒" color="var(--warning)"
            onClick={() => setPage('orders')}
          />
          {isAdmin && (
            <StatCard
              label="Doanh thu tháng này" 
              value={loading ? '—' : fmtRevenueLong(currentMonthRevenue)}
              sub={(
                <span style={{ 
                  color: prevMonthRevenue === 0 ? 'var(--text-muted)' : (isGrowthNoChange ? 'var(--text-muted)' : (isGrowthPositive ? '#10B981' : '#EF4444')), 
                  fontWeight: 700 
                }}>
                  {growthPctStr}
                </span>
              )}
              icon="💰" 
              color="#10B981"
            />
          )}
          <StatCard
            label="Tồn kho thấp" value={stats?.lowStock ?? '—'}
            sub="mặt hàng cần nhập thêm" icon="⚠️" color={stats?.lowStock > 0 ? '#EF4444' : '#10B981'}
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

        {/* Monthly Revenue Analytics Card (Admin Only) */}
        {isAdmin && (
          <div className="card" style={{
            marginBottom: 20,
            padding: revenueCollapsed ? '14px 20px' : '24px 28px',
            transition: 'padding 200ms ease-in-out'
          }}>
            {/* Clickable Header for Toggling Collapsed State */}
            <div
              onClick={toggleRevenueCollapsed}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '6px 10px',
                margin: '-6px -10px',
                borderRadius: 6,
                transition: 'background-color 200ms ease-in-out'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: 0, color: '#082B4C', fontSize: 14.5, fontWeight: 900 }}>
                  {revenueCollapsed ? '📈 DOANH THU & LỢI NHUẬN' : 'LỢI NHUẬN THỰC TẾ (LÃI - PHÍ)'}
                </h3>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 800, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {revenueCollapsed ? 'Tháng này' : '6 THÁNG'}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {revenueCollapsed && (
                  <>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#082B4C' }}>
                      {loading ? '—' : fmtRevenueLong(currentMonthRevenue)}
                    </span>
                    {prevMonthRevenue > 0 && (
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: isGrowthNoChange ? '#64748B' : (isGrowthPositive ? '#10B981' : '#EF4444')
                      }}>
                        {isGrowthNoChange ? 'Không đổi' : `${isGrowthPositive ? '↑' : '↓'} ${growthPctStr.split(' ')[0].replace('+', '').replace('-', '')}`}
                      </span>
                    )}
                  </>
                )}
                
                {!revenueCollapsed && (
                  <button
                    className="btn sm"
                    onClick={e => {
                      e.stopPropagation(); // Avoid collapsing when clicking the button
                      setShowExpenseModal(true);
                    }}
                    style={{
                      background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569',
                      fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 4, cursor: 'pointer'
                    }}
                    onMouseOver={el => { el.currentTarget.style.color = '#0878D9'; el.currentTarget.style.borderColor = '#0878D9'; }}
                    onMouseOut={el => { el.currentTarget.style.color = '#475569'; el.currentTarget.style.borderColor = '#E2E8F0'; }}
                  >
                    💸 Quản lý chi phí
                  </button>
                )}
                
                {/* Chevron icon */}
                <span style={{ fontSize: 16, color: '#64748B', fontWeight: 900, marginLeft: 4 }}>
                  {revenueCollapsed ? '⌄' : '⌃'}
                </span>
              </div>
            </div>
            
            {/* Body of the card containing line chart and MoM comparison panel */}
            <div style={{
              maxHeight: revenueCollapsed ? 0 : 500,
              opacity: revenueCollapsed ? 0 : 1,
              overflow: 'hidden',
              transition: 'max-height 250ms ease-in-out, opacity 200ms ease-in-out, margin-top 250ms ease-in-out',
              marginTop: revenueCollapsed ? 0 : 20
            }}>
              <div className="revenue-split-container" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Left Panel: Line Chart */}
                <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
                  <svg width="100%" height="135" viewBox="0 0 500 135" style={{ overflow: 'visible' }}>
                    {/* Grid helper lines */}
                    <line x1="30" y1="65" x2="470" y2="65" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="30" y1="105" x2="470" y2="105" stroke="#E2E8F0" strokeWidth="1.5" />
                    
                    {(() => {
                      const maxVal = Math.max(...monthlyRevenues.map(r => r.revenue), 1)
                      const getScaleY = (val) => 105 - (val / maxVal) * 65
                      const pts = monthlyRevenues.map((r, i) => ({ x: 50 + i * 78, y: getScaleY(r.revenue) }))
                      const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
                      
                      return (
                        <g>
                          {/* Line path */}
                          <path d={pathD} fill="none" stroke="#0878D9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          
                          {/* Interactive dots and tooltips */}
                          {pts.map((p, i) => {
                            const isCurrent = i === 5
                            const isHovered = hoveredIdx === i
                            const showTooltip = isHovered || (hoveredIdx === null && isCurrent)
                            const rev = monthlyRevenues[i].revenue
                            
                            return (
                              <g key={i}>
                                {showTooltip && (
                                  <line x1={p.x} y1={p.y} x2={p.x} y2="105" stroke="#0878D9" strokeWidth="1" strokeDasharray="2 2" />
                                )}
                                
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isCurrent ? 6 : 4}
                                  fill={isCurrent ? '#0878D9' : '#FFFFFF'}
                                  stroke="#0878D9"
                                  strokeWidth={isCurrent ? 2 : 2.5}
                                />
                                
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="20"
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => setHoveredIdx(i)}
                                  onMouseLeave={() => setHoveredIdx(null)}
                                />
                                
                                {showTooltip && (
                                  <g>
                                    <rect
                                      x={isCurrent ? p.x - 92 : p.x - 46}
                                      y={p.y - 28}
                                      width="92"
                                      height="19"
                                      rx="4"
                                      fill="#082B4C"
                                    />
                                    <text
                                      x={isCurrent ? p.x - 46 : p.x}
                                      y={p.y - 15}
                                      textAnchor="middle"
                                      fill="#FFFFFF"
                                      fontSize="9.5"
                                      fontWeight="800"
                                    >
                                      {fmtRevenueLong(rev)}
                                    </text>
                                  </g>
                                )}
                                
                                <text x={p.x} y="122" textAnchor="middle" fill="#64748B" fontSize="10.5" fontWeight="800">
                                  {monthlyRevenues[i].label}
                                </text>
                              </g>
                            )
                          })}
                        </g>
                      )
                    })()}
                  </svg>
                </div>
                
                {/* Right Panel: MoM comparison */}
                <div className="mom-comparison-panel" style={{
                  width: 230, flexShrink: 0, padding: '16px 20px', background: '#F8FAFC',
                  border: '1px solid #E2E8F0', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12
                }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0', paddingBottom: 6 }}>
                    SO SÁNH THÁNG
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase' }}>Tháng này ({months[5]?.label})</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#082B4C', marginTop: 2 }}>{fmtRevenueLong(currentMonthRevenue)}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                      Lãi đơn: {fmtShort(monthlyRevenues[5]?.orderProfit ?? 0)} · Phí: {fmtShort(monthlyRevenues[5]?.expenseAmount ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Tháng trước ({months[4]?.label})</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 2 }}>{fmtRevenueLong(prevMonthRevenue)}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                      Lãi đơn: {fmtShort(monthlyRevenues[4]?.orderProfit ?? 0)} · Phí: {fmtShort(monthlyRevenues[4]?.expenseAmount ?? 0)}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: prevMonthRevenue === 0 ? '#64748B' : (isGrowthNoChange ? '#64748B' : (isGrowthPositive ? '#10B981' : '#EF4444')), textTransform: 'uppercase' }}>
                      {prevMonthRevenue === 0 ? 'SO SÁNH' : (isGrowthNoChange ? 'KHÔNG ĐỔI' : (isGrowthPositive ? 'TĂNG' : 'GIẢM'))}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: prevMonthRevenue === 0 ? '#64748B' : (isGrowthNoChange ? '#64748B' : (isGrowthPositive ? '#10B981' : '#EF4444')), marginTop: 2 }}>
                      {prevMonthRevenue === 0 ? '—' : `${diffAmount >= 0 ? '+' : ''}${fmtRevenueLong(diffAmount)}`}
                    </div>
                    {prevMonthRevenue > 0 && !isGrowthNoChange && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: isGrowthPositive ? '#10B981' : '#EF4444', marginTop: 1 }}>
                        {growthPctStr.split(' ')[0]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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

      {showExpenseModal && (
        <ExpenseTrackerModal
          expenses={expenses}
          onClose={() => setShowExpenseModal(false)}
          user={user}
          toast={toast}
        />
      )}
    </div>
  )
}

function ExpenseTrackerModal({ expenses, onClose, user, toast }) {
  const [expAmount, setExpAmount] = useState('')
  const [expCategory, setExpCategory] = useState('Facebook Ads')
  const [expCustomCategory, setExpCustomCategory] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0])
  const [expNote, setExpNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const parseMoney = v => {
    if (typeof v === 'number') return v
    const digits = String(v || '').replace(/[^\d]/g, '')
    return parseInt(digits, 10) || 0
  }

  const formatMoney = n => {
    return Number(n).toLocaleString('vi-VN') + ' ₫'
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const amountVal = parseMoney(expAmount)
    if (amountVal <= 0) {
      alert('Vui lòng nhập số tiền chi phí hợp lệ!')
      return
    }
    const cat = expCategory === 'Khác' ? expCustomCategory.trim() : expCategory
    if (!cat) {
      alert('Vui lòng nhập hạng mục chi!')
      return
    }
    setIsSubmitting(true)
    try {
      await addExpense({
        amount: amountVal,
        category: cat,
        date: expDate,
        note: expNote.trim(),
        createdBy: user.uid
      })
      toast('Đã thêm chi phí thành công', 'success')
      setExpAmount('')
      setExpNote('')
      setExpCustomCategory('')
    } catch (err) {
      console.error(err)
      toast('Lỗi khi thêm chi phí', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Xóa khoản chi phí này?')) return
    try {
      await deleteExpense(id)
      toast('Đã xóa chi phí', 'success')
    } catch (err) {
      console.error(err)
      toast('Lỗi khi xóa chi phí', 'error')
    }
  }

  // Sort expenses by date desc
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '')
    if (dateComp !== 0) return dateComp
    return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  })

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#082B4C' }}>💸 QUẢN LÝ CHI PHÍ DOANH NGHIỆP</h2>
          <button className="btn ghost sm" onClick={onClose} style={{ padding: 6, fontSize: 16 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', padding: 20, flex: 1 }}>
          {/* Form thêm chi phí */}
          <form onSubmit={handleSave} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ margin: '0 0 4px 0', color: '#082B4C', fontSize: 13, fontWeight: 800 }}>+ GHI NHẬN CHI PHÍ MỚI</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>SỐ TIỀN (VNĐ)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ví dụ: 5.000.000"
                  value={expAmount}
                  onChange={e => {
                    const clean = e.target.value.replace(/[^0-9]/g, '')
                    setExpAmount(clean ? Number(clean).toLocaleString('vi-VN') : '')
                  }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>NGÀY CHI</label>
                <input
                  type="date"
                  className="input"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>HẠNG MỤC</label>
                <select className="input select" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                  <option value="Facebook Ads">Facebook Ads</option>
                  <option value="Google/Tiktok Ads">Google/Tiktok Ads</option>
                  <option value="Vận chuyển">Vận chuyển</option>
                  <option value="Nhân sự">Lương nhân sự</option>
                  <option value="Mặt bằng">Mặt bằng / Điện nước</option>
                  <option value="Khác">Hạng mục khác...</option>
                </select>
              </div>
              {expCategory === 'Khác' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>TÊN HẠNG MỤC MỚI</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Tên chi phí..."
                    value={expCustomCategory}
                    onChange={e => setExpCustomCategory(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>GHI CHÚ / CHI TIẾT</label>
              <input
                type="text"
                className="input"
                placeholder="Ví dụ: Chạy quảng cáo bơm hỏa tiễn tuần 2"
                value={expNote}
                onChange={e => setExpNote(e.target.value)}
              />
            </div>

            <button type="submit" className="btn primary" disabled={isSubmitting} style={{ marginTop: 4, alignSelf: 'flex-start', padding: '8px 16px', fontSize: 12 }}>
              {isSubmitting ? 'Đang lưu...' : '✓ Ghi nhận chi phí'}
            </button>
          </form>

          {/* Danh sách chi phí */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 style={{ margin: 0, color: '#082B4C', fontSize: 13, fontWeight: 800 }}>📋 DANH SÁCH CHI PHÍ ĐÃ GHI NHẬN</h4>
            {sortedExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed #E2E8F0', borderRadius: 8, color: '#64748B', fontSize: 12.5, fontWeight: 650 }}>
                Chưa ghi nhận khoản chi phí nào
              </div>
            ) : (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 800 }}>Ngày</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 800 }}>Hạng mục</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 800 }}>Ghi chú</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 800, textAlign: 'right' }}>Số tiền</th>
                      <th style={{ padding: '8px 12px', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpenses.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                          {(() => {
                            if (!e.date) return '—'
                            const parts = e.date.split('-')
                            return `${parts[2]}/${parts[1]}`
                          })()}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 750, color: '#082B4C' }}>{e.category}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.note}>{e.note || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#EF4444', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          -{formatMoney(e.amount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDelete(e.id)}
                            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}
                            onMouseOver={el => el.currentTarget.style.color = '#EF4444'}
                            onMouseOut={el => el.currentTarget.style.color = '#94A3B8'}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
