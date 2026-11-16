import ExcelJS from 'exceljs'

/**
 * Hàm phân tách thông minh Công suất và Thông số Cột áp (Hmax) - Lưu lượng (Qmax)
 */
export function parsePowerAndSpecs(r) {
  let power = (r.spec1 || r.webSpecs?.power || '').toString().trim()
  let specs = (r.spec2 || r.webSpecs?.specs || '').toString().trim()

  // Chuẩn hóa công suất nếu chỉ có số
  if (power && !power.toLowerCase().includes('kw') && !power.toLowerCase().includes('hp') && !power.toLowerCase().includes('w')) {
    if (!isNaN(parseFloat(power))) {
      power = `${power} kW`
    }
  }

  // Tự động tách nếu trong spec2 có chứa phần công suất ở đầu
  // Ví dụ: "0,75 kW, Hmax 28 m - Qmax 9,0" hoặc "5-5,5KW-380V, Hmax 65m - Qmax 22"
  if (specs) {
    const match = specs.match(/^([\d,.\-\s]+(?:\s*-\s*[\d,.\s]+)?\s*(?:kW|KW|Kw|kw|HP|hp|W|w)(?:\s*-\s*\d+V)?)[,\s;]*(.*)$/i)
    if (match) {
      if (!power || power === '—') {
        power = match[1].trim()
      }
      specs = match[2].trim()
    }
  }

  // Chuẩn hóa dấu phẩy thành chấm cho công suất (VD: 0,75 kW -> 0.75 kW)
  if (power) {
    power = power.replace(/(\d+),(\d+)/g, '$1.$2')
  }

  // Dọn dẹp ký tự thừa đầu chuỗi thông số
  if (specs) {
    specs = specs.replace(/^[,\s;:\-]+/, '').trim()
  }

  return {
    power: power || '—',
    specs: specs || '—'
  }
}

/**
 * Định dạng họng xả đẹp mắt chuẩn kỹ thuật (DN50, Ø65 mm, Hút Ø42 / Xả Ø34 mm...)
 */
export function formatPipeStr(val) {
  if (!val || typeof val !== 'string') return ''
  const s = String(val).trim()
  if (!s || s.toLowerCase() === 'vỏ nhôm' || s === '-' || s === '—') return '—'
  
  if (/^DN\s*\d+/i.test(s)) return s.toUpperCase().replace(/\s+/, '')
  
  if (/^[ØφΦ]\s*/i.test(s)) {
    const clean = s.replace(/^[ØφΦ]\s*/i, '').trim()
    return clean.includes('mm') || clean.includes('inch') || clean.includes('"') ? `Ø${clean}` : `Ø${clean} mm`
  }
  
  const pairMatch = s.match(/^(\d+)\s*[-/]\s*(\d+)$/)
  if (pairMatch) {
    const p1 = pairMatch[1]
    const p2 = pairMatch[2]
    if (p1 === p2) return `Ø${p1} mm`
    return `Hút Ø${p1} / Xả Ø${p2} mm`
  }
  
  if (/^\d+(\.\d+)?$/.test(s)) {
    return `Ø${s} mm`
  }
  
  return s
}

/**
 * Tải ảnh và chuyển thành Buffer / Uint8Array để ExcelJS nhúng vào file
 */
async function fetchImageBuffer(urlOrBase64) {
  if (!urlOrBase64 || typeof urlOrBase64 !== 'string') return null
  try {
    if (urlOrBase64.startsWith('data:')) {
      const parts = urlOrBase64.split(',')
      if (parts.length < 2) return null
      const base64Data = parts[1]
      const binaryString = atob(base64Data)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const isPng = urlOrBase64.includes('image/png')
      return {
        buffer: bytes.buffer,
        extension: isPng ? 'png' : 'jpeg'
      }
    } else {
      const resp = await fetch(urlOrBase64, { mode: 'cors' })
      if (!resp.ok) return null
      const arrayBuffer = await resp.arrayBuffer()
      const isPng = urlOrBase64.toLowerCase().endsWith('.png')
      return {
        buffer: arrayBuffer,
        extension: isPng ? 'png' : 'jpeg'
      }
    }
  } catch (err) {
    console.warn('Không thể tải ảnh cho Excel:', err)
    return null
  }
}

/**
 * Xuất file Excel Bảng Giá theo form chuẩn Công ty T&T:
 * - Cột HÌNH ẢNH ở cuối cùng bên phải
 * - Merge 1 ảnh đại diện to rõ nét cho cả dòng/nhóm sản phẩm
 * - Cột Công suất & Thông số H-Q tách riêng biệt
 */
