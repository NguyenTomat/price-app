import * as XLSX from 'xlsx'

/** Shared Excel row parsing for FCM-style price/inventory sheets */

const SKIP_NAME_PATTERNS = [
  /giá trên/i,
  /^#/,
  /tổng cộng/i,
  /^cộng\b/i,
  /^total\b/i,
  /^ghi chú/i,
  /^note\b/i,
  /^stt$/i,
]

export const productKey = (p) =>
  [p.group || '', p.name || '', p.spec1 || '', p.spec2 || '', p.phiHocng || ''].join('\0').toLowerCase()

export const normalizeName = (s) => (s || '').toString().trim().toLowerCase()

/** Firestore doc IDs cannot contain '/' — encode for storage, keep productId as original code */
export const sanitizeFirestoreId = (id) =>
  String(id ?? '').replace(/\//g, '%2F')

const buildInventoryLookup = (existingInventory = []) => {
  const byId = Object.fromEntries(existingInventory.map(i => [i.id, i]))
  const byProductId = Object.fromEntries(
    existingInventory.filter(i => i.productId).map(i => [i.productId, i])
  )
  const findByCode = (code) => {
    if (!code) return null
    return byId[sanitizeFirestoreId(code)] || byProductId[code] || byId[code] || null
  }
  return { byId, byProductId, findByCode }
}

export const slugId = (name, spec1 = '', spec2 = '') => {
  const raw = [name, spec1, spec2].filter(Boolean).join('-')
  const slug = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug.slice(0, 120) || 'sp-' + Date.now()
}

const SKIP_CODE_PATTERNS = [
  /^mã hàng$/i,
  /^ma hang$/i,
  /^tên hàng$/i,
  /^ten hang$/i,
]

const shouldSkipCode = (code) => {
  if (!code) return true
  return SKIP_CODE_PATTERNS.some(re => re.test(code))
}

const shouldSkipName = (name) => {
  if (!name) return true
  return SKIP_NAME_PATTERNS.some(re => re.test(name))
}

const parseNum = (v) => {
  if (v == null || v === '') return NaN
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return isNaN(n) ? NaN : n
}

export const isGroupHeader = (row, { qtyCol = null } = {}) => {
  const name = (row[1] || '').toString().trim()
  const priceRaw = row[4]
  if (!name || shouldSkipName(name)) return false
  const hasPrice = !isNaN(parseNum(priceRaw)) && parseNum(priceRaw) > 0
  if (hasPrice) return false
  if (qtyCol != null) {
    const qtyRaw = row[qtyCol]
    if (qtyRaw != null && qtyRaw !== '' && !isNaN(parseNum(qtyRaw))) return false
  }
  return true
}

/**
 * Parse FCM-style sheet rows into products.
 * Bảng giá: A=STT, B=Tên, C=Công suất (kW), D=Thông số, E=Giá, F=Phi họng
 * Tồn kho FCM: F=Tồn kho (khi includeQty)
 */
export const parseFcmRows = (rows, { includeQty = false } = {}) => {
  let currentGroup = 'Chưa phân nhóm'
  const products = []
  const dupKeys = new Set()
  const duplicates = []
  const qtyCol = includeQty ? 5 : null

  for (const row of rows) {
    if (!row || row.length < 2) continue
    const name = (row[1] || '').toString().trim()
    if (!name || shouldSkipName(name)) continue
    const col0 = (row[0] || '').toString().trim()
    if (col0.toLowerCase() === 'stt') continue

    const price = parseNum(row[4])
    const hasPrice = !isNaN(price) && price > 0
    const qtyRaw = includeQty ? row[5] : null
    const qty = includeQty && qtyRaw != null && qtyRaw !== '' ? parseNum(qtyRaw) : NaN
    const hasQty = includeQty && !isNaN(qty)
    const phiRaw = !includeQty ? row[5] : null
    const phiHocng = phiRaw != null && phiRaw !== '' ? String(phiRaw).trim() : ''

    if (isGroupHeader(row, { qtyCol })) {
      if (name.length > 3) currentGroup = name
      continue
    }

    if (!hasPrice && !hasQty) continue

    const item = {
      name,
      group: currentGroup,
      spec1: row[2] != null ? row[2].toString().trim() : '',
      spec2: (row[3] || '').toString().trim(),
      phiHocng,
      price: hasPrice ? price : null,
      qty: hasQty ? qty : null,
      images: [],
    }

    const key = productKey(item)
    if (dupKeys.has(key)) {
      duplicates.push(name)
      const idx = products.findIndex(p => productKey(p) === key)
      if (idx >= 0) products[idx] = { ...products[idx], ...item, order: products[idx].order }
      continue
    }
    dupKeys.add(key)
    products.push({ ...item, order: products.length })
  }

  return { products, duplicates }
}

/** File tổng hợp tồn kho: STT | Mã hàng | Tên hàng | Lô SX | Tồn kho cuối kỳ */
export const detectTonKhoWarehouseFormat = (rows) => {
  for (const row of (rows || []).slice(0, 40)) {
    if (!row) continue
    for (const cell of row) {
      const s = (cell || '').toString().toLowerCase().replace(/\s+/g, ' ')
      if (s.includes('mã hàng') || s.includes('ma hang') || s.includes('tồn kho')) return true
    }
  }
  return false
}

export const parseTonKhoWarehouseRows = (rows, existingInventory = []) => {
  const { byId, findByCode } = buildInventoryLookup(existingInventory)
  let currentWarehouse = 'Chưa phân kho'
  const items = []
  const duplicates = []
  const seenIds = new Set()

  for (const row of rows) {
    if (!row) continue
    const code = (row[1] || '').toString().trim()
    const name = (row[2] || '').toString().trim()
    const batch = (row[3] || '').toString().trim()
    const qty = parseNum(row[4])

    if (!code || shouldSkipCode(code)) continue
    if (/^cộng$/i.test(code)) continue
    if (code.toLowerCase() === 'stt') continue
    if (/cân đối/i.test(code)) continue
    if (/^tên hàng$/i.test(name)) continue

    if (code === name && /^KHO/i.test(code)) {
      currentWarehouse = code
      continue
    }

    if (!name) continue

    const existing = findByCode(code) || byId[sanitizeFirestoreId(code)]
    const id = existing?.id || sanitizeFirestoreId(code)
    const item = {
      id,
      productId: code,
      productName: name,
      group: currentWarehouse,
      batch: batch || currentWarehouse,
      listName: existing?.listName || '',
      listId: existing?.listId || null,
      unit: existing?.unit || 'cái',
      qty: isNaN(qty) ? (existing?.qty ?? 0) : qty,
      lowStockAlert: existing?.lowStockAlert ?? null,
      price: existing?.price ?? null,
    }

    if (seenIds.has(id)) {
      duplicates.push(code)
      const idx = items.findIndex(x => x.id === id)
      if (idx >= 0) items[idx] = { ...items[idx], qty: item.qty, batch: item.batch }
      continue
    }
    seenIds.add(id)
    items.push(item)
  }

  return { items, duplicates, format: 'tonkho' }
}

/** Detect & parse inventory Excel — tổng hợp kho, export template, or FCM + Tồn kho */
export const parseInventorySheet = (ws, existingInventory = []) => {
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  if (detectTonKhoWarehouseFormat(rawRows)) {
    return parseTonKhoWarehouseRows(rawRows, existingInventory)
  }

  const jsonRows = XLSX.utils.sheet_to_json(ws, { defval: null })
  const first = jsonRows[0] || {}

  if (first['Mã SP'] != null || first['Tên sản phẩm'] != null) {
    return parseInventoryExportRows(jsonRows, existingInventory)
  }

  const { products, duplicates } = parseFcmRows(rawRows, { includeQty: true })
  return mapFcmToInventory(products, existingInventory, duplicates)
}

const parseInventoryExportRows = (rows, existingInventory) => {
  const { byId, findByCode } = buildInventoryLookup(existingInventory)
  const byName = Object.fromEntries(
    existingInventory.map(i => [normalizeName(i.productName), i])
  )
  const items = []
  const duplicates = []
  const seenIds = new Set()

  for (const r of rows) {
    const name = r['Tên sản phẩm'] ? String(r['Tên sản phẩm']).trim() : ''
    const code = r['Mã SP'] ? String(r['Mã SP']).trim() : ''
    if (!name && !code) continue

    const existing = (code && findByCode(code)) || byName[normalizeName(name)] || null
    let id = existing?.id || (code ? sanitizeFirestoreId(code) : slugId(name))

    if (seenIds.has(id)) {
      duplicates.push(name || code)
      const idx = items.findIndex(x => x.id === id)
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          qty: r['Tồn kho'] != null ? parseFloat(r['Tồn kho']) || 0 : items[idx].qty,
          price: r['Đơn giá'] != null ? parseFloat(r['Đơn giá']) || null : items[idx].price,
        }
      }
      continue
    }
    seenIds.add(id)

    items.push({
      id,
      productId: code || existing?.productId || id,
      productName: name || existing?.productName || byId[id]?.productName || '',
      group: r['Nhóm'] ? String(r['Nhóm']).trim() : (byId[id]?.group || ''),
      listName: r['Bảng giá'] ? String(r['Bảng giá']).trim() : (byId[id]?.listName || ''),
      unit: r['Đơn vị'] ? String(r['Đơn vị']).trim() : (byId[id]?.unit || 'cái'),
      qty: r['Tồn kho'] != null ? parseFloat(r['Tồn kho']) || 0 : (byId[id]?.qty ?? 0),
      lowStockAlert: r['Cảnh báo thấp'] != null && r['Cảnh báo thấp'] !== ''
        ? parseFloat(r['Cảnh báo thấp']) : (byId[id]?.lowStockAlert ?? null),
      price: r['Đơn giá'] != null ? parseFloat(r['Đơn giá']) || null : (byId[id]?.price ?? null),
    })
  }

  return { items, duplicates, format: 'export' }
}

