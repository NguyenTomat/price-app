/** Tỷ lệ chênh lệch theo bậc — tính trên chênh lệch gốc (giá bán − giá vốn) 1 SP */
export const getChenhTierPct = (rawChenhAmount) => {
  const p = Math.max(0, Number(rawChenhAmount) || 0)
  if (p < 3_000_000) return 0
  if (p < 5_000_000) return 1.5
  if (p < 10_000_000) return 3
  if (p < 15_000_000) return 4
  if (p < 20_000_000) return 6
  return 10
}

export const CHENH_TIER_LABELS = [
  { label: '< 3 triệu → 0%' },
  { label: '3 – 5 triệu → 1.5%' },
  { label: '5 – 10 triệu → 3%' },
  { label: '10 – 15 triệu → 4%' },
  { label: '15 – 20 triệu → 6%' },
  { label: '≥ 20 triệu → 10%' },
]

/**
 * Tính thêm vào chênh do phí vận chuyển không có VAT và >= 600k
 * - shippingHasVat = true  → không thêm gì
 * - shippingHasVat = false, ship < 600k  → không thêm gì
 * - shippingHasVat = false, ship >= 600k → thêm 20% phí VC
 */
export const calcShippingChenhExtra = ({ shipping = 0, shippingHasVat = true } = {}) => {
  const ship = Number(shipping) || 0
  if (shippingHasVat) return 0
  if (ship < 600_000) return 0
  return Math.round(ship * 0.2)
}

/**
 * Tính 1 dòng sản phẩm trong đơn hàng.
 * - rawChenh = giá bán − giá gốc
 * - % bậc áp dụng khi includeVat = true (VAT 8% trên giá bán)
 */
export const calcOrderLine = ({
  sellPrice = 0,
  costPrice = 0,
  qty = 1,
  includeVat = false,
} = {}) => {
  const q = Math.max(1, Number(qty) || 1)
  const unitSell = Number(sellPrice) || 0
  const unitCost = Number(costPrice) || 0

  const sellTotal = Math.round(unitSell * q)
  const costTotal = Math.round(unitCost * q)
  const unitRawChenh = unitSell - unitCost
  const rawChenh = Math.round(unitRawChenh * q)
  const chenhPct = includeVat ? getChenhTierPct(unitRawChenh) : 0
  const chenhApplied = includeVat ? Math.round(unitRawChenh * chenhPct / 100 * q) : 0
  const vatAmount = includeVat ? Math.round(sellTotal * 0.08) : 0

  return {
    sellTotal,
    costTotal,
    unitRawChenh,
    rawChenh,
    chenhPct,
    chenhApplied,
    vatAmount,
    vatPct: includeVat ? 8 : 0,
  }
}
