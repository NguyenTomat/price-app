import { useState, useEffect, useMemo, useRef } from 'react'
import { subscribeInventory, upsertInventoryItem, bulkUpsertInventory, getPriceLists, getProducts } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import {
  parseInventorySheet, readWorkbookSheet,
  inventoryToTonKhoRows, writeAoaWorkbook, writeJsonWorkbook,
} from '../utils/excelParse'

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

export default function InventoryPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const fileRef = useRef()

  const [inventory, setInventory] = useState([])
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showAddFrom, setShowAddFrom] = useState(false)
  const [lists, setLists] = useState([])
  const [addingFromList, setAddingFromList] = useState(null)

  useEffect(() => {
    const unsub = subscribeInventory(setInventory)
    return unsub
  }, [])

  useEffect(() => { getPriceLists().then(setLists) }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return inventory.filter(i =>
      !q || (i.productName || '').toLowerCase().includes(q) || (i.listName || '').toLowerCase().includes(q)
    )
  }, [inventory, search])

  const stockClass = (i) => {
    if (i.qty == null) return ''
    if (i.qty === 0) return 'stock-zero'
    if (i.lowStockAlert != null && i.qty <= i.lowStockAlert) return 'stock-low'
    return 'stock-ok'
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({ qty: item.qty ?? '', unit: item.unit || 'cái', lowStockAlert: item.lowStockAlert ?? '' })
  }

  const handleSaveEdit = async (item) => {
    setSaving(true)
    try {
      await upsertInventoryItem(item.id, {
        ...item,
        qty: parseFloat(editForm.qty) || 0,
        unit: editForm.unit || 'cái',
        lowStockAlert: editForm.lowStockAlert !== '' ? parseFloat(editForm.lowStockAlert) : null,
      })
      setEditId(null)
      toast('Đã cập nhật tồn kho', 'success')
    } catch { toast('Lỗi lưu', 'error') }
    finally { setSaving(false) }
  }

  // Add products from price list to inventory
  const handleAddFromList = async (list) => {
    setAddingFromList(list.id)
    try {
      const prods = await getProducts(list.id)
      const items = prods.map(p => ({
        id: p.id,
        productId: p.id,
        productName: p.name,
        group: p.group,
        listId: list.id,
        listName: list.name,
        price: p.price,
        qty: 0,
        unit: 'cái',
        lowStockAlert: null,
      }))
      await bulkUpsertInventory(items)
      toast(`Đã thêm ${items.length} sản phẩm từ "${list.name}"`, 'success')
      setShowAddFrom(false)
    } catch (e) { toast('Lỗi: ' + e.message, 'error') }
    finally { setAddingFromList(null) }
  }

  // Export Excel (định dạng tổng hợp kho — giống file TONG_HOP_TON_KHO)
  const handleExport = () => {
    const date = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')
    const rows = inventoryToTonKhoRows(inventory)
    writeAoaWorkbook(rows, `ton-kho-${date}.xlsx`)
    toast('Đã xuất Excel (Mã hàng + Tồn kho cuối kỳ)', 'success')
  }

  const handleExportTemplate = () => {
    const rows = inventory.map(i => ({
      'Mã SP': i.productId || i.id,
      'Tên sản phẩm': i.productName,
      'Nhóm': i.group || '',
      'Bảng giá': i.listName || '',
      'Đơn vị': i.unit || 'cái',
      'Tồn kho': i.qty ?? 0,
      'Cảnh báo thấp': i.lowStockAlert ?? '',
      'Đơn giá': i.price ?? '',
    }))
    const date = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')
    writeJsonWorkbook(rows, `ton-kho-chi-tiet-${date}.xlsx`)
    toast('Đã xuất Excel chi tiết', 'success')
  }

  // Import from Excel — hỗ trợ FCM (cột F = Tồn kho) hoặc template chi tiết
  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const { ws } = readWorkbookSheet(ev.target.result)
        const { items, duplicates, format } = parseInventorySheet(ws, inventory)
        if (!items.length) {
          toast('Không tìm thấy dữ liệu hợp lệ. Kiểm tra định dạng Excel.', 'error')
          return
        }
        await bulkUpsertInventory(items)
        const dupMsg = duplicates.length ? ` (gộp ${duplicates.length} dòng trùng)` : ''
        const fmtLabel = format === 'tonkho' ? 'Tổng hợp kho' : format === 'fcm' ? 'FCM' : 'chi tiết'
        toast(`Import thành công ${items.length} mặt hàng${dupMsg} · ${fmtLabel}`, 'success')
      } catch (err) {
        const msg = err.code === 'permission-denied' || /permission/i.test(err.message)
          ? 'Thiếu quyền ghi kho. Vào Firebase Console → Firestore → Rules, thêm block inventory (xem trang Quản lý tài khoản).'
          : err.message
        toast('Lỗi import: ' + msg, 'error')
      }
      finally { setImporting(false) }
    }
    reader.readAsBinaryString(file)
  }

  const totalValue = inventory.reduce((sum, i) => sum + (i.qty || 0) * (i.price || 0), 0)
  const lowCount = inventory.filter(i => i.qty != null && i.lowStockAlert != null && i.qty <= i.lowStockAlert).length
  const zeroCount = inventory.filter(i => (i.qty ?? 0) === 0).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ flex: 1 }}>Quản lý tồn kho</h2>
        <div className="search-wrap" style={{ width: 200 }}>
          <span className="search-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input className="input" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        {isAdmin && (
          <>
            <button className="btn" onClick={handleExport}>📥 Xuất Excel</button>
            <button className="btn" onClick={handleExportTemplate} title="Template có Mã SP, cảnh báo...">📋 Xuất chi tiết</button>
            <button className="btn" onClick={() => fileRef.current.click()} disabled={importing}>
              {importing ? <span className="spinner" style={{ width: 14, height: 14 }}/> : '📤'} Nhập Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport}/>
            <button className="btn primary" onClick={() => setShowAddFrom(s => !s)}>
              {showAddFrom ? '✕' : '+ Thêm từ bảng giá'}
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Stats row */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Tổng mặt hàng</div>
            <div className="stat-value">{inventory.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tồn kho thấp</div>
            <div className="stat-value" style={{ color: lowCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{lowCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hết hàng</div>
            <div className="stat-value" style={{ color: zeroCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{zeroCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tổng giá trị tồn</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{(totalValue / 1_000_000).toFixed(1)} tr</div>
          </div>
        </div>

        {/* Add from list */}
        {showAddFrom && isAdmin && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Thêm sản phẩm từ bảng giá</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
              Chọn bảng giá để thêm tất cả sản phẩm vào danh sách tồn kho (tồn kho ban đầu = 0).
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lists.map(l => (
                <button key={l.id} className="btn" onClick={() => handleAddFromList(l)} disabled={addingFromList === l.id}>
                  {addingFromList === l.id ? <span className="spinner" style={{ width: 12, height: 12 }}/> : '📄'} {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inventory table */}
        <div className="card">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ flex: 1 }}>Danh sách tồn kho</h3>
            <span className="text-muted text-sm">{filtered.length}/{inventory.length} mặt hàng</span>
          </div>

          {inventory.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
              <div>Chưa có dữ liệu tồn kho</div>
              <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                {isAdmin ? 'Thêm từ bảng giá hoặc nhập từ Excel để bắt đầu' : 'Admin chưa cập nhật tồn kho'}
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Nhóm</th>
                    <th>Bảng giá</th>
                    <th style={{ textAlign: 'right' }}>Đơn giá</th>
                    <th style={{ textAlign: 'center' }}>Đơn vị</th>
                    <th style={{ textAlign: 'center' }}>Tồn kho</th>
                    <th style={{ textAlign: 'center' }}>Cảnh báo</th>
                    {isAdmin && <th style={{ textAlign: 'center' }}>Sửa</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} style={{ cursor: 'default' }}>
                      <td className="td-mono" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.productName || '—'}
                      </td>
                      <td className="td-spec">{item.group || '—'}</td>
                      <td className="text-sm text-muted">{item.listName || '—'}</td>
                      <td className="td-price" style={{ textAlign: 'right' }}>{fmt(item.price)}</td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>
                        {editId === item.id
                          ? <input className="input" style={{ width: 60, textAlign: 'center', padding: '4px 6px', fontSize: 12 }} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}/>
                          : item.unit || 'cái'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {editId === item.id
                          ? <input className="input" type="number" style={{ width: 80, textAlign: 'center', padding: '4px 6px' }} value={editForm.qty} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))}/>
                          : <span className={stockClass(item)} style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                              {item.qty ?? '—'}
                            </span>
                        }
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {editId === item.id
                          ? <input className="input" type="number" style={{ width: 80, textAlign: 'center', padding: '4px 6px' }} value={editForm.lowStockAlert} placeholder="—" onChange={e => setEditForm(f => ({ ...f, lowStockAlert: e.target.value }))}/>
                          : <span className="text-sm text-muted">{item.lowStockAlert ?? '—'}</span>
                        }
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          {editId === item.id ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button className="btn xs primary" onClick={() => handleSaveEdit(item)} disabled={saving}>✓</button>
                              <button className="btn xs" onClick={() => setEditId(null)}>✕</button>
                            </div>
                          ) : (
                            <button className="btn xs ghost" onClick={() => startEdit(item)}>✏️</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help note */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          <strong>📋 Định dạng Excel khi nhập:</strong><br/>
          <strong>Cách 1 (file tổng hợp kho — khuyên dùng):</strong> STT | Mã hàng | Tên hàng | Lô SX | <strong>Tồn kho cuối kỳ</strong> — giống file <em>TONG_HOP_TON_KHO</em>. Dòng KHO 1, KHO 4… là tiêu đề kho.<br/>
          <strong>Cách 2 (FCM):</strong> A=STT, B=Tên SP, C=Công suất (kW), D=Thông số, E=Đơn giá, F=Tồn kho.<br/>
          <strong>Cách 3 (chi tiết):</strong> Mã SP, Tên sản phẩm, Nhóm, Bảng giá, Đơn vị, Tồn kho, Cảnh báo thấp, Đơn giá.<br/>
          Quy trình: <strong>Xuất Excel</strong> → chỉnh cột tồn → <strong>Nhập Excel</strong> lại mỗi ngày.
        </div>
      </div>
    </div>
  )
}
