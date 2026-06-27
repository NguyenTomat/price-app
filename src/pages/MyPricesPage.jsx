import { useState, useEffect, useMemo } from 'react'
import { subscribePriceLists, getProducts, getUserPriceLists, saveUserPriceList, updateUserPriceList, deleteUserPriceList } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { calcPriceBreakdown } from '../utils/priceCalc'

// ✅ Fixed formatter — parse properly, no NaN display
const fmt = (n) => {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : Number(n)
  if (n == null || n === '' || isNaN(num)) return '—'
  return num.toLocaleString('vi-VN') + ' ₫'
}

export default function MyPricesPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [lists, setLists] = useState([])
  const [selectedList, setSelectedList] = useState(null)
  const [products, setProducts] = useState([])
  const [loadingProds, setLoadingProds] = useState(false)

  const [disc, setDisc] = useState('0')
  const [margin, setMargin] = useState('0')
  const [vat, setVat] = useState('0')
  const [search, setSearch] = useState('')

  const [savedLists, setSavedLists] = useState([])
  const [showSaved, setShowSaved] = useState(false)
  const [viewingSaved, setViewingSaved] = useState(null)
  const [editingSavedId, setEditingSavedId] = useState(null)
  const [editingSavedLabel, setEditingSavedLabel] = useState('')

  // Realtime price lists
  useEffect(() => {
    const unsub = subscribePriceLists(setLists)
    return unsub
  }, [])

  useEffect(() => { loadSaved() }, [])

  const loadSaved = async () => {
    const s = await getUserPriceLists(user.uid)
    setSavedLists(s)
  }

  const handleSelectList = async (list) => {
    setSelectedList(list)
    setLoadingProds(true)
    setProducts([])
    try {
      const prods = await getProducts(list.id)
      setProducts(prods)
    } catch { toast('Lỗi tải sản phẩm', 'error') }
    finally { setLoadingProds(false) }
  }

  const discN   = Math.max(0, parseFloat(disc)   || 0)
  const marginN = Math.max(0, parseFloat(margin)  || 0)
  const vatN    = parseFloat(vat) || 0
  const includeVat = vatN > 0

  const calcOpts = { discPct: discN, marginPct: marginN, includeVat }
  const calcPrice = (base) => calcPriceBreakdown(base, calcOpts)?.sellPrice ?? null
  const calcBreakdown = (base) => calcPriceBreakdown(base, calcOpts)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      const num = typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price)
      if (p.price == null || isNaN(num)) return false
      if (!q) return true
      return (p.name || '').toLowerCase().includes(q) || (p.group || '').toLowerCase().includes(q)
    })
  }, [products, search])

  const sampleBd = filtered[0] ? calcBreakdown(filtered[0].price) : null

  const handleSave = async () => {
    if (!selectedList || !filtered.length) return
    const rows = filtered.map(p => ({
      name: p.name, group: p.group, spec1: p.spec1, spec2: p.spec2,
      originalPrice: p.price, myPrice: calcPrice(p.price),
    }))
    try {
      await saveUserPriceList(user.uid, {
        listName: selectedList.name, listId: selectedList.id,
        discPct: discN, marginPct: marginN, includeVat: vatN > 0,
        rows,
        label: `${selectedList.name} -${discN}% +${marginN}%${vatN ? ' VAT' : ''}`,
      })
      toast('Đã lưu bảng giá', 'success')
      loadSaved()
    } catch { toast('Lỗi lưu', 'error') }
  }

  const handleDeleteSaved = async (id) => {
    await deleteUserPriceList(user.uid, id)
    setSavedLists(s => s.filter(x => x.id !== id))
    if (viewingSaved?.id === id) setViewingSaved(null)
    toast('Đã xóa', 'success')
  }

  const handleViewSaved = (saved) => {
    setViewingSaved(saved)
    setShowSaved(true)
  }

  const startRenameSaved = (saved, e) => {
    e?.stopPropagation()
    setEditingSavedId(saved.id)
    setEditingSavedLabel(saved.label || '')
  }

  const cancelRenameSaved = () => {
    setEditingSavedId(null)
    setEditingSavedLabel('')
  }

  const handleRenameSaved = async (id) => {
    const label = editingSavedLabel.trim()
    if (!label) {
      toast('Tên bảng giá không được để trống', 'error')
      return
    }
    try {
      await updateUserPriceList(user.uid, id, { label })
      setSavedLists(s => s.map(x => x.id === id ? { ...x, label } : x))
      if (viewingSaved?.id === id) setViewingSaved(v => ({ ...v, label }))
      cancelRenameSaved()
      toast('Đã đổi tên bảng giá', 'success')
    } catch {
      toast('Lỗi đổi tên', 'error')
    }
  }

  const exportCSV = (saved) => {
    const header = 'Nhóm,Tên sản phẩm,Thông số,Giá gốc,Giá bán\n'
    const rows = saved.rows.map(r =>
      [r.group, r.name, r.spec2 || '', r.originalPrice || '', r.myPrice || ''].join(',')
    ).join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `bang-gia-${(saved.label || 'cua-toi').replace(/\s+/g, '-')}.csv`
    a.click()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ flex: 1 }}>Bảng giá của tôi</h2>
        <button className="btn" onClick={() => setShowSaved(s => !s)}>
          📁 Đã lưu ({savedLists.length})
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {showSaved && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Bảng giá đã lưu</h3>
            {savedLists.length === 0 ? (
              <div className="text-muted text-sm">Chưa có bảng giá nào.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedLists.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
                    border: viewingSaved?.id === s.id ? '1px solid var(--accent)' : '1px solid transparent',
                  }}>
                    {editingSavedId === s.id ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          className="input"
                          value={editingSavedLabel}
                          onChange={e => setEditingSavedLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSaved(s.id)
                            if (e.key === 'Escape') cancelRenameSaved()
                          }}
                          autoFocus
                          style={{ flex: 1, minWidth: 180 }}
                        />
                        <button className="btn sm primary" onClick={() => handleRenameSaved(s.id)}>Lưu</button>
                        <button className="btn sm" onClick={cancelRenameSaved}>Hủy</button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleViewSaved(s)}
                          style={{
                            flex: 1, textAlign: 'left', background: 'none', border: 'none',
                            cursor: 'pointer', padding: 0, color: 'inherit', font: 'inherit',
                          }}
                        >
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{s.label}</div>
                          <div className="text-muted text-sm">
                            {s.rows?.length} sản phẩm
                            {s.savedAt?.toDate ? ' · ' + s.savedAt.toDate().toLocaleDateString('vi-VN') : ''}
                          </div>
                        </button>
                        <button className="btn sm" onClick={(e) => startRenameSaved(s, e)} title="Đổi tên">✏️</button>
                      </>
                    )}
                    <button className="btn sm" onClick={() => exportCSV(s)}>📥 Xuất CSV</button>
                    <button className="btn sm danger" onClick={() => handleDeleteSaved(s.id)}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewingSaved && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {editingSavedId === viewingSaved.id ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    value={editingSavedLabel}
                    onChange={e => setEditingSavedLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameSaved(viewingSaved.id)
                      if (e.key === 'Escape') cancelRenameSaved()
                    }}
                    autoFocus
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  <button className="btn sm primary" onClick={() => handleRenameSaved(viewingSaved.id)}>Lưu</button>
                  <button className="btn sm" onClick={cancelRenameSaved}>Hủy</button>
                </div>
              ) : (
                <>
                  <h3 style={{ flex: 1 }}>{viewingSaved.label}</h3>
                  <button className="btn sm" onClick={(e) => startRenameSaved(viewingSaved, e)} title="Đổi tên">✏️</button>
                </>
              )}
              <span className="text-muted text-sm">{viewingSaved.rows?.length} sản phẩm</span>
              <button className="btn sm" onClick={() => exportCSV(viewingSaved)}>📥 Xuất CSV</button>
              <button className="btn sm" onClick={() => setViewingSaved(null)}>✕ Đóng</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhóm</th>
                    <th>Tên / Mã sản phẩm</th>
                    <th>Công suất</th>
                    <th>Thông số</th>
                    <th style={{ textAlign: 'right' }}>Giá gốc</th>
                    <th style={{ textAlign: 'right', color: 'var(--accent)' }}>Giá bán</th>
                    <th style={{ textAlign: 'right' }}>Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSaved.rows || []).map((r, idx) => {
                    const orig = typeof r.originalPrice === 'string'
                      ? parseFloat(r.originalPrice) : Number(r.originalPrice)
                    const sell = typeof r.myPrice === 'string'
                      ? parseFloat(r.myPrice) : Number(r.myPrice)
                    const profit = !isNaN(orig) && !isNaN(sell) ? sell - orig : null
                    return (
                      <tr key={idx}>
                        <td className="text-muted text-sm">{r.group || '—'}</td>
                        <td className="td-mono">{r.name}</td>
                        <td className="td-spec">{r.spec1 ? r.spec1 + ' kW' : '—'}</td>
                        <td className="td-spec">{r.spec2 || '—'}</td>
                        <td className="td-price" style={{ textAlign: 'right' }}>{fmt(r.originalPrice)}</td>
                        <td className="td-price" style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmt(r.myPrice)}</td>
                        <td style={{
                          textAlign: 'right', fontSize: 12,
                          color: profit == null ? 'var(--text2)' : profit > 0 ? 'var(--success)' : profit < 0 ? 'var(--danger)' : 'var(--text2)',
                        }}>
                          {profit != null ? (profit > 0 ? '+' : '') + fmt(profit) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {!viewingSaved.rows?.length && (
                    <tr><td colSpan={7} className="empty" style={{ padding: '32px 0' }}>Không có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 1 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>1. Chọn bảng giá gốc</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lists.map(l => (
              <button key={l.id} className={`btn ${selectedList?.id === l.id ? 'primary' : ''}`} onClick={() => handleSelectList(l)}>
                {l.name}
              </button>
            ))}
            {lists.length === 0 && <span className="text-muted text-sm">Chưa có bảng giá nào.</span>}
          </div>
        </div>

        {selectedList && (
          <>
            {/* Step 2 */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 14 }}>2. Cài đặt giá</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div className="field">
                  <label className="field-label">% Chiết khấu từ giá gốc</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="input" type="number" value={disc} min="0" max="99" step="0.5"
                      onChange={e => setDisc(e.target.value)} style={{ maxWidth: 100 }}/>
                    <span className="text-muted">%</span>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">% Lợi nhuận cộng vào</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="input" type="number" value={margin} min="0" step="0.5"
                      onChange={e => setMargin(e.target.value)} style={{ maxWidth: 100 }}/>
                    <span className="text-muted">%</span>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">VAT 8%</label>
                  <select className="input select" value={vat} onChange={e => setVat(e.target.value)}>
                    <option value="0">Không tính VAT</option>
                    <option value="8">Có VAT 8%</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '9px 13px', background: 'var(--accent-s)', borderRadius: 'var(--radius-sm)', fontSize: 12.5, color: 'var(--accent)' }}>
                <strong>Công thức:</strong> Giá bán = Giá gốc × (1 − {discN}%) × (1 + {marginN}%) {vatN ? '+ VAT 8%' : ''}
              </div>

              {sampleBd && (
                <div className="calc-result" style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                    Ví dụ tính giá (sản phẩm đầu tiên — so sánh giá gốc vs giá bán):
                  </div>
                  {[
                    ['Giá gốc', fmt(sampleBd.original)],
                    [`Sau chiết khấu ${discN}%`, fmt(sampleBd.afterDisc)],
                    [`Sau lợi nhuận +${marginN}%`, fmt(sampleBd.afterMargin)],
                    ['VAT 8%', includeVat ? fmt(sampleBd.vatAmt) : 'Không tính'],
                    ['Giá bán ra', fmt(sampleBd.sellPrice)],
                  ].map(([label, val]) => (
                    <div key={label} className="cr-row">
                      <span className="cr-label">{label}</span>
                      <span style={label === 'Giá bán ra' ? { fontWeight: 700, color: 'var(--accent)' } : undefined}>{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3 */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h3 style={{ flex: 1 }}>3. Bảng giá của bạn ({filtered.length} sản phẩm)</h3>
                <div className="search-wrap" style={{ width: 190 }}>
                  <span className="search-icon">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </span>
                  <input className="input" placeholder="Tìm..." value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
                <button className="btn primary" onClick={handleSave}>💾 Lưu</button>
                <button className="btn" onClick={() => exportCSV({
                  label: `${selectedList.name}-${discN}%-${marginN}%`,
                  rows: filtered.map(p => ({ group: p.group, name: p.name, spec2: p.spec2, originalPrice: p.price, myPrice: calcPrice(p.price) }))
                })}>📥 Xuất CSV</button>
              </div>

              {loadingProds ? (
                <div className="empty"><span className="spinner"/></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhóm</th>
                        <th>Tên / Mã sản phẩm</th>
                        <th>Thông số</th>
                        <th style={{ textAlign: 'right' }}>Giá gốc</th>
                        <th style={{ textAlign: 'right', color: 'var(--accent)' }}>Giá bán</th>
                        <th style={{ textAlign: 'right' }}>Lợi nhuận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => {
                        const bd = calcBreakdown(p.price)
                        const sellPrice = bd?.sellPrice ?? null
                        const profit = bd ? bd.sellPrice - bd.original : null
                        return (
                          <tr key={p.id}>
                            <td className="text-muted text-sm">{p.group || '—'}</td>
                            <td className="td-mono">{p.name}</td>
                            <td className="td-spec">{p.spec2 || '—'}</td>
                            <td className="td-price" style={{ textAlign: 'right' }}>{fmt(p.price)}</td>
                            <td className="td-price" style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmt(sellPrice)}</td>
                            <td style={{
                              textAlign: 'right', fontSize: 12,
                              color: profit == null ? 'var(--text2)' : profit > 0 ? 'var(--success)' : profit < 0 ? 'var(--danger)' : 'var(--text2)',
                            }}>
                              {profit != null ? (profit > 0 ? '+' : '') + fmt(profit) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={6} className="empty" style={{ padding: '32px 0' }}>Không có sản phẩm có giá</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
