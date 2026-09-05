import ExcelJS from 'exceljs'

const TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/Mau_bao_gia_TT_tu_dong.xlsx`

/**
 * Đọc số tiền thành chữ tiếng Việt chuẩn xác
 * @example docSoThanhChu(5940000) => "Năm triệu chín trăm bốn mươi nghìn đồng chẵn."
 */
export function docSoThanhChu(so) {
  if (so == null || isNaN(so)) return ''
  const num = Math.round(Number(so))
  if (num === 0) return 'Không đồng chẵn.'

  const dv = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
  const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

  function docBlock3(b, full = true) {
    const tr = Math.floor(b / 100)
    const ch = Math.floor((b % 100) / 10)
    const c = b % 10
    let res = ''

    if (tr > 0 || full) res += chuSo[tr] + ' trăm '
    if (ch > 1) {
      res += chuSo[ch] + ' mươi '
      if (c === 1) res += 'mốt '
      else if (c === 5) res += 'lăm '
      else if (c > 0) res += chuSo[c] + ' '
    } else if (ch === 1) {
      res += 'mười '
      if (c === 5) res += 'lăm '
      else if (c > 0) res += chuSo[c] + ' '
    } else {
      if (c > 0) {
        if (tr > 0 || full) res += 'lẻ ' + chuSo[c] + ' '
        else res += chuSo[c] + ' '
      }
    }
    return res.trim()
  }

  const s = Math.abs(num)
  let strNum = s.toString()
  const blocks = []
  while (strNum.length > 0) {
    blocks.unshift(parseInt(strNum.slice(-3), 10))
    strNum = strNum.slice(0, -3)
  }

  let chuoi = ''
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const donvi = dv[blocks.length - 1 - i]
    if (b > 0) {
      const doc = docBlock3(b, i > 0)
      chuoi += doc + ' ' + donvi + ' '
    }
  }

  chuoi = chuoi.trim() + ' đồng chẵn.'
  chuoi = chuoi.charAt(0).toUpperCase() + chuoi.slice(1)
  return chuoi.replace(/\s+/g, ' ')
}

const thinBorder = {
  top: { style: 'thin', color: { argb: 'FFAEBBC6' } },
  left: { style: 'thin', color: { argb: 'FFAEBBC6' } },
  bottom: { style: 'thin', color: { argb: 'FFAEBBC6' } },
  right: { style: 'thin', color: { argb: 'FFAEBBC6' } },
}

const navyHeaderFill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF17365D' },
}

const graySubFill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F6F8' },
}

const downloadBuffer = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Xuất báo giá Excel chuẩn theo mẫu T&T tự động (Mau_bao_gia_TT_tu_dong.xlsx)
 */
export const exportQuoteExcel = async ({
  customerName = '',
  customerAddress = '',
  customerTaxCode = '',
  contactPerson = '',
  contactPhone = '',
  quoteNumber = '',
  quoteDate = new Date(),
  quoterName = 'NGUYỄN THỊ TUYẾT',
  note = '',
  items = [],
  sellTotal = 0,
  vatAmount = 0,
  vatPct = 8,
  includeVat = false,
  shipping = 0,
  grandTotal = 0,
  filename,
}) => {
  const resp = await fetch(TEMPLATE_URL)
  if (!resp.ok) throw new Error('Không tải được file mẫu báo giá')
  const buf = await resp.arrayBuffer()

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.getWorksheet('BÁO GIÁ') || wb.worksheets[0]

  const d = quoteDate instanceof Date ? quoteDate : new Date(quoteDate || Date.now())
  const qDateStr = `Hà Nội, ngày ${String(d.getDate()).padStart(2, '0')} tháng ${String(d.getMonth() + 1).padStart(2, '0')} năm ${d.getFullYear()}`
  const qNum = quoteNumber || `Số: ……/${d.getFullYear()}/BG-T&T`

  // 1. Tiêu đề số báo giá & ngày
  ws.getCell('A6').value = qNum
  ws.getCell('D6').value = qDateStr

  // 2. Thông tin khách hàng
  ws.getCell('B9').value = customerName || ''
  ws.getCell('B10').value = customerAddress || ''
  ws.getCell('F10').value = customerTaxCode || ''
  ws.getCell('B11').value = contactPerson || ''
  ws.getCell('F11').value = contactPhone || ''

  // 3. Xóa sạch tất cả merge và ô từ dòng 14 trở xuống để tránh lỗi merge duplicate trong ExcelJS
  for (const key in ws._merges) {
    const m = ws._merges[key]
    if (m && m.model && m.model.top >= 14) {
      delete ws._merges[key]
    }
  }

  for (let r = 14; r <= 80; r++) {
    const row = ws.getRow(r)
    row.values = []
    row.height = undefined
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c)
      cell.value = null
      cell.fill = { type: 'pattern', pattern: 'none' }
      cell.border = {}
      cell.font = { name: 'Aptos', size: 10 }
      cell.numFmt = null
    }
  }

  // 4. Điền các dòng sản phẩm bắt đầu từ dòng 14
  let curRow = 14
  let calculatedSubTotal = 0

  const safeItems = items && items.length > 0 ? items : [{ name: '', specs: '', unit: 'Cái', qty: 1, sellPrice: 0 }]

  safeItems.forEach((it, idx) => {
    const r = curRow
    const qty = Number(it.qty) || 1
    const price = Number(it.sellPrice) || 0
    const total = qty * price
    calculatedSubTotal += total

    const row = ws.getRow(r)
    row.getCell(1).value = idx + 1
    row.getCell(2).value = it.name || ''
    row.getCell(3).value = it.specs || ''
    row.getCell(4).value = it.unit || 'Cái'
    row.getCell(5).value = qty
    row.getCell(6).value = price
    row.getCell(7).value = total

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
    row.getCell(6).numFmt = '#,##0;-#,##0;;'
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
    row.getCell(7).numFmt = '#,##0;-#,##0;;'

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF1F2933' } }
      cell.border = thinBorder
    }

    const nameLines = String(it.name || '').split('\n').length
    const specLines = String(it.specs || '').split('\n').length
    const maxLines = Math.max(nameLines, specLines, 1)
    row.height = Math.max(26, maxLines * 16 + 8)

    curRow++
  })

  // 5. Phần tổng tiền
  const finalSubTotal = sellTotal || calculatedSubTotal
  const actualVatPct = includeVat ? (Number(vatPct) || 8) : 0
  const finalVatAmount = includeVat ? (vatAmount || Math.round(finalSubTotal * (actualVatPct / 100))) : 0
  const ship = Number(shipping) || 0
  const finalGrandTotal = grandTotal || (finalSubTotal + finalVatAmount + ship)

  // Dòng: Cộng tiền hàng (Merge D..F)
  const subTotalRow = curRow
  ws.mergeCells(`D${subTotalRow}:F${subTotalRow}`)
  ws.getCell(`D${subTotalRow}`).value = 'Cộng tiền hàng'
  ws.getCell(`D${subTotalRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`D${subTotalRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell(`D${subTotalRow}`).fill = graySubFill

  ws.getCell(`G${subTotalRow}`).value = finalSubTotal
  ws.getCell(`G${subTotalRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`G${subTotalRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`G${subTotalRow}`).numFmt = '#,##0;-#,##0;;'
  ws.getCell(`G${subTotalRow}`).fill = graySubFill

  for (let c = 4; c <= 7; c++) {
    ws.getRow(subTotalRow).getCell(c).border = thinBorder
  }
  ws.getRow(subTotalRow).height = 24
  curRow++

  // Dòng: Thuế GTGT (Merge D..E, F: %VAT, G: tiền VAT)
  const vatRow = curRow
  ws.mergeCells(`D${vatRow}:E${vatRow}`)
  ws.getCell(`D${vatRow}`).value = 'Thuế GTGT'
  ws.getCell(`D${vatRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`D${vatRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  ws.getCell(`F${vatRow}`).value = actualVatPct > 0 ? `${actualVatPct}%` : '0%'
  ws.getCell(`F${vatRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`F${vatRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  ws.getCell(`G${vatRow}`).value = finalVatAmount
  ws.getCell(`G${vatRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`G${vatRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`G${vatRow}`).numFmt = '#,##0;-#,##0;;'

  for (let c = 4; c <= 7; c++) {
    ws.getRow(vatRow).getCell(c).border = thinBorder
  }
  ws.getRow(vatRow).height = 24
  curRow++

  // Dòng: TỔNG THANH TOÁN (Merge D..F)
  const grandTotalRow = curRow
  ws.mergeCells(`D${grandTotalRow}:F${grandTotalRow}`)
  ws.getCell(`D${grandTotalRow}`).value = 'TỔNG THANH TOÁN'
  ws.getCell(`D${grandTotalRow}`).font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`D${grandTotalRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell(`D${grandTotalRow}`).fill = graySubFill

  ws.getCell(`G${grandTotalRow}`).value = finalGrandTotal
  ws.getCell(`G${grandTotalRow}`).font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`G${grandTotalRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`G${grandTotalRow}`).numFmt = '#,##0;-#,##0;;'
  ws.getCell(`G${grandTotalRow}`).fill = graySubFill

  for (let c = 4; c <= 7; c++) {
    ws.getRow(grandTotalRow).getCell(c).border = thinBorder
  }
  ws.getRow(grandTotalRow).height = 26
  curRow++

  // Dòng: Bằng chữ (Merge A..B: "Bằng chữ:", Merge C..G: chữ)
  const wordsRow = curRow
  ws.mergeCells(`A${wordsRow}:B${wordsRow}`)
  ws.getCell(`A${wordsRow}`).value = 'Bằng chữ:'
  ws.getCell(`A${wordsRow}`).font = { name: 'Aptos', size: 10, italic: true, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`A${wordsRow}`).alignment = { horizontal: 'left', vertical: 'middle' }

  ws.mergeCells(`C${wordsRow}:G${wordsRow}`)
  ws.getCell(`C${wordsRow}`).value = docSoThanhChu(finalGrandTotal)
  ws.getCell(`C${wordsRow}`).font = { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF1F2933' } }
  ws.getCell(`C${wordsRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(wordsRow).height = 24
  curRow++

  // Dòng trống cách biệt
  ws.getRow(curRow).height = 10
  curRow++

  // 6. ĐIỀU KIỆN THƯƠNG MẠI
  const termsHeaderRow = curRow
  ws.mergeCells(`A${termsHeaderRow}:G${termsHeaderRow}`)
  ws.getCell(`A${termsHeaderRow}`).value = 'ĐIỀU KIỆN THƯƠNG MẠI'
  ws.getCell(`A${termsHeaderRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getCell(`A${termsHeaderRow}`).fill = navyHeaderFill
  ws.getCell(`A${termsHeaderRow}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(termsHeaderRow).height = 24
  curRow++

  const termsList = [
    { label: 'Chất lượng / Bảo hành', text: 'Hàng mới 100%, chính hãng; bảo hành 12 tháng.' },
    { label: 'Giá / Hiệu lực', text: 'Đơn giá chưa gồm VAT; báo giá có hiệu lực 07 ngày.' },
    { label: 'Giao hàng', text: 'Trong 1 đến 4 ngày từ khi xác nhận đơn; địa điểm theo yêu cầu.' },
    { label: 'Thanh toán', text: 'Thanh toán 100% trước khi giao hàng.' },
    { label: 'Chuyển khoản', text: 'STK 8600888688888 – Ngân hàng TMCP Quân đội (MB), CN Tây Hà Nội.' },
  ]

  termsList.forEach(t => {
    const r = curRow
    ws.mergeCells(`A${r}:B${r}`)
    ws.getCell(`A${r}`).value = t.label
    ws.getCell(`A${r}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
    ws.getCell(`A${r}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
    ws.getCell(`A${r}`).fill = graySubFill

    ws.mergeCells(`C${r}:G${r}`)
    ws.getCell(`C${r}`).value = t.text
    ws.getCell(`C${r}`).font = { name: 'Aptos', size: 10, color: { argb: 'FF1F2933' } }
    ws.getCell(`C${r}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }

    for (let c = 1; c <= 7; c++) {
      ws.getRow(r).getCell(c).border = thinBorder
    }
    ws.getRow(r).height = 23
    curRow++
  })

  // Dòng trống cách biệt
  ws.getRow(curRow).height = 14
  curRow++

  // 7. Chữ ký xác nhận (Signatures)
  const sigHeaderRow = curRow
  ws.mergeCells(`A${sigHeaderRow}:C${sigHeaderRow}`)
  ws.getCell(`A${sigHeaderRow}`).value = 'XÁC NHẬN KHÁCH HÀNG'
  ws.getCell(`A${sigHeaderRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`A${sigHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`E${sigHeaderRow}:G${sigHeaderRow}`)
  ws.getCell(`E${sigHeaderRow}`).value = 'ĐẠI DIỆN BÊN BÁN'
  ws.getCell(`E${sigHeaderRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`E${sigHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(sigHeaderRow).height = 20
  curRow++

  const sigSubRow = curRow
  ws.mergeCells(`A${sigSubRow}:C${sigSubRow}`)
  ws.getCell(`A${sigSubRow}`).value = '(Ký, ghi rõ họ tên)'
  ws.getCell(`A${sigSubRow}`).font = { name: 'Aptos', size: 9, italic: true, color: { argb: 'FF6B7280' } }
  ws.getCell(`A${sigSubRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(`E${sigSubRow}:G${sigSubRow}`)
  ws.getCell(`E${sigSubRow}`).value = 'GIÁM ĐỐC'
  ws.getCell(`E${sigSubRow}`).font = { name: 'Aptos', size: 9, italic: true, color: { argb: 'FF6B7280' } }
  ws.getCell(`E${sigSubRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(sigSubRow).height = 18
  curRow++

  // 2 dòng trống tạo khoảng cách để ký
  ws.getRow(curRow).height = 18
  curRow++
  ws.getRow(curRow).height = 18
  curRow++

  // Tên người đại diện bên bán / Giám đốc
  const sigNameRow = curRow
  ws.mergeCells(`E${sigNameRow}:G${sigNameRow}`)
  ws.getCell(`E${sigNameRow}`).value = quoterName || 'NGUYỄN THỊ TUYẾT'
  ws.getCell(`E${sigNameRow}`).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } }
  ws.getCell(`E${sigNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(sigNameRow).height = 22

  // 8. Cấu hình in khổ A4 chuẩn
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
    printArea: `A1:G${sigNameRow + 1}`,
  }

  const outName =
    filename ||
    `bao-gia-${(customerName || 'khach').replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ]/g, '-').slice(0, 30)}-${d.toISOString().slice(0, 10)}.xlsx`

  const outBuf = await wb.xlsx.writeBuffer()
  downloadBuffer(outBuf, outName)
}

export const fmtNum = (n) => (n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') : '')

