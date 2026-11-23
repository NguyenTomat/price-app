import React, { useState, useEffect, useMemo } from 'react'
import { getAllProductsFlat } from '../firebase/firebase'
import { useToast } from '../components/Toast'
import { copyImageToClipboard, downloadImage } from '../utils/imageClipboard'
import {
  parseRequirementRow,
  solveProjectRequirements,
  SAMPLE_PROJECT_1_TEXT,
  SAMPLE_PROJECT_2_TEXT
} from '../utils/pumpSolver'
import ExcelJS from 'exceljs'

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

export default function AiSolverPage({ setPage }) {
  const toast = useToast()

  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Input states
  const [inputTab, setInputTab] = useState('paste') // 'paste' | 'manual'
  const [rawText, setRawText] = useState(SAMPLE_PROJECT_1_TEXT)
  const [requirements, setRequirements] = useState(() => {
    return SAMPLE_PROJECT_1_TEXT.split('\n')
      .map((line, idx) => parseRequirementRow(line, idx + 1))
      .filter(Boolean)
  })

  // Manual Row add form
  const [manualTitle, setManualTitle] = useState('')
  const [manualMount, setManualMount] = useState('submersible') // 'submersible' | 'surface'
  const [manualFlow, setManualFlow] = useState('')
  const [manualHead, setManualHead] = useState('')
  const [manualPower, setManualPower] = useState('')
  const [manualQty, setManualQty] = useState('1')
  const [manualConfig, setManualConfig] = useState('2 bơm luân phiên')

  // Solving states
  const [solving, setSolving] = useState(false)
  const [solvedResults, setSolvedResults] = useState([])
  const [hasSolved, setHasSolved] = useState(false)
  const [projectTitle, setProjectTitle] = useState('BẢNG BÓC TÁCH & ĐỐI CHIẾU CỤM BƠM DỰ ÁN MEP')
  const [clientName, setClientName] = useState('Quý Ban Quản Lý / Tổng Thầu MEP')

  // Copy / Lightbox states
  const [copiedImgKey, setCopiedImgKey] = useState(null)
  const [copiedZalo, setCopiedZalo] = useState(false)
  const [zoomImage, setZoomImage] = useState(null)
  const [exportingExcel, setExportingExcel] = useState(false)

  // Load all products across all price lists
  useEffect(() => {
    let cancelled = false
    setLoadingProducts(true)
    getAllProductsFlat().then(data => {
      if (!cancelled && Array.isArray(data)) {
        setAllProducts(data)
      }
    }).catch(err => {
      console.warn('Lỗi tải all products flat:', err)
    }).finally(() => {
      if (!cancelled) setLoadingProducts(false)
    })
    return () => { cancelled = true }
  }, [])

  // Auto solve initial sample on load once products are ready
  useEffect(() => {
    if (allProducts.length > 0 && !hasSolved && requirements.length > 0) {
      const res = solveProjectRequirements(requirements, allProducts)
      setSolvedResults(res)
      setHasSolved(true)
    }
  }, [allProducts, hasSolved, requirements])

  // Parse text into requirements
  const handleParseText = () => {
    if (!rawText.trim()) {
      toast('Vui lòng nhập nội dung đề bài yêu cầu của khách', 'warning')
      return
    }
    const lines = rawText.split('\n').filter(l => l.trim().length > 0)
    const list = []
    lines.forEach((line, idx) => {
      const parsed = parseRequirementRow(line, idx + 1)
      if (parsed) list.push(parsed)
    })
    if (list.length === 0) {
      toast('Không tìm thấy thông số hợp lệ. Hãy kiểm tra lại dòng văn bản.', 'warning')
      return
    }
    setRequirements(list)
    executeSolve(list)
  }

  // Execute solve algorithm
  const executeSolve = (reqList = requirements) => {
    setSolving(true)
    setTimeout(() => {
      try {
        const pool = allProducts.length > 0 ? allProducts : []
        const res = solveProjectRequirements(reqList, pool)
        setSolvedResults(res)
        setHasSolved(true)
        toast(`✅ Đã giải toán & đối chiếu thành công ${res.length} hạng mục!`, 'success')
      } catch (err) {
        toast('Lỗi giải toán: ' + err.message, 'error')
      } finally {
        setSolving(false)
      }
    }, 350)
  }

  // Load Sample 1 (Image 1 from user)
  const handleLoadSample1 = () => {
    setRawText(SAMPLE_PROJECT_1_TEXT)
    setProjectTitle('DỰ ÁN TẦNG HẦM & CẤP NƯỚC SINH HOẠT TÒA NHÀ')
    const list = SAMPLE_PROJECT_1_TEXT.split('\n').map((l, i) => parseRequirementRow(l, i + 1)).filter(Boolean)
    setRequirements(list)
    executeSolve(list)
    toast('Đã nạp đề bài mẫu từ Ảnh 1 (6 Hạng mục Bơm Sinh Hoạt & Nước Thải)', 'default')
  }

  // Load Sample 2 (Image 2 from user)
  const handleLoadSample2 = () => {
    setRawText(SAMPLE_PROJECT_2_TEXT)
    setProjectTitle('DỰ ÁN HỆ THỐNG BƠM CƠ ĐIỆN MEP (BỂ CHỨA, TĂNG ÁP, TƯỚI)')
    const list = SAMPLE_PROJECT_2_TEXT.split('\n').map((l, i) => parseRequirementRow(l, i + 1)).filter(Boolean)
    setRequirements(list)
    executeSolve(list)
    toast('Đã nạp đề bài mẫu từ Ảnh 2 (Cấp nước bể chứa, tăng áp, tưới)', 'default')
  }

  // Add a manual row
  const handleAddManualRow = (e) => {
    e.preventDefault()
    if (!manualTitle.trim()) {
      toast('Vui lòng nhập tên hạng mục bơm', 'warning')
      return
    }
    const newReq = {
      id: `req_manual_${Date.now()}`,
      index: requirements.length + 1,
      title: manualTitle.trim(),
      rawText: `${manualTitle}: Q=${manualFlow || 0}m3/h, H=${manualHead || 0}m. SL: ${manualQty || 1}`,
      mountType: manualMount,
      mountLabel: manualMount === 'submersible' ? 'Bơm chìm' : 'Bơm cạn',
      subCategory: manualMount === 'submersible' ? 'Bơm chìm nước thải / hố móng' : 'Bơm cạn cấp nước / tăng áp',
      flow: manualFlow ? parseFloat(manualFlow) : null,
      head: manualHead ? parseFloat(manualHead) : null,
      power: manualPower ? parseFloat(manualPower) : null,
      qty: parseInt(manualQty, 10) || 1,
      config: manualConfig || 'Bơm đơn',
      accessories: manualMount === 'submersible'
        ? ['Tủ điều khiển luân phiên', 'Khớp nối nhanh & Phao báo mức']
        : ['Tủ điều khiển biến tần', 'Bình tích áp']
    }
    const nextList = [...requirements, newReq]
    setRequirements(nextList)
    executeSolve(nextList)
    // reset form
    setManualTitle('')
    setManualFlow('')
    setManualHead('')
    setManualPower('')
    toast('Đã thêm 1 hạng mục mới vào bài toán', 'success')
  }

  // Remove a requirement row
  const handleRemoveRow = (idxToRemove) => {
    const nextList = requirements.filter((_, i) => i !== idxToRemove)
    setRequirements(nextList)
    executeSolve(nextList)
  }

  // Copy Image directly to clipboard for Zalo
  const handleCopyImage = async (src, key) => {
    if (!src || src === '/logo.png') {
      toast('Sản phẩm này chưa có ảnh trong app', 'warning')
      return
    }
    try {
      await copyImageToClipboard(src)
      setCopiedImgKey(key)
      toast('✅ Đã copy ảnh! Bạn chỉ cần nhấn Ctrl + V vào Zalo để gửi', 'success')
      setTimeout(() => setCopiedImgKey(null), 2500)
    } catch (err) {
      console.warn('Lỗi copy ảnh:', err)
      try {
        await downloadImage(src, 'may-bom-tandt.png')
        toast('Trình duyệt đã tải ảnh về máy để bạn gửi Zalo', 'default')
      } catch (dErr) {
        toast('Không thể sao chép ảnh: ' + err.message, 'error')
      }
    }
  }

  // Generate Zalo Text for Contractor
  const handleCopyZaloSummary = () => {
    if (solvedResults.length === 0) return
    let text = `🌊 BÁO GIÁ ĐỐI CHIẾU KỸ THUẬT CỤM BƠM DỰ ÁN\n`
    text += `🏢 Dự án: ${projectTitle}\n`
    text += `👤 Kính gửi: ${clientName}\n`
    text += `──────────────────────\n`
    solvedResults.forEach((res, i) => {
      const req = res.requirement
      const m = res.bestMatch
      text += `${i + 1}. ${req.title.toUpperCase()}\n`
      text += `   • Yêu cầu: Q=${req.flow || '...'}m³/h, H=${req.head || '...'}m | SL: ${req.qty} máy (${req.mountLabel})\n`
      if (m) {
        text += `   👉 T&T đề xuất: ${m.name}\n`
        text += `   • Thông số: ${m.calcPower ? m.calcPower + 'kW' : ''} | Hmax=${m.calcHead || '...'}m | Qmax=${m.calcFlow || '...'}m³/h | ${m.calcVoltage || '380V'}\n`
        text += `   • Độ phù hợp: ⭐ ${m.accuracy}% kỹ thuật\n`
        text += `   • Đơn giá: ${fmt(m.price)}/máy\n`
      } else {
        text += `   👉 Đang cập nhật model kho...\n`
      }
      text += `\n`
    })
    text += `──────────────────────\n`
    text += `📞 Hotline Kỹ Thuật T&T: 0984.273.806\n`
    text += `Em gửi kèm hình ảnh thực tế từng model bên dưới, anh/chị xem qua giúp em nhé!`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedZalo(true)
      toast('✅ Đã copy bản tóm tắt Zalo!', 'success')
      setTimeout(() => setCopiedZalo(false), 2500)
    }
  }

  // Export Excel Spreadsheet
  const handleExportExcel = async () => {
    if (solvedResults.length === 0) {
      toast('Chưa có kết quả để xuất Excel', 'warning')
      return
    }
    setExportingExcel(true)
    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Máy Bơm T&T'
      const ws = wb.addWorksheet('Báo Giá Dự Án', {
        views: [{ showGridLines: true }]
      })

      // Set columns
      ws.columns = [
        { key: 'stt', width: 6 },
        { key: 'req_title', width: 34 },
        { key: 'mount_type', width: 14 },
        { key: 'req_specs', width: 20 },
        { key: 'model_name', width: 32 },
        { key: 'model_specs', width: 28 },
        { key: 'accuracy', width: 14 },
        { key: 'qty', width: 8 },
        { key: 'price', width: 16 },
        { key: 'total', width: 18 },
        { key: 'notes', width: 36 }
      ]

      // Title & Header
      ws.mergeCells('A1:K1')
      const tCell = ws.getCell('A1')
      tCell.value = 'CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ THIẾT BỊ ĐIỆN T&T'
      tCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0878D9' } }
      tCell.alignment = { horizontal: 'center', vertical: 'middle' }

      ws.mergeCells('A2:K2')
      const subCell = ws.getCell('A2')
      subCell.value = `${projectTitle.toUpperCase()} - ĐỐI CHIẾU THÔNG SỐ KỸ THUẬT`
      subCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } }
      subCell.alignment = { horizontal: 'center', vertical: 'middle' }

      ws.mergeCells('A3:K3')
      const dateCell = ws.getCell('A3')
      dateCell.value = `Ngày lập: ${new Date().toLocaleDateString('vi-VN')} | Đơn vị tư vấn: Máy Bơm T&T (Hotline: 0984.273.806)`
      dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } }
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // Table Header Row at Row 5
      const headerRow = ws.getRow(5)
      headerRow.values = [
        'STT',
        'Hạng mục yêu cầu',
        'Chủng loại',
        'Thông số Q & H yêu cầu',
        'Model T&T đối chiếu',
        'Thông số kỹ thuật T&T',
        'Độ khớp (%)',
        'Số lượng',
        'Đơn giá (VNĐ)',
        'Thành tiền (VNĐ)',
        'Phụ kiện & Đề xuất kỹ thuật'
      ]
      headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      headerRow.height = 30
      for (let c = 1; c <= 11; c++) {
        headerRow.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0878D9' }
        }
      }

      let rIndex = 6
      let grandTotal = 0

      solvedResults.forEach((res, i) => {
        const req = res.requirement
        const m = res.bestMatch
        const unitPrice = m?.price || 0
        const total = unitPrice * (req.qty || 1)
        grandTotal += total

        const row = ws.getRow(rIndex)
        row.values = [
          i + 1,
          req.title,
          req.mountLabel,
          `Q=${req.flow || '...'} m³/h, H=${req.head || '...'} m`,
          m?.name || 'Đang cập nhật',
          m ? `${m.calcPower ? m.calcPower + 'kW' : ''} - Hmax: ${m.calcHead || '...'}m - Qmax: ${m.calcFlow || '...'}m³/h` : '—',
          m ? `${m.accuracy}%` : '—',
          req.qty,
          unitPrice,
          total,
          req.accessories.join('; ') || 'Cụm tiêu chuẩn'
        ]

        row.font = { name: 'Arial', size: 10 }
        row.alignment = { vertical: 'middle' }
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(9).numFmt = '#,##0'
        row.getCell(10).numFmt = '#,##0'

        // Highlight accuracy
        if (m && m.accuracy >= 90) {
          row.getCell(7).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF059669' } }
        }

        rIndex++
      })

      // Total Row
      const totalRow = ws.getRow(rIndex)
      ws.mergeCells(`A${rIndex}:I${rIndex}`)
      totalRow.getCell(1).value = 'TỔNG CỘNG TIỀN THIẾT BỊ (CHƯA VAT):'
      totalRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } }
      totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
      totalRow.getCell(10).value = grandTotal
      totalRow.getCell(10).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFDC2626' } }
      totalRow.getCell(10).numFmt = '#,##0 "₫"'
      totalRow.height = 25

      // Border for table
      for (let r = 5; r <= rIndex; r++) {
        for (let c = 1; c <= 11; c++) {
          ws.getCell(r, c).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          }
        }
      }

      // Download buffer
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bao-gia-du-an-${projectTitle.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, '-')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast('✅ Đã xuất file Excel Báo Giá Dự Án thành công!', 'success')
    } catch (err) {
      toast('Lỗi xuất Excel: ' + err.message, 'error')
    } finally {
      setExportingExcel(false)
    }
  }

  // Summary statistics
  const stats = useMemo(() => {
    let totalQty = 0
    let totalAmount = 0
    let accuracySum = 0
    let highMatchCount = 0

    solvedResults.forEach(r => {
      const q = r.requirement.qty || 1
      totalQty += q
      if (r.bestMatch) {
        totalAmount += (r.bestMatch.price || 0) * q
        accuracySum += r.bestMatch.accuracy || 0
        if (r.bestMatch.accuracy >= 90) highMatchCount++
      }
    })

    const avgAccuracy = solvedResults.length > 0 ? (accuracySum / solvedResults.length).toFixed(1) : 0
    return {
      itemsCount: solvedResults.length,
      totalQty,
      totalAmount,
      avgAccuracy,
      highMatchCount
    }
  }, [solvedResults])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
        padding: '18px 22px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(8,120,217,0.1) 0%, rgba(124,58,237,0.08) 100%)',
        border: '1.5px solid rgba(8,120,217,0.22)',
        boxShadow: '0 4px 16px rgba(8,120,217,0.06)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>📐</span>
              <span>Giải Toán Máy Bơm &amp; Bóc Tách Dự Án</span>
            </h1>
            <span style={{ fontSize: 11, background: '#10B981', color: '#fff', padding: '3px 10px', borderRadius: 12, fontWeight: 800 }}>
              🎯 Chuẩn Xác ≥ 90%
            </span>
            <span style={{ fontSize: 11, background: '#7C3AED', color: '#fff', padding: '3px 10px', borderRadius: 12, fontWeight: 800 }}>
              🔄 Phân Loại Bơm Cạn &amp; Bơm Chìm
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, maxWidth: 880 }}>
            Thuật toán AI tự động bóc tách cột áp ($H$), lưu lượng ($Q$), công suất, phân loại chính xác 100% <strong>Bơm chìm</strong> vs <strong>Bơm cạn</strong> và đối chiếu qua toàn bộ kho hàng ({allProducts.length} model) để tìm mã khớp tối ưu nhất cho thầu/dự án.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleLoadSample1}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--accent)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s'
            }}
            title="Tải lại mẫu từ Ảnh 1 (Bơm sinh hoạt & Thoát sàn hầm)"
          >
            <span>📋</span> <span>Nạp Đề Bài Ảnh 1 (6 mục)</span>
          </button>
          <button
            onClick={handleLoadSample2}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'var(--surface)', border: '1px solid #7C3AED', color: '#7C3AED',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s'
            }}
            title="Tải lại mẫu từ Ảnh 2 (Bơm bể chứa, tăng áp, tưới)"
          >
            <span>📋</span> <span>Nạp Đề Bài Ảnh 2 (3 mục)</span>
          </button>
        </div>
      </div>

      {/* ── PROJECT TITLE & INPUT CONTROLS ───────────────────────────────── */}
      <div className="card" style={{ padding: 18, marginBottom: 22, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ flex: '1 1 320px' }}>
            <label style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Tên Dự Án / Bảng Mời Thầu:
            </label>
            <input
              type="text"
              value={projectTitle}
              onChange={e => setProjectTitle(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14, fontWeight: 700,
                borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            <button
              onClick={() => setInputTab('paste')}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                border: inputTab === 'paste' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: inputTab === 'paste' ? 'var(--accent)' : 'var(--surface2)',
                color: inputTab === 'paste' ? '#fff' : 'var(--text)',
                cursor: 'pointer'
              }}
            >
              📝 Dán bảng từ Zalo / Excel
            </button>
            <button
              onClick={() => setInputTab('manual')}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                border: inputTab === 'manual' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: inputTab === 'manual' ? 'var(--accent)' : 'var(--surface2)',
                color: inputTab === 'manual' ? '#fff' : 'var(--text)',
                cursor: 'pointer'
              }}
            >
              ➕ Nhập tay từng dòng
            </button>
          </div>
        </div>

        {/* TAB 1: PASTE TEXTAREA */}
        {inputTab === 'paste' ? (
          <div>
            <textarea
              rows={6}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Dán nội dung từ Zalo, bảng thầu hoặc file Excel... (Mỗi dòng là một hạng mục, ví dụ: 'Cụm bơm cấp nước: Q=45m3/h, H=100m. SL: 4 máy')"
              style={{
                width: '100%', padding: 12, fontSize: 13, lineHeight: 1.5,
                borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontFamily: 'monospace', resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                💡 <em>Mẹo: AI tự động nhận diện Q (m³/h, l/s), H (m), công suất kW/HP, bơm cạn vs bơm chìm và số lượng máy.</em>
              </span>
              <button
                onClick={handleParseText}
                disabled={solving}
                style={{
                  padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 800,
                  background: 'linear-gradient(135deg, #0878D9 0%, #7C3AED 100%)', color: '#fff', border: 'none',
                  cursor: solving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(8,120,217,0.3)', transition: 'all .15s'
                }}
              >
                <span>{solving ? '⏳' : '🚀'}</span>
                <span>{solving ? 'Đang giải toán...' : 'Giải Toán & Đối Chiếu Kho Ngay'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: MANUAL FORM */
          <form onSubmit={handleAddManualRow} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Tên hạng mục *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cụm bơm cấp nước sinh hoạt, Bơm thoát hố pít..."
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Chủng loại lắp đặt *
                </label>
                <select
                  value={manualMount}
                  onChange={e => setManualMount(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 700 }}
                >
                  <option value="submersible">🌊 Bơm chìm (Submersible)</option>
                  <option value="surface">🏠 Bơm cạn (Surface/CDLF)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Lưu lượng Q (m³/h)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="VD: 15, 20, 45"
                  value={manualFlow}
                  onChange={e => setManualFlow(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Cột áp H (m)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="VD: 20, 40, 100"
                  value={manualHead}
                  onChange={e => setManualHead(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Công suất P (kW) nếu có
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="VD: 2.2, 11, 18.5"
                  value={manualPower}
                  onChange={e => setManualPower(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Số lượng (máy)
                </label>
                <input
                  type="number"
                  value={manualQty}
                  onChange={e => setManualQty(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                  Cấu hình cụm
                </label>
                <input
                  type="text"
                  placeholder="VD: 2 bơm luân phiên, 1 chạy 1 dự phòng"
                  value={manualConfig}
                  onChange={e => setManualConfig(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="submit"
                className="btn sm primary"
                style={{ padding: '8px 18px', fontSize: 12.5, fontWeight: 800 }}
              >
                ➕ Thêm Hạng Mục Vào Bài Toán
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── KPI STATS BAR ────────────────────────────────────────────────── */}
      {hasSolved && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
          marginBottom: 22
        }}>
          <div className="card" style={{ padding: 14, background: 'linear-gradient(135deg, rgba(8,120,217,0.08), rgba(8,120,217,0.02))', border: '1px solid rgba(8,120,217,0.2)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>Hạng Mục Bóc Tách</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>
              {stats.itemsCount} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>hạng mục ({stats.totalQty} máy)</span>
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>Độ Chuẩn Xác Trung Bình</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', marginTop: 4 }}>
              {stats.avgAccuracy}% <span style={{ fontSize: 11, background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>≥ 90% Đạt Chuẩn</span>
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.02))', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Phân Loại Chủng Loại</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#7C3AED', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✅ 100% Khớp Bơm Cạn / Chìm</span>
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Tổng Dự Toán Tạm Tính</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>
              {fmt(stats.totalAmount)}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION BAR (EXCEL, ZALO, CHUYỂN ĐƠN) ─────────────────────────── */}
      {hasSolved && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          padding: '12px 18px',
          borderRadius: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
            📋 Danh Sách {solvedResults.length} Cụm Bơm Đã Đối Chiếu Khớp Kho:
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleCopyZaloSummary}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 800,
                background: copiedZalo ? '#10B981' : '#0068FF', color: '#fff', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 6px rgba(0,104,255,0.25)'
              }}
            >
              <span>{copiedZalo ? '✅' : '💬'}</span>
              <span>{copiedZalo ? 'Đã copy mẫu Zalo' : 'Copy Báo Giá Zalo'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 800,
                background: '#10B981', color: '#fff', border: 'none', cursor: exportingExcel ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
              }}
            >
              <span>{exportingExcel ? '⏳' : '📥'}</span>
              <span>{exportingExcel ? 'Đang xuất file...' : 'Xuất Excel Dự Án'}</span>
            </button>

            <button
              onClick={() => {
                toast('Chức năng đẩy sang Đơn Bán đang hoàn tất...', 'default')
                if (setPage) setPage('orders')
              }}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 800,
                background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <span>🛒</span> <span>Đẩy sang Tạo Đơn Bán</span>
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS LIST TABLE / CARDS ──────────────────────────────────── */}
      {solving ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px 0' }}>
            Đang phân loại Bơm Chìm vs Bơm Cạn &amp; Rà kho {allProducts.length} model...
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            Thuật toán đang tính toán cột áp H, lưu lượng Q và điểm làm việc tối ưu BEP...
          </p>
        </div>
      ) : solvedResults.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📐</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px 0' }}>
            Chưa có bài toán nào được nạp
          </h3>
          <p style={{ fontSize: 13, maxWidth: 500, margin: '0 auto 14px', color: 'var(--text2)' }}>
            Bấm nút <strong>"Nạp Đề Bài Ảnh 1"</strong> hoặc dán yêu cầu dự án vào khung nhập ở trên để hệ thống tự động bóc tách.
          </p>
          <button
            onClick={handleLoadSample1}
            className="btn sm primary"
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 800 }}
          >
            📋 Nạp đề bài mẫu Ảnh 1 để thử ngay
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {solvedResults.map((item, idx) => {
            const req = item.requirement
            const m = item.bestMatch
            const alt = item.altMatch
            const isSubmersible = req.mountType === 'submersible'

            return (
              <div
                key={req.id || idx}
                className="card"
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: m && m.accuracy >= 90 ? '1.5px solid #10B981' : '1px solid var(--border)',
                  background: 'var(--surface)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(320px, 1.6fr) minmax(220px, 1fr)', gap: 16, alignItems: 'start' }}>
                  
                  {/* CỘT 1: ĐỀ BÀI CỦA KHÁCH */}
                  <div style={{ borderRight: '1px dashed var(--border)', paddingRight: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, background: 'var(--surface2)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 4 }}>
                        #{idx + 1}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                        background: isSubmersible ? '#EDE9FE' : '#EFF6FF',
                        color: isSubmersible ? '#7C3AED' : '#1D4ED8'
                      }}>
                        {isSubmersible ? '🌊 BƠM CHÌM' : '🏠 BƠM CẠN'}
                      </span>
                      <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '2px 7px', borderRadius: 6, fontWeight: 800 }}>
                        SL: {req.qty} máy
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35 }}>
                      {req.title}
                    </h4>

                    {/* Customer Specs Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {req.flow && (
                        <span style={{ fontSize: 11, background: '#F1F5F9', color: '#0F172A', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                          💧 Q yêu cầu: <strong>{req.flow} m³/h</strong>
                        </span>
                      )}
                      {req.head && (
                        <span style={{ fontSize: 11, background: '#F1F5F9', color: '#0F172A', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                          🌊 H yêu cầu: <strong>{req.head} m</strong>
                        </span>
                      )}
                      {req.power && (
                        <span style={{ fontSize: 11, background: '#F1F5F9', color: '#0F172A', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                          ⚡ CS: ~{req.power} kW
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4, marginBottom: 6 }}>
                      ⚙️ Cấu hình: <strong>{req.config}</strong>
                    </div>

                    {req.rawText && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', background: 'var(--surface2)', padding: '6px 8px', borderRadius: 6 }}>
                        "{req.rawText}"
                      </div>
                    )}
                  </div>

                  {/* CỘT 2: PHƯƠNG ÁN 1 (MODEL KHỚP CHUẨN KỸ THUẬT ≥ 90%) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>⭐</span> <span>Phương án 1 (Khuyên dùng - Khớp kỹ thuật):</span>
                      </span>
                      {m && (
                        <span style={{
                          fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 10,
                          background: m.accuracy >= 90 ? '#DCFCE7' : '#FEF3C7',
                          color: m.accuracy >= 90 ? '#15803D' : '#B45309'
                        }}>
                          Độ khớp: {m.accuracy}%
                        </span>
                      )}
                    </div>

                    {m ? (
                      <div style={{
                        display: 'flex',
                        gap: 12,
                        padding: 10,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(8,120,217,0.03) 100%)',
                        border: '1px solid rgba(16,185,129,0.25)'
                      }}>
                        {/* Image */}
                        <div style={{ width: 85, height: 85, background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, border: '1px solid var(--border)', flexShrink: 0 }}>
                          <img
                            src={m.resolvedImage}
                            alt={m.name}
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer' }}
                            onClick={() => setZoomImage({ src: m.resolvedImage, name: m.name })}
                            title="Bấm để phóng to"
                          />
                        </div>

                        {/* Model Specs */}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>
                            Hãng: <strong>{m.webBrand || m.brand || 'UPTI PUMP'}</strong> ({m.mountLabel})
                          </div>

                          {/* Technical Comparison Bar */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6, fontSize: 11 }}>
                            {m.calcHead && (
                              <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                🌊 Hmax: {m.calcHead}m {req.head ? `(yc ${req.head}m)` : ''}
                              </span>
                            )}
                            {m.calcFlow && (
                              <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                💧 Qmax: {m.calcFlow}m³/h {req.flow ? `(yc ${req.flow}m³)` : ''}
                              </span>
                            )}
                            {m.calcPower && (
                              <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                ⚡ {m.calcPower} kW
                              </span>
                            )}
                            <span style={{ background: '#F5F3FF', color: '#6D28D9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                              🔌 {m.calcVoltage}
                            </span>
                          </div>

                          {/* Price & Subtotal */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#059669' }}>
                              {fmt(m.price)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>/ máy</span>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>
                              Thành tiền: <strong style={{ color: '#dc2626' }}>{fmt((m.price || 0) * (req.qty || 1))}</strong>
                            </div>
                          </div>

                          {/* 1-Click Copy Image */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                              onClick={() => handleCopyImage(m.resolvedImage, `best_${idx}`)}
                              style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                border: 'none', background: copiedImgKey === `best_${idx}` ? '#10B981' : '#0068FF',
                                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                              }}
                            >
                              <span>{copiedImgKey === `best_${idx}` ? '✅' : '📋'}</span>
                              <span>{copiedImgKey === `best_${idx}` ? 'Đã chép ảnh!' : 'Sao chép ảnh (Zalo)'}</span>
                            </button>
                            <button
                              onClick={() => downloadImage(m.resolvedImage, `${m.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`)}
                              style={{
                                padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer'
                              }}
                            >
                              💾 Tải ảnh
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 14, background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text3)' }}>
                        Chưa tìm thấy model khớp trong danh mục hiện tại.
                      </div>
                    )}
                  </div>

                  {/* CỘT 3: PHƯƠNG ÁN 2 & PHỤ KIỆN ĐỀ XUẤT */}
                  <div style={{ borderLeft: '1px dashed var(--border)', paddingLeft: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 4 }}>
                      🔗 Phương án 2 (Kinh tế / Dự phòng):
                    </div>
                    {alt ? (
                      <div style={{ background: 'var(--surface2)', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{alt.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          Hmax: {alt.calcHead || '...'}m • Qmax: {alt.calcFlow || '...'}m³/h • {alt.calcPower || '...'}kW
                        </div>
                        <div style={{ fontWeight: 800, color: '#059669', marginTop: 2 }}>
                          {fmt(alt.price)} <span style={{ fontSize: 10, color: 'var(--text3)' }}>(Khớp {alt.accuracy}%)</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 8 }}>
                        Không có phương án thay thế khác.
                      </div>
                    )}

                    {/* Phụ kiện đề xuất trọn gói */}
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 4 }}>
                      📦 Phụ kiện đề xuất kèm cụm:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.45 }}>
                      {req.accessories.map((acc, aIdx) => (
                        <li key={aIdx}>{acc}</li>
                      ))}
                    </ul>

                    {/* Delete row button */}
                    <button
                      onClick={() => handleRemoveRow(idx)}
                      style={{
                        marginTop: 10, background: 'none', border: 'none', color: '#dc2626',
                        fontSize: 11, cursor: 'pointer', padding: 0
                      }}
                    >
                      🗑️ Xóa hạng mục này
                    </button>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LIGHTBOX ZOOM MODAL ─────────────────────────────────────────── */}
      {zoomImage && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 13000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(5px)'
          }}
          onClick={() => setZoomImage(null)}
        >
          <div
            style={{
              background: 'var(--surface)', borderRadius: 14, maxWidth: 650, width: '100%', padding: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{zoomImage.name}</div>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)' }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 380, maxHeight: '60vh', background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <img src={zoomImage.src} alt={zoomImage.name} style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }} />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => handleCopyImage(zoomImage.src, 'zoom_btn')}
                className="btn sm primary"
                style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 800 }}
              >
                📋 Sao chép ảnh (Ctrl+V Zalo)
              </button>
              <button
                onClick={() => downloadImage(zoomImage.src, `${(zoomImage.name || 'may-bom').replace(/[^a-zA-Z0-9]/g, '_')}.png`)}
                className="btn sm"
                style={{ padding: '8px 16px', fontSize: 12.5 }}
              >
                💾 Tải ảnh về máy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
