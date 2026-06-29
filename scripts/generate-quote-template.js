/** Tạo file mẫu báo giá T&T (logo, viền, khổ A4) — chạy: node scripts/generate-quote-template.js */
const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')

const thin = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

const fontBody = { name: 'Times New Roman', size: 11 }
const fontBold = { name: 'Times New Roman', size: 11, bold: true }
const fontCompany = { name: 'Times New Roman', size: 12, bold: true }
const fontTitle = { name: 'Times New Roman', size: 20, bold: true }

const A4_PAGE = {
  paperSize: 9,
  orientation: 'portrait',
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  horizontalCentered: true,
  margins: {
    left: 0.47,
    right: 0.47,
    top: 0.47,
    bottom: 0.47,
    header: 0.2,
    footer: 0.2,
  },
  printArea: 'B5:P45',
}

const borderAll = (cell, b = thin) => {
  cell.border = b
}
const borderRange = (ws, r1, c1, r2, c2) => {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) borderAll(ws.getCell(r, c))
}
const fillRow = (ws, row, fromCol, toCol, fn) => {
  for (let c = fromCol; c <= toCol; c++) fn(ws.getCell(row, c), c)
}

async function main() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Invoice', {
    views: [{ showGridLines: false }],
    pageSetup: { ...A4_PAGE },
  })

  ws.columns = [
    { width: 2 },
    { width: 5 },
    { width: 5 },
    { width: 5 },
    { width: 6 },
    { width: 24 },
    { width: 5 },
    { width: 5 },
    { width: 5 },
    { width: 7 },
    { width: 5 },
    { width: 12 },
    { width: 4 },
    { width: 14 },
    { width: 8 },
    { width: 14 },
    { width: 10 },
    { width: 2, hidden: true },
    { width: 2, hidden: true },
  ]

  ws.getRow(6).height = 22
  ws.getRow(7).height = 18
  ws.getRow(8).height = 18
  ws.getRow(9).height = 18
  ws.getRow(10).height = 34
  ws.getRow(23).height = 20
  ws.getRow(24).height = 18

  const merge = (r1, c1, r2, c2) => ws.mergeCells(r1, c1, r2, c2)

  // Logo — lệch phải một chút, không đè chữ
  const logoPath = path.join(__dirname, '..', 'public', 'templates', 'company-logo.png')
  if (fs.existsSync(logoPath)) {
    const imageId = wb.addImage({ filename: logoPath, extension: 'png' })
    ws.addImage(imageId, {
      tl: { col: 1.45, row: 4.3 },
      ext: { width: 48, height: 48 },
    })
  }

  merge(6, 5, 6, 12)
  ws.getCell('E6').value = 'CÔNG TY TNHH THƯƠNG MẠI MÁY CÔNG NGHIỆP T&T'
  ws.getCell('E6').font = fontCompany
  ws.getCell('E6').alignment = { horizontal: 'left', vertical: 'middle' }

  merge(7, 5, 7, 12)
  ws.getCell('E7').value = 'No14, LK 27-28, Phường Dương Nội, Q Hà Đông, Hà Nội'
  ws.getCell('E7').font = fontBody
  ws.getCell('E7').alignment = { horizontal: 'left', vertical: 'middle' }

  merge(8, 5, 8, 12)
  ws.getCell('E8').value = 'Tel :                                     Email:'
  ws.getCell('E8').font = fontBody
  ws.getCell('E8').alignment = { horizontal: 'left', vertical: 'middle' }

  ws.getCell('E9').value = 'WEBSITE:'
  ws.getCell('E9').font = fontBody
  ws.getCell('E9').alignment = { horizontal: 'left', vertical: 'middle' }

  merge(10, 4, 10, 16)
  ws.getCell('D10').value = 'BÁO GIÁ'
  ws.getCell('D10').font = fontTitle
  ws.getCell('D10').alignment = { horizontal: 'center', vertical: 'middle' }

  const leftRows = [
    [15, 'Tên đơn vị nhận hàng: '],
    [16, 'Địa chỉ: '],
    [17, 'Người liên hệ: '],
    [18, 'Điện thoại:'],
    [19, 'Loại bơm: '],
  ]
  leftRows.forEach(([row, label]) => {
    merge(row, 4, row, 11)
    const cell = ws.getCell(row, 4)
    cell.value = label
    cell.font = fontBody
    cell.alignment = { vertical: 'middle', wrapText: true }
  })

  const rightRows = [
    [15, 'Số báo giá:'],
    [16, 'Ngày báo giá:'],
    [17, 'Hiệu lực đến:'],
    [18, 'Người báo giá : '],
    [19, 'Số điện thoại: '],
  ]
  rightRows.forEach(([row, label]) => {
    merge(row, 13, row, 16)
    const cell = ws.getCell(row, 13)
    cell.value = label
    cell.font = fontBody
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  })

  merge(21, 4, 21, 16)
  ws.getCell('D21').value =
    'Công ty chúng tôi trân trọng gửi tới quý khách báo giá các sản phẩm và dịch vụ dưới đây với các điều khoản và điều kiện nêu trong nội dung sau:'
  ws.getCell('D21').font = fontBody
  ws.getCell('D21').alignment = { wrapText: true, vertical: 'top' }

  // Header bảng 2 dòng — merge dọc STT/Nội dung/Ghi chú, viền liền khối
  merge(23, 4, 24, 4)
  merge(23, 5, 24, 9)
  merge(23, 10, 23, 11)
  merge(24, 10, 24, 11)
  merge(23, 12, 23, 13)
  merge(24, 12, 24, 13)
  merge(23, 14, 23, 15)
  merge(24, 14, 24, 15)
  merge(23, 16, 24, 16)

  const setHdr = (r, c, v, align = 'center') => {
    const cell = ws.getCell(r, c)
    cell.value = v
    cell.font = fontBold
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true }
  }

  setHdr(23, 4, 'STT')
  setHdr(23, 5, 'Nội dung', 'center')
  setHdr(23, 10, 'Số lượng')
  setHdr(24, 10, '(bộ)')
  setHdr(23, 12, 'Đơn giá')
  setHdr(24, 12, '(VND)')
  setHdr(23, 14, 'Thành tiền')
  setHdr(24, 14, '(VND)')
  setHdr(23, 16, 'Ghi chú')

  borderRange(ws, 23, 4, 24, 16)

  // Phần thân bảng (SP + tổng) export sẽ ghi — không tạo dòng mẫu tránh lệch viền

  const outDir = path.join(__dirname, '..', 'public', 'templates')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'bao-gia-mau.xlsx')
  await wb.xlsx.writeFile(outPath)
  console.log('Written', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
