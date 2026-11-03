/**
 * Chuyển đổi chuỗi tiếng Việt thành slug thân thiện với URL (URL-friendly slug)
 * Ví dụ: 'CDLF85-50-380V-37kW' -> 'cdlf85-50-380v-37kw'
 *        'Bơm hỏa tiễn' -> 'bom-hoa-tien'
 */
export function toSlug(str) {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
