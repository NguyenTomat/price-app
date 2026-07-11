import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { subscribePriceLists, subscribeProducts, updateProduct, updateProductImages, addProduct, deleteProduct, deletePriceList, reorderProducts, updatePriceList } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import ProductModal from '../components/ProductModal'
import MobileTableWrap from '../components/MobileTableWrap'

// ✅ Sửa lỗi định dạng số: đảm bảo parse đúng, tránh NaN hiển thị
const fmt = (n) => {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : Number(n)
  if (n == null || n === '' || isNaN(num)) return '—'
  return num.toLocaleString('vi-VN') + ' ₫'
}

export default function PriceListsPage({ spotlightTarget, clearSpotlightTarget }) {
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [lists, setLists] = useState([])
  const [selectedList, setSelectedList] = useState(null)
  const [products, setProducts] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', group: '', spec1: '', spec2: '', phiHocng: '', price: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [listPanelOpen, setListPanelOpen] = useState(true)
  // Rename bảng giá (admin)
  const [editingListId, setEditingListId] = useState(null)
  const [listNameDraft, setListNameDraft]  = useState('')
  const touchRef = useRef(null)
  const mainRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (isMobile && !selectedList) setListPanelOpen(true)
  }, [isMobile, selectedList])

  const selectList = useCallback((l) => {
    setSelectedList(l)
    setSearch('')
    setGroupFilter('')
    if (isMobile) setListPanelOpen(false)
  }, [isMobile])

  const closeListPanel = useCallback(() => {
    if (isMobile) setListPanelOpen(false)
  }, [isMobile])

  const onPanelTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, zone: 'panel' }
  }

  const onPanelTouchMove = (e) => {
    const t = touchRef.current
    if (!t || t.zone !== 'panel' || !isMobile || !listPanelOpen) return
    const dx = e.touches[0].clientX - t.x
    const dy = e.touches[0].clientY - t.y
    if (Math.abs(dx) > Math.abs(dy) && dx < -50) {
      closeListPanel()
      touchRef.current = null
    }
  }

  const onMainTouchStart = (e) => {
    if (!isMobile || listPanelOpen) return
    const x = e.touches[0].clientX
    if (x <= 28) touchRef.current = { x, y: e.touches[0].clientY, zone: 'edge' }
  }

  const onMainTouchMove = (e) => {
    const t = touchRef.current
    if (!t || t.zone !== 'edge' || !isMobile || listPanelOpen) return
    const dx = e.touches[0].clientX - t.x
    const dy = e.touches[0].clientY - t.y
    if (Math.abs(dx) > Math.abs(dy) && dx > 50) {
      setListPanelOpen(true)
      touchRef.current = null
    }
  }

  const onTouchEnd = () => { touchRef.current = null }

  // Realtime price lists
  useEffect(() => {
    const unsub = subscribePriceLists(setLists)
    return unsub
  }, [])

  // Realtime products for selected list
  useEffect(() => {
    if (!selectedList) return
    setLoadingList(true)
    setProducts([])
    const unsub = subscribeProducts(selectedList.id, (prods) => {
      setProducts(prods)
      setLoadingList(false)
    })
    return () => { unsub(); setLoadingList(false) }
  }, [selectedList?.id])

  // Handle spotlight navigation — auto-open a product
  useEffect(() => {
    if (!spotlightTarget || !products.length) return
    const found = products.find(p => p.id === spotlightTarget.id)
    if (found) {
      setSelectedProduct(found)
      clearSpotlightTarget?.()
    }
  }, [spotlightTarget, products])

  // Auto-select the list that spotlight target belongs to
  useEffect(() => {
    if (!spotlightTarget?.listId || !lists.length) return
    const list = lists.find(l => l.id === spotlightTarget.listId)
    if (list && list.id !== selectedList?.id) setSelectedList(list)
  }, [spotlightTarget, lists])

  const groups = useMemo(() =>
    [...new Set(products.map(p => p.group).filter(Boolean))], [products])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      if (groupFilter && p.group !== groupFilter) return false
      if (!q) return true
      return (p.name || '').toLowerCase().includes(q) ||
             (p.group || '').toLowerCase().includes(q) ||
             (p.spec2 || '').toLowerCase().includes(q)
    })
  }, [products, search, groupFilter])

  const rows = useMemo(() => {
    if (groupFilter || search) return filtered.map(p => ({ type: 'product', data: p }))
    const out = []
    let lastGroup = null
    for (const p of filtered) {
      if (p.group !== lastGroup) {
        out.push({ type: 'group', label: p.group })
        lastGroup = p.group
      }
      out.push({ type: 'product', data: p })
    }
    return out
  }, [filtered, groupFilter, search])

  const handleSaveProduct = async (updated) => {
    try {
      if (isAdmin) {
        await updateProduct(selectedList.id, updated.id, updated)
      } else {
        await updateProductImages(selectedList.id, updated.id, updated.images)
      }
      setSelectedProduct(null)
      toast(isAdmin ? 'Đã lưu sản phẩm' : 'Đã lưu ảnh', 'success')
    } catch { toast('Lỗi lưu sản phẩm', 'error') }
  }

  const handleAddProduct = async () => {
    if (!addForm.name.trim()) { toast('Nhập tên sản phẩm', 'error'); return }
    const price = parseFloat(addForm.price) || 0
    if (!price) { toast('Nhập đơn giá', 'error'); return }
    setAddSaving(true)
    try {
      const groupName = addForm.group.trim() || (groups[0] ?? '')
      const newKw     = parseFloat(addForm.spec1) || null

      // ── Tìm vị trí chèn đúng trong nhóm theo kW ──
      // Lấy tất cả SP trong cùng nhóm, sắp theo order
      const sameGroup = products
        .filter(p => p.group === groupName)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      // Vị trí chèn: sau sản phẩm cuối có kW ≤ newKw
      // Nếu không có kW → chèn cuối nhóm
      let insertAfterOrder = null  // order của sản phẩm liền trước vị trí chèn
      if (newKw !== null) {
        for (const p of sameGroup) {
          const pkw = parseFloat(p.spec1) || null
          if (pkw === null || pkw <= newKw) {
            insertAfterOrder = p.order ?? 0
          } else {
            break
          }
        }
      } else {
        // Không có kW → chèn cuối nhóm
        if (sameGroup.length > 0) {
          insertAfterOrder = sameGroup[sameGroup.length - 1].order ?? 0
        }
      }

      // Tính order của sản phẩm mới
      let newOrder
      if (insertAfterOrder === null && sameGroup.length === 0) {
        // Nhóm rỗng / chưa có SP → append sau tất cả SP hiện tại
        newOrder = products.length
      } else if (insertAfterOrder === null) {
        // Chèn đầu nhóm (newKw nhỏ hơn tất cả trong nhóm)
        newOrder = sameGroup.length > 0 ? (sameGroup[0].order ?? 0) : products.length
      } else {
        newOrder = insertAfterOrder + 1
      }

      // Dịch order của tất cả SP có order >= newOrder lên 1
      const toReorder = products
        .filter(p => (p.order ?? 0) >= newOrder)
        .map(p => ({ id: p.id, order: (p.order ?? 0) + 1 }))
      if (toReorder.length > 0) {
        await reorderProducts(selectedList.id, toReorder)
      }

      await addProduct(selectedList.id, {
        name: addForm.name.trim(),
        group: groupName,
        spec1: addForm.spec1.trim(),
        spec2: addForm.spec2.trim(),
        phiHocng: addForm.phiHocng.trim(),
        price,
        order: newOrder,
        images: [],
      })
      setAddForm({ name: '', group: '', spec1: '', spec2: '', phiHocng: '', price: '' })
      setShowAddForm(false)
      toast('Đã thêm sản phẩm', 'success')
    } catch (e) { toast('Lỗi: ' + e.message, 'error') }
    finally { setAddSaving(false) }
  }

  const handleDeleteProduct = async (product) => {
    if (!confirm(`Xóa sản phẩm "${product.name}"?`)) return
    try {
      await deleteProduct(selectedList.id, product.id)
      toast('Đã xóa sản phẩm', 'success')
    } catch { toast('Lỗi xóa sản phẩm', 'error') }
  }

  const handleDeleteList = async () => {
    if (!isAdmin || !selectedList) return
    if (!confirm(`Xóa bảng giá "${selectedList.name}" và toàn bộ sản phẩm? Hành động này không thể hoàn tác.`)) return
    try {
      await deletePriceList(selectedList.id)
      setSelectedList(null)
      setProducts([])
      toast('Đã xóa bảng giá', 'success')
    } catch { toast('Lỗi xóa bảng giá', 'error') }
  }

  const handleRenameList = async (id, newName) => {
    const trimmed = newName.trim()
    setEditingListId(null)
    if (!trimmed) return
    const old = lists.find(l => l.id === id)
    if (old && old.name === trimmed) return
    try {
      await updatePriceList(id, { name: trimmed })
      // Cập nhật selectedList nếu đang xem bảng giá đó
      if (selectedList?.id === id) setSelectedList(l => ({ ...l, name: trimmed }))
      toast(`Đã đổi tên thành "${trimmed}"`, 'success')
    } catch { toast('Lỗi đổi tên', 'error') }
  }

  return (
    <div className="price-lists-layout">
      {isMobile && listPanelOpen && (
        <div
          className="price-lists-sidebar-backdrop open"
          onClick={closeListPanel}
          aria-hidden="true"
        />
      )}

      {/* Sidebar list */}
      <div
        className={`price-lists-sidebar ${isMobile && listPanelOpen ? 'open' : ''}`}
        onTouchStart={onPanelTouchStart}
        onTouchMove={onPanelTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {isMobile && (
          <div className="price-lists-sidebar-head">
            <span>Chọn bảng giá</span>
            <button type="button" className="mobile-icon-btn" onClick={closeListPanel} aria-label="Đóng">✕</button>
          </div>
        )}
        <div className="price-lists-sidebar-label">
          Bảng giá
        </div>
        {lists.map(l => (
          <div
            key={l.id}
            onClick={() => { if (editingListId !== l.id) selectList(l) }}
            className={`price-lists-item ${selectedList?.id === l.id ? 'active' : ''}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              {editingListId === l.id ? (
                // Inline rename input
                <input
                  className="input"
                  style={{ flex: 1, padding: '3px 7px', fontSize: 13, height: 28 }}
                  value={listNameDraft}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onChange={e => setListNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameList(l.id, listNameDraft)
                    if (e.key === 'Escape') setEditingListId(null)
                  }}
                  onBlur={() => handleRenameList(l.id, listNameDraft)}
                />
              ) : (
                <>
                  <span style={{ opacity: .7 }}>📄</span>
                  <span className="price-lists-item-name" style={{ flex: 1 }}>{l.name}</span>
                  {isAdmin && (
                    <button
                      className="btn xs ghost"
                      style={{ padding: '1px 5px', opacity: 0.6, flexShrink: 0 }}
                      title="Đổi tên bảng giá"
                      onClick={e => { e.stopPropagation(); setEditingListId(l.id); setListNameDraft(l.name) }}
                    >✏️</button>
                  )}
                </>
              )}
            </div>
            {l.category && <div className="price-lists-item-cat">{l.category}</div>}
          </div>
        ))}
        {lists.length === 0 && (
          <div className="text-muted text-sm" style={{ padding: '8px 10px' }}>
            {isAdmin ? 'Chưa có bảng giá. Vào Import để tạo.' : 'Chưa có bảng giá.'}
          </div>
        )}
        {isMobile && listPanelOpen && (
          <div className="price-lists-swipe-hint">← Vuốt sang trái để đóng</div>
        )}
      </div>

      {/* Main content */}
      <div
        ref={mainRef}
        className="price-lists-main"
        onTouchStart={onMainTouchStart}
        onTouchMove={onMainTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {!selectedList ? (
          <div className="empty" style={{ margin: 'auto' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Chọn một bảng giá để xem</div>
            <div className="text-muted text-sm">Chọn từ danh sách bên trái</div>
          </div>
        ) : (
          <>
            <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              {isMobile && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setListPanelOpen(true)}
                  style={{ flexShrink: 0 }}
                >
                  📄 Danh sách
                </button>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedList.name}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  {selectedList.category && <span className="tag" style={{ margin: 0 }}>{selectedList.category}</span>}
                  <span className="text-muted text-sm">{products.length} sản phẩm · Realtime 🔴</span>
                  {!isAdmin && <span className="text-muted text-sm">· Bấm SP → tab Hình ảnh để thêm ảnh</span>}
                </div>
              </div>
              <div className="search-wrap" style={{ width: 200 }}>
                <span className="search-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </span>
                <input className="input" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <select className="input select" style={{ width: 170 }} value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
                <option value="">Tất cả nhóm</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{filtered.length}/{products.length} SP</span>
              {isAdmin && (
                <>
                  <button className="btn sm primary" onClick={() => { setShowAddForm(s => !s); setAddForm({ name: '', group: '', spec1: '', spec2: '', price: '' }) }}>
                    {showAddForm ? '✕ Đóng' : '+ Thêm SP'}
                  </button>
                  <button className="btn sm danger" onClick={handleDeleteList} title="Xóa bảng giá này">🗑</button>
                </>
              )}
            </div>

            {/* Add product form */}
            {isAdmin && showAddForm && (
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div className="field" style={{ marginBottom: 0, gridColumn: '1 / span 2' }}>
                    <label className="field-label">Tên / Mã sản phẩm *</label>
                    <input className="input" placeholder="VD: MHI-202EA-220V-0.37KW"
                      value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}/>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label">Nhóm (group)</label>
                    <input className="input" placeholder="VD: BƠM TĂNG ÁP BIẾN TẦN"
                      value={addForm.group} onChange={e => setAddForm(f => ({ ...f, group: e.target.value }))}
                      list="group-list"/>
                    <datalist id="group-list">
                      {[...new Set(products.map(p => p.group).filter(Boolean))].map(g => <option key={g} value={g}/>)}
                    </datalist>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label">Công suất (kW)</label>
                    <input className="input" placeholder="VD: 0.37"
                      value={addForm.spec1} onChange={e => setAddForm(f => ({ ...f, spec1: e.target.value }))}/>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label">Lưu lượng / Thông số</label>
                    <input className="input" placeholder="VD: Hmax 27m - Qmax 4.0"
                      value={addForm.spec2} onChange={e => setAddForm(f => ({ ...f, spec2: e.target.value }))}/>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label">Phi họng (mm)</label>
                    <input className="input" placeholder="VD: 65"
                      value={addForm.phiHocng} onChange={e => setAddForm(f => ({ ...f, phiHocng: e.target.value }))}/>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label">Đơn giá (₫) *</label>
                    <input className="input" type="number" min="0" placeholder="VD: 4000000"
                      value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}/>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm" onClick={() => setShowAddForm(false)}>Hủy</button>
                  <button className="btn sm primary" onClick={handleAddProduct} disabled={addSaving}>
                    {addSaving ? '...' : '✓ Lưu sản phẩm'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
              {loadingList ? (
                <div className="empty"><span className="spinner"/></div>
              ) : (
                <MobileTableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>Tên / Mã sản phẩm</th>
                        <th>Công suất</th>
                        <th>Lưu lượng / Thông số</th>
                        <th>Phi họng</th>
                        <th style={{ textAlign: 'right' }}>Đơn giá</th>
                        <th style={{ width: 56, textAlign: 'center' }}>Ảnh</th>
                        {isAdmin && <th style={{ width: 40 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) =>
                        row.type === 'group' ? (
                          <tr key={'g-' + i} className="group-row">
                            <td colSpan={isAdmin ? 7 : 6} style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)', padding: '7px 14px' }}>
                              📁 {row.label}
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.data.id} onClick={() => setSelectedProduct(row.data)}>
                            <td className="td-mono">{row.data.name || '—'}</td>
                            <td className="td-spec">{row.data.spec1 ? row.data.spec1 + ' kW' : '—'}</td>
                            <td className="td-spec">{row.data.spec2 || '—'}</td>
                            <td className="td-spec">{row.data.phiHocng ? 'φ' + row.data.phiHocng : '—'}</td>
                            <td className="td-price" style={{ textAlign: 'right' }}>{fmt(row.data.price)}</td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>
                              {(row.data.images?.length > 0) ? `📷 ${row.data.images.length}` : '—'}
                            </td>
                            {isAdmin && (
                              <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                <button
                                  className="btn xs ghost"
                                  style={{ color: 'var(--danger)', padding: '2px 6px' }}
                                  onClick={() => handleDeleteProduct(row.data)}
                                  title="Xóa sản phẩm"
                                >🗑</button>
                              </td>
                            )}
                          </tr>
                        )
                      )}
                      {rows.length === 0 && (
                        <tr><td colSpan={isAdmin ? 7 : 6} className="empty" style={{ padding: '36px 0' }}>Không tìm thấy sản phẩm</td></tr>
                      )}
                    </tbody>
                  </table>
                </MobileTableWrap>
              )}
            </div>
          </>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSave={handleSaveProduct}
          readOnly={false}
        />
      )}
    </div>
  )
}
