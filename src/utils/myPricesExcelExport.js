import ExcelJS from 'exceljs'

/**
 * Xuất file Excel Bảng Giá theo đúng form chuẩn của Công ty T&T
 * @param {Object} options
 * @param {string} options.listName - Tên bảng giá / thương hiệu
 * @param {Array} options.rows - Danh sách sản phẩm [{ group, name, spec1, spec2, myPrice, price }]
 * @param {boolean} options.includeVat - Có VAT hay không
 * @param {number} options.discPct - % chiết khấu
 * @param {number} options.marginPct - % lợi nhuận
 * @param {string} options.userName - Tên người lập bảng giá
 * @param {string} options.fileName - Tên file tải về (optional)
 */
export async function exportMyPricesExcel({
  listName = 'UPTI PUMP',
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
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3
      }
    }
  })

  // Định nghĩa độ rộng cột (Columns A, B, C, D)
  ws.columns = [
    { key: 'group', width: 22 },   // Cột A: NHÓM SẢN PHẨM
    { key: 'name', width: 30 },    // Cột B: TÊN / MODEL
    { key: 'specs', width: 46 },   // Cột C: THÔNG SỐ KỸ THUẬT
    { key: 'price', width: 22 }    // Cột D: GIÁ BÁN (VNĐ)
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

  // Khối bên phải: THÔNG TIN CÔNG TY T&T (C1:D3)
  // Row 1: Tên công ty
  ws.mergeCells('C1:D1')
  const compNameCell = ws.getCell('C1')
  compNameCell.value = 'CÔNG TY TNHH TM MÁY CÔNG NGHIỆP T&T'
  compNameCell.font = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FF000000' }
  }
  compNameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  // Row 2: Địa chỉ
  ws.mergeCells('C2:D2')
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
  const mstCell = ws.getCell('C3')
  mstCell.value = 'MST: 0106888466'
  mstCell.font = {
    name: 'Arial',
    size: 9.5,
    color: { argb: 'FF334155' }
  }
  mstCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  const bankCell = ws.getCell('D3')
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
  ws.mergeCells('A5:D5')
  const titleCell = ws.getCell('A5')
  
  // Format tên thương hiệu/dòng bơm
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

  // Row 6: Dòng trống phân cách
  ws.getRow(6).height = 10

  // ─────────────────────────────────────────────────────────────
  // 3. TIÊU ĐỀ CỘT (Row 7)
  // ─────────────────────────────────────────────────────────────
  const headerRow = ws.getRow(7)
  headerRow.values = [
    'NHÓM SẢN PHẨM',
    'TÊN / MODEL',
    'THÔNG SỐ KỸ THUẬT',
    'GIÁ BÁN (VNĐ)'
  ]
  headerRow.height = 28

  for (let c = 1; c <= 4; c++) {
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
  // 4. DANH SÁCH DỮ LIỆU SẢN PHẨM (Row 8 trở đi)
  // ─────────────────────────────────────────────────────────────
  let currentRow = 8
  let lastGroupName = ''

  rows.forEach((r, idx) => {
    const rowObj = ws.getRow(currentRow)
    
    const groupName = r.group || ''
    // Nếu cùng nhóm sản phẩm với dòng trên thì để trống để bảng thoáng và đẹp như mẫu
    const displayGroup = (groupName !== lastGroupName) ? groupName : ''
    lastGroupName = groupName

    // Ghép thông số kỹ thuật (spec2 hoặc spec1 + spec2)
    let specsText = r.spec2 || ''
    if (r.spec1 && !specsText.includes(r.spec1)) {
      specsText = specsText ? `${r.spec1} kW, ${specsText}` : `${r.spec1} kW`
    }

    const priceNum = typeof r.myPrice === 'number'
      ? r.myPrice
      : (parseFloat(String(r.myPrice || r.originalPrice || 0).replace(/[^\d.]/g, '')) || 0)

    rowObj.values = [
      displayGroup,
      r.name || '',
      specsText,
      priceNum
    ]

    rowObj.height = 23

    // Cột A: Nhóm sản phẩm
    const cellA = rowObj.getCell(1)
    cellA.font = { name: 'Arial', size: 10, bold: !!displayGroup, color: { argb: displayGroup ? NAVY_COLOR : TEXT_DARK } }
    cellA.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    cellA.border = thinBorder

    // Cột B: Tên / Model
    const cellB = rowObj.getCell(2)
    cellB.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: TEXT_DARK } }
    cellB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    cellB.border = thinBorder

    // Cột C: Thông số kỹ thuật
    const cellC = rowObj.getCell(3)
    cellC.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } }
    cellC.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    cellC.border = thinBorder

    // Cột D: Giá bán (VNĐ)
    const cellD = rowObj.getCell(4)
    cellD.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
    cellD.alignment = { horizontal: 'right', vertical: 'middle' }
    cellD.numFmt = '#,##0'
    cellD.border = thinBorder

    // Zebra light striping
    if (idx % 2 === 1) {
      cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
      cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
      cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
      cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ROW_ALT } }
    }

    currentRow++
  })

  // Nếu không có sản phẩm nào
  if (rows.length === 0) {
    const emptyRow = ws.getRow(currentRow)
    ws.mergeCells(`A${currentRow}:D${currentRow}`)
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
  ws.getRow(currentRow).height = 10
  currentRow++

  // Tiêu đề Ghi chú
  ws.mergeCells(`A${currentRow}:D${currentRow}`)
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
    ws.mergeCells(`A${currentRow}:D${currentRow}`)
    const cell = ws.getCell(`A${currentRow}`)
    cell.value = noteText
    cell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF334155' } }
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    ws.getRow(currentRow).height = 20
    currentRow++
  })

  // Dòng trống trước phần chữ ký
  currentRow++
  ws.getRow(currentRow).height = 10
  currentRow++

  // Ngày tháng
  const today = new Date()
  const dayStr = String(today.getDate()).padStart(2, '0')
  const monthStr = String(today.getMonth() + 1).padStart(2, '0')
  const yearStr = today.getFullYear()

  ws.mergeCells(`C${currentRow}:D${currentRow}`)
  const dateCell = ws.getCell(`C${currentRow}`)
  dateCell.value = `Hà Nội, ngày ${dayStr} tháng ${monthStr} năm ${yearStr}`
  dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } }
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 20
  currentRow++

  // Tiêu đề các khối chữ ký
  ws.mergeCells(`A${currentRow}:B${currentRow}`)
  const signerLeftTitle = ws.getCell(`A${currentRow}`)
  signerLeftTitle.value = 'NGƯỜI LẬP BẢNG GIÁ'
  signerLeftTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
  signerLeftTitle.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`C${currentRow}:D${currentRow}`)
  const signerRightTitle = ws.getCell(`C${currentRow}`)
  signerRightTitle.value = 'ĐẠI DIỆN CÔNG TY T&T'
  signerRightTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: NAVY_COLOR } }
  signerRightTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 22
  currentRow++

  // Chú thích chữ ký
  ws.mergeCells(`A${currentRow}:B${currentRow}`)
  const subLeft = ws.getCell(`A${currentRow}`)
  subLeft.value = '(Ký & ghi rõ họ tên)'
  subLeft.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } }
  subLeft.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`C${currentRow}:D${currentRow}`)
  const subRight = ws.getCell(`C${currentRow}`)
  subRight.value = '(Ký tên & đóng dấu)'
  subRight.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } }
  subRight.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 18

  // Khoảng trống ký tên (4 dòng trống)
  currentRow += 4

  // Tên người lập & thông tin Hotline công ty
  ws.mergeCells(`A${currentRow}:B${currentRow}`)
  const nameLeft = ws.getCell(`A${currentRow}`)
  nameLeft.value = userName ? userName.toUpperCase() : 'NGUYỄN THỊ TUYẾT'
  nameLeft.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: TEXT_DARK } }
  nameLeft.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`C${currentRow}:D${currentRow}`)
  const nameRight = ws.getCell(`C${currentRow}`)
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
