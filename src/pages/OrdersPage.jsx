import { useState, useEffect, useMemo } from 'react'
import { subscribeOrders, createOrder, updateOrderStatus, deleteOrder, subscribeCostPrices } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { calcOrderLine, calcShippingChenhExtra, CHENH_TIER_LABELS } from '../utils/orderCalc'
import { exportQuoteExcel } from '../utils/quoteExport'
import { parseMoney } from '../utils/moneyFormat'
import MoneyInput from '../components/MoneyInput'

const fmt  = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'
const fmtN = n => (n != null && !isNaN(Number(n))) ? Number(n).toLocaleString('vi-VN') : '0'

const STATUS = {
  pending:   { label: 'Chờ xác nhận', cls: 'pending',   next: 'confirmed' },
  confirmed: { label: 'Đã xác nhận',  cls: 'confirmed', next: 'delivered' },
  delivered: { label: 'Đã giao',      cls: 'delivered', next: null },
  cancelled: { label: 'Đã hủy',       cls: 'cancelled', next: null },
}

const emptyLine = (costItem = null) => ({
  key: Date.now() + Math.random(),
  costId: costItem?.id || '',
  name: costItem?.name || '',
  qty: 1,
  sellPrice: '',
})

// ── Chi tiết đơn ────────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose }) {
  const st = STATUS[order.status] || { label: order.status, cls: '' }
  const shipping          = order.shipping ?? 0
  const vatAmount         = order.vatAmount ?? 0
  const grandTotal        = order.grandTotal ?? order.total ?? 0
  const itemsTotal        = order.total ?? 0
  const totalCost         = order.totalCost ?? order.items?.reduce((s, i) => s + (Number(i.costPrice) || Number(i.price) || 0) * (i.qty ?? 1), 0) ?? 0
  const profit            = order.profit ?? null
  const recommendedProfit = order.recommendedProfit ?? null

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h2>Chi tiết đơn hàng</h2>
            <div className="text-sm text-muted" style={{ marginTop: 2 }}>
              {order.userName} · <span className={`order-status ${st.cls}`}>{st.label}</span>
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th style={{ textAlign: 'center' }}>SL</th>
                  <th style={{ textAlign: 'right' }}>Giá bán</th>
                  <th style={{ textAlign: 'right' }}>Giá gốc</th>
                  <th style={{ textAlign: 'right' }}>Chênh</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>
                      <div style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{item.name}</div>
                      {item.costCode && <div className="text-muted" style={{ fontSize: 10 }}>{item.costCode}</div>}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(item.sellPrice ?? item.myPrice)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(item.costPrice ?? item.price)}</td>
                    <td style={{ textAlign: 'right', fontSize: 11 }}>
                      {item.rawChenh != null ? (
                        <>
                          <div>{fmt(item.rawChenh)}</div>
                          {item.chenhPct > 0 && <div className="text-muted">{item.chenhPct}% → {fmt(item.chenhApplied)}</div>}
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="calc-result" style={{ marginBottom: 16 }}>
            {[
              ['Tiền hàng (giá bán)', fmt(itemsTotal), ''],
              order.vatPct > 0 ? [`+ VAT ${order.vatPct}%`, fmt(vatAmount), 'var(--text2)'] : null,
              shipping > 0 ? [`+ Phí VC ${order.shippingHasVat ? '(có VAT)' : '(không VAT)'}`, fmt(shipping), 'var(--text2)'] : null,
              order.shippingPaidBy === 'company' ? ['  └ VC mình trả', fmt(shipping), 'var(--warning)'] : null,
              order.shippingChenhExtra > 0 ? [`  └ Chênh thêm VC 20%`, fmt(order.shippingChenhExtra), 'var(--warning)'] : null,
              ['Tổng khách trả', fmt(grandTotal), 'var(--accent)'],
            ].filter(Boolean).map(([label, val, color]) => (
              <div key={label} className="cr-row">
                <span className="cr-label">{label}</span>
                <span style={color ? { color, fontWeight: label === 'Tổng khách trả' ? 700 : 500 } : {}}>{val}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>📊 Phân tích</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {[
                { label: 'Tổng giá gốc', value: fmt(totalCost) },
                { label: 'Chênh lệch gốc', value: fmt(order.rawChenhTotal) },
                { label: 'Chênh áp dụng', value: fmt(order.chenhAppliedTotal) },
                profit != null
                  ? { label: 'Lợi nhuận (tự nhập)', value: fmt(profit), color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }
                  : { label: 'Lợi nhuận', value: '—', color: 'var(--text2)' },
                recommendedProfit != null
                  ? { label: 'Gợi ý LN', value: (recommendedProfit >= 0 ? '+' : '') + fmt(recommendedProfit), color: recommendedProfit >= 0 ? 'var(--success)' : 'var(--danger)' }
                  : null,
              ].filter(Boolean).map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--mono)' }}>{value}</div>
                </div>
              ))}
            </div>
            {order.note && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>📝 {order.note}</div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

// ── Dòng sản phẩm (compact) ─────────────────────────────────────────────────
function OrderLineRow({ line, costPrices, onChange, onRemove, canRemove, includeVat }) {
  const cost = costPrices.find(c => c.id === line.costId)
  const sell = parseMoney(line.sellPrice)
  const calc = calcOrderLine({ sellPrice: sell, costPrice: cost?.avgPrice ?? 0, qty: line.qty, includeVat })

  const [query, setQuery] = useState(cost ? cost.code : '')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return costPrices.slice(0, 25)
    return costPrices.filter(c =>
      (c.code || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q)
    ).slice(0, 25)
  }, [costPrices, query])

  const pick = (item) => {
    onChange({ ...line, costId: item.id, name: item.name || line.name })
    setQuery(item.code || '')
    setOpen(false)
  }

  return (
    <div className="order-line">
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          style={{ padding: '6px 8px', fontSize: 12 }}
          value={query}
          placeholder="Mã giá gốc..."
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange({ ...line, costId: '' }) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && (
          <div className="order-cost-dropdown">
            {filtered.map(item => (
              <div
                key={item.id}
                onMouseDown={() => pick(item)}
                style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <span style={{ fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{item.code}</span>
                <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{fmt(item.avgPrice)}</span>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: 8, color: 'var(--text2)', fontSize: 11 }}>Không tìm thấy</div>}
          </div>
        )}
      </div>

      <input
        className="input"
        style={{ padding: '6px 8px', fontSize: 12 }}
        value={line.name}
        onChange={e => onChange({ ...line, name: e.target.value })}
        placeholder="Tên / mô tả SP"
      />

      <MoneyInput
        value={line.sellPrice}
        onChange={v => onChange({ ...line, sellPrice: v })}
        placeholder="Giá bán"
        style={{ padding: '6px 8px', fontSize: 12 }}
      />

      <input
        className="input"
        type="number"
        min="1"
        style={{ padding: '6px 8px', fontSize: 12, textAlign: 'center' }}
        value={line.qty}
        onChange={e => onChange({ ...line, qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
      />

      <div className="order-line-total">
        {sell > 0 ? fmt(calc.sellTotal) : '—'}
      </div>

      {canRemove ? (
        <button type="button" className="btn xs ghost" style={{ color: 'var(--danger)', padding: '4px 6px' }} onClick={onRemove} title="Xóa dòng">✕</button>
      ) : <span />}

      {(cost || sell > 0) && (
        <div className="order-line-meta">
          {cost && <span>Gốc: <strong>{fmt(cost.avgPrice)}</strong></span>}
          {sell > 0 && cost && (
            <>
              <span>Chênh: <strong>{fmt(calc.rawChenh)}</strong></span>
              {includeVat && calc.chenhPct > 0 && (
                <span style={{ color: 'var(--success)' }}>Bậc {calc.chenhPct}%: <strong>{fmt(calc.chenhApplied)}</strong></span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Quick select nhiều SP từ danh sách ──────────────────────────────────────
function QuickSelectPanel({ costPrices, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return costPrices.filter(c =>
      !q || (c.code || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)
    )
  }, [costPrices, search])

  const toggle = (id) => setSelected(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const confirm = () => {
    const items = costPrices.filter(c => selected.has(c.id))
    onAdd(items)
    onClose()
  }

  return (
    <div style={{ border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', flex: 1 }}>
          Chọn nhanh từ danh sách giá vốn {selected.size > 0 && `(${selected.size} đã chọn)`}
        </span>
        <input className="input" style={{ width: 200 }} placeholder="Tìm mã, tên..." value={search} onChange={e => setSearch(e.target.value)} autoFocus/>
        <button className="btn sm primary" onClick={confirm} disabled={!selected.size}>✓ Thêm {selected.size > 0 ? selected.size : ''} SP</button>
        <button className="btn sm" onClick={onClose}>✕</button>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {filtered.map(item => {
          const checked = selected.has(item.id)
          return (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
                background: checked ? 'var(--accent-s)' : '',
              }}
              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!checked) e.currentTarget.style.background = '' }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                background: checked ? 'var(--accent)' : '',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: 12 }}>{item.code}</span>
                <span style={{ color: 'var(--text2)', marginLeft: 8, fontSize: 12 }}>{item.name?.slice(0, 50)}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{fmt(item.avgPrice)}</div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ padding: '20px 12px', color: 'var(--text2)', fontSize: 12 }}>Không tìm thấy</div>}
      </div>
    </div>
  )
}

// ── Section helper ───────────────────────────────────────────────────────────
function OrderSection({ num, title, action, children }) {
  return (
    <div className="order-section">
      <div className="order-section-head">
        <span className="order-section-num">{num}</span>
        <h4>{title}</h4>
        {action}
      </div>
      <div className="order-section-body">{children}</div>
    </div>
  )
}

// ── Form tạo đơn ─────────────────────────────────────────────────────────────
function CreateOrderPanel({ onCreated, onCancel }) {
  const { user, profile } = useAuth()
  const toast = useToast()

  const [costPrices, setCostPrices]         = useState([])
  const [lines, setLines]                   = useState([emptyLine()])
  const [customerName, setCustomerName]     = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [contactPerson, setContactPerson]   = useState('')
  const [contactPhone, setContactPhone]     = useState('')
  const [pumpType, setPumpType]             = useState('')
  const [quoterPhone, setQuoterPhone]       = useState('')
  const [note, setNote]                     = useState('')
  const [shipping, setShipping]             = useState('')
  const [shippingPaidBy, setShippingPaidBy] = useState('customer')
  const [shippingHasVat, setShippingHasVat] = useState(true)
  const [includeVat, setIncludeVat]         = useState(false)
  const [showQuick, setShowQuick]           = useState(false)
  const [userProfit, setUserProfit]         = useState('')
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    const unsub = subscribeCostPrices(setCostPrices)
    return unsub
  }, [])

  const updateLine = (key, data) => setLines(ls => ls.map(l => l.key === key ? data : l))

  const addQuickItems = (items) => {
    const newLines = items.map(item => emptyLine(item))
    setLines(ls => {
      // Remove last empty line if untouched
      const filtered = ls.filter(l => l.costId || l.name || l.sellPrice)
      return [...filtered, ...newLines]
    })
  }

  const ship = parseMoney(shipping)

  const orderCalc = useMemo(() => {
    const itemCalcs = lines.map(line => {
      const cost = costPrices.find(c => c.id === line.costId)
      return {
        line, cost,
        calc: calcOrderLine({
          sellPrice: parseMoney(line.sellPrice),
          costPrice: cost?.avgPrice ?? 0,
          qty: line.qty,
          includeVat,
        }),
      }
    })

    const sellTotal         = itemCalcs.reduce((s, x) => s + x.calc.sellTotal, 0)
    const costTotal         = itemCalcs.reduce((s, x) => s + x.calc.costTotal, 0)
    const rawChenhTotal     = itemCalcs.reduce((s, x) => s + x.calc.rawChenh, 0)
    const chenhBase         = itemCalcs.reduce((s, x) => s + x.calc.chenhApplied, 0)
    const shippingChenhExtra = includeVat ? calcShippingChenhExtra({ shipping: ship, shippingHasVat }) : 0
    const chenhAppliedTotal = chenhBase + shippingChenhExtra
    const vatAmount         = includeVat ? Math.round(sellTotal * 0.08) : 0
    const customerShipping  = shippingPaidBy === 'customer' ? ship : 0
    const companyShipping   = shippingPaidBy === 'company' ? ship : 0
    const grandTotal        = sellTotal + vatAmount + customerShipping
    // Lợi nhuận gợi ý: giá bán (ko VAT) − VC mình trả − chênh áp dụng − giá gốc
    const recommendedProfit = sellTotal - companyShipping - chenhAppliedTotal - costTotal

    return { itemCalcs, sellTotal, costTotal, rawChenhTotal, chenhAppliedTotal, chenhBase, shippingChenhExtra, vatAmount, grandTotal, recommendedProfit, companyShipping, customerShipping }
  }, [lines, costPrices, shipping, shippingPaidBy, shippingHasVat, includeVat])

  const handleExportQuote = async () => {
    const valid = orderCalc.itemCalcs.filter(x =>
      x.line.name.trim() && parseMoney(x.line.sellPrice) > 0
    )
    if (!valid.length) {
      toast('Nhập tên và giá bán cho ít nhất 1 sản phẩm', 'error')
      return
    }
    try {
      await exportQuoteExcel({
        customerName: customerName.trim() || 'Khách hàng',
        customerAddress: customerAddress.trim(),
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        pumpType: pumpType.trim(),
        quoterName: profile?.displayName || profile?.email || '',
        quoterPhone: quoterPhone.trim(),
        note: note.trim(),
        includeVat,
        shipping: orderCalc.customerShipping,
        items: valid.map(({ line }) => ({
          name: line.name.trim(),
          qty: line.qty,
          sellPrice: parseMoney(line.sellPrice),
        })),
        sellTotal: orderCalc.sellTotal,
        vatAmount: orderCalc.vatAmount,
        grandTotal: orderCalc.grandTotal,
      })
      toast('Đã xuất báo giá Excel', 'success')
    } catch (e) {
      toast('Lỗi xuất Excel: ' + e.message, 'error')
    }
  }

  const handleCreate = async () => {
    const valid = orderCalc.itemCalcs.filter(x => x.line.name.trim() && parseMoney(x.line.sellPrice) > 0 && x.cost)
    if (!valid.length) {
      toast('Nhập giá bán và chọn giá gốc tính chênh cho ít nhất 1 sản phẩm', 'error')
      return
    }
    setSaving(true)
    try {
      const items = valid.map(({ line, cost, calc }) => ({
        name: line.name.trim(),
        costCode: cost.code,
        costId: cost.id,
        qty: line.qty,
        sellPrice: parseMoney(line.sellPrice),
        costPrice: cost.avgPrice,
        myPrice: parseMoney(line.sellPrice),
        price: cost.avgPrice,
        rawChenh: calc.rawChenh,
        chenhPct: includeVat ? calc.chenhPct : 0,
        chenhApplied: includeVat ? calc.chenhApplied : 0,
      }))

      await createOrder({
        uid: user.uid,
        userName: customerName.trim() || profile?.displayName || profile?.email || user.uid,
        items,
        total: orderCalc.sellTotal,
        totalCost: orderCalc.costTotal,
        rawChenhTotal: orderCalc.rawChenhTotal,
        chenhAppliedTotal: orderCalc.chenhAppliedTotal,
        shippingChenhExtra: orderCalc.shippingChenhExtra,
        includeVat,
        shipping: ship,
        shippingPaidBy,
        shippingHasVat,
        companyShipping: orderCalc.companyShipping,
        vatPct: includeVat ? 8 : 0,
        vatAmount: orderCalc.vatAmount,
        grandTotal: orderCalc.grandTotal,
        profit: parseMoney(userProfit) || null,
        recommendedProfit: orderCalc.recommendedProfit,
        note: note.trim(),
      })
      toast('Đã tạo đơn hàng', 'success')
      onCreated()
    } catch (e) {
      toast('Lỗi tạo đơn: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const summaryRows = [
    ['Tiền hàng', fmt(orderCalc.sellTotal)],
    includeVat ? ['Chênh lệch gốc', fmt(orderCalc.rawChenhTotal)] : null,
    includeVat ? ['Chênh bậc %', fmt(orderCalc.chenhBase)] : null,
    includeVat && orderCalc.shippingChenhExtra > 0 ? ['Chênh thêm VC 20%', `+${fmt(orderCalc.shippingChenhExtra)}`] : null,
    includeVat ? ['Tổng chênh áp dụng', fmt(orderCalc.chenhAppliedTotal)] : null,
    includeVat ? ['VAT 8%', fmt(orderCalc.vatAmount)] : null,
    orderCalc.customerShipping > 0 ? ['VC (khách trả)', fmt(orderCalc.customerShipping)] : null,
    orderCalc.companyShipping > 0 ? ['VC (mình trả)', `−${fmt(orderCalc.companyShipping)}`] : null,
  ].filter(Boolean)

  return (
    <div className="card order-create">
      <div className="order-create-header">
        <h3>Tạo đơn / báo giá mới</h3>
        <button className="btn sm ghost" onClick={onCancel}>✕ Đóng</button>
      </div>

      <div className="order-create-body">
        {/* ── Cột trái: form ── */}
        <div className="order-create-main">

          <OrderSection num="1" title="Thông tin khách hàng">
            <div className="order-grid-2">
              <div className="field span-2" style={{ marginBottom: 0 }}>
                <label className="field-label">Tên đơn vị / khách hàng</label>
                <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="A Quang"/>
              </div>
              <div className="field span-2" style={{ marginBottom: 0 }}>
                <label className="field-label">Địa chỉ</label>
                <input className="input" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="14 Lô E, TTTM Tân Thành..."/>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Người liên hệ</label>
                <input className="input" value={contactPerson} onChange={e => setContactPerson(e.target.value)}/>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Điện thoại</label>
                <input className="input" value={contactPhone} onChange={e => setContactPhone(e.target.value)}/>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Loại bơm / hàng</label>
                <input className="input" value={pumpType} onChange={e => setPumpType(e.target.value)} placeholder="Máy con sò thổi khí..."/>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">SĐT người báo giá</label>
                <input className="input" value={quoterPhone} onChange={e => setQuoterPhone(e.target.value)}/>
              </div>
            </div>
          </OrderSection>

          <OrderSection
            num="2"
            title={`Sản phẩm (${lines.length})`}
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn sm primary" onClick={() => setShowQuick(s => !s)}>
                  {showQuick ? '✕ Đóng' : '☰ Chọn nhanh'}
                </button>
                <button type="button" className="btn sm" onClick={() => setLines(ls => [...ls, emptyLine()])}>+ Dòng</button>
              </div>
            }
          >
            {showQuick && costPrices.length > 0 && (
              <QuickSelectPanel costPrices={costPrices} onAdd={addQuickItems} onClose={() => setShowQuick(false)}/>
            )}

            {costPrices.length === 0 && (
              <div style={{ padding: '8px 10px', background: '#fffbea', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, marginBottom: 10, color: '#78350f' }}>
                ⚠ Chưa có giá vốn — Admin import tại tab <strong>Giá vốn tính chênh</strong>
              </div>
            )}

            <div className="order-line-header">
              <span>Giá gốc (mã)</span>
              <span>Tên sản phẩm</span>
              <span>Giá bán</span>
              <span>SL</span>
              <span style={{ textAlign: 'right' }}>Thành tiền</span>
              <span />
            </div>

            {lines.map(line => (
              <OrderLineRow
                key={line.key}
                line={line}
                costPrices={costPrices}
                includeVat={includeVat}
                onChange={data => updateLine(line.key, data)}
                onRemove={() => setLines(ls => ls.filter(l => l.key !== line.key))}
                canRemove={lines.length > 1}
              />
            ))}
          </OrderSection>

          <OrderSection num="3" title="VAT & tính chênh">
            <div className="order-grid-2">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">VAT trên giá bán</label>
                <select className="input select" value={includeVat ? '8' : '0'} onChange={e => setIncludeVat(e.target.value === '8')}>
                  <option value="0">Không tính VAT</option>
                  <option value="8">Có VAT 8%</option>
                </select>
                <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                  Bật VAT để tính thuế trên báo giá và bậc chênh lệch
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="field-label">Gợi ý lợi nhuận</label>
                <div style={{ padding: '8px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: orderCalc.recommendedProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {orderCalc.recommendedProfit >= 0 ? '+' : ''}{fmt(orderCalc.recommendedProfit)}
                </div>
              </div>
            </div>
            {includeVat && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)' }}>
                <strong>Bậc chênh:</strong> {CHENH_TIER_LABELS.map(t => t.label).join(' · ')}
              </div>
            )}
          </OrderSection>

          <OrderSection num="4" title="Vận chuyển">
            <div className="order-grid-3">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Phí vận chuyển</label>
                <MoneyInput value={shipping} onChange={setShipping} placeholder="0"/>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Ai trả cước?</label>
                <select className="input select" value={shippingPaidBy} onChange={e => setShippingPaidBy(e.target.value)}>
                  <option value="customer">Khách trả</option>
                  <option value="company">Mình trả</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Hóa đơn VC có VAT?</label>
                <select className="input select" value={shippingHasVat ? 'yes' : 'no'} onChange={e => setShippingHasVat(e.target.value === 'yes')}>
                  <option value="yes">Có VAT</option>
                  <option value="no">Không VAT</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Lợi nhuận ước tính</label>
                <MoneyInput value={userProfit} onChange={setUserProfit} placeholder="Tự nhập"/>
              </div>
            </div>
            {ship > 0 && !shippingHasVat && includeVat && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: ship >= 600_000 ? 'var(--warning)' : 'var(--text2)' }}>
                {ship >= 600_000
                  ? `⚠ VC không VAT ≥ 600k → chênh +20% × ${fmt(ship)}`
                  : 'VC không VAT < 600k → chênh không đổi'}
              </div>
            )}
          </OrderSection>

          <OrderSection num="5" title="Ghi chú">
            <textarea className="textarea input" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 56, marginBottom: 0 }} placeholder="Ghi chú thêm cho đơn / báo giá..."/>
          </OrderSection>
        </div>

        {/* ── Cột phải: tóm tắt + actions ── */}
        <aside className="order-create-aside">
          <div className="order-summary-card">
            {summaryRows.map(([label, val]) => (
              <div key={label} className="order-summary-row">
                <span>{label}</span>
                <span>{val}</span>
              </div>
            ))}
            <div className="order-summary-total">
              <div className="label">Khách trả</div>
              <div className="value">{fmt(orderCalc.grandTotal)}</div>
            </div>
          </div>

          <div className="order-aside-actions">
            <button type="button" className="btn primary" onClick={handleCreate} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14 }}/> Đang lưu...</> : `✓ Tạo đơn hàng`}
            </button>
            <button type="button" className="btn" onClick={handleExportQuote}>📥 Xuất báo giá Excel</button>
            <button type="button" className="btn ghost" onClick={onCancel}>Hủy</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Trang chính ──────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()

  const [orders,       setOrders]       = useState([])
  const [showCreate,   setShowCreate]   = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [search,       setSearch]       = useState('')
  const [detailOrder,  setDetailOrder]  = useState(null)

  useEffect(() => {
    const filters = isAdmin ? {} : { uid: user.uid }
    const unsub = subscribeOrders(setOrders, filters)
    return unsub
  }, [isAdmin, user.uid])

  const handleAdvanceStatus = async (order) => {
    const next = STATUS[order.status]?.next
    if (!next) return
    try { await updateOrderStatus(order.id, next); toast(`→ ${STATUS[next].label}`, 'success') }
    catch { toast('Lỗi cập nhật', 'error') }
  }
  const handleCancel = async (order) => {
    if (!confirm('Xác nhận hủy đơn này?')) return
    try { await updateOrderStatus(order.id, 'cancelled'); toast('Đã hủy đơn', 'success') }
    catch { toast('Lỗi hủy đơn', 'error') }
  }
  const handleDelete = async (order) => {
    if (!confirm('Xóa đơn hàng này vĩnh viễn?')) return
    try { await deleteOrder(order.id); toast('Đã xóa', 'success') }
    catch { toast('Lỗi xóa', 'error') }
  }

  const filtered = useMemo(() => orders.filter(o => {
    if (filterStatus && o.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(o.userName || '').toLowerCase().includes(q) &&
          !(o.items?.some(i => i.name?.toLowerCase().includes(q)))) return false
    }
    return true
  }), [orders, filterStatus, search])

  const totalRevenue = filtered.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.grandTotal ?? o.total ?? 0), 0)
  const totalPending = filtered.filter(o => o.status === 'pending').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ flex: 1 }}>Quản lý đơn bán</h2>
        <div className="search-wrap" style={{ width: 190 }}>
          <span className="search-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input className="input" placeholder="Tìm khách hàng..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn primary" onClick={() => setShowCreate(s => !s)}>
          {showCreate ? '✕ Đóng' : '+ Tạo đơn mới'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {isAdmin && (
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Tổng đơn</div>
              <div className="stat-value">{filtered.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Chờ xác nhận</div>
              <div className="stat-value" style={{ color: totalPending > 0 ? 'var(--warning)' : 'var(--success)' }}>{totalPending}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Doanh thu (đã giao)</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {totalRevenue >= 1_000_000 ? (totalRevenue / 1_000_000).toFixed(1) + ' tr' : fmtN(totalRevenue)}
              </div>
            </div>
          </div>
        )}

        {showCreate && (
          <CreateOrderPanel
            onCreated={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        )}

        <div className="card">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ flex: 1 }}>Danh sách đơn hàng</h3>
            <span className="text-muted text-sm">{filtered.length} đơn</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
              <div>Chưa có đơn hàng nào</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Sản phẩm</th>
                    <th style={{ textAlign: 'right' }}>Tiền hàng</th>
                    <th style={{ textAlign: 'right' }}>Khách trả</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const st = STATUS[o.status] || { label: o.status, cls: '' }
                    return (
                      <tr key={o.id} onClick={() => setDetailOrder(o)}>
                        <td style={{ fontWeight: 500 }}>{o.userName || '—'}</td>
                        <td className="text-muted text-sm">
                          {o.items?.length ?? 0} SP{o.items?.[0] ? ` · ${o.items[0].name?.slice(0, 16)}` : ''}
                        </td>
                        <td className="td-price" style={{ textAlign: 'right' }}>{fmt(o.total)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(o.grandTotal ?? o.total)}</td>
                        <td><span className={`order-status ${st.cls}`}>{st.label}</span></td>
                        <td className="text-sm text-muted">
                          {o.createdAt?.toDate?.() ? o.createdAt.toDate().toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {isAdmin && st.next && (
                              <button className="btn xs primary" onClick={() => handleAdvanceStatus(o)}>→ {STATUS[st.next]?.label}</button>
                            )}
                            {isAdmin && o.status !== 'cancelled' && o.status !== 'delivered' && (
                              <button className="btn xs" style={{ color: 'var(--danger)' }} onClick={() => handleCancel(o)}>Hủy</button>
                            )}
                            {isAdmin && (
                              <button className="btn xs ghost" onClick={() => handleDelete(o)}>🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)}/>
      )}
    </div>
  )
}