const mapFcmToInventory = (products, existingInventory, duplicates) => {
  const byName = Object.fromEntries(
    existingInventory.map(i => [normalizeName(i.productName), i])
  )

  const items = products.map(p => {
    const existing = byName[normalizeName(p.name)]
    const id = existing?.id || slugId(p.name, p.spec1, p.spec2)
    return {
      id,
      productId: existing?.productId || id,
      productName: p.name,
      group: p.group,
      listName: existing?.listName || '',
      listId: existing?.listId || null,
      unit: existing?.unit || 'cái',
      qty: p.qty != null ? p.qty : (existing?.qty ?? 0),
      lowStockAlert: existing?.lowStockAlert ?? null,
      price: p.price ?? existing?.price ?? null,
    }
  })

  return { items, duplicates, format: 'fcm' }
}

/** Build FCM-style export rows grouped by nhóm */
export const inventoryToTonKhoRows = (inventory) => {
  const rows = [['STT', 'Mã hàng', 'Tên hàng', 'Lô SX', 'Tồn kho Cuối kỳ']]
  const groups = [...new Set(inventory.map(i => i.group || 'Chưa phân kho'))]
  let stt = 0

  for (const g of groups) {
    const inGroup = inventory.filter(i => (i.group || 'Chưa phân kho') === g)
    if (!inGroup.length) continue
    const total = inGroup.reduce((s, i) => s + (i.qty || 0), 0)
    rows.push(['', g, g, null, total])
    for (const i of inGroup) {
      stt++
      rows.push([stt, i.productId || i.id, i.productName || '', i.batch || g, i.qty ?? 0])
    }
  }
  return rows
}

