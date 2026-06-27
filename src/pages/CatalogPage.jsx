import { useState, useEffect, useMemo, useRef } from 'react'
import { subscribeCatalogs, uploadCatalog, addCatalogLink, deleteCatalog } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'

const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/** Chuyển link Google Drive share → embed URL */
const toEmbedUrl = (raw) => {
  if (!raw) return raw
  // https://drive.google.com/file/d/FILE_ID/view?...
  const m = raw.match(/\/file\/d\/([^/?\s]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  // https://drive.google.com/open?id=FILE_ID
  const m2 = raw.match(/[?&]id=([^&\s]+)/)
  if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`
  return raw
}

const isGoogleDriveUrl = (url) => url && url.includes('drive.google.com')

export default function CatalogPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [catalogs, setCatalogs]       = useState([])
  const [search, setSearch]           = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [viewing, setViewing]         = useState(null)   // catalog đang xem PDF
  const [uploading, setUploading]     = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [addMode, setAddMode]         = useState('file') // 'file' | 'link'
  const [form, setForm]               = useState({ name: '', brand: '', note: '', linkUrl: '' })
  const [dragOver, setDragOver]       = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileRef = useRef()

  useEffect(() => subscribeCatalogs(setCatalogs), [])

  const brands = useMemo(() =>
    [...new Set(catalogs.map(c => c.brand).filter(Boolean))].sort(), [catalogs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return catalogs.filter(c => {
      if (brandFilter && c.brand !== brandFilter) return false
      if (!q) return true
      return (c.name || '').toLowerCase().includes(q) ||
             (c.brand || '').toLowerCase().includes(q) ||
             (c.note || '').toLowerCase().includes(q)
    })
  }, [catalogs, search, brandFilter])

  const resetForm = () => { setShowForm(false); setSelectedFile(null); setForm({ name: '', brand: '', note: '', linkUrl: '' }) }

  const handleFilePick = (file) => {
    if (!file || file.type !== 'application/pdf') {
      toast('Chỉ hỗ trợ file PDF', 'error'); return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast('File > 20MB — dùng "Thêm link Google Drive" để tránh tốn dung lượng Firebase', 'error')
      return
    }
    setSelectedFile(file)
    setAddMode('file')
    setForm(f => ({ ...f, name: f.name || file.name.replace(/\.pdf$/i, '') }))
    setShowForm(true)
  }

  const handleUpload = async () => {
    if (!form.name.trim()) { toast('Nhập tên catalog', 'error'); return }

    if (addMode === 'link') {
      if (!form.linkUrl.trim()) { toast('Nhập link Google Drive', 'error'); return }
      setUploading(true)
      try {
        await addCatalogLink({
          name: form.name.trim(),
          brand: form.brand.trim(),
          note: form.note.trim(),
          linkUrl: toEmbedUrl(form.linkUrl.trim()),
        })
        toast('Đã thêm catalog', 'success')
        resetForm()
      } catch (e) { toast('Lỗi: ' + e.message, 'error') }
      finally { setUploading(false) }
      return
    }

    if (!selectedFile) { toast('Chọn file PDF trước', 'error'); return }
    setUploading(true)
    try {
      await uploadCatalog({ file: selectedFile, name: form.name.trim(), brand: form.brand.trim(), note: form.note.trim() })
      toast('Đã upload catalog', 'success')
      resetForm()
    } catch (e) { toast('Lỗi upload: ' + e.message, 'error') }
    finally { setUploading(false) }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Xóa catalog "${cat.name}"?`)) return
    try { await deleteCatalog(cat); toast('Đã xóa', 'success') }
    catch { toast('Lỗi xóa', 'error') }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ flex: 1 }}>Catalog sản phẩm</h2>
        <div className="search-wrap" style={{ width: 200 }}>
          <span className="search-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input className="input" placeholder="Tìm catalog..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input select" style={{ width: 160 }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
          <option value="">Tất cả hãng</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {isAdmin && (
          <>
            <button className="btn sm" onClick={() => { setAddMode('link'); setShowForm(true) }}>
              🔗 Thêm link Drive
            </button>
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              ⬆ Upload PDF
            </button>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleFilePick(e.target.files[0]); e.target.value = '' }}/>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Add form */}
        {isAdmin && showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
              {[['file', '⬆ Upload file PDF (<20MB)'], ['link', '🔗 Link Google Drive (PDF to, không giới hạn)']].map(([m, label]) => (
                <button key={m} onClick={() => setAddMode(m)} style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: addMode === m ? 700 : 400,
                  color: addMode === m ? 'var(--accent)' : 'var(--text2)',
                  borderBottom: addMode === m ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'none', border: 'none', borderBottom: addMode === m ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer', marginBottom: -1,
                }}>{label}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Tên catalog *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: SELANNI cánh inox 2026"/>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Hãng / Thương hiệu</label>
                <input className="input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  list="brand-list" placeholder="VD: SELANNI"/>
                <datalist id="brand-list">{brands.map(b => <option key={b} value={b}/>)}</datalist>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Ghi chú</label>
                <input className="input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Bơm chìm, 2026..."/>
              </div>
              {addMode === 'link' && (
                <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="field-label">Link Google Drive *</label>
                  <input className="input" value={form.linkUrl}
                    onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                    placeholder="https://drive.google.com/file/d/xxx/view?usp=sharing"/>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                    Trong Google Drive: chuột phải file PDF → <strong>Chia sẻ</strong> → <strong>Copy link</strong> → dán vào đây
                  </div>
                  {form.linkUrl && isGoogleDriveUrl(form.linkUrl) && (
                    <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 3 }}>✓ Đã nhận diện link Google Drive</div>
                  )}
                </div>
              )}
            </div>

            {addMode === 'file' && selectedFile && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                📄 {selectedFile.name} ({fmtSize(selectedFile.size)})
              </div>
            )}
            {addMode === 'file' && !selectedFile && (
              <div style={{ marginBottom: 12 }}>
                <button className="btn sm" onClick={() => fileRef.current?.click()}>Chọn file PDF</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={resetForm}>Hủy</button>
              <button className="btn sm primary" onClick={handleUpload} disabled={uploading}>
                {uploading
                  ? <><span className="spinner" style={{ width: 13, height: 13 }}/> Đang lưu...</>
                  : addMode === 'link' ? '🔗 Lưu link' : '⬆ Upload'}
              </button>
            </div>
          </div>
        )}

        {/* Drop zone (admin) */}
        {isAdmin && !showForm && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFilePick(f) }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center',
              marginBottom: 20, cursor: 'pointer', transition: 'all .15s',
              background: dragOver ? 'var(--accent-s)' : 'var(--surface)',
              color: 'var(--text2)', fontSize: 13,
            }}>
            📄 Kéo thả file PDF vào đây hoặc bấm để chọn
          </div>
        )}

        {/* Grid catalog */}
        {filtered.length === 0 ? (
          <div className="empty" style={{ padding: '60px 0' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📚</div>
            <div style={{ fontWeight: 500 }}>{catalogs.length === 0 ? 'Chưa có catalog nào' : 'Không tìm thấy'}</div>
            {isAdmin && catalogs.length === 0 && <div className="text-muted text-sm" style={{ marginTop: 4 }}>Upload file PDF để thêm catalog</div>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {filtered.map(cat => (
              <div key={cat.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', overflow: 'hidden', cursor: 'pointer',
                transition: 'box-shadow .15s, transform .15s',
                display: 'flex', flexDirection: 'column',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
              >
                {/* PDF preview area */}
                <div
                  onClick={() => setViewing(cat)}
                  style={{
                    height: 160, background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, position: 'relative',
                  }}>
                  <div style={{ fontSize: 48 }}>📋</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>PDF</div>
                  <div style={{ position: 'absolute', top: 8, right: 8, background: cat.isExternalLink ? '#e8f5e9' : 'rgba(0,0,0,.06)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: cat.isExternalLink ? '#2e7d32' : 'var(--text2)', fontWeight: cat.isExternalLink ? 600 : 400 }}>
                    {cat.isExternalLink ? '🔗 Drive' : fmtSize(cat.fileSize)}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: '10px 12px', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3, lineHeight: 1.3 }}>{cat.name}</div>
                  {cat.brand && (
                    <div style={{ display: 'inline-block', background: 'var(--accent-s)', color: 'var(--accent)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                      {cat.brand}
                    </div>
                  )}
                  {cat.note && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{cat.note}</div>}
                </div>

                {/* Actions */}
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                  <button className="btn sm primary" style={{ flex: 1, fontSize: 12 }} onClick={() => setViewing(cat)}>
                    👁 Xem
                  </button>
                  <a href={cat.url} target="_blank" rel="noreferrer" className="btn sm" style={{ fontSize: 12 }} title="Mở tab mới">
                    ↗
                  </a>
                  {isAdmin && (
                    <button className="btn sm ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => handleDelete(cat)} title="Xóa">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {viewing && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div style={{
            width: '90vw', height: '90vh', background: 'var(--surface)',
            borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{viewing.name}</div>
                {viewing.brand && <div style={{ fontSize: 12, color: 'var(--accent)' }}>{viewing.brand}</div>}
              </div>
              <a href={viewing.url} target="_blank" rel="noreferrer" className="btn sm">↗ Mở ngoài</a>
              <button className="btn ghost sm" onClick={() => setViewing(null)}>✕</button>
            </div>
            <iframe
              src={viewing.url + '#toolbar=1&navpanes=0'}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title={viewing.name}
            />
          </div>
        </div>
      )}
    </div>
  )
}
