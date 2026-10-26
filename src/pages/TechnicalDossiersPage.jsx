import { useState, useEffect, useMemo, useRef } from 'react'
import {
  subscribeTechnicalDossiers,
  uploadTechnicalDossier,
  addTechnicalDossierLink,
  deleteTechnicalDossier,
  getPriceLists
} from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'

const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/** Chuyển link Google Drive share hoặc PDF → embed URL */
const toEmbedUrl = (raw) => {
  if (!raw) return ''
  const m = raw.match(/\/file\/d\/([^/?\s]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  const m2 = raw.match(/[?&]id=([^&\s]+)/)
  if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`
  if (raw.includes('drive.google.com') && raw.includes('/view')) {
    return raw.replace(/\/view.*$/, '/preview')
  }
  if (raw.includes('firebasestorage.googleapis.com') || raw.toLowerCase().includes('.pdf')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(raw)}&embedded=true`
  }
  return raw
}

const openDossier = (dossier) => {
  if (!dossier?.url) return
  window.open(dossier.url, '_blank', 'noopener,noreferrer')
}

const isGoogleDriveUrl = (url) => url && url.includes('drive.google.com')

const getFileIcon = (dossier) => {
  if (dossier.isExternalLink) {
    return { icon: '🔗', color: '#8b5cf6', label: 'Drive / Link' }
  }
  const name = (dossier.fileName || dossier.name || '').toLowerCase()
  if (name.endsWith('.pdf')) return { icon: '📕', color: '#ef4444', label: 'PDF' }
  if (name.endsWith('.doc') || name.endsWith('.docx')) return { icon: '📘', color: '#3b82f6', label: 'Word' }
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return { icon: '📗', color: '#10b981', label: 'Excel' }
  if (name.endsWith('.zip') || name.endsWith('.rar')) return { icon: '🗂️', color: '#f59e0b', label: 'Nén' }
  if (name.endsWith('.dwg') || name.endsWith('.dxf')) return { icon: '📐', color: '#6366f1', label: 'Bản vẽ' }
  return { icon: '📄', color: '#64748b', label: 'File' }
}

export default function TechnicalDossiersPage() {
  const { user, profile, isAdmin } = useAuth()
  const toast = useToast()

  const [dossiers, setDossiers] = useState([])
  const [priceLists, setPriceLists] = useState([])
  const [search, setSearch] = useState('')
  const [selectedLine, setSelectedLine] = useState('')
  const [viewing, setViewing] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, text: '' })
  const [showForm, setShowForm] = useState(false)
  const [addMode, setAddMode] = useState('file') // 'file' | 'link'
  
  // Form states
  const [selectedLineForUpload, setSelectedLineForUpload] = useState('')
  const [customLineName, setCustomLineName] = useState('')
  const [note, setNote] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')

  // Batch file upload: danh sách các file được chọn [{ file, name, id }]
  const [selectedFiles, setSelectedFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // Tải danh sách hồ sơ thời gian thực
  useEffect(() => {
    const unsub = subscribeTechnicalDossiers(setDossiers)
    return () => unsub?.()
  }, [])

  // Tải danh sách bảng giá để lấy các dòng sản phẩm
  useEffect(() => {
    getPriceLists().then(lists => {
      setPriceLists(lists || [])
    }).catch(err => {
      console.error('Lỗi tải danh sách bảng giá:', err)
    })
  }, [])

  // Danh sách các dòng sản phẩm từ bảng giá
  const availableLines = useMemo(() => {
    const names = new Set()
    priceLists.forEach(pl => {
      if (pl.name?.trim()) names.add(pl.name.trim())
    })
    dossiers.forEach(d => {
      if (d.lineName?.trim()) names.add(d.lineName.trim())
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [priceLists, dossiers])

  // Lọc tài liệu theo tìm kiếm và theo dòng
  const filteredDossiers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dossiers.filter(d => {
      if (selectedLine && d.lineName !== selectedLine) return false
      if (!q) return true
      return (d.name || '').toLowerCase().includes(q) ||
             (d.lineName || '').toLowerCase().includes(q) ||
             (d.note || '').toLowerCase().includes(q) ||
             (d.fileName || '').toLowerCase().includes(q)
    })
  }, [dossiers, search, selectedLine])

  const resetForm = () => {
    setShowForm(false)
    setSelectedFiles([])
    setUploadProgress({ current: 0, total: 0, text: '' })
    setSelectedLineForUpload('')
    setCustomLineName('')
    setNote('')
    setLinkUrl('')
    setLinkName('')
  }

  // Thêm file vào danh sách batch
  const handleAddFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return
    const newItems = []
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i]
      if (file.size > 100 * 1024 * 1024) {
        toast(`File "${file.name}" > 100MB. Vui lòng tải qua Google Drive!`, 'error')
        continue
      }
      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name.replace(/\.[^/.]+$/, '')
      })
    }

    if (newItems.length > 0) {
      setSelectedFiles(prev => [...prev, ...newItems])
      setAddMode('file')
      if (!selectedLineForUpload && availableLines.length > 0) {
        setSelectedLineForUpload(availableLines[0])
      }
      setShowForm(true)
    }
  }

  const handleRemoveFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleUpdateFileName = (id, newName) => {
    setSelectedFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f))
  }

  const handleOpenAddModal = (mode = 'file') => {
    setAddMode(mode)
    if (!selectedLineForUpload && availableLines.length > 0) {
      setSelectedLineForUpload(availableLines[0])
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    const lineToUse = selectedLineForUpload === '__custom__'
      ? customLineName.trim()
      : selectedLineForUpload.trim()

    if (!lineToUse) {
      toast('Vui lòng chọn hoặc nhập dòng sản phẩm (tên bảng giá)!', 'error')
      return
    }

    const matchedPL = priceLists.find(p => p.name?.trim() === lineToUse)
    const currentUserName = profile?.name || user?.email?.split('@')[0] || 'Admin'

    // Chế độ thêm Link Google Drive
    if (addMode === 'link') {
      if (!linkName.trim()) {
        toast('Vui lòng nhập tên tài liệu / link!', 'error')
        return
      }
      if (!linkUrl.trim()) {
        toast('Vui lòng dán link Google Drive hoặc liên kết tải!', 'error')
        return
      }
      setUploading(true)
      try {
        await addTechnicalDossierLink({
          name: linkName.trim(),
          lineName: lineToUse,
          priceListId: matchedPL?.id || '',
          note: note.trim(),
          linkUrl: toEmbedUrl(linkUrl.trim()),
          uploadedBy: currentUserName,
        })
        toast('Đã lưu liên kết hồ sơ thành công!', 'success')
        resetForm()
      } catch (err) {
        toast('Lỗi khi lưu link: ' + err.message, 'error')
      } finally {
        setUploading(false)
      }
      return
    }

    // Chế độ Upload Batch File (Tải hàng loạt file)
    if (selectedFiles.length === 0) {
      toast('Vui lòng chọn hoặc kéo thả ít nhất 1 file tài liệu!', 'error')
      return
    }

    setUploading(true)
    const total = selectedFiles.length
    let successCount = 0
    let failedCount = 0

    try {
      for (let i = 0; i < total; i++) {
        const item = selectedFiles[i]
        setUploadProgress({
          current: i + 1,
          total,
          text: `Đang tải lên (${i + 1}/${total}): ${item.file.name}...`
        })

        try {
          await uploadTechnicalDossier({
            file: item.file,
            name: item.name.trim() || item.file.name,
            lineName: lineToUse,
            priceListId: matchedPL?.id || '',
            note: note.trim(),
            uploadedBy: currentUserName,
          })
          successCount++
        } catch (uploadErr) {
          console.error(`Lỗi tải file ${item.file.name}:`, uploadErr)
          failedCount++
        }
      }

      if (failedCount === 0) {
        toast(`Đã tải lên thành công tất cả ${successCount} hồ sơ cho dòng "${lineToUse}"!`, 'success')
        resetForm()
      } else {
        toast(`Đã tải xong: ${successCount} thành công, ${failedCount} lỗi.`, 'error')
      }
    } catch (err) {
      toast('Lỗi tiến trình tải file: ' + err.message, 'error')
    } finally {
      setUploading(false)
      setUploadProgress({ current: 0, total: 0, text: '' })
    }
  }

  const handleDelete = async (dossier) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa hồ sơ: "${dossier.name}"?`)) return
    try {
      await deleteTechnicalDossier(dossier)
      toast('Đã xóa hồ sơ', 'success')
    } catch (err) {
      toast('Lỗi khi xóa: ' + err.message, 'error')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Header */}
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: '1 1 240px' }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📁</span> Hồ sơ kỹ thuật
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Tài liệu, bản vẽ kỹ thuật, CO-CQ theo từng dòng sản phẩm
          </div>
        </div>

        {/* Search */}
        <div className="search-wrap" style={{ width: 220, minWidth: 160 }}>
          <span className="search-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            className="input"
            placeholder="Tìm hồ sơ, dòng máy..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Action Buttons for Admin */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn sm"
              onClick={() => handleOpenAddModal('link')}
              title="Dán link tài liệu từ Google Drive"
            >
              🔗 Thêm link Drive
            </button>
            <button
              className="btn primary sm"
              onClick={() => fileRef.current?.click()}
              title="Tải nhiều file hồ sơ cùng lúc"
            >
              ⬆ Tải lên hồ sơ (Nhiều file)
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.dwg,.dxf,image/*"
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) {
              handleAddFiles(e.target.files)
            }
            e.target.value = ''
          }}
        />
      </div>

      {/* Filter by Product Line (Các dòng từ Bảng Giá) */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>🏷️</span> Dòng sản phẩm:
        </span>

        <button
          onClick={() => setSelectedLine('')}
          className="btn sm"
          style={{
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: !selectedLine ? 700 : 500,
            background: !selectedLine ? 'var(--accent)' : 'var(--bg)',
            color: !selectedLine ? '#fff' : 'var(--text2)',
            borderColor: !selectedLine ? 'var(--accent)' : 'var(--border)',
          }}
        >
          Tất cả ({dossiers.length})
        </button>

        {availableLines.map(line => {
          const count = dossiers.filter(d => d.lineName === line).length
          const isSel = selectedLine === line
          return (
            <button
              key={line}
              onClick={() => setSelectedLine(isSel ? '' : line)}
              className="btn sm"
              style={{
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: isSel ? 700 : 500,
                background: isSel ? 'var(--accent)' : 'var(--bg)',
                color: isSel ? '#fff' : 'var(--text)',
                borderColor: isSel ? 'var(--accent)' : 'var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{line}</span>
              <span style={{
                fontSize: 10,
                background: isSel ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                padding: '1px 5px',
                borderRadius: 10,
                color: isSel ? '#fff' : 'var(--text2)'
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>

        {/* Upload Form Modal / Drawer */}
        {isAdmin && showForm && (
          <div className="card" style={{ marginBottom: 20, border: '1.5px solid var(--accent)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📁</span> Thêm hồ sơ kỹ thuật (Hỗ trợ kéo chọn nhiều file)
              </div>
              <button className="btn sm ghost" onClick={resetForm} disabled={uploading} style={{ padding: '2px 8px' }}>✕ Đóng</button>
            </div>

            {/* Mode selection */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setAddMode('file')}
                className={`btn sm ${addMode === 'file' ? 'primary' : ''}`}
                style={{ borderRadius: 6 }}
              >
                ⬆ Tải file trực tiếp (Chọn hoặc kéo thả nhiều file)
              </button>
              <button
                type="button"
                onClick={() => setAddMode('link')}
                className={`btn sm ${addMode === 'link' ? 'primary' : ''}`}
                style={{ borderRadius: 6 }}
              >
                🔗 Link Google Drive / Web (Không giới hạn dung lượng)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
              {/* Product line selection (from price lists) */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ fontWeight: 600 }}>
                  Dòng sản phẩm (Chọn từ Bảng giá) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  className="input select"
                  value={selectedLineForUpload}
                  onChange={e => setSelectedLineForUpload(e.target.value)}
                >
                  <option value="">-- Chọn dòng sản phẩm áp dụng --</option>
                  {availableLines.map(line => (
                    <option key={line} value={line}>{line}</option>
                  ))}
                  <option value="__custom__">+ Nhập tên dòng sản phẩm mới...</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                  💡 Tất cả các file trong đợt này sẽ được gán vào dòng sản phẩm đã chọn ở đây.
                </div>
              </div>

              {selectedLineForUpload === '__custom__' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Tên dòng sản phẩm mới <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    className="input"
                    placeholder="VD: BƠM APP CHÌM BAV..."
                    value={customLineName}
                    onChange={e => setCustomLineName(e.target.value)}
                  />
                </div>
              )}

              {/* Note */}
              <div className="field" style={{ marginBottom: 0, gridColumn: addMode === 'link' ? 'auto' : '1 / -1' }}>
                <label className="field-label">Ghi chú chung (tùy chọn)</label>
                <input
                  className="input"
                  placeholder="VD: Bản vẽ kỹ thuật 2026, CO/CQ..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {/* Link Input if mode is link */}
              {addMode === 'link' && (
                <>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label" style={{ fontWeight: 600 }}>
                      Tên hồ sơ / tài liệu <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      className="input"
                      placeholder="VD: Catalogue tổng hợp CNP 2026"
                      value={linkName}
                      onChange={e => setLinkName(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label className="field-label" style={{ fontWeight: 600 }}>
                      Link Google Drive / Web <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      className="input"
                      placeholder="https://drive.google.com/file/d/... hoặc link tài liệu"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                    />
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      💡 Hướng dẫn Drive: Chuột phải file trên Google Drive → <strong>Chia sẻ (Bất kỳ ai có liên kết)</strong> → <strong>Sao chép liên kết</strong> rồi dán vào đây.
                    </div>
                    {linkUrl && isGoogleDriveUrl(linkUrl) && (
                      <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 3 }}>
                        ✓ Đã nhận diện đường link Google Drive
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Multiple files preview & management */}
            {addMode === 'file' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                    Danh sách file đã chọn ({selectedFiles.length} file):
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    + Chọn thêm file...
                  </button>
                </div>

                {selectedFiles.length === 0 ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: 24,
                      border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius)',
                      textAlign: 'center',
                      background: 'var(--bg)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📑</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                      Chưa có file nào được chọn
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                      Bấm vào đây hoặc kéo thả một hoặc nhiều file vào khung
                    </div>
                  </div>
                ) : (
                  <div style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg)',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    {selectedFiles.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: 'var(--surface)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', width: 22 }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontSize: 18 }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            className="input"
                            style={{ height: 28, fontSize: 12, padding: '2px 8px', fontWeight: 600 }}
                            value={item.name}
                            onChange={e => handleUpdateFileName(item.id, e.target.value)}
                            title="Sửa tên hiển thị của tài liệu"
                            disabled={uploading}
                          />
                          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2, display: 'flex', gap: 10 }}>
                            <span>Tên gốc: {item.file.name}</span>
                            <span>Dung lượng: {fmtSize(item.file.size)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => handleRemoveFile(item.id)}
                          disabled={uploading}
                          style={{ color: 'var(--danger)', fontSize: 16, padding: '2px 6px' }}
                          title="Bỏ file này"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Progress bar */}
            {uploading && uploadProgress.total > 0 && (
              <div style={{ marginBottom: 14, background: 'var(--bg)', padding: 10, borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{uploadProgress.text}</span>
                  <span style={{ fontWeight: 700 }}>
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`,
                    background: 'var(--accent)',
                    transition: 'width 0.2s'
                  }}/>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={resetForm} disabled={uploading}>
                Hủy bỏ
              </button>
              <button
                className="btn sm primary"
                onClick={handleSave}
                disabled={uploading || (addMode === 'file' && selectedFiles.length === 0)}
                style={{ fontWeight: 700 }}
              >
                {uploading ? (
                  <><span className="spinner" style={{ width: 13, height: 13 }}/> Đang tải lên...</>
                ) : addMode === 'link' ? (
                  '🔗 Lưu liên kết hồ sơ'
                ) : (
                  `⬆ Tải lên & Lưu ${selectedFiles.length > 0 ? selectedFiles.length + ' file' : 'hồ sơ'}`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Drag & Drop Area for Admin */}
        {isAdmin && !showForm && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleAddFiles(e.dataTransfer.files)
              }
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              textAlign: 'center',
              marginBottom: 20,
              cursor: 'pointer',
              transition: 'all .15s',
              background: dragOver ? 'var(--accent-s)' : 'var(--surface)',
              color: 'var(--text2)',
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>📑</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              Kéo thả một hoặc nhiều file hồ sơ vào đây (hoặc bấm để chọn)
            </div>
            <div style={{ fontSize: 11 }}>
              Hỗ trợ kéo cùng lúc nhiều file PDF, Word, Excel, Bản vẽ CAD, File nén để cùng lưu vào 1 dòng sản phẩm
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredDossiers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
              {search || selectedLine ? 'Không tìm thấy hồ sơ phù hợp' : 'Chưa có hồ sơ kỹ thuật nào'}
            </div>
            <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
              {search || selectedLine
                ? 'Thử xóa bộ lọc hoặc tìm kiếm với từ khóa khác.'
                : isAdmin
                  ? 'Bấm nút "Tải lên hồ sơ (Nhiều file)" hoặc "Thêm link Drive" phía trên để lưu tài liệu theo các dòng sản phẩm.'
                  : 'Hiện chưa có tài liệu kỹ thuật nào được đăng tải cho dòng này.'}
            </div>
          </div>
        ) : (
          /* Grid of dossiers */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16
          }}>
            {filteredDossiers.map(dossier => {
              const fileMeta = getFileIcon(dossier)
              const isPdfOrDrive = dossier.isExternalLink || (dossier.fileName || dossier.name || '').toLowerCase().endsWith('.pdf')
              const formattedDate = dossier.createdAt?.toDate
                ? dossier.createdAt.toDate().toLocaleDateString('vi-VN')
                : ''

              return (
                <div
                  key={dossier.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                >
                  {/* Card Header with Line Badge */}
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--bg)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: '#2563eb',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      maxWidth: '75%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={`Dòng sản phẩm: ${dossier.lineName}`}>
                      <span>🏷️</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dossier.lineName || 'Chung'}
                      </span>
                    </div>

                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: fileMeta.color,
                      background: 'var(--surface)',
                      padding: '2px 7px',
                      borderRadius: 12,
                      border: '1px solid var(--border)'
                    }}>
                      {fileMeta.label}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div style={{ padding: '14px 16px', flex: 1, display: 'flex', gap: 12 }}>
                    <div style={{
                      fontSize: 28,
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: 'var(--bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {fileMeta.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          lineHeight: 1.35,
                          marginBottom: 4,
                          color: 'var(--text)',
                          wordBreak: 'break-word',
                          cursor: 'pointer'
                        }}
                        onClick={() => isPdfOrDrive ? setViewing(dossier) : openDossier(dossier)}
                        title="Bấm để xem hoặc mở tài liệu"
                      >
                        {dossier.name}
                      </div>

                      {dossier.note && (
                        <div style={{
                          fontSize: 12,
                          color: 'var(--text2)',
                          marginBottom: 6,
                          lineHeight: 1.4,
                          fontStyle: 'italic'
                        }}>
                          {dossier.note}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
                        {dossier.fileSize ? (
                          <span>📦 {fmtSize(dossier.fileSize)}</span>
                        ) : null}
                        {formattedDate && (
                          <span>📅 {formattedDate}</span>
                        )}
                        {dossier.uploadedBy && (
                          <span>👤 {dossier.uploadedBy}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    padding: '10px 14px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    {isPdfOrDrive ? (
                      <button
                        className="btn sm"
                        onClick={() => setViewing(dossier)}
                        style={{ flex: 1, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <span>👁</span> Xem tài liệu
                      </button>
                    ) : null}

                    <button
                      className="btn sm primary"
                      onClick={() => openDossier(dossier)}
                      style={{
                        flex: isPdfOrDrive ? '0 0 auto' : 1,
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                      title="Mở tab mới hoặc tải file về"
                    >
                      <span>↗</span> {dossier.isExternalLink ? 'Mở link' : 'Tải về'}
                    </button>

                    {isAdmin && (
                      <button
                        className="btn sm ghost"
                        style={{ color: 'var(--danger)', fontSize: 13, padding: '4px 8px' }}
                        onClick={() => handleDelete(dossier)}
                        title="Xóa hồ sơ"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PDF / Google Drive Document Preview Modal */}
      {viewing && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div style={{
            width: '95vw',
            height: '92vh',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {viewing.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  Dòng sản phẩm: {viewing.lineName || 'Chung'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openDossier(viewing)}
                className="btn sm primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <span>↗</span> Mở tab ngoài / Tải về
              </button>

              <button
                className="btn ghost sm"
                onClick={() => setViewing(null)}
                style={{ fontSize: 18, padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            {/* Hint Bar */}
            <div style={{
              padding: '8px 16px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>💡 Nếu tài liệu tải chậm hoặc trang trắng do mạng:</span>
              <button
                onClick={() => openDossier(viewing)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Bấm vào đây để mở trực tiếp trong Tab mới ↗
              </button>
            </div>

            {/* Iframe View */}
            <div style={{ flex: 1, position: 'relative', background: '#1e293b' }}>
              <iframe
                src={toEmbedUrl(viewing.url)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', background: '#ffffff' }}
                title={viewing.name}
                allow="autoplay; encrypted-media"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