export async function exportMyPricesExcel({
  listName = 'UPTI PUMP',
  note = '',
  rows = [],
  includeVat = false,
  discPct = 0,
  marginPct = 0,
  userName = '',
  fileName = ''
}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Công Ty TNHH TM Máy Công Nghiệp T&T'
  wb.created = new Date()
  wb.modified = new Date()

  const ws = wb.addWorksheet('BẢNG GIÁ', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    }
  })

  // Định nghĩa độ rộng 7 cột: A (Nhóm), B (Model), C (Công suất), D (Thông số H-Q), E (Họng xả), F (Giá bán), G (Hình ảnh bên phải)
  ws.columns = [
    { key: 'group', width: 22 },   // Cột A: NHÓM SẢN PHẨM
    { key: 'name', width: 28 },    // Cột B: TÊN / MODEL
    { key: 'power', width: 14 },   // Cột C: CÔNG SUẤT (0.75 kW, 1.1 kW...)
    { key: 'specs', width: 34 },   // Cột D: THÔNG SỐ (H - Q)
    { key: 'pipe', width: 16 },    // Cột E: HỌNG XẢ (DN50, Ø65...)
    { key: 'price', width: 20 },   // Cột F: GIÁ BÁN (VNĐ)
    { key: 'image', width: 22 }    // Cột G: HÌNH ẢNH ĐẠI DIỆN
  ]

  // Bảng màu chuẩn thương hiệu T&T
  const NAVY_COLOR = 'FF0E385E'      // Xanh Navy đậm (#0E385E)
  const BORDER_COLOR = 'FFD0D7DE'    // Viền xám nhạt bảng tính
  const TEXT_DARK = 'FF1E293B'       // Màu chữ đậm
  const BG_ROW_ALT = 'FFF8FAFC'      // Màu nền dòng so le

  const thinBorder = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. HEADER CÔNG TY (Rows 1 - 3)
  // ─────────────────────────────────────────────────────────────

  // Khối bên trái: T&T MÁY BƠM CÔNG NGHIỆP (A1:B3)
  ws.mergeCells('A1:B3')
  const logoCell = ws.getCell('A1')
  logoCell.value = 'T&T\nMÁY BƠM CÔNG NGHIỆP'
  logoCell.font = {
    name: 'Arial',
    size: 13,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  }
  logoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY_COLOR }
  }
  logoCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true
  }

  // Khối bên phải: THÔNG TIN CÔNG TY T&T (C1:G3)
  // Row 1: Tên công ty
  ws.mergeCells('C1:G1')
  const compNameCell = ws.getCell('C1')
  compNameCell.value = 'CÔNG TY TNHH TM MÁY CÔNG NGHIỆP T&T'
  compNameCell.font = {
    name: 'Arial',
    size: 11.5,
    bold: true,
    color: { argb: 'FF000000' }
  }
  compNameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  // Row 2: Địa chỉ
  ws.mergeCells('C2:G2')
  const addrCell = ws.getCell('C2')
  addrCell.value = 'Địa chỉ: Số 3 ngõ 61 đường Chùa Vẽ, TDP Thống Nhất, P. Dương Nội, TP Hà Nội'
  addrCell.font = {
    name: 'Arial',
    size: 9.5,
    italic: true,
    color: { argb: 'FF334155' }
  }
  addrCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  // Row 3: MST và STK Ngân hàng
  ws.mergeCells('C3:D3')
  const mstCell = ws.getCell('C3')
  mstCell.value = 'MST: 0106888466'
  mstCell.font = {
    name: 'Arial',
    size: 9.5,
    color: { argb: 'FF334155' }
  }
  mstCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  ws.mergeCells('E3:G3')
  const bankCell = ws.getCell('E3')
  bankCell.value = 'STK: 860088688888 – MB Tây Hà Nội'
  bankCell.font = {
    name: 'Arial',
    size: 9.5,
    color: { argb: 'FF334155' }
  }
  bankCell.alignment = { horizontal: 'left', vertical: 'middle' }

  // Set row heights for rows 1 - 3
  ws.getRow(1).height = 20
  ws.getRow(2).height = 20
  ws.getRow(3).height = 20

  // Row 4: Dòng trống phân cách
  ws.getRow(4).height = 12

  // ─────────────────────────────────────────────────────────────
  // 2. TIÊU ĐỀ BẢNG GIÁ (Row 5)
  // ─────────────────────────────────────────────────────────────
  ws.mergeCells('A5:G5')
  const titleCell = ws.getCell('A5')
  
  let cleanTitle = String(listName || 'SẢN PHẨM')
    .replace(/^BẢNG GIÁ\s*[-–:]*\s*/i, '')
    .trim()
    .toUpperCase()

  titleCell.value = `BẢNG GIÁ SẢN PHẨM – ${cleanTitle}`
  titleCell.font = {
    name: 'Arial',
    size: 15,
    bold: true,
    color: { argb: NAVY_COLOR }
  }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(5).height = 30

  // Row 6: Dòng lưu ý nếu có hoặc dòng trống
  if (note && String(note).trim()) {
    ws.mergeCells('A6:G6')
    const noteCell = ws.getCell('A6')
    noteCell.value = `* Lưu ý: ${String(note).trim()}`
    noteCell.font = {
      name: 'Arial',
      size: 10,
      italic: true,
      color: { argb: 'FF92400E' }
    }
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(6).height = 20
  } else {
    ws.getRow(6).height = 10
  }

  // ─────────────────────────────────────────────────────────────
  // 3. TIÊU ĐỀ CỘT (Row 7)
  // ─────────────────────────────────────────────────────────────
  const headerRow = ws.getRow(7)
  headerRow.values = [
    'NHÓM SẢN PHẨM',
    'TÊN / MODEL',
    'CÔNG SUẤT',
    'THÔNG SỐ (H - Q)',
    'HỌNG XẢ',
    'GIÁ BÁN (VNĐ)',
    'HÌNH ẢNH'
  ]
  headerRow.height = 28

  for (let c = 1; c <= 7; c++) {
    const cell = headerRow.getCell(c)
    cell.font = {
      name: 'Arial',
      size: 10.5,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: NAVY_COLOR }
    }
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF07243E' } },
      bottom: { style: 'medium', color: { argb: 'FF07243E' } },
      left: { style: 'thin', color: { argb: 'FF07243E' } },
      right: { style: 'thin', color: { argb: 'FF07243E' } }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. GOM NHÓM & XUẤT DỮ LIỆU SẢN PHẨM (Row 8 trở đi)
  // ─────────────────────────────────────────────────────────────
  
  // Gom các sản phẩm thành từng nhóm liên tiếp để merge dòng & ảnh đại diện
  const groups = []
  let curG = null

  rows.forEach(r => {
    const gName = (r.group || 'DÒNG BƠM KHÁC').trim()
    if (!curG || curG.name !== gName) {
      curG = {
        name: gName,
        items: [],
        imageUrl: null
      }
      groups.push(curG)
    }
    curG.items.push(r)
    if (!curG.imageUrl) {
      curG.imageUrl = r.image || (r.webImages && r.webImages[0]) || (r.images && r.images[0]) || null
    }
  })

  // Tải trước ảnh đại diện của từng nhóm
  const groupImagePromises = groups.map(g => {
    return g.imageUrl ? fetchImageBuffer(g.imageUrl) : Promise.resolve(null)
  })
  const groupImageBuffers = await Promise.all(groupImagePromises)

  let currentRow = 8

  groups.forEach((group, gIdx) => {
    const startRow = currentRow
    const numItems = group.items.length
    const endRow = startRow + numItems - 1
    const imgObj = groupImageBuffers[gIdx]

    // Chiều cao dòng: nếu nhóm chỉ có 1 sản phẩm mà có ảnh thì tăng lên 65px để ảnh to, nếu nhiều dòng thì 28px/dòng
    const itemRowHeight = numItems === 1 && imgObj ? 65 : 28

    group.items.forEach((r, idxInGroup) => {
      const rowObj = ws.getRow(currentRow)
      const { power, specs } = parsePowerAndSpecs(r)
      const pipeStr = formatPipeStr(r.phiHocng || r.pipe || r.webSpecs?.pipe || '') || '—'

      const priceNum = typeof r.myPrice === 'number'
        ? r.myPrice
        : (parseFloat(String(r.myPrice || r.originalPrice || 0).replace(/[^\d.]/g, '')) || 0)

      rowObj.values = [
        group.name,
        r.name || '',
        power,
        specs,
        pipeStr,
        priceNum,
        ''
      ]

      rowObj.height = itemRowHeight

      // Cột A: Nhóm sản phẩm
      const cellA = rowObj.getCell(1)
      cellA.font = { name: 'Arial', size: 10, bold: true, color: { argb: NAVY_COLOR } }
      cellA.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
      cellA.border = thinBorder

      // Cột B: Tên / Model
      const cellB = rowObj.getCell(2)
      cellB.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: TEXT_DARK } }
      cellB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      cellB.border = thinBorder

      // Cột C: Công suất
      const cellC = rowObj.getCell(3)
      cellC.font = { name: 'Arial', size: 10, bold: true, color: { argb: NAVY_COLOR } }
      cellC.alignment = { horizontal: 'center', vertical: 'middle' }
      cellC.border = thinBorder

      // Cột D: Thông số H - Q
      const cellD = rowObj.getCell(4)
      cellD.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } }
      cellD.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      cellD.border = thinBorder

      // Cột E: Họng xả
      const cellE = rowObj.getCell(5)
      cellE.font = { name: 'Arial', size: 10, bold: true, color: { argb: TEXT_DARK } }
      cellE.alignment = { horizontal: 'center', vertical: 'middle' }
      cellE.border = thinBorder

      // Cột F: Giá bán (VNĐ)
      const cellF = rowObj.getCell(6)
      cellF.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
      cellF.alignment = { horizontal: 'right', vertical: 'middle' }
      cellF.numFmt = '#,##0'
      cellF.border = thinBorder

      // Cột G: Hình ảnh đại diện
      const cellG = rowObj.getCell(7)
      cellG.font = { name: 'Arial', size: 9.5, color: { argb: 'FF94A3B8' } }
      cellG.alignment = { horizontal: 'center', vertical: 'middle' }
      cellG.border = thinBorder

      // Zebra light striping
      if (idxInGroup % 2 === 1) {
        cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
        cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
        cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
        cellE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
        cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
      }

      currentRow++
    })

    // Merge Cột A (Nhóm sản phẩm) cho toàn bộ nhóm
    if (numItems > 1) {
      ws.mergeCells(startRow, 1, endRow, 1)
      const mergedA = ws.getCell(startRow, 1)
      mergedA.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
    }

    // Merge Cột G (Hình ảnh đại diện) cho toàn bộ nhóm và nhúng ảnh to
    if (numItems > 1) {
      ws.mergeCells(startRow, 7, endRow, 7)
    }

    if (imgObj) {
      try {
        const imgId = wb.addImage({
          buffer: imgObj.buffer,
          extension: imgObj.extension
        })

        // Tính kích thước ảnh to phù hợp với chiều cao khối merged
        const totalHeightPoints = numItems === 1 ? 65 : numItems * 28
        const imgPixelSize = Math.min(110, Math.max(60, Math.round(totalHeightPoints * 0.78)))

        // Đặt ảnh vào giữa ô Col G (Col index 6 in ExcelJS 0-based)
        const rowOffset = numItems === 1
          ? 0.08
          : (numItems - (imgPixelSize / 36)) / 2

        ws.addImage(imgId, {
          tl: { col: 6.15, row: (startRow - 1) + Math.max(0.05, rowOffset) },
          ext: { width: imgPixelSize, height: imgPixelSize },
          editAs: 'oneCell'
        })
      } catch (addImgErr) {
        console.warn('Lỗi chèn ảnh nhóm vào Excel:', addImgErr)
        ws.getCell(startRow, 7).value = '📷'
      }
    } else {
      ws.getCell(startRow, 7).value = '—'
    }
  })

  // Nếu không có sản phẩm nào
  if (rows.length === 0) {
    const emptyRow = ws.getRow(currentRow)
    ws.mergeCells(`A${currentRow}:G${currentRow}`)
    const emptyCell = emptyRow.getCell(1)
    emptyCell.value = 'Không có sản phẩm nào trong bảng giá'
    emptyCell.font = { name: 'Arial', size: 10.5, italic: true, color: { argb: 'FF64748B' } }
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
    emptyCell.border = thinBorder
    emptyRow.height = 30
    currentRow++
  }

  // ─────────────────────────────────────────────────────────────
  // 5. FOOTER CHUYÊN NGHIỆP (Ghi chú, Điều khoản & Chữ ký)
  // ─────────────────────────────────────────────────────────────
  currentRow++ // Dòng trống
  ws.getRow(currentRow).height = 12
  currentRow++

  // Tiêu đề Ghi chú
  ws.mergeCells(`A${currentRow}:G${currentRow}`)
  const noteTitleCell = ws.getCell(`A${currentRow}`)
  noteTitleCell.value = '📌 GHI CHÚ & ĐIỀU KHOẢN THƯƠNG MẠI:'
  noteTitleCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
  noteTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(currentRow).height = 22
  currentRow++

  // Danh sách các điều khoản chuyên nghiệp
  const vatText = includeVat
    ? 'Giá trên ĐÃ BAO GỒM thuế VAT.'
    : 'Giá trên CHƯA BAO GỒM thuế giá trị gia tăng (VAT).'

  const notesList = [
    `1. Giá cả: ${vatText}`,
    '2. Hiệu lực báo giá: Bảng giá có hiệu lực trong vòng 30 ngày kể từ ngày ban hành.',
    '3. Xuất xứ & Chất lượng: Cam kết hàng chính hãng 100%, mới nguyên đai nguyên kiện, đầy đủ chứng chỉ chất lượng CO/CQ và hóa đơn VAT hợp pháp.',
    '4. Chế độ bảo hành: 12 – 24 tháng theo tiêu chuẩn của nhà sản xuất.',
    '5. Giao hàng & Vận chuyển: Miễn phí vận chuyển nội thành Hà Nội cho các đơn hàng tiêu chuẩn; Hỗ trợ giao nhanh ra các bến xe, chành xe chuyển phát đi tất cả các tỉnh thành trên toàn quốc.'
  ]

  notesList.forEach(noteText => {
    ws.mergeCells(`A${currentRow}:G${currentRow}`)
    const cell = ws.getCell(`A${currentRow}`)
    cell.value = noteText
    cell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF334155' } }
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    ws.getRow(currentRow).height = 20
    currentRow++
  })

  // Dòng trống trước phần chữ ký
  currentRow++
  ws.getRow(currentRow).height = 12
  currentRow++

  // Ngày tháng
  const today = new Date()
  const dayStr = String(today.getDate()).padStart(2, '0')
  const monthStr = String(today.getMonth() + 1).padStart(2, '0')
  const yearStr = today.getFullYear()

  ws.mergeCells(`E${currentRow}:G${currentRow}`)
  const dateCell = ws.getCell(`E${currentRow}`)
  dateCell.value = `Hà Nội, ngày ${dayStr} tháng ${monthStr} năm ${yearStr}`
  dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } }
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 20
  currentRow++

  // Tiêu đề các khối chữ ký
  ws.mergeCells(`A${currentRow}:D${currentRow}`)
  const signerLeftTitle = ws.getCell(`A${currentRow}`)
  signerLeftTitle.value = 'NGƯỜI LẬP BẢNG GIÁ'
  signerLeftTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
  signerLeftTitle.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`E${currentRow}:G${currentRow}`)
  const signerRightTitle = ws.getCell(`E${currentRow}`)
  signerRightTitle.value = 'ĐẠI DIỆN CÔNG TY T&T'
  signerRightTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
  signerRightTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 22
  currentRow++

  // Chú thích chữ ký
  ws.mergeCells(`A${currentRow}:D${currentRow}`)
  const subLeft = ws.getCell(`A${currentRow}`)
  subLeft.value = '(Ký & ghi rõ họ tên)'
  subLeft.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } }
  subLeft.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`E${currentRow}:G${currentRow}`)
  const subRight = ws.getCell(`E${currentRow}`)
  subRight.value = '(Ký tên & đóng dấu)'
  subRight.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } }
  subRight.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 18

  // Khoảng trống ký tên (4 dòng trống)
  currentRow += 4

  // Tên người lập & thông tin Hotline công ty
  ws.mergeCells(`A${currentRow}:D${currentRow}`)
  const nameLeft = ws.getCell(`A${currentRow}`)
  nameLeft.value = userName ? userName.toUpperCase() : 'NGUYỄN THỊ TUYẾT'
  nameLeft.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: TEXT_DARK } }
  nameLeft.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`E${currentRow}:G${currentRow}`)
  const nameRight = ws.getCell(`E${currentRow}`)
  nameRight.value = 'Hotline: 0984.273.806 – maybomtandt.com.vn'
  nameRight.font = { name: 'Arial', size: 10, bold: true, color: { argb: NAVY_COLOR } }
  nameRight.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 24

  // ─────────────────────────────────────────────────────────────
  // 6. XUẤT FILE BUFFER & TẢI XUỐNG
  // ─────────────────────────────────────────────────────────────
  const finalFileName = fileName || `Bang-gia-${cleanTitle.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, '-')}-${today.toISOString().slice(0, 10)}.xlsx`

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = finalFileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
