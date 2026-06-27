import { useState, useEffect, useMemo, useRef } from 'react'
import { subscribeCostPrices, bulkUpsertCostPrices } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { parseCostPriceFile } from '../utils/costPriceParse'
import { writeJsonWorkbook } from '../utils/excelParse'

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

export default function CostPricesPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const fileRef = useRef()

  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const unsub = subscribeCostPrices(setItems)
    return unsub
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i =>
      !q ||
      (i.code || '').toLowerCase().includes(q) ||
      (i.name || '').toLowerCase().includes(q)
    )
  }, [items, search])

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const { items: parsed, duplicates } = parseCostPriceFile(ev.target.result)
        if (!parsed.length) {
          toast('Không tìm thấy dữ liệu. Cột B=Mã, C=Tên, D=ĐVT, E=Giá bình quân', 'error')
          return
        }
        await bulkUpsertCostPrices(parsed)
        const dupMsg = duplicates.length ? ` (gộp ${duplicates.length} dòng trùng)` : ''
        toast(`Import thành công ${parsed.length} mặt hàng${dupMsg}`, 'success')
      } catch (err) {
        toast('Lỗi import: ' + err.message, 'error')
      } finally {
        setImporting(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleExport = () => {
    const rows = filtered.map(i => ({
      'Mã hàng': i.code,
      'Tên hàng': i.name,
      'ĐVT': i.unit,
      'Đơn giá bình quân': i.avgPrice,
    }))
    writeJsonWorkbook(rows, `gia-von-tinh-chenh-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
    toast('Đã xuất Excel', 'success')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ flex: 1 }}>Giá gốc tính chênh</h2>
        <div className="search-wrap" style={{ width: 220 }}>
          <span className="search-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input className="input" placeholder="Tìm mã, tên..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button className="btn" onClick={handleExport} disabled={!filtered.length}>📥 Xuất Excel</button>
        {isAdmin && (
          <button className="btn primary" onClick={() => fileRef.current.click()} disabled={importing}>
            {importing ? <span className="spinner" style={{ width: 14, height: 14 }}/> : '📤'} Nhập Excel
          </button>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport}/>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        <div className="card" style={{ marginBottom: 16, background: 'var(--accent-s)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize: 13, color: 'var(--accent)' }}>
            <strong>Bảng giá vốn xuất hóa đơn</strong> — dùng khi tạo đơn bán để chọn giá gốc tính chênh.
            {isAdmin && ' Admin import file Excel: cột B=Mã hàng, C=Tên, D=ĐVT, E=Đơn giá bình quân.'}
          </div>
        </div>

        <div className="card">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ flex: 1 }}>Danh sách ({filtered.length}/{items.length})</h3>
          </div>

          {items.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div>Chưa có dữ liệu giá vốn</div>
              {isAdmin && <div className="text-muted text-sm" style={{ marginTop: 6 }}>Import file Excel giá vốn để bắt đầu</div>}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã hàng</th>
                    <th>Tên hàng</th>
                    <th>ĐVT</th>
                    <th style={{ textAlign: 'right' }}>Đơn giá bình quân</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}>
                      <td className="td-mono">{i.code}</td>
                      <td>{i.name}</td>
                      <td className="text-muted text-sm">{i.unit || '—'}</td>
                      <td className="td-price" style={{ textAlign: 'right' }}>{fmt(i.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
