import { useState, useEffect, useMemo, useRef } from 'react'
import { subscribeInventory, upsertInventoryItem } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'

const fmt = (n) => {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : Number(n)
  if (n == null || n === '' || isNaN(num)) return '—'
  return num.toLocaleString('vi-VN') + ' ₫'
}

export default function QuickStockDrawer({ isOpen, onClose }) {
  const { isAdmin } = useAuth()
  const toast = useToast()
  
  const [inventory, setInventory] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'in-stock' | 'out-of-stock' | 'low-stock'
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  
  // Inline edit for Admin
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [savingId, setSavingId] = useState(null)

  const searchInputRef = useRef(null)

  // Realtime inventory subscription
  useEffect(() => {
    if (!isOpen) return
    const unsub = subscribeInventory(setInventory)
    return unsub
  }, [isOpen])

  // Focus search input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }, 100)
    }
  }, [isOpen])

  // ESC shortcut to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Extract warehouse options (e.g. KHO 1, KHO 2, KHO 4, K4, K1)
  const warehouseOptions = useMemo(() => {
    const whSet = new Set()
    inventory.forEach(item => {
      const code = item.productId || item.code || item.id || ''
      const match = code.match(/^K\d+/i)
      if (match) {
        whSet.add(match[0].toUpperCase())
      }
      if (item.warehouse) {
        whSet.add(String(item.warehouse).toUpperCase())
      }
    })
    return Array.from(whSet).sort()
  }, [inventory])

  // Multi-keyword instant filter
  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase()
    const tokens = q ? q.split(/\s+/).filter(Boolean) : []

    return inventory.filter(item => {
      const code = (item.productId || item.code || item.id || '').toLowerCase()
      const name = (item.productName || item.name || '').toLowerCase()
      const group = (item.group || '').toLowerCase()
      const listName = (item.listName || '').toLowerCase()
      const combined = `${code} ${name} ${group} ${listName}`

      // 1. Search tokens check (every typed word must be present)
      if (tokens.length > 0) {
        const matchesAll = tokens.every(token => combined.includes(token))
        if (!matchesAll) return false
      }

      // 2. Warehouse filter
      if (selectedWarehouse) {
        const whUpper = selectedWarehouse.toUpperCase()
        const codeUpper = (item.productId || item.code || item.id || '').toUpperCase()
        const itemWhUpper = String(item.warehouse || '').toUpperCase()
        const matchesWh = codeUpper.startsWith(whUpper) || itemWhUpper.includes(whUpper)
        if (!matchesWh) return false
      }

      // 3. Status filter
      const qty = Number(item.qty) || 0
      if (statusFilter === 'in-stock' && qty <= 0) return false
      if (statusFilter === 'out-of-stock' && qty > 0) return false
      if (statusFilter === 'low-stock' && (qty <= 0 || qty > 5)) return false

      return true
    })
  }, [inventory, search, selectedWarehouse, statusFilter])

  // Stats
  const inStockCount = useMemo(() => inventory.filter(i => (Number(i.qty) || 0) > 0).length, [inventory])
  const outOfStockCount = useMemo(() => inventory.filter(i => (Number(i.qty) || 0) <= 0).length, [inventory])

  // Quick adjust (+1 / -1)
  const handleQuickAdjust = async (item, delta) => {
    const currentQty = Number(item.qty) || 0
    const newQty = Math.max(0, currentQty + delta)
    setSavingId(item.id)
    try {
      await upsertInventoryItem(item.id, {
        ...item,
        qty: newQty
      })
      toast(`Đã cập nhật: ${newQty} ${item.unit || 'cái'}`, 'success')
    } catch (e) {
      toast('Lỗi cập nhật: ' + e.message, 'error')
    } finally {
      setSavingId(null)
    }
  }

  // Save direct edit input
  const handleSaveEdit = async (item) => {
    const newQty = Math.max(0, parseFloat(editQty) || 0)
    setSavingId(item.id)
    try {
      await upsertInventoryItem(item.id, {
        ...item,
        qty: newQty
      })
      setEditingId(null)
      toast(`Đã lưu tồn kho: ${newQty} ${item.unit || 'cái'}`, 'success')
    } catch (e) {
      toast('Lỗi cập nhật: ' + e.message, 'error')
    } finally {
      setSavingId(null)
    }
  }

  // Copy code to clipboard
  const handleCopyCode = (code, e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(code)
    toast(`Đã sao chép mã: ${code}`, 'success')
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        .qsd-overlay {
          position: fixed;
          inset: 0;
          background: transparent;
          pointer-events: none;
          z-index: 99999;
          display: flex;
          justify-content: flex-end;
        }
        .qsd-drawer {
          width: 520px;
          max-width: 100vw;
          height: 100%;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          border-left: 1.5px solid #CBD5E1;
          box-shadow: -10px 0 35px rgba(15, 23, 42, 0.18);
          pointer-events: auto;
          animation: qsdSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes qsdSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .qsd-header {
          padding: 14px 20px;
          border-bottom: 1px solid #EAECF0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #F8FAFC;
        }
        .qsd-title {
          font-size: 16px;
          font-weight: 700;
          color: #101828;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .qsd-close-btn {
          background: transparent;
          border: none;
          font-size: 20px;
          color: #64748B;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qsd-close-btn:hover {
          background: #E2E8F0;
          color: #1E293B;
        }
        .qsd-search-box {
          padding: 14px 20px;
          border-bottom: 1px solid #EAECF0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #FFFFFF;
        }
        .qsd-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .qsd-search-icon {
          position: absolute;
          left: 12px;
          color: #94A3B8;
          pointer-events: none;
        }
        .qsd-input {
          width: 100%;
          height: 42px;
          padding: 0 40px 0 38px;
          border: 1.5px solid #CBD5E1;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .qsd-input:focus {
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .qsd-clear-btn {
          position: absolute;
          right: 10px;
          background: #E2E8F0;
          border: none;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          font-size: 11px;
          color: #475467;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qsd-filters-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .qsd-filters-row::-webkit-scrollbar {
          display: none;
        }
        .qsd-pill {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #475467;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.12s;
        }
        .qsd-pill:hover {
          background: #F1F5F9;
          border-color: #CBD5E1;
        }
        .qsd-pill.active {
          background: #1D4ED8;
          color: #FFFFFF;
          border-color: #1D4ED8;
          font-weight: 600;
        }
        .qsd-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          background: #F8FAFC;
        }
        .qsd-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 10px;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .qsd-card:hover {
          border-color: #93C5FD;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }
        .qsd-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .qsd-card-code {
          font-family: monospace;
          font-size: 13.5px;
          font-weight: 700;
          color: #0F172A;
          background: #F1F5F9;
          padding: 2px 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .qsd-card-code:hover {
          background: #E2E8F0;
          color: #1D4ED8;
        }
        .qsd-stock-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .qsd-stock-in {
          background: #DEF7EC;
          color: #03543F;
          border: 1px solid #BCF0DA;
        }
        .qsd-stock-low {
          background: #FEF08A;
          color: #713F12;
          border: 1px solid #FDE047;
        }
        .qsd-stock-out {
          background: #FDE8E8;
          color: #9B1C1C;
          border: 1px solid #F8B4B4;
        }
        .qsd-card-name {
          font-size: 13px;
          color: #334155;
          line-height: 1.4;
          font-weight: 500;
        }
        .qsd-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px solid #F1F5F9;
          font-size: 12px;
          color: #64748B;
        }
        .qsd-adjust-wrap {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .qsd-adj-btn {
          width: 24px;
          height: 24px;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          background: #FFFFFF;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s;
        }
        .qsd-adj-btn:hover {
          background: #E2E8F0;
          color: #0F172A;
        }
        .qsd-adj-btn:active {
          transform: scale(0.95);
        }
        .qsd-edit-input {
          width: 50px;
          height: 24px;
          padding: 0 4px;
          border: 1px solid #2563EB;
          border-radius: 4px;
          font-size: 12.5px;
          text-align: center;
          font-weight: 600;
        }
      `}</style>

      <div className="qsd-overlay" onClick={onClose}>
        <div className="qsd-drawer" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="qsd-header">
            <div className="qsd-title">
              <span>📦 Tra cứu kho siêu tốc</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475467', background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>
                F2 / ESC
              </span>
            </div>
            <button className="qsd-close-btn" onClick={onClose} title="Đóng (ESC)">
              ✕
            </button>
          </div>

          {/* Search & Filters */}
          <div className="qsd-search-box">
            <div className="qsd-input-wrap">
              <span className="qsd-search-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                className="qsd-input"
                placeholder="Gõ mã model, tên hàng, kho... (VD: 4-60, sl8sp, kho 4)"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="qsd-clear-btn" onClick={() => { setSearch(''); searchInputRef.current?.focus() }}>
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="qsd-filters-row">
              <button
                className={`qsd-pill ${statusFilter === 'all' && !selectedWarehouse ? 'active' : ''}`}
                onClick={() => { setStatusFilter('all'); setSelectedWarehouse('') }}
              >
                Tất cả ({inventory.length})
              </button>
              <button
                className={`qsd-pill ${statusFilter === 'in-stock' ? 'active' : ''}`}
                onClick={() => setStatusFilter(s => s === 'in-stock' ? 'all' : 'in-stock')}
              >
                🟢 Còn ({inStockCount})
              </button>
              <button
                className={`qsd-pill ${statusFilter === 'out-of-stock' ? 'active' : ''}`}
                onClick={() => setStatusFilter(s => s === 'out-of-stock' ? 'all' : 'out-of-stock')}
              >
                🔴 Hết ({outOfStockCount})
              </button>

              {warehouseOptions.map(wh => (
                <button
                  key={wh}
                  className={`qsd-pill ${selectedWarehouse === wh ? 'active' : ''}`}
                  onClick={() => setSelectedWarehouse(w => w === wh ? '' : wh)}
                >
                  🏢 {wh}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items List */}
          <div className="qsd-content">
            {filteredInventory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94A3B8' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#475467' }}>Không tìm thấy mặt hàng nào</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Thử tìm từ khóa ngắn hơn hoặc kiểm tra bộ lọc</div>
              </div>
            ) : (
              filteredInventory.map(item => {
                const qty = Number(item.qty) || 0
                const isOut = qty <= 0
                const isLow = qty > 0 && qty <= 5
                const itemCode = item.productId || item.code || item.id || ''
                const isEditing = editingId === item.id
                const isSaving = savingId === item.id

                return (
                  <div key={item.id} className="qsd-card">
                    <div className="qsd-card-top">
                      <div
                        className="qsd-card-code"
                        title="Bấm để sao chép mã"
                        onClick={(e) => handleCopyCode(itemCode, e)}
                      >
                        <span>{itemCode}</span>
                        <span style={{ fontSize: 11, opacity: 0.6 }}>📋</span>
                      </div>

                      <div className={`qsd-stock-badge ${isOut ? 'qsd-stock-out' : isLow ? 'qsd-stock-low' : 'qsd-stock-in'}`}>
                        {isOut ? '🔴 Hết hàng' : isLow ? `🟡 Còn ${qty} ${item.unit || 'cái'}` : `🟢 Còn ${qty} ${item.unit || 'cái'}`}
                      </div>
                    </div>

                    <div className="qsd-card-name">
                      {item.productName || item.name || '—'}
                    </div>

                    <div className="qsd-card-footer">
                      <div>
                        {item.price ? <span style={{ fontWeight: 600, color: '#101828' }}>{fmt(item.price)}</span> : null}
                        {item.listName && <span style={{ marginLeft: 6, color: '#94A3B8', fontSize: 11.5 }}>({item.listName})</span>}
                      </div>

                      {/* Admin Quick Quantity Control */}
                      {isAdmin && (
                        <div className="qsd-adjust-wrap">
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                autoFocus
                                className="qsd-edit-input"
                                type="number"
                                min="0"
                                value={editQty}
                                onChange={e => setEditQty(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEdit(item)
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                              />
                              <button
                                className="qsd-adj-btn"
                                style={{ background: '#2563EB', color: '#FFF', borderColor: '#2563EB' }}
                                onClick={() => handleSaveEdit(item)}
                                disabled={isSaving}
                              >
                                ✓
                              </button>
                              <button className="qsd-adj-btn" onClick={() => setEditingId(null)}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                className="qsd-adj-btn"
                                title="Giảm 1"
                                disabled={isSaving || qty <= 0}
                                onClick={() => handleQuickAdjust(item, -1)}
                              >
                                -
                              </button>
                              <span
                                style={{ fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: 'center', cursor: 'pointer', color: '#2563EB' }}
                                title="Bấm để gõ số tồn mới"
                                onClick={() => { setEditingId(item.id); setEditQty(String(qty)) }}
                              >
                                {qty}
                              </span>
                              <button
                                className="qsd-adj-btn"
                                title="Tăng 1"
                                disabled={isSaving}
                                onClick={() => handleQuickAdjust(item, 1)}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