export const inventoryToFcmRows = (inventory) => {
  const rows = [['STT', 'Tên sản phẩm', 'Công suất (kW)', 'Lưu lượng / Thông số', 'Đơn giá', 'Tồn kho']]
  const groups = [...new Set(inventory.map(i => i.group || 'Chưa phân nhóm'))]
  let stt = 0

  for (const g of groups) {
    const inGroup = inventory.filter(i => (i.group || 'Chưa phân nhóm') === g)
    if (!inGroup.length) continue
    rows.push(['', g, '', '', '', ''])
    for (const i of inGroup) {
      stt++
      rows.push([stt, i.productName || '', '', '', i.price ?? '', i.qty ?? 0])
    }
  }

  return rows
}

export const readWorkbookSheet = (data) => {
  const wb = XLSX.read(data, { type: 'binary', cellFormula: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return { wb, ws }
}

export const parseFcmFromBinary = (data, opts) => {
  const { ws } = readWorkbookSheet(data)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  return parseFcmRows(rows, opts)
}

export const writeAoaWorkbook = (rows, filename, sheetName = 'Tồn kho') => {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

export const writeFcmWorkbook = (rows, filename) => writeAoaWorkbook(rows, filename)

export const writeJsonWorkbook = (rows, filename, sheetName = 'Tồn kho') => {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}
