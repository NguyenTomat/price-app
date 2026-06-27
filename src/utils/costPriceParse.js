import * as XLSX from 'xlsx'
import { sanitizeFirestoreId } from './excelParse'

const SKIP = [
  /^mã hàng$/i, /^tên hàng$/i, /^tên kho/i, /^tổng hợp/i, /^kho:/i,
  /^stt$/i, /^cộng$/i, /^total$/i,
]

const parseNum = (v) => {
  if (v == null || v === '') return NaN
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return isNaN(n) ? NaN : n
}

/** Excel giá vốn: cột B=Mã, C=Tên, D=ĐVT, E=Đơn giá bình quân */
export const parseCostPriceRows = (rows) => {
  const items = []
  const duplicates = []
  const seen = new Set()

  for (const row of rows) {
    if (!row) continue
    const code = (row[1] || '').toString().trim()
    const name = (row[2] || '').toString().trim()
    const unit = (row[3] || '').toString().trim()
    const avgPrice = parseNum(row[4])

    if (!code || SKIP.some(re => re.test(code))) continue
    if (!name) continue
    if (isNaN(avgPrice) || avgPrice <= 0) continue

    const id = sanitizeFirestoreId(code)
    const item = { id, code, name, unit: unit || 'Chiếc', avgPrice }

    if (seen.has(id)) {
      duplicates.push(code)
      const idx = items.findIndex(x => x.id === id)
      if (idx >= 0) items[idx] = item
      continue
    }
    seen.add(id)
    items.push(item)
  }

  return { items, duplicates }
}

export const parseCostPriceFile = (binary) => {
  const wb = XLSX.read(binary, { type: 'binary', cellFormula: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  return parseCostPriceRows(rows)
}
