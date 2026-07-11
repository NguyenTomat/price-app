import { useState, useEffect, useMemo } from 'react'
import { subscribeOrders } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import MobileTableWrap from '../components/MobileTableWrap'

const fmt  = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'
const fmtM = n => {
  if (n == null || isNaN(Number(n))) return '—'
  const v = Number(n)
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' tr'
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return v.toLocaleString('vi-VN')
}

const NOW = new Date()

export default function RevenuePage() {
  const { user } = useAuth()

  const [orders, setOrders]           = useState([])
  const [filterMonth, setFilterMonth] = useState(NOW.getMonth() + 1)
  const [filterYear,  setFilterYear]  = useState(NOW.getFullYear())
  const [detailOrder, setDetailOrder] = useState(null)

  // Chỉ subscribe đơn của chính user này (private — admin cũng chỉ xem đơn của mình)
  useEffect(() => {
    const unsub = subscribeOrders(setOrders, { uid: user.uid })
    return unsub
  }, [user.uid])

  // Chỉ lấy đơn đã giao
  const delivered = useMemo(() =>
    orders.filter(o => o.status === 'delivered'), [orders])

  // Lọc theo tháng/năm
  const filtered = useMemo(() => {
    return delivered.filter(o => {
      const d = o.createdAt?.toDate?.()
      if (!d) return false
      return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear
    })
  }, [delivered, filterMonth, filterYear])

  // Tổng hợp tháng
  const stats = useMemo(() => {
    const revenue        = filtered.reduce((s, o) => s + (o.grandTotal ?? o.total ?? 0), 0)
    const listPriceTotal = filtered.reduce((s, o) => s + (o.listPriceTotal ?? 0), 0)
    const listProfit     = filtered.reduce((s, o) => s + (o.listPriceProfit ?? 0), 0)
    const recProfit      = filtered.reduce((s, o) => s + (o.recommendedProfit ?? 0), 0)
    const hasListPrice   = filtered.some(o => o.listPriceTotal > 0)
    return { revenue, listPriceTotal, listProfit, recProfit, hasListPrice, count: filtered.length }
  }, [filtered])

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years  = Array.from({ length: 5  }, (_, i) => NOW.getFullYear() - i)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ flex: 1 }}>💹 Doanh Thu của tôi</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input select" style={{ width: 110 }} value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
          <select className="input select" style={{ width: 90 }} value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* ── Thẻ thống kê tháng ── */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Số đơn đã giao</div>
            <div className="stat-value">{stats.count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Doanh thu (khách trả)</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--accent)' }}>{fmtM(stats.revenue)}</div>
          </div>
          {stats.hasListPrice && (
            <>
              <div className="stat-card">
                <div className="stat-label">Tổng giá bảng</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmtM(stats.listPriceTotal)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Lãi (so giá bảng)</div>
                <div className="stat-value" style={{ fontSize: 20, color: stats.listProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {stats.listProfit >= 0 ? '+' : ''}{fmtM(stats.listProfit)}
                </div>
              </div>
            </>
          )}
          <div className="stat-card">
            <div className="stat-label">LN (giá vốn chênh)</div>
            <div className="stat-value" style={{ fontSize: 18, color: stats.recProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {stats.recProfit >= 0 ? '+' : ''}{fmtM(stats.recProfit)}
            </div>
          </div>
        </div>

        {/* ── Bảng chi tiết đơn ── */}
        <div className="card">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ flex: 1 }}>Đơn đã giao — Tháng {filterMonth}/{filterYear}</h3>
            <span className="text-muted text-sm">{stats.count} đơn</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div>Chưa có đơn đã giao trong tháng này</div>
              <div className="text-muted text-sm" style={{ marginTop: 4 }}>
                Tổng tất cả: {delivered.length} đơn đã giao
              </div>
            </div>
          ) : (
            <MobileTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Khách hàng</th>
                    <th>Sản phẩm</th>
                    <th style={{ textAlign: 'right' }}>Khách trả</th>
                    <th style={{ textAlign: 'right' }}>Giá bảng</th>
                    <th style={{ textAlign: 'right' }}>Lãi (bảng giá)</th>
                    <th style={{ textAlign: 'right' }}>LN (giá vốn)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const lp       = o.listPriceTotal
                    const lpProfit = o.listPriceProfit
                    const recP     = o.recommendedProfit
                    return (
                      <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setDetailOrder(o)}>
                        <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                          {o.createdAt?.toDate?.() ? o.createdAt.toDate().toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ fontWeight: 500 }}>{o.userName || '—'}</td>
                        <td className="td-mono text-sm">
                          {o.items?.length ?? 0} SP{o.items?.[0] ? ` · ${o.items[0].name?.slice(0, 28)}` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                          {fmt(o.grandTotal ?? o.total)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text2)' }}>
                          {lp > 0 ? fmt(lp) : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: lpProfit != null ? (lpProfit >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text2)' }}>
                          {lpProfit != null ? (lpProfit >= 0 ? '+' : '') + fmt(lpProfit) : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: recP != null ? (recP >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text2)' }}>
                          {recP != null ? (recP >= 0 ? '+' : '') + fmt(recP) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text2)', fontSize: 12, paddingRight: 8 }}>
                      Tổng tháng {filterMonth}/{filterYear}:
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(stats.revenue)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>
                      {stats.listPriceTotal > 0 ? fmt(stats.listPriceTotal) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: stats.listProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {stats.hasListPrice ? (stats.listProfit >= 0 ? '+' : '') + fmt(stats.listProfit) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: stats.recProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {(stats.recProfit >= 0 ? '+' : '') + fmt(stats.recProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </MobileTableWrap>
          )}
        </div>

        {orders.filter(o => o.status !== 'delivered').length > 0 && (
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
            Ngoài ra bạn còn {orders.filter(o => o.status === 'pending').length} đơn chờ xác nhận,{' '}
            {orders.filter(o => o.status === 'confirmed').length} đơn đã xác nhận.
          </div>
        )}
      </div>

      {/* Modal chi tiết đơn */}
      {detailOrder && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setDetailOrder(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h2>Chi tiết đơn</h2>
                <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                  {detailOrder.userName} · {detailOrder.createdAt?.toDate?.()?.toLocaleDateString('vi-VN')}
                </div>
              </div>
              <button className="btn ghost sm" onClick={() => setDetailOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              <MobileTableWrap style={{ marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th style={{ textAlign: 'center' }}>SL</th>
                      <th style={{ textAlign: 'right' }}>Giá bán</th>
                      <th style={{ textAlign: 'right' }}>Giá bảng</th>
                      <th style={{ textAlign: 'right' }}>Lãi/dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailOrder.items || []).map((item, i) => {
                      const lp = item.listPrice
                      const profitLine = lp > 0 ? (item.sellPrice - lp) * (item.qty ?? 1) : null
                      return (
                        <tr key={i}>
                          <td className="td-mono" style={{ fontSize: 12 }}>{item.name}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(item.sellPrice)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text2)' }}>
                            {lp > 0 ? fmt(lp) : '—'}
                          </td>
                          <td style={{
                            textAlign: 'right', fontWeight: 600,
                            color: profitLine != null ? (profitLine >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text2)'
                          }}>
                            {profitLine != null ? (profitLine >= 0 ? '+' : '') + fmt(profitLine) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </MobileTableWrap>

              <div className="calc-result">
                {[
                  ['Tiền hàng', fmt(detailOrder.total)],
                  detailOrder.vatAmount > 0 ? [`VAT ${detailOrder.vatPct}%`, fmt(detailOrder.vatAmount)] : null,
                  detailOrder.shipping > 0 ? ['Phí vận chuyển', fmt(detailOrder.shipping)] : null,
                  ['Khách trả', fmt(detailOrder.grandTotal ?? detailOrder.total)],
                  detailOrder.listPriceTotal > 0 ? ['Tổng giá bảng', fmt(detailOrder.listPriceTotal)] : null,
                  detailOrder.listPriceProfit != null
                    ? ['Lãi (bảng giá)', (detailOrder.listPriceProfit >= 0 ? '+' : '') + fmt(detailOrder.listPriceProfit)]
                    : null,
                  detailOrder.recommendedProfit != null
                    ? ['LN (giá vốn chênh)', (detailOrder.recommendedProfit >= 0 ? '+' : '') + fmt(detailOrder.recommendedProfit)]
                    : null,
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="cr-row">
                    <span className="cr-label">{label}</span>
                    <span style={{
                      fontWeight: label.startsWith('Lãi') || label.startsWith('LN') || label === 'Khách trả' ? 700 : 500,
                      color: label === 'Khách trả' ? 'var(--accent)'
                           : label.startsWith('Lãi') || label.startsWith('LN') ? 'var(--success)' : ''
                    }}>{val}</span>
                  </div>
                ))}
              </div>
              {detailOrder.note && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)' }}>📝 {detailOrder.note}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDetailOrder(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
