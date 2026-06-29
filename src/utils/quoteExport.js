import ExcelJS from 'exceljs'

const TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/bao-gia-mau.xlsx`

const fmtDate = (d) => d.toLocaleDateString('vi-VN')

const thin = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

const fontBody = { name: 'Times New Roman', size: 11 }
const fontBold = { name: 'Times New Roman', size: 11, bold: true }

/** Cột phải meta — merge M:P (13–16), ghi vào ô master M */
const META_COL = 13
const setMetaRight = (ws, row, text) => {
  const cell = ws.getCell(row, META_COL)
  cell.value = text
  cell.font = fontBody
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
}

/** Template đã merge sẵn một số dòng — bỏ qua nếu đã merge */
const safeMerge = (ws, r1, c1, r2, c2) => {
  try {
    ws.mergeCells(r1, c1, r2, c2)
  } catch (e) {
    const msg = String(e?.message || e)
    if (!msg.toLowerCase().includes('merge')) throw e
  }
}

const TABLE_FROM = 4
const TABLE_TO = 16

const borderRange = (ws, r1, c1, r2, c2) => {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = thin
    }
}

const borderTableRow = (ws, row) => borderRange(ws, row, TABLE_FROM, TABLE_TO)

/** Viền liền cả khối bảng (header → tổng) — sửa ô bị mất khi in */
const sealTableBorders = (ws, fromRow, toRow) => {
  for (let r = fromRow; r <= toRow; r++)
    for (let c = TABLE_FROM; c <= TABLE_TO; c++)
      ws.getCell(r, c).border = thin
}

/** Cột Ghi chú liền một khối dọc — viền phải không bị đứt */
const sealNoteColumn = (ws, fromRow, toRow) => {
  if (toRow < fromRow) return
  safeMerge(ws, fromRow, 16, toRow, 16)
  const cell = ws.getCell(fromRow, 16)
  cell.value = cell.value || ''
  cell.font = fontBody
  cell.alignment = { vertical: 'top', wrapText: true }
  for (let r = fromRow; r <= toRow; r++) ws.getCell(r, 16).border = thin
}

const styleItemRow = (ws, row) => {
  safeMerge(ws, row, 5, row, 9)
  safeMerge(ws, row, 10, row, 11)
  safeMerge(ws, row, 12, row, 13)
  safeMerge(ws, row, 14, row, 15)
  for (let c = TABLE_FROM; c <= TABLE_TO; c++) {
    const cell = ws.getCell(row, c)
    cell.font = fontBody
    cell.alignment = { vertical: 'middle', wrapText: true }
  }
  ws.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  ws.getCell(row, 10).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  ws.getCell(row, 12).numFmt = '#,##0'
  ws.getCell(row, 12).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(row, 14).numFmt = '#,##0'
  ws.getCell(row, 14).alignment = { horizontal: 'right', vertical: 'middle' }
  borderTableRow(ws, row)
}

const styleTotalRow = (ws, row, label) => {
  safeMerge(ws, row, 5, row, 13)
  safeMerge(ws, row, 14, row, 15)
  for (let c = TABLE_FROM; c <= TABLE_TO; c++) {
    ws.getCell(row, c).font = fontBold
    ws.getCell(row, c).alignment = { vertical: 'middle' }
  }
  const labelCell = ws.getCell(row, 5)
  labelCell.value = label
  labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
  const moneyCell = ws.getCell(row, 14)
  moneyCell.numFmt = '#,##0'
  moneyCell.alignment = { horizontal: 'right', vertical: 'middle' }
  borderTableRow(ws, row)
}

const TABLE_HEADER_ROW = 23

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

/** Xóa footer mẫu cũ (tránh trùng Ghi chú / Phòng kinh doanh) */
const clearFooterArea = (ws, fromRow = 30, toRow = 45) => {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = 4; c <= 16; c++) {
      const cell = ws.getCell(r, c)
      cell.value = null
      cell.border = {}
    }
  }
}

/** Khổ A4 — vùng in vừa trang, không scale méo bảng */
const applyPrintSetup = (ws, lastRow) => {
  const endRow = Math.max(lastRow + 2, 37)
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.55,
      right: 0.55,
      top: 0.55,
      bottom: 0.55,
      header: 0.2,
      footer: 0.2,
    },
    printArea: `B4:P${endRow}`,
  }
  for (let c = 17; c <= 26; c++) {
    const col = ws.getColumn(c)
    if (col) col.hidden = true
  }
}

/** Xuất báo giá Excel theo mẫu T&T (ExcelJS — giữ viền, font, merge) */
export const exportQuoteExcel = async ({
  customerName = '',
  customerAddress = '',
  contactPerson = '',
  contactPhone = '',
  pumpType = '',
  quoteNumber = '',
  quoteDate = new Date(),
  validUntil = null,
  quoterName = '',
  quoterPhone = '',
  note = '',
  items = [],
  sellTotal = 0,
  vatAmount = 0,
  shipping = 0,
  grandTotal = 0,
  includeVat = false,
  filename,
}) => {
  const resp = await fetch(TEMPLATE_URL)
  if (!resp.ok) throw new Error('Không tải được file mẫu báo giá')
  const buf = await resp.arrayBuffer()

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.getWorksheet('Invoice') || wb.worksheets[0]

  const valid = validUntil || new Date(quoteDate.getTime() + 7 * 86400000)
  const qNum =
    quoteNumber ||
    `BG-${quoteDate.toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`

  ws.getCell(15, 4).value = `Tên đơn vị nhận hàng: ${customerName}`
  setMetaRight(ws, 15, `Số báo giá: ${qNum}`)
  ws.getCell(16, 4).value = `Địa chỉ: ${customerAddress}`
  setMetaRight(ws, 16, `Ngày báo giá: ${fmtDate(quoteDate)}`)
  ws.getCell(17, 4).value = `Người liên hệ: ${contactPerson}`
  setMetaRight(ws, 17, `Hiệu lực đến: ${fmtDate(valid)}`)
  ws.getCell(18, 4).value = `Điện thoại:${contactPhone ? ' ' + contactPhone : ''}`
  setMetaRight(ws, 18, `Người báo giá : ${quoterName}`)
  ws.getCell(19, 4).value = `Loại bơm: ${pumpType}`
  setMetaRight(ws, 19, `Số điện thoại: ${quoterPhone}`)

  const ITEM_START = 25
  let r = ITEM_START
  const itemStart = r
  items.forEach((item, i) => {
    styleItemRow(ws, r)
    const sell = Number(item.sellPrice) || 0
    const qty = Number(item.qty) || 1
    ws.getCell(r, 4).value = i + 1
    ws.getCell(r, 5).value = item.name || ''
    ws.getCell(r, 10).value = qty
    ws.getCell(r, 12).value = sell
    ws.getCell(r, 14).value = sell * qty
    ws.getRow(r).height = Math.min(52, Math.max(22, Math.ceil(String(item.name || '').length / 50) * 14 + 8))
    r++
  })

  styleTotalRow(ws, r, 'TỔNG CỘNG')
  ws.getCell(r, 4).value = ''
  ws.getCell(r, 14).value = sellTotal
  r++

  if (includeVat) {
    styleTotalRow(ws, r, 'Thuế VAT 8%')
    ws.getCell(r, 4).value = ''
    ws.getCell(r, 14).value = vatAmount
    r++
  }

  if (shipping > 0) {
    styleTotalRow(ws, r, 'Phí vận chuyển')
    ws.getCell(r, 4).value = ''
    ws.getCell(r, 14).value = shipping
    r++
  }

  styleTotalRow(ws, r, 'Tổng thanh toán')
  ws.getCell(r, 4).value = ''
  ws.getCell(r, 14).value = grandTotal
  const tableEnd = r

  sealTableBorders(ws, TABLE_HEADER_ROW, tableEnd)
  if (items.length) sealNoteColumn(ws, itemStart, tableEnd)
  r += 2

  clearFooterArea(ws, 30, 50)

  ws.getCell(r, 4).value = note ? `Ghi chú: ${note}` : 'Ghi chú:'
  ws.getCell(r, 4).font = fontBody
  safeMerge(ws, r, 4, r, 11)
  ws.getCell(r, 4).alignment = { wrapText: false, vertical: 'top', horizontal: 'left' }
  safeMerge(ws, r, 13, r, 16)
  ws.getCell(r, 13).value = 'Phòng kinh doanh'
  ws.getCell(r, 13).font = fontBold
  ws.getCell(r, 13).alignment = { horizontal: 'center', vertical: 'middle' }
  r++
  ws.getCell(r, 4).value = 'Thông tin thanh toán'
  ws.getCell(r, 4).font = fontBold
  r++
  ws.getCell(r, 4).value = 'Ngân hàng: MB Bank - Ngân hàng quân đội'
  ws.getCell(r, 4).font = fontBody
  r++
  ws.getCell(r, 4).value = 'Chủ tài khoản: CÔNG TY TNHH THƯƠNG MẠI MÁY CÔNG NGHIỆP T&T'
  ws.getCell(r, 4).font = fontBody
  r++
  ws.getCell(r, 4).value = 'Số Tài khoản: 8600 8886 88888'
  ws.getCell(r, 4).font = fontBody
  r += 2
  ws.getCell(r, 4).value = 'Hàng mới 100%'
  ws.getCell(r, 4).font = fontBody
  r++
  ws.getCell(r, 4).value = 'Bảo Hành 12 tháng'
  ws.getCell(r, 4).font = fontBody

  applyPrintSetup(ws, r)

  const outName =
    filename ||
    `bao-gia-${(customerName || 'khach').replace(/\s+/g, '-').slice(0, 30)}-${quoteDate.toISOString().slice(0, 10)}.xlsx`

  const outBuf = await wb.xlsx.writeBuffer()
  downloadBuffer(outBuf, outName)
}

export const fmtNum = (n) => (n != null && !isNaN(n) ? Number(n).toLocaleString('en-US') : '')
