import { useState, useEffect, useMemo } from 'react'
import { subscribePriceLists, subscribeProducts, updateProduct, updateProductImages, deletePriceList } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import ProductModal from '../components/ProductModal'

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

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar list */}
      <div style={{
        width: 220, minWidth: 220, borderRight: '1px solid var(--border)',
        background: 'var(--surface)', overflowY: 'auto', padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Bảng giá
        </div>
        {lists.map(l => (
          <div
            key={l.id}
            onClick={() => { setSelectedList(l); setSearch(''); setGroupFilter('') }}
            style={{
              padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: selectedList?.id === l.id ? 'var(--accent-s)' : 'transparent',
              color: selectedList?.id === l.id ? 'var(--accent)' : 'var(--text)',
              fontWeight: selectedList?.id === l.id ? 600 : 400,
              fontSize: 13, transition: 'background 0.1s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: .7 }}>📄</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
            </div>
            {l.category && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, paddingLeft: 18 }}>{l.category}</div>}
          </div>
        ))}
        {lists.length === 0 && (
          <div className="text-muted text-sm" style={{ padding: '8px 10px' }}>
            {isAdmin ? 'Chưa có bảng giá. Vào Import để tạo.' : 'Chưa có bảng giá.'}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedList ? (
          <div className="empty" style={{ margin: 'auto' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Chọn một bảng giá để xem</div>
            <div className="text-muted text-sm">Chọn từ danh sách bên trái</div>
          </div>
        ) : (
          <>
            <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
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
                <button className="btn sm danger" onClick={handleDeleteList} title="Xóa bảng giá này">🗑</button>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
              {loadingList ? (
                <div className="empty"><span className="spinner"/></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '36%' }}>Tên / Mã sản phẩm</th>
                        <th>Công suất</th>
                        <th>Lưu lượng / Thông số</th>
                        <th style={{ textAlign: 'right' }}>Đơn giá</th>
                        <th style={{ width: 56, textAlign: 'center' }}>Ảnh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) =>
                        row.type === 'group' ? (
                          <tr key={'g-' + i} className="group-row">
                            <td colSpan={5} style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)', padding: '7px 14px' }}>
                              📁 {row.label}
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.data.id} onClick={() => setSelectedProduct(row.data)}>
                            <td className="td-mono">{row.data.name || '—'}</td>
                            <td className="td-spec">{row.data.spec1 ? row.data.spec1 + ' kW' : '—'}</td>
                            <td className="td-spec">{row.data.spec2 || '—'}</td>
                            <td className="td-price" style={{ textAlign: 'right' }}>{fmt(row.data.price)}</td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>
                              {(row.data.images?.length > 0) ? `📷 ${row.data.images.length}` : '—'}
                            </td>
                          </tr>
                        )
                      )}
                      {rows.length === 0 && (
                        <tr><td colSpan={5} className="empty" style={{ padding: '36px 0' }}>Không tìm thấy sản phẩm</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
