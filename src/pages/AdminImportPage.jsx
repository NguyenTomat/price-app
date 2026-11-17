import { useState, useMemo, useEffect } from 'react'
import {
  subscribePriceLists,
  getProducts,
  createPriceList,
  saveProducts,
  syncPriceListProducts,
} from '../firebase/firebase'
import { useToast } from '../components/Toast'
import { parseFcmFromBinary, slugId } from '../utils/excelParse'
import MobileTableWrap from '../components/MobileTableWrap'

// Trích xuất mã model từ tên hoặc thông số (VD: SHM15-8-0.55F, MHI-805EA, CEA210/075)
const extractModelCode = (str) => {
  if (!str) return ''
  const m = String(str).match(/[A-Z0-9]+[A-Z0-9/-]*[0-9]+[A-Z0-9/-]*/i)
  return m ? m[0].toUpperCase() : ''
}

const normalizeText = (str) => {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Khung thông báo định dạng file Excel chuẩn (Giao diện hiện đại)
function ExcelFormatNotice() {
  return (
    <div
      style={{
        marginTop: 14,
        padding: '14px 16px',
        background: 'rgba(59, 130, 246, 0.05)',
        borderRadius: 10,
        border: '1px solid rgba(59, 130, 246, 0.2)',
        fontSize: 12.5,
        color: 'var(--text)',
        lineHeight: 1.6,
        gridColumn: '1 / -1',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, fontSize: 13 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>QUY CHUẨN CỘT DỮ LIỆU EXCEL (BẢNG GIÁ FCM / BƠM NƯỚC):</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
          gap: '6px 12px',
          background: 'var(--surface)',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        <div><strong style={{ color: 'var(--primary)' }}>Cột A</strong>: STT</div>
        <div><strong style={{ color: 'var(--primary)' }}>Cột B</strong>: Tên SP / Model</div>
        <div><strong style={{ color: 'var(--primary)' }}>Cột C</strong>: Công suất (kW)</div>
        <div><strong style={{ color: 'var(--primary)' }}>Cột D</strong>: Lưu lượng / Cột áp</div>
        <div><strong style={{ color: 'var(--primary)' }}>Cột E</strong>: Đơn giá (VNĐ)</div>
        <div><strong style={{ color: 'var(--primary)' }}>Cột F</strong>: Phi họng</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)' }}></span>
          <span><strong>Dòng tên nhóm / danh mục:</strong> Cột E (Đơn giá) để trống thì dòng đó tự động nhận làm Tên nhóm hàng.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)' }}></span>
          <span><strong>Dòng trùng lặp:</strong> Cùng nhóm + model + thông số tự động được gộp và lấy đơn giá mới nhất.</span>
        </div>
      </div>
    </div>
  )
}

export default function AdminImportPage() {
  const toast = useToast()

  // Mode: 'sync' (Đồng bộ bảng giá cũ, giữ nguyên ảnh) | 'new' (Tạo bảng giá mới hoàn toàn)
  const [mode, setMode] = useState('sync')

  // Danh sách bảng giá hiện có trong hệ thống
  const [priceLists, setPriceLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [existingProducts, setExistingProducts] = useState([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  // File import state
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dupCount, setDupCount] = useState(0)

  // Smart Sync State
  const [diffResult, setDiffResult] = useState(null)
  const [diffFilter, setDiffFilter] = useState('all') // 'all' | 'changed' | 'new' | 'same'

  // Chế độ 'new' state
  const [listName, setListName] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState([]) // Cho chế độ tạo mới

  // Group editor state (cho chế độ tạo mới)
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeTo, setMergeTo] = useState('')
  const [showMerge, setShowMerge] = useState(false)
  const [editingRowIdx, setEditingRowIdx] = useState(null)
  const [rowGroupDraft, setRowGroupDraft] = useState('')

  // Đăng ký danh sách bảng giá
  useEffect(() => {
    const unsub = subscribePriceLists((lists) => {
      setPriceLists(lists)
      if (lists.length > 0 && !selectedListId) {
        setSelectedListId(lists[0].id)
      }
    })
    return () => unsub()
  }, [])

  // Khi chọn bảng giá trong chế độ sync -> load sản phẩm hiện tại
  useEffect(() => {
    if (mode !== 'sync' || !selectedListId) return
    setLoadingExisting(true)
    setDiffResult(null)
    setFileName('')

    getProducts(selectedListId)
      .then((prods) => {
        setExistingProducts(prods)
      })
      .catch((err) => {
        toast('Lỗi tải sản phẩm hiện có: ' + err.message, 'error')
      })
      .finally(() => {
        setLoadingExisting(false)
      })
  }, [mode, selectedListId])

  // Thống kê sản phẩm hiện có của bảng giá đang chọn
  const existingStats = useMemo(() => {
    const total = existingProducts.length
    const withImages = existingProducts.filter((p) => p.images && p.images.length > 0).length
    const totalImages = existingProducts.reduce((sum, p) => sum + (p.images?.length || 0), 0)
    return { total, withImages, totalImages }
  }, [existingProducts])

  // Xử lý đọc file Excel
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    if (!listName && mode === 'new') setListName(file.name.replace(/\.(xlsx?|csv)$/i, ''))

    const reader = new FileReader()
    reader.onload = (ev) => {
      const { products, duplicates } = parseFcmFromBinary(ev.target.result)
      setDupCount(duplicates.length)
      if (duplicates.length) {
        toast(`Đã gộp ${duplicates.length} dòng trùng trong Excel`, 'default')
      }

      if (mode === 'sync') {
        // Chạy thuật toán so khớp đối soát thông minh (Smart Matcher)
        runSmartDiff(products, existingProducts)
      } else {
        setPreview(products)
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // Thuật toán đối soát thông minh: Bảo vệ 100% hình ảnh cũ
  const runSmartDiff = (excelProducts, existingList) => {
    if (!existingList.length && !excelProducts.length) return

    // Tạo các map tra cứu sản phẩm hiện có
    const bySlug = new Map()
    const byModelCode = new Map()
    const byExactNameSpec = new Map()

    existingList.forEach((p) => {
      const slug = slugId(p.name, p.spec1, p.spec2)
      bySlug.set(slug, p)

      const keyNameSpec = `${normalizeText(p.name)}_${normalizeText(p.spec1)}`
      byExactNameSpec.set(keyNameSpec, p)

      const m1 = extractModelCode(p.name)
      const m2 = extractModelCode(p.spec1)
      if (m1 && m1.length >= 4) byModelCode.set(m1, p)
      if (m2 && m2.length >= 4) byModelCode.set(m2, p)
    })

    const matchedUpdates = []
    const newAdditions = []
    const unchangedList = []
    const matchedExistingIds = new Set()

    excelProducts.forEach((ep) => {
      const epSlug = slugId(ep.name, ep.spec1, ep.spec2)
      const epKey = `${normalizeText(ep.name)}_${normalizeText(ep.spec1)}`
      const epModel1 = extractModelCode(ep.name)
      const epModel2 = extractModelCode(ep.spec1)

      let match = null
      if (bySlug.has(epSlug)) {
        match = bySlug.get(epSlug)
      } else if (byExactNameSpec.has(epKey)) {
        match = byExactNameSpec.get(epKey)
      } else if (epModel1 && epModel1.length >= 4 && byModelCode.has(epModel1)) {
        match = byModelCode.get(epModel1)
      } else if (epModel2 && epModel2.length >= 4 && byModelCode.has(epModel2)) {
        match = byModelCode.get(epModel2)
      }

      const newP = Number(ep.price) || 0

      if (match) {
        matchedExistingIds.add(match.id)
        const oldP = Number(match.price) || 0
        const priceChanged = Math.abs(oldP - newP) > 10 // chênh lệch giá
        const specsChanged =
          (ep.spec1 && ep.spec1 !== match.spec1) || (ep.spec2 && ep.spec2 !== match.spec2)

        const itemDiff = {
          id: match.id,
          name: match.name || ep.name,
          group: ep.group || match.group,
          spec1: ep.spec1 || match.spec1,
          spec2: ep.spec2 || match.spec2,
          phiHocng: ep.phiHocng || match.phiHocng,
          oldPrice: oldP,
          newPrice: newP,
          priceDiff: newP - oldP,
          priceChanged,
          specsChanged,
          images: match.images || [],
          imageCount: match.images?.length || 0,
          status: priceChanged ? 'changed' : 'same',
        }

        if (priceChanged || specsChanged) {
          matchedUpdates.push(itemDiff)
        } else {
          unchangedList.push(itemDiff)
        }
      } else {
        // Sản phẩm mới toanh
        newAdditions.push({
          name: ep.name,
          group: ep.group || 'Chung',
          spec1: ep.spec1 || '',
          spec2: ep.spec2 || '',
          phiHocng: ep.phiHocng || '',
          newPrice: newP,
          oldPrice: 0,
          priceDiff: newP,
          status: 'new',
          imageCount: 0,
        })
      }
    })

    // Những sản phẩm cũ trong bảng giá nhưng Excel không nhắc tới (vẫn giữ an toàn 100%)
    const unmentionedOld = existingList.filter((p) => !matchedExistingIds.has(p.id))

    setDiffResult({
      updates: matchedUpdates,
      additions: newAdditions,
      unchanged: unchangedList,
      unmentionedOld,
      totalMatched: matchedUpdates.length + unchangedList.length,
      preservedImages: existingList.reduce((sum, p) => sum + (p.images?.length || 0), 0),
    })

    toast(
      `Đã rà soát: ${matchedUpdates.length} đổi giá, ${newAdditions.length} mới, ${unchangedList.length} giữ nguyên`,
      'success'
    )
  }

  // Thực hiện đồng bộ cập nhật bảng giá cũ
  const handleApplySync = async () => {
    if (!diffResult || !selectedListId) return
    const totalChanges = diffResult.updates.length + diffResult.additions.length
    if (totalChanges === 0) {
      toast('Không có sản phẩm nào thay đổi giá hoặc thêm mới!', 'default')
      return
    }

    setUploading(true)
    try {
      await syncPriceListProducts(selectedListId, {
        updates: diffResult.updates,
        additions: diffResult.additions,
      })

      toast(
        `✓ Cập nhật thành công ${diffResult.updates.length} sản phẩm đổi giá & thêm ${diffResult.additions.length} sản phẩm mới! Toàn bộ hình ảnh được bảo toàn nguyên vẹn.`,
        'success'
      )

      // Refresh lại danh sách sản phẩm hiện có
      const refreshed = await getProducts(selectedListId)
      setExistingProducts(refreshed)
      setDiffResult(null)
      setFileName('')
    } catch (err) {
      toast('Lỗi cập nhật: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  // Danh sách hiển thị theo bộ lọc Diff
  const filteredDiffItems = useMemo(() => {
    if (!diffResult) return []
    const all = [...diffResult.updates, ...diffResult.additions, ...diffResult.unchanged]
    if (diffFilter === 'changed') return diffResult.updates
    if (diffFilter === 'new') return diffResult.additions
    if (diffFilter === 'same') return diffResult.unchanged
    return all
  }, [diffResult, diffFilter])

  // ── XỬ LÝ CHẾ ĐỘ IMPORT TẠO MỚI (Legacy) ──
  const groups = useMemo(() => [...new Set(preview.map((p) => p.group))], [preview])

  const applyRenameGroup = (oldName, newName) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setPreview((ps) => ps.map((p) => (p.group === oldName ? { ...p, group: trimmed } : p)))
    toast(`Đã đổi tên nhóm "${oldName}" → "${trimmed}"`, 'success')
  }

  const applyMerge = () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) {
      toast('Chọn 2 nhóm khác nhau', 'error')
      return
    }
    setPreview((ps) => ps.map((p) => (p.group === mergeFrom ? { ...p, group: mergeTo } : p)))
    toast(`Đã gộp "${mergeFrom}" vào "${mergeTo}"`, 'success')
    setMergeFrom('')
    setMergeTo('')
    setShowMerge(false)
  }

  const applyRowGroup = (idx) => {
    const trimmed = rowGroupDraft.trim()
    if (!trimmed) return
    setPreview((ps) => ps.map((p, i) => (i === idx ? { ...p, group: trimmed } : p)))
    setEditingRowIdx(null)
  }

  const handleCreateNewImport = async () => {
    if (!listName.trim()) {
      toast('Nhập tên bảng giá', 'error')
      return
    }
    if (!preview.length) {
      toast('Chưa có sản phẩm để import', 'error')
      return
    }
    setUploading(true)
    try {
      const docRef = await createPriceList({
        name: listName.trim(),
        category: category.trim(),
        note: note.trim(),
      })
      await saveProducts(docRef.id, preview)
      toast(`Import thành công ${preview.length} sản phẩm vào "${listName}"`, 'success')
      setPreview([])
      setListName('')
      setCategory('')
      setNote('')
      setFileName('')
    } catch (err) {
      toast('Lỗi import: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const fmt = (n) => (n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Header with Mode Tabs */}
      <div className="main-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Nhập &amp; Đồng bộ Bảng Giá</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text2)' }}>
            Tự động rà soát mã cũ, cập nhật giá mới, thêm sản phẩm và bảo vệ 100% hình ảnh
          </p>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', background: 'var(--surface2)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => { setMode('sync'); setFileName('') }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              background: mode === 'sync' ? 'var(--primary)' : 'transparent',
              color: mode === 'sync' ? '#fff' : 'var(--text2)',
              boxShadow: mode === 'sync' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              transition: 'all .15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Đồng bộ Bảng giá có sẵn (Giữ ảnh)</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('new'); setFileName('') }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              background: mode === 'new' ? 'var(--primary)' : 'transparent',
              color: mode === 'new' ? '#fff' : 'var(--text2)',
              boxShadow: mode === 'new' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              transition: 'all .15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Tạo bảng giá mới</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {/* ========================================================= */}
        {/* TAB 1: SMART SYNC / UPDATE EXISTING PRICE LIST (RECOMMENDED) */}
        {/* ========================================================= */}
        {mode === 'sync' && (
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Step 1: Chọn bảng giá & Tải file */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>1. Chọn Bảng giá &amp; Tải file Excel mới</span>
                <span className="badge" style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}>
                  Bảo vệ hình ảnh 100%
                </span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) 1fr', gap: 16 }}>
                <div>
                  <label className="field-label" style={{ fontWeight: 700 }}>Bảng giá cần cập nhật *</label>
                  <select
                    className="input select"
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
                  >
                    {priceLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.category ? `(${l.category})` : ''}
                      </option>
                    ))}
                  </select>

                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12 }}>
                    <span>📦 Hiện có: <strong>{existingStats.total}</strong> sản phẩm</span>
                    <span>📷 Đã tải: <strong>{existingStats.totalImages}</strong> ảnh ({existingStats.withImages} SP)</span>
                  </div>
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 700 }}>Chọn file Excel bảng giá mới *</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => document.getElementById('syncXlsInput').click()}
                      style={{ padding: '8px 18px', fontWeight: 700 }}
                    >
                      📂 Tải file Excel mới
                    </button>
                    <input
                      id="syncXlsInput"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      style={{ display: 'none' }}
                      onChange={handleFile}
                    />
                    {fileName && <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>📄 {fileName}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    Hệ thống sẽ đối soát tự động, giữ nguyên 100% ảnh đã có và cập nhật giá mới.
                  </div>
                </div>

                {/* Định dạng Excel chuẩn */}
                <ExcelFormatNotice />
              </div>
            </div>

            {/* Step 2: Màn hình đối soát (Preview Diff) */}
            {diffResult && (
              <div className="card" style={{ padding: 20 }}>
                {/* Summary Stat Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>
                      Kết quả đối soát ({diffResult.updates.length + diffResult.additions.length + diffResult.unchanged.length} dòng)
                    </h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="tag" style={{ background: '#f59e0b20', color: '#d97706', border: '1px solid #f59e0b40', fontWeight: 700 }}>
                        🟡 {diffResult.updates.length} sản phẩm đổi giá
                      </span>
                      <span className="tag" style={{ background: '#10b98120', color: '#059669', border: '1px solid #10b98140', fontWeight: 700 }}>
                        🟢 {diffResult.additions.length} sản phẩm mới toanh
                      </span>
                      <span className="tag" style={{ background: '#3b82f620', color: '#2563eb', border: '1px solid #3b82f640', fontWeight: 700 }}>
                        🔵 {diffResult.unchanged.length} sản phẩm giữ nguyên
                      </span>
                      <span className="tag" style={{ background: '#8b5cf620', color: '#7c3aed', border: '1px solid #8b5cf640', fontWeight: 800 }}>
                        🛡️ Đã bảo toàn {diffResult.preservedImages} hình ảnh
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleApplySync}
                    disabled={uploading || (diffResult.updates.length === 0 && diffResult.additions.length === 0)}
                    style={{ padding: '10px 22px', fontSize: 13, fontWeight: 800, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                  >
                    {uploading ? (
                      <>⏳ Đang cập nhật...</>
                    ) : (
                      `✓ Xác nhận cập nhật (${diffResult.updates.length} đổi giá, ${diffResult.additions.length} mới)`
                    )}
                  </button>
                </div>

                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button
                    className={`btn sm ${diffFilter === 'all' ? 'primary' : 'ghost'}`}
                    onClick={() => setDiffFilter('all')}
                  >
                    Tất cả ({diffResult.updates.length + diffResult.additions.length + diffResult.unchanged.length})
                  </button>
                  <button
                    className={`btn sm ${diffFilter === 'changed' ? 'primary' : 'ghost'}`}
                    onClick={() => setDiffFilter('changed')}
                    style={diffFilter === 'changed' ? { background: '#d97706', borderColor: '#d97706' } : {}}
                  >
                    Đổi giá ({diffResult.updates.length})
                  </button>
                  <button
                    className={`btn sm ${diffFilter === 'new' ? 'primary' : 'ghost'}`}
                    onClick={() => setDiffFilter('new')}
                    style={diffFilter === 'new' ? { background: '#059669', borderColor: '#059669' } : {}}
                  >
                    Sản phẩm mới ({diffResult.additions.length})
                  </button>
                  <button
                    className={`btn sm ${diffFilter === 'same' ? 'primary' : 'ghost'}`}
                    onClick={() => setDiffFilter('same')}
                  >
                    Không đổi ({diffResult.unchanged.length})
                  </button>
                </div>

                {/* Diff Table */}
                <MobileTableWrap style={{ maxHeight: 460, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>Trạng thái</th>
                        <th>Tên sản phẩm</th>
                        <th>Thông số</th>
                        <th style={{ textAlign: 'right' }}>Giá hiện tại</th>
                        <th style={{ textAlign: 'center' }}>→</th>
                        <th style={{ textAlign: 'right' }}>Giá mới (Excel)</th>
                        <th>Chênh lệch</th>
                        <th>Bảo toàn ảnh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDiffItems.map((p, idx) => (
                        <tr key={idx} style={{ background: p.status === 'changed' ? '#fffbeb10' : p.status === 'new' ? '#ecfdf510' : 'transparent' }}>
                          <td className="text-muted text-sm" style={{ textAlign: 'right' }}>{idx + 1}</td>
                          <td>
                            {p.status === 'changed' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 6 }}>
                                🟡 Đổi giá
                              </span>
                            )}
                            {p.status === 'new' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: 6 }}>
                                🟢 Mới thêm
                              </span>
                            )}
                            {p.status === 'same' && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                                🔵 Không đổi
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600, fontSize: 12.5 }}>
                            {p.name}
                            {p.group && <span className="tag" style={{ marginLeft: 6, fontSize: 10 }}>{p.group}</span>}
                          </td>
                          <td className="td-spec" style={{ fontSize: 11.5 }}>
                            {p.spec1 ? `${p.spec1} kW ` : ''}
                            {p.spec2 ? `• ${p.spec2}` : ''}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>
                            {p.oldPrice > 0 ? fmt(p.oldPrice) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text3)' }}>→</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: p.status === 'changed' ? '#d97706' : p.status === 'new' ? '#059669' : 'inherit' }}>
                            {fmt(p.newPrice)}
                          </td>
                          <td>
                            {p.status === 'changed' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: p.priceDiff > 0 ? '#dc2626' : '#16a34a' }}>
                                {p.priceDiff > 0 ? `+${fmt(p.priceDiff)}` : fmt(p.priceDiff)}
                              </span>
                            )}
                            {p.status === 'new' && <span style={{ fontSize: 11, color: '#059669' }}>Mới</span>}
                            {p.status === 'same' && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                          </td>
                          <td>
                            {p.imageCount > 0 ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                📷 {p.imageCount} ảnh
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chưa có</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </MobileTableWrap>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CREATE BRAND NEW PRICE LIST (LEGACY)               */}
        {/* ========================================================= */}
        {mode === 'new' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16 }}>Thông tin bảng giá mới</h3>
              <div className="row">
                <div className="field">
                  <label className="field-label">Tên bảng giá *</label>
                  <input
                    className="input"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="VD: Giá sỉ nước thải INOX 2026"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Danh mục / Phân loại</label>
                  <input
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="VD: Bơm nước, Điện công nghiệp..."
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: 10 }}>
                <label className="field-label">Lưu ý bảng giá (hiển thị trên cùng của bảng giá)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Giá chưa bao gồm VAT 10%, bảo hành chính hãng 12 tháng..."
                  style={{ resize: 'vertical', minHeight: 54, fontSize: 13, lineHeight: 1.5 }}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">File Excel</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button className="btn primary" onClick={() => document.getElementById('xlsInputNew').click()}>
                    📂 Chọn file Excel (.xlsx)
                  </button>
                  <input
                    id="xlsInputNew"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFile}
                  />
                  {fileName && <span className="text-sm text-muted">📄 {fileName}</span>}
                </div>

                {/* Định dạng Excel chuẩn */}
                <ExcelFormatNotice />
              </div>
            </div>

            {preview.length > 0 && (
              <>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h3 style={{ flex: 1 }}>Quản lý nhóm ({groups.length} nhóm)</h3>
                    <button className="btn sm" onClick={() => setShowMerge((s) => !s)}>
                      {showMerge ? '✕ Đóng' : '🔀 Gộp nhóm'}
                    </button>
                  </div>

                  {showMerge && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                        <label className="field-label">Nhóm cần gộp</label>
                        <select className="input select" value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)}>
                          <option value="">— Chọn nhóm —</option>
                          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div style={{ paddingBottom: 2, color: 'var(--text2)', fontSize: 18 }}>→</div>
                      <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                        <label className="field-label">Gộp vào nhóm</label>
                        <select className="input select" value={mergeTo} onChange={(e) => setMergeTo(e.target.value)}>
                          <option value="">— Chọn nhóm —</option>
                          {groups.filter((g) => g !== mergeFrom).map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <button className="btn primary" onClick={applyMerge} style={{ marginBottom: 0 }}>✓ Gộp</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {groups.map((g) => {
                      const count = preview.filter((p) => p.group === g).length
                      const isEditing = editingGroup === g
                      return (
                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', fontSize: 13 }}>
                          <span style={{ color: 'var(--text2)', fontSize: 11, minWidth: 26, textAlign: 'right' }}>{count}</span>
                          {isEditing ? (
                            <>
                              <input
                                className="input"
                                style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
                                value={groupDraft}
                                autoFocus
                                onChange={(e) => setGroupDraft(e.target.value)}
                                onKeyDown={(e) => {
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

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <h3 style={{ flex: 1 }}>
                      Xem trước: {preview.length} sản phẩm, {groups.length} nhóm
                    </h3>
                    <button className="btn primary" onClick={handleCreateNewImport} disabled={uploading}>
                      {uploading ? '⏳ Đang tải lên...' : `☁️ Tạo bảng giá "${listName}"`}
                    </button>
                  </div>

                  <MobileTableWrap style={{ maxHeight: 480, overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th style={{ minWidth: 160 }}>Nhóm</th>
                          <th>Tên sản phẩm</th>
                          <th>Công suất</th>
                          <th>Thông số</th>
                          <th style={{ textAlign: 'right' }}>Đơn giá</th>
                          <th>Phi họng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((p, i) => (
                          <tr key={i}>
                            <td className="text-muted text-sm" style={{ textAlign: 'right' }}>{i + 1}</td>
                            <td><span className="tag">{p.group}</span></td>
                            <td className="td-mono" style={{ fontSize: 12 }}>{p.name}</td>
                            <td className="td-spec">{p.spec1 ? p.spec1 + ' kW' : '—'}</td>
                            <td className="td-spec">{p.spec2 || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.price)}</td>
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
        )}
      </div>
    </div>
  )
}
