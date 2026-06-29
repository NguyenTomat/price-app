/** Parse chuỗi tiền (có dấu phẩy/chấm) → số nguyên VND */
export const parseMoney = (v) => {
  if (v == null || v === '') return 0
  const digits = String(v).replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return isNaN(n) ? 0 : n
}

/** Giữ chỉ chữ số (lưu state) */
export const digitsOnly = (v) => String(v ?? '').replace(/[^\d]/g, '')

/** Hiển thị với dấu phẩy ngàn: 1000000 → 1,000,000 */
export const formatMoneyInput = (v) => {
  const d = digitsOnly(v)
  if (!d) return ''
  return Number(d).toLocaleString('en-US')
}

/** Handler onChange cho input tiền — trả về chuỗi số thuần để lưu state */
export const onMoneyInputChange = (raw) => digitsOnly(raw)
