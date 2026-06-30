import { useState, useMemo } from 'react'
import { createPriceList, saveProducts } from '../firebase/firebase'
import { useToast } from '../components/Toast'
import { parseFcmFromBinary } from '../utils/excelParse'
import MobileTableWrap from '../components/MobileTableWrap'

export default function AdminImportPage() {
  const toast = useToast()
  const [listName, setListName]   = useState('')
  const [category, setCategory]   = useState('')
  const [preview, setPreview]     = useState([])   // [{name, group, spec1, spec2, price, images, order}]
  const [fileName, setFileName]   = useState('')
  const [uploading, setUploading] = useState(false)
  const [dupCount, setDupCount]   = useState(0)

  // group editor state
  const [editingGroup, setEditingGroup] = useState(null)   // group name being renamed
  const [groupDraft,   setGroupDraft]   = useState('')
  const [mergeFrom,    setMergeFrom]    = useState('')     // group to merge FROM
  const [mergeTo,      setMergeTo]      = useState('')     // group to merge INTO
  const [showMerge,    setShowMerge]    = useState(false)

  // per-row group editing
  const [editingRowIdx, setEditingRowIdx] = useState(null)
  const [rowGroupDraft, setRowGroupDraft] = useState('')

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    if (!listName) setListName(file.name.replace(/\.(xlsx?|csv)$/i, ''))
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { products, duplicates } = parseFcmFromBinary(ev.target.result)
      setPreview(products)
      setDupCount(duplicates.length)
      if (duplicates.length) {
        toast(`Đã gộp ${duplicates.length} dòng trùng (giữ dòng cuối)`, 'default')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // ── Group helpers ────────────────────────────────────────────────────────
  const groups = useMemo(() => [...new Set(preview.map(p => p.group))], [preview])

  // Rename a whole group
  const applyRenameGroup = (oldName, newName) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setPreview(ps => ps.map(p => p.group === oldName ? { ...p, group: trimmed } : p))
    toast(`Đã đổi tên nhóm "${oldName}" → "${trimmed}"`, 'success')
  }

  // Merge mergeFrom → mergeTo
  const applyMerge = () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) {
      toast('Chọn 2 nhóm khác nhau', 'error'); return
    }
    setPreview(ps => ps.map(p => p.group === mergeFrom ? { ...p, group: mergeTo } : p))
    toast(`Đã gộp "${mergeFrom}" vào "${mergeTo}"`, 'success')
    setMergeFrom(''); setMergeTo(''); setShowMerge(false)
  }

  // Edit a single row's group
  const applyRowGroup = (idx) => {
    const trimmed = rowGroupDraft.trim()
    if (!trimmed) return
    setPreview(ps => ps.map((p, i) => i === idx ? { ...p, group: trimmed } : p))
    setEditingRowIdx(null)
  }

  // ── Import ───────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!listName.trim())  { toast('Nhập tên bảng giá', 'error');       return }
    if (!preview.length)   { toast('Chưa có sản phẩm để import', 'error'); return }
    setUploading(true)
    try {
      const docRef = await createPriceList({ name: listName.trim(), category: category.trim() })
      await saveProducts(docRef.id, preview)
      toast(`Import thành công ${preview.length} sản phẩm vào "${listName}"`, 'success')
      setPreview([]); setListName(''); setCategory(''); setFileName('')
    } catch (err) {
      toast('Lỗi import: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const fmt = (n) => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header">
        <h2>Import bảng giá mới</h2>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* ── Thông tin bảng giá ── */}
        <div className="card" style={{ maxWidth: 700, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Thông tin bảng giá</h3>
          <div className="row">
            <div className="field">
              <label className="field-label">Tên bảng giá *</label>
              <input className="input" value={listName} onChange={e => setListName(e.target.value)}
                placeholder="VD: Giá sỉ nước thải INOX 2026"/>
            </div>
            <div className="field">
              <label className="field-label">Danh mục / Phân loại</label>
              <input className="input" value={category} onChange={e => setCategory(e.target.value)}
                placeholder="VD: Bơm nước, Điện công nghiệp..."/>
            </div>
          </div>
          <div style={{ marginTop: 4 }}>
            <label className="field-label">File Excel</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn" onClick={() => document.getElementById('xlsInput').click()}>
                📂 Chọn file Excel (.xlsx)
              </button>
              <input id="xlsInput" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile}/>
              {fileName && <span className="text-sm text-muted">📄 {fileName}</span>}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong>Định dạng chuẩn (như bảng giá FCM):</strong>&nbsp;
              Cột A = STT, B = Tên SP, C = Công suất (kW), D = Lưu lượng, E = Đơn giá, <strong>F = Phi họng</strong>.
              Dòng tiêu đề nhóm (Cột E trống) được tự động nhận diện.
              Dòng trùng (cùng nhóm + tên + thông số) sẽ tự gộp, giữ dòng cuối.
            </div>
          </div>
        </div>

        {preview.length > 0 && (
          <>
            {/* ── Group manager ── */}
            <div className="card" style={{ maxWidth: 700, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h3 style={{ flex: 1 }}>Quản lý nhóm ({groups.length} nhóm)</h3>
                <button className="btn sm" onClick={() => setShowMerge(s => !s)}>
                  {showMerge ? '✕ Đóng' : '🔀 Gộp nhóm'}
                </button>
              </div>

              {/* Merge panel */}
              {showMerge && (
                <div style={{
                  background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px', marginBottom: 12,
                  display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
                }}>
                  <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                    <label className="field-label">Nhóm cần gộp (sẽ bị xóa)</label>
                    <select className="input select" value={mergeFrom} onChange={e => setMergeFrom(e.target.value)}>
                      <option value="">— Chọn nhóm —</option>
                      {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div style={{ paddingBottom: 2, color: 'var(--text2)', fontSize: 18 }}>→</div>
                  <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                    <label className="field-label">Gộp vào nhóm</label>
                    <select className="input select" value={mergeTo} onChange={e => setMergeTo(e.target.value)}>
                      <option value="">— Chọn nhóm —</option>
                      {groups.filter(g => g !== mergeFrom).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <button className="btn primary" onClick={applyMerge} style={{ marginBottom: 0 }}>✓ Gộp</button>
                </div>
              )}

              {/* Group list with inline rename */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groups.map(g => {
                  const count = preview.filter(p => p.group === g).length
                  const isEditing = editingGroup === g
                  return (
                    <div key={g} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface2)', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--text2)', fontSize: 11, minWidth: 26, textAlign: 'right' }}>{count}</span>
                      {isEditing ? (
                        <>
                          <input
                            className="input"
                            style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
                            value={groupDraft}
                            autoFocus
                            onChange={e => setGroupDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { applyRenameGroup(g, groupDraft); setEditingGroup(null) }
                              if (e.key === 'Escape') setEditingGroup(null)
                            }}
                          />
                          <button className="btn xs primary" onClick={() => { applyRenameGroup(g, groupDraft); setEditingGroup(null) }}>✓</button>
                          <button className="btn xs" onClick={() => setEditingGroup(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontWeight: 500 }}>{g}</span>
                          <button className="btn xs ghost" onClick={() => { setEditingGroup(g); setGroupDraft(g) }}>✏️ Đổi tên</button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Preview table ── */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h3 style={{ flex: 1 }}>
                  Xem trước: {preview.length} sản phẩm, {groups.length} nhóm
                  {dupCount > 0 && <span style={{ color: 'var(--warning)', fontWeight: 400, fontSize: 13 }}> · đã gộp {dupCount} trùng</span>}
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="text-sm text-muted">Click vào nhóm trong bảng để sửa nhanh</span>
                  <button
                    className="btn primary"
                    onClick={handleImport}
                    disabled={uploading}
                  >
                    {uploading
                      ? <><span className="spinner" style={{ width: 14, height: 14 }}/> Đang upload...</>
                      : `☁️ Import "${listName}"`}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {groups.map(g => <span key={g} className="tag">{g}</span>)}
              </div>

              <MobileTableWrap style={{ maxHeight: 480, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th style={{ minWidth: 160 }}>Nhóm <span style={{ fontWeight: 400, opacity: .6 }}>(click để sửa)</span></th>
                      <th>Tên sản phẩm</th>
                      <th>Công suất</th>
                      <th>Thông số</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá</th>
                      <th>Phi họng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} style={{ cursor: 'default' }}>
                        <td className="text-muted text-sm" style={{ textAlign: 'right' }}>{i + 1}</td>
                        {/* Editable group cell */}
                        <td onClick={() => { if (editingRowIdx !== i) { setEditingRowIdx(i); setRowGroupDraft(p.group) } }}
                          style={{ cursor: 'text', minWidth: 150 }}>
                          {editingRowIdx === i ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input
                                className="input"
                                style={{ padding: '3px 7px', fontSize: 12, flex: 1 }}
                                value={rowGroupDraft}
                                autoFocus
                                list="group-list"
                                onChange={e => setRowGroupDraft(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') applyRowGroup(i)
                                  if (e.key === 'Escape') setEditingRowIdx(null)
                                }}
                                onBlur={() => { applyRowGroup(i) }}
                              />
                              {/* datalist for autocomplete */}
                              <datalist id="group-list">
                                {groups.map(g => <option key={g} value={g}/>)}
                              </datalist>
                            </div>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                              <span className="tag" style={{ margin: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.group}</span>
                              <span style={{ color: 'var(--text3)', fontSize: 10 }}>✏️</span>
                            </span>
                          )}
                        </td>
                        <td className="td-mono" style={{ fontSize: 12 }}>{p.name}</td>
                        <td className="td-spec">{p.spec1 ? p.spec1 + ' kW' : '—'}</td>
                        <td className="td-spec">{p.spec2 || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {p.price != null ? Number(p.price).toLocaleString('vi-VN') + ' ₫' : <span className="text-muted">—</span>}
                        </td>
                        <td className="td-spec">{p.phiHocng || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MobileTableWrap>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
