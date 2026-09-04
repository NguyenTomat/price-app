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
      const t = o.deliveredAt ?? o.createdAt ?? o.updatedAt
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

  // Hiệu ứng "Xin vía" - Easter Egg tài lộc: Nút -> Gọi vía -> Lì xì -> Bùng lộc -> Chúc mừng -> Biến mất
  const [viaStage, setViaStage] = useState('idle') // 'idle' | 'calling' | 'burst'

  const handleXinVia = () => {
    if (viaStage !== 'idle') return

    // 1. Âm thanh SIUUU huyền thoại
    try {
      const audio = new Audio('/siuuu.mp3')
      audio.currentTime = 0
      audio.volume = 1.0
      audio.play().catch(() => {})
    } catch {}

    // 2. Trạng thái 'calling' (0.0s - 0.4s)
    setViaStage('calling')

    // 3. Trạng thái 'burst' (0.4s - 2.8s)
    setTimeout(() => {
      setViaStage('burst')
    }, 380)

    // 4. Kết thúc và dọn dẹp (2.85s)
    setTimeout(() => {
      setViaStage('idle')
    }, 2850)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: '#F7F8FA' }}>

      {/* Embedded Styles for Easter Egg & Modern Dashboard */}
      <style>{`
        @keyframes viaPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { transform: scale(0.97); box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
        }
        .via-btn-calling {
          animation: viaPulse 0.4s ease-in-out infinite;
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
        }

        /* Phong bao lì xì xuất hiện ngay dưới nút */
        .via-envelope-pop {
          position: absolute;
          top: 42px;
          right: 12px;
          z-index: 1000;
          pointer-events: none;
          animation: envSequence 2.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .via-envelope-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
          color: #FEF08A;
          padding: 6px 14px;
          border-radius: 100px;
          box-shadow: 0 6px 18px rgba(220, 38, 38, 0.4);
          border: 1.5px solid #FDE047;
          font-weight: 750;
          font-size: 12px;
          white-space: nowrap;
        }
        @keyframes envSequence {
          0% { transform: scale(0.5) translateY(-8px); opacity: 0; }
          15% { transform: scale(1.1) translateY(0); opacity: 1; }
          30% { transform: scale(1) translateY(0) rotate(-3deg); opacity: 1; }
          40% { transform: scale(1.05) translateY(0) rotate(3deg); opacity: 1; }
          50% { transform: scale(1) translateY(0) rotate(0deg); opacity: 1; }
          75% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(0.85) translateY(-10px); opacity: 0; }
        }

        /* Punchline Card */
        .via-punchline-card {
          position: absolute;
          top: 86px;
          right: 0;
          z-index: 1001;
          pointer-events: none;
          background: #FFFFFF;
          border: 1px solid #E7EAF0;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
          animation: punchlineFade 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.55s;
          opacity: 0;
        }
        @keyframes punchlineFade {
          0% { transform: translateY(8px) scale(0.95); opacity: 0; }
          15% { transform: translateY(0) scale(1); opacity: 1; }
          80% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-6px) scale(0.96); opacity: 0; }
        }

        /* Tờ tiền bắn ra từ lì xì */
        .burst-item {
          position: absolute;
          top: 50px;
          right: 50px;
          pointer-events: none;
          z-index: 999;
          opacity: 0;
          will-change: transform, opacity;
        }
        .burst-bn {
          width: 56px;
          height: 27px;
          border-radius: 3px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2px 3px;
          box-sizing: border-box;
          color: #FFFFFF;
          font-family: inherit;
        }
        .bn-500k { background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); border: 1px solid #0369a1; }
        .bn-200k { background: linear-gradient(135deg, #dc2626 0%, #f87171 100%); border: 1px solid #b91c1c; }
        .bn-100k { background: linear-gradient(135deg, #059669 0%, #34d399 100%); border: 1px solid #047857; }
        .bn-50k  { background: linear-gradient(135deg, #db2777 0%, #f472b6 100%); border: 1px solid #be185d; }
        .bn-20k  { background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%); border: 1px solid #1d4ed8; }

        .bn-top { display: flex; justify-content: space-between; font-size: 6px; font-weight: 800; line-height: 1; opacity: 0.9; }
        .bn-mid { text-align: center; font-size: 8px; font-weight: 900; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.25); }
        .bn-bot { display: flex; justify-content: space-between; font-size: 5.5px; font-weight: 700; line-height: 1; opacity: 0.85; }

        /* Burst Trajectories */
        @keyframes burstTraj1 {
          0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          20% { transform: translate(-110px, -45px) scale(1) rotate(-15deg); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-150px, 70px) scale(0.9) rotate(-35deg); opacity: 0; }
        }
        @keyframes burstTraj2 {
          0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          20% { transform: translate(-160px, 15px) scale(1) rotate(20deg); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-200px, 120px) scale(0.9) rotate(45deg); opacity: 0; }
        }
        @keyframes burstTraj3 {
          0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          20% { transform: translate(-95px, 60px) scale(1) rotate(-25deg); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-125px, 175px) scale(0.9) rotate(-50deg); opacity: 0; }
        }
        @keyframes burstTraj4 {
          0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          20% { transform: translate(-35px, 75px) scale(1) rotate(15deg); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-45px, 190px) scale(0.9) rotate(30deg); opacity: 0; }
        }
        @keyframes burstTraj5 {
          0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          20% { transform: translate(25px, 60px) scale(1) rotate(-10deg); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(35px, 160px) scale(0.9) rotate(-25deg); opacity: 0; }
        }

        /* Coin Trajectories */
        @keyframes burstCoin1 {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          20% { transform: translate(-70px, -55px) scale(1.1); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-90px, 45px) scale(0.85); opacity: 0; }
        }
        @keyframes burstCoin2 {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          20% { transform: translate(-135px, 50px) scale(1.1); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-165px, 145px) scale(0.85); opacity: 0; }
        }
        @keyframes burstCoin3 {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          20% { transform: translate(-15px, 80px) scale(1.1); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(-20px, 165px) scale(0.85); opacity: 0; }
        }
        @keyframes burstCoin4 {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          20% { transform: translate(35px, 40px) scale(1.1); opacity: 1; }
          75% { opacity: 0.95; }
          100% { transform: translate(45px, 125px) scale(0.85); opacity: 0; }
        }

        /* Sparkles */
        @keyframes burstSparkle1 {
          0% { transform: translate(0, 0) scale(0.2); opacity: 0; }
          40% { transform: translate(-80px, -10px) scale(1.2); opacity: 1; }
          100% { transform: translate(-100px, 15px) scale(0.4); opacity: 0; }
        }
        @keyframes burstSparkle2 {
          0% { transform: translate(0, 0) scale(0.2); opacity: 0; }
          40% { transform: translate(10px, 25px) scale(1.2); opacity: 1; }
          100% { transform: translate(15px, 50px) scale(0.4); opacity: 0; }
        }

        /* Mobile specific adjustments for Xin Vía: prevent left edge clipping */
        @media (max-width: 768px) {
          .via-envelope-pop {
            right: 0;
            top: 40px;
          }
          .via-envelope-badge {
            font-size: 11px;
            padding: 5px 12px;
          }
          .via-punchline-card {
            right: 0;
            top: 76px;
            max-width: calc(100vw - 36px);
            padding: 8px 12px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          }
          .burst-item {
            right: 25px;
            top: 42px;
          }
          @keyframes burstTraj1 {
            0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
            20% { transform: translate(-60px, -30px) scale(0.88) rotate(-15deg); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-80px, 45px) scale(0.8) rotate(-30deg); opacity: 0; }
          }
          @keyframes burstTraj2 {
            0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
            20% { transform: translate(-85px, 10px) scale(0.88) rotate(15deg); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-105px, 70px) scale(0.8) rotate(35deg); opacity: 0; }
          }
          @keyframes burstTraj3 {
            0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
            20% { transform: translate(-50px, 40px) scale(0.88) rotate(-20deg); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-65px, 110px) scale(0.8) rotate(-40deg); opacity: 0; }
          }
          @keyframes burstTraj4 {
            0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
            20% { transform: translate(-20px, 50px) scale(0.88) rotate(10deg); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-25px, 120px) scale(0.8) rotate(20deg); opacity: 0; }
          }
          @keyframes burstTraj5 {
            0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
            20% { transform: translate(10px, 35px) scale(0.88) rotate(-10deg); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(15px, 95px) scale(0.8) rotate(-20deg); opacity: 0; }
          }
          @keyframes burstCoin1 {
            0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
            20% { transform: translate(-45px, -35px) scale(0.95); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-55px, 30px) scale(0.8); opacity: 0; }
          }
          @keyframes burstCoin2 {
            0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
            20% { transform: translate(-75px, 30px) scale(0.95); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-90px, 90px) scale(0.8); opacity: 0; }
          }
          @keyframes burstCoin3 {
            0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
            20% { transform: translate(-10px, 50px) scale(0.95); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(-15px, 110px) scale(0.8); opacity: 0; }
          }
          @keyframes burstCoin4 {
            0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
            20% { transform: translate(20px, 25px) scale(0.95); opacity: 1; }
            75% { opacity: 0.95; }
            100% { transform: translate(25px, 80px) scale(0.8); opacity: 0; }
          }
        }
          justify-content: space-between;
          font-size: 6px;
          font-weight: 700;
          line-height: 1;
          opacity: 0.85;
        }
        .coin-item {
          position: absolute;
          top: -30px;
          font-size: 18px;
          animation: coinFlutter linear forwards;
          opacity: 0;
          will-change: transform, opacity, top;
        }
        .sparkle-item {
          position: absolute;
          font-size: 16px;
          animation: sparkleFade 1.2s ease-out forwards;
          opacity: 0;
        }
        @keyframes banknoteFlutter {
          0% {
            top: -40px;
            opacity: 0;
            transform: translateX(0px) rotate(var(--rot-start)) rotateY(0deg);
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: translateX(var(--drift-mid)) rotate(var(--rot-mid)) rotateY(180deg);
          }
          80% {
            opacity: 0.9;
          }
          100% {
            top: 88vh;
            opacity: 0;
            transform: translateX(var(--drift-end)) rotate(var(--rot-end)) rotateY(360deg);
          }
        }
        @keyframes coinFlutter {
          0% { top: -30px; opacity: 0; transform: translateX(0) rotate(0deg); }
          15% { opacity: 1; }
          80% { opacity: 0.9; }
          100% { top: 85vh; opacity: 0; transform: translateX(var(--drift-end)) rotate(720deg); }
        }
        @keyframes sparkleFade {
          0% { transform: scale(0.3); opacity: 0; }
          40% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.5); opacity: 0; }
        }
        .lucky-toast-card {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10000;
          background: #FFFFFF;
          border: 1px solid #E7EAF0;
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: toastSlideUp 2.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: none;
          min-width: 240px;
        }
        @keyframes toastSlideUp {
          0% { transform: translateY(16px); opacity: 0; }
          12% { transform: translateY(0); opacity: 1; }
          80% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(10px); opacity: 0; }
        }
        .dash-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .dash-max-container {
          max-width: 1420px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .kpi-unified-strip {
          display: grid;
          background: #FFFFFF;
          border: 1px solid #E7EAF0;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          overflow: hidden;
        }
        .kpi-segment {
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 84px;
          box-sizing: border-box;
          transition: background-color 0.1s ease;
        }
        .kpi-segment:not(:last-child) {
          border-right: 1px solid #F1F5F9;
        }
        .kpi-segment-label {
          font-size: 11px;
          font-weight: 600;
          color: #667085;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .kpi-segment-val {
          font-size: 26px;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .kpi-segment-sub {
          font-size: 11.5px;
          color: #667085;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .status-inline-strip {
          background: #FFFFFF;
          border: 1px solid #E7EAF0;
          border-radius: 8px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          min-height: 40px;
          box-sizing: border-box;
        }
        .status-inline-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #344054;
          font-weight: 500;
        }
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .analytics-2col-card {
          background: #FFFFFF;
          border: 1px solid #E7EAF0;
          border-radius: 8px;
          padding: 16px 20px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .analytics-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .analytics-split-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 250px;
          gap: 20px;
          align-items: stretch;
        }
        .chart-left-pane {
          min-width: 0;
          height: 210px;
          position: relative;
        }
        .mom-right-pane {
          width: 250px;
          box-sizing: border-box;
          padding: 12px 14px;
          background: #F8FAFC;
          border: 1px solid #E7EAF0;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
        }
        .table-surface-card {
          background: #FFFFFF;
          border: 1px solid #E7EAF0;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          overflow: hidden;
        }
        .erp-data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .erp-data-table thead th {
          background: #F8FAFC;
          border-bottom: 1px solid #E7EAF0;
          padding: 8px 14px;
          font-size: 10.5px;
          font-weight: 650;
          color: #667085;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .erp-data-table tbody tr {
          border-bottom: 1px solid #F1F5F9;
          height: 44px;
          transition: background-color 0.1s ease;
        }
        .erp-data-table tbody tr:hover {
          background-color: #F8FAFC;
        }
        .erp-data-table tbody td {
          padding: 8px 14px;
          vertical-align: middle;
        }
        @media (max-width: 960px) {
          .analytics-split-layout {
            grid-template-columns: 1fr !important;
          }
          .mom-right-pane {
            width: 100% !important;
          }
        }
        @media (max-width: 768px) {
          .dash-scroll-area {
            padding: 12px 14px;
          }
          .kpi-unified-strip {
            grid-template-columns: 1fr !important;
          }
          .kpi-segment:not(:last-child) {
            border-right: none !important;
            border-bottom: 1px solid #F1F5F9;
          }
          .status-inline-strip {
            gap: 8px;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="main-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 24px',
        minHeight: 52,
        background: '#FFFFFF',
        borderBottom: '1px solid #E7EAF0'
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 650, color: '#101828', margin: 0, letterSpacing: '-0.01em' }}>
            {greeting}, {profile?.displayName?.split(' ').pop() || 'bạn'} 👋
          </h2>
          <div style={{ fontSize: 12, color: '#667085', marginTop: 1 }}>
            Hệ thống quản lý giá & kinh doanh · {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Nút Easter Egg: 🤑 XIN VÍA với Burst Sequence */}
        <div style={{ position: 'relative' }}>
          <button
            className={`btn ${viaStage === 'calling' ? 'via-btn-calling' : ''}`}
            onClick={handleXinVia}
            disabled={viaStage !== 'idle'}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 650,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '100px',
              boxShadow: '0 2px 6px rgba(217, 119, 6, 0.22)',
              cursor: viaStage === 'idle' ? 'pointer' : 'default',
              fontSize: 12.5,
              transition: 'transform 0.1s, box-shadow 0.1s, background 0.2s',
              userSelect: 'none',
              minWidth: 108,
              justifyContent: 'center'
            }}
            onMouseEnter={e => { if (viaStage === 'idle') e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={e => { if (viaStage === 'idle') e.currentTarget.style.transform = 'scale(1)' }}
          >
            {viaStage === 'calling' ? (
              <>
                <span>🔮</span>
                <span>Đang gọi vía...</span>
              </>
            ) : (
              <>
                <span>🤑</span>
                <span>XIN VÍA</span>
              </>
            )}
          </button>

          {/* Phong bao lì xì pop ra ngay dưới nút */}
          {viaStage === 'burst' && (
            <>
              <div className="via-envelope-pop">
                <div className="via-envelope-badge">
                  <span style={{ fontSize: 16 }}>🧧</span>
                  <span>VÍA TÀI LỘC!</span>
                  <span style={{ fontSize: 13 }}>✨</span>
                </div>
              </div>

              {/* Punchline Card */}
              <div className="via-punchline-card">
                <div style={{ fontSize: 20 }}>💰</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#101828' }}>
                    VÍA TÀI LỘC ĐÃ VỀ!
                  </div>
                  <div style={{ fontSize: 11, color: '#667085', marginTop: 1 }}>
                    Chúc tháng này đơn về đều ✨
                  </div>
                </div>
              </div>

              {/* 5 Banknotes burst */}
              <div className="burst-item" style={{ animation: 'burstTraj1 1.6s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.1s' }}>
                <div className="burst-bn bn-500k">
                  <div className="bn-top"><span>VIỆT NAM</span><span>500k</span></div>
                  <div className="bn-mid">500.000 ₫</div>
                  <div className="bn-bot"><span>★ NHNN</span><span>500k</span></div>
                </div>
              </div>
              <div className="burst-item" style={{ animation: 'burstTraj2 1.6s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.12s' }}>
                <div className="burst-bn bn-200k">
                  <div className="bn-top"><span>VIỆT NAM</span><span>200k</span></div>
                  <div className="bn-mid">200.000 ₫</div>
                  <div className="bn-bot"><span>★ NHNN</span><span>200k</span></div>
                </div>
              </div>
              <div className="burst-item" style={{ animation: 'burstTraj3 1.6s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.14s' }}>
                <div className="burst-bn bn-100k">
                  <div className="bn-top"><span>VIỆT NAM</span><span>100k</span></div>
                  <div className="bn-mid">100.000 ₫</div>
                  <div className="bn-bot"><span>★ NHNN</span><span>100k</span></div>
                </div>
              </div>
              <div className="burst-item" style={{ animation: 'burstTraj4 1.6s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.16s' }}>
                <div className="burst-bn bn-50k">
                  <div className="bn-top"><span>VIỆT NAM</span><span>50k</span></div>
                  <div className="bn-mid">50.000 ₫</div>
                  <div className="bn-bot"><span>★ NHNN</span><span>50k</span></div>
                </div>
              </div>
              <div className="burst-item" style={{ animation: 'burstTraj5 1.6s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.18s' }}>
                <div className="burst-bn bn-20k">
                  <div className="bn-top"><span>VIỆT NAM</span><span>20k</span></div>
                  <div className="bn-mid">20.000 ₫</div>
                  <div className="bn-bot"><span>★ NHNN</span><span>20k</span></div>
                </div>
              </div>

              {/* 4 Coins */}
              <div className="burst-item" style={{ fontSize: 18, animation: 'burstCoin1 1.5s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.08s' }}>
                🪙
              </div>
              <div className="burst-item" style={{ fontSize: 18, animation: 'burstCoin2 1.5s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.12s' }}>
                🪙
              </div>
              <div className="burst-item" style={{ fontSize: 18, animation: 'burstCoin3 1.5s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.15s' }}>
                🪙
              </div>
              <div className="burst-item" style={{ fontSize: 18, animation: 'burstCoin4 1.5s cubic-bezier(0.12, 0.9, 0.3, 1) forwards', animationDelay: '0.18s' }}>
                🪙
              </div>

              {/* 2 Sparkles */}
              <div className="burst-item" style={{ fontSize: 16, animation: 'burstSparkle1 1.2s ease-out forwards', animationDelay: '0.1s' }}>
                ✨
              </div>
              <div className="burst-item" style={{ fontSize: 16, animation: 'burstSparkle2 1.2s ease-out forwards', animationDelay: '0.14s' }}>
                ✨
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area (Max-Width 1420px centered) */}
      <div className="dash-scroll-area">
        <div className="dash-max-container">

          {/* 1. KPI STRIP (Unified Data Strip) */}
          <div className="kpi-unified-strip" style={{ gridTemplateColumns: isAdmin ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
            {/* Segment 1: ĐƠN BÁN */}
            <div
              className="kpi-segment"
              onClick={() => setPage('orders')}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div>
                <div className="kpi-segment-label">
                  <span>ĐƠN BÁN</span>
                </div>
                <div className="kpi-segment-val" style={{ color: '#101828' }}>
                  {loading ? '—' : (stats?.orders ?? '—')}
                </div>
              </div>
              <div className="kpi-segment-sub">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
                <span><strong style={{ color: '#B45309' }}>{stats?.ordersByStatus?.pending ?? 0}</strong> đơn chờ xác nhận</span>
              </div>
            </div>

            {/* Segment 2: DOANH THU THÁNG NÀY (Hero Metric) */}
            {isAdmin && (
              <div className="kpi-segment" style={{ background: '#FAFAFC' }}>
                <div>
                  <div className="kpi-segment-label">
                    <span style={{ color: '#101828', fontWeight: 650 }}>DOANH THU THÁNG NÀY</span>
                  </div>
                  <div
                    className="kpi-segment-val"
                    style={{
                      color: loading ? '#101828' : (currentMonthRevenue < 0 ? '#EF4444' : '#16A34A')
                    }}
                  >
                    {loading ? '—' : fmtRevenueLong(currentMonthRevenue)}
                  </div>
                </div>
                <div className="kpi-segment-sub">
                  <span style={{
                    color: prevMonthRevenue === 0 ? '#667085' : (isGrowthNoChange ? '#667085' : (isGrowthPositive ? '#16A34A' : '#EF4444')),
                    fontWeight: 650
                  }}>
                    {growthPctStr}
                  </span>
                </div>
              </div>
            )}

            {/* Segment 3: TỒN KHO THẤP */}
            <div
              className="kpi-segment"
              onClick={() => setPage('inventory')}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div>
                <div className="kpi-segment-label">
                  <span>CẢNH BÁO TỒN KHO</span>
                </div>
                <div
                  className="kpi-segment-val"
                  style={{ color: (stats?.lowStock > 0 ? '#EF4444' : '#16A34A') }}
                >
                  {loading ? '—' : (stats?.lowStock ?? '—')}
                </div>
              </div>
              <div className="kpi-segment-sub">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stats?.lowStock > 0 ? '#EF4444' : '#16A34A' }} />
                <span>{stats?.lowStock > 0 ? `${stats.lowStock} mặt hàng cần nhập thêm` : 'Tất cả mức tồn an toàn'}</span>
              </div>
            </div>
          </div>

          {/* 2. ORDER STATUS (Sleek Horizontal Status Bar) */}
          {stats?.ordersByStatus && (
            <div className="status-inline-strip">
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TRẠNG THÁI ĐƠN
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div className="status-inline-item">
                  <span className="status-dot" style={{ background: '#F59E0B' }} />
                  <span>Chờ xác nhận: <strong>{stats.ordersByStatus.pending ?? 0}</strong></span>
                </div>
                <span style={{ color: '#E2E8F0' }}>·</span>
                <div className="status-inline-item">
                  <span className="status-dot" style={{ background: '#2563EB' }} />
                  <span>Đã xác nhận: <strong>{stats.ordersByStatus.confirmed ?? 0}</strong></span>
                </div>
                <span style={{ color: '#E2E8F0' }}>·</span>
                <div className="status-inline-item">
                  <span className="status-dot" style={{ background: '#16A34A' }} />
                  <span>Đã giao: <strong>{stats.ordersByStatus.delivered ?? 0}</strong></span>
                </div>
                <span style={{ color: '#E2E8F0' }}>·</span>
                <div className="status-inline-item">
                  <span className="status-dot" style={{ background: '#94A3B8' }} />
                  <span>Đã hủy: <strong>{stats.ordersByStatus.cancelled ?? 0}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* 3. MAIN ANALYTICS: 2-COLUMN LAYOUT (Chart ~75% + MoM ~25%) */}
          {isAdmin && (
            <div className="analytics-2col-card">
              {/* Top Bar */}
              <div className="analytics-topbar">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 650, color: '#101828', margin: 0 }}>
                    LỢI NHUẬN THỰC TẾ (LÃI - PHÍ)
                  </h3>
                  <span style={{ fontSize: 11, color: '#667085', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    6 THÁNG
                  </span>
                </div>

                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowExpenseModal(true)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E7EAF0',
                    color: '#344054',
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  onMouseOver={el => { el.currentTarget.style.color = '#2563EB'; el.currentTarget.style.borderColor = '#2563EB'; }}
                  onMouseOut={el => { el.currentTarget.style.color = '#344054'; el.currentTarget.style.borderColor = '#E7EAF0'; }}
                >
                  💸 Quản lý chi phí
                </button>
              </div>

              {/* 2-Column Split */}
              <div className="analytics-split-layout">
                {/* Left Pane: SVG Chart */}
                <div className="chart-left-pane">
                  <svg width="100%" height="100%" viewBox="0 0 700 200" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {(() => {
                      const revenues = monthlyRevenues.map(r => r.revenue)
                      const rawMax = Math.max(...revenues, 0)
                      const rawMin = Math.min(...revenues, 0)
                      
                      const domainPadding = Math.max((rawMax - rawMin) * 0.15, 1000000)
                      const domainMax = rawMax + domainPadding
                      const domainMin = rawMin - domainPadding
                      const domainRange = domainMax - domainMin || 1

                      const topY = 20
                      const bottomY = 165
                      const heightY = bottomY - topY

                      const getY = (val) => bottomY - ((val - domainMin) / domainRange) * heightY
                      const zeroY = getY(0)

                      const leftX = 55
                      const rightX = 665
                      const stepX = (rightX - leftX) / 5

                      const pts = monthlyRevenues.map((r, i) => ({
                        x: leftX + i * stepX,
                        y: getY(r.revenue),
                        rev: r.revenue,
                        label: r.label
                      }))

                      const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')

                      return (
                        <g>
                          {/* Top subtle gridline */}
                          <line x1="45" y1={topY + 10} x2={rightX + 15} y2={topY + 10} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <text x="38" y={topY + 14} textAnchor="end" fontSize="9.5" fontWeight="600" fill="#94A3B8">
                            {fmtShort(domainMax * 0.85)}
                          </text>

                          {/* Zero baseline */}
                          <line x1="45" y1={zeroY} x2={rightX + 15} y2={zeroY} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
                          <text x="38" y={zeroY + 3.5} textAnchor="end" fontSize="9.5" fontWeight="650" fill="#64748B">
                            0 ₫
                          </text>

                          {/* Area under curve */}
                          <path
                            d={`${pathD} L ${pts[5].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`}
                            fill="url(#chartFillGrad)"
                          />

                          {/* Main line */}
                          <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Points and Tooltips */}
                          {pts.map((p, i) => {
                            const isCurrent = i === 5
                            const isHovered = hoveredIdx === i
                            const showTooltip = isHovered || (hoveredIdx === null && isCurrent)

                            return (
                              <g key={i}>
                                <line x1={p.x} y1={p.y} x2={p.x} y2={bottomY} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" opacity={showTooltip ? 0.8 : 0.25} />

                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isCurrent ? 4.5 : 3}
                                  fill={isCurrent ? '#2563EB' : '#FFFFFF'}
                                  stroke="#2563EB"
                                  strokeWidth={isCurrent ? 2 : 1.8}
                                />

                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="24"
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => setHoveredIdx(i)}
                                  onMouseLeave={() => setHoveredIdx(null)}
                                />

                                {showTooltip && (
                                  <g>
                                    <rect
                                      x={isCurrent ? p.x - 90 : (i === 0 ? p.x - 6 : p.x - 48)}
                                      y={p.y - 28}
                                      width="96"
                                      height="20"
                                      rx="4"
                                      fill="#101828"
                                    />
                                    <text
                                      x={isCurrent ? p.x - 42 : (i === 0 ? p.x + 42 : p.x)}
                                      y={p.y - 14}
                                      textAnchor="middle"
                                      fill="#FFFFFF"
                                      fontSize="10"
                                      fontWeight="650"
                                    >
                                      {fmtRevenueLong(p.rev)}
                                    </text>
                                  </g>
                                )}

                                <text x={p.x} y={bottomY + 18} textAnchor="middle" fill={isCurrent ? '#101828' : '#667085'} fontSize="11" fontWeight={isCurrent ? '700' : '600'}>
                                  {p.label}
                                </text>
                              </g>
                            )
                          })}
                        </g>
                      )
                    })()}
                  </svg>
                </div>

                {/* Right Pane: Compact MoM Summary Box */}
                <div className="mom-right-pane">
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#667085', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #E7EAF0', paddingBottom: 5 }}>
                    SO SÁNH THÁNG
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>
                      THÁNG NÀY ({months[5]?.label})
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: currentMonthRevenue < 0 ? '#EF4444' : '#101828', marginTop: 1 }}>
                      {fmtRevenueLong(currentMonthRevenue)}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#667085', marginTop: 1 }}>
                      Lãi dòng: {fmtShort(monthlyRevenues[5]?.orderProfit ?? 0)} · Phí: {fmtShort(monthlyRevenues[5]?.expenseAmount ?? 0)}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E7EAF0', paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>
                      THÁNG TRƯỚC ({months[4]?.label})
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#344054', marginTop: 1 }}>
                      {fmtRevenueLong(prevMonthRevenue)}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#667085', marginTop: 1 }}>
                      Lãi dòng: {fmtShort(monthlyRevenues[4]?.orderProfit ?? 0)} · Phí: {fmtShort(monthlyRevenues[4]?.expenseAmount ?? 0)}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E7EAF0', paddingTop: 6 }}>
                    <div style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: prevMonthRevenue === 0 ? '#667085' : (isGrowthNoChange ? '#667085' : (isGrowthPositive ? '#16A34A' : '#EF4444')),
                      textTransform: 'uppercase'
                    }}>
                      {prevMonthRevenue === 0 ? 'SO SÁNH' : (isGrowthNoChange ? 'KHÔNG ĐỔI' : (isGrowthPositive ? 'TĂNG' : 'GIẢM'))}
                    </div>
                    <div style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: prevMonthRevenue === 0 ? '#667085' : (isGrowthNoChange ? '#667085' : (isGrowthPositive ? '#16A34A' : '#EF4444')),
                      marginTop: 1
                    }}>
                      {prevMonthRevenue === 0 ? '—' : `${diffAmount >= 0 ? '+' : ''}${fmtRevenueLong(diffAmount)}`}
                    </div>
                    {prevMonthRevenue > 0 && !isGrowthNoChange && (
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isGrowthPositive ? '#16A34A' : '#EF4444',
                        marginTop: 1
                      }}>
                        {growthPctStr.split(' ')[0]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. RECENT ORDERS TABLE */}
          <div className="table-surface-card">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderBottom: '1px solid #E7EAF0'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 650, color: '#101828', margin: 0 }}>
                Đơn hàng gần đây
              </h3>
              <button
                className="btn ghost sm"
                onClick={() => setPage('orders')}
                style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', padding: '2px 6px' }}
              >
                Xem tất cả →
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <div className="empty" style={{ padding: '28px 0', textAlign: 'center', color: '#667085' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>🛒</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Chưa có đơn hàng nào</div>
                <div style={{ fontSize: 12, color: '#98A2B3', marginTop: 2 }}>Đơn bán mới sẽ xuất hiện tại đây</div>
              </div>
            ) : (
              <MobileTableWrap>
                <table className="erp-data-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Chi tiết sản phẩm</th>
                      <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map(o => {
                      const st = STATUS_LABELS[o.status] || { label: o.status, cls: '' }
                      const dotColor = o.status === 'delivered' ? '#16A34A' : o.status === 'pending' ? '#F59E0B' : o.status === 'confirmed' ? '#2563EB' : '#94A3B8'
                      return (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600, color: '#101828' }}>
                            {o.userName || o.uid?.slice(0, 8) || '—'}
                          </td>
                          <td style={{ color: '#667085' }}>
                            <span style={{ fontWeight: 500, color: '#344054' }}>{o.items?.length ?? 0} mặt hàng</span>
                            {o.items?.[0] ? ` · ${o.items[0].name}` : ''}
                            {o.items?.length > 1 ? ` +${o.items.length - 1}` : ''}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#101828', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(o.total)}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: '100px',
                              background: '#F1F5F9',
                              color: '#344054'
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
                              {st.label}
                            </span>
                          </td>
                          <td style={{ color: '#667085', fontSize: 12 }}>
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

          {/* 5. QUICK ACTIONS TOOLBAR */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <button className="btn primary sm" onClick={() => setPage('my-prices')} style={{ fontSize: 12.5, fontWeight: 600 }}>
              ⭐ Tính giá của tôi
            </button>
            <button className="btn sm" onClick={() => setPage('orders')} style={{ fontSize: 12.5, fontWeight: 500, background: '#FFFFFF' }}>
              🛒 Tạo đơn bán
            </button>
            {isAdmin && (
              <button className="btn sm" onClick={() => setPage('admin-import')} style={{ fontSize: 12.5, fontWeight: 500, background: '#FFFFFF' }}>
                📥 Import bảng giá
              </button>
            )}
            <button className="btn sm" onClick={() => setPage('inventory')} style={{ fontSize: 12.5, fontWeight: 500, background: '#FFFFFF' }}>
              📦 Quản lý tồn kho
            </button>
          </div>
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
