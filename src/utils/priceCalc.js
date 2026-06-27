/** Shared price calculation: discount → margin → VAT */

export const parsePrice = (base) => {
  const n = typeof base === 'string'
    ? parseFloat(base.replace(/[^\d.]/g, ''))
    : Number(base)
  if (base == null || base === '' || isNaN(n)) return null
  return n
}

export const calcPriceBreakdown = (base, { discPct = 0, marginPct = 0, includeVat = false } = {}) => {
  const n = parsePrice(base)
  if (n == null) return null

  const afterDisc = n * (1 - Math.max(0, discPct) / 100)
  const afterMargin = afterDisc * (1 + Math.max(0, marginPct) / 100)
  const vatAmt = includeVat ? afterMargin * 0.08 : 0
  const sellPrice = Math.round(afterMargin + vatAmt)

  return {
    original: n,
    afterDisc: Math.round(afterDisc),
    afterMargin: Math.round(afterMargin),
    vatAmt: Math.round(vatAmt),
    sellPrice,
  }
}

export const calcPrice = (base, opts) => calcPriceBreakdown(base, opts)?.sellPrice ?? null
