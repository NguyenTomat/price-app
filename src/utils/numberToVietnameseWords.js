// Chuyển đổi số thành chữ tiếng Việt chuẩn (cho hóa đơn, báo giá)
const ChuSo = [' không ', ' một ', ' hai ', ' ba ', ' bốn ', ' năm ', ' sáu ', ' bảy ', ' tám ', ' chín ']
const Tien = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ']

function docSo3ChuSo(baso) {
  let tram = parseInt(baso / 100)
  let chuc = parseInt((baso % 100) / 10)
  let donvi = baso % 10
  let ketqua = ''
  if (tram === 0 && chuc === 0 && donvi === 0) return ''
  if (tram !== 0) {
    ketqua += ChuSo[tram] + ' trăm '
    if (chuc === 0 && donvi !== 0) ketqua += ' linh '
  }
  if (chuc !== 0 && chuc !== 1) {
    ketqua += ChuSo[chuc] + ' mươi'
    if (chuc === 0 && donvi !== 0) ketqua = ketqua + ' linh '
  }
  if (chuc === 1) ketqua += ' mười '
  switch (donvi) {
    case 1:
      if (chuc !== 0 && chuc !== 1) ketqua += ' mốt '
      else ketqua += ChuSo[donvi]
      break
    case 5:
      if (chuc === 0) ketqua += ChuSo[donvi]
      else ketqua += ' lăm '
      break
    default:
      if (donvi !== 0) ketqua += ChuSo[donvi]
      break
  }
  return ketqua
}

export function docTienBangChu(SoTien) {
  const num = typeof SoTien === 'string' ? parseFloat(SoTien.replace(/[^\d.]/g, '')) : Number(SoTien)
  if (!num || isNaN(num) || num === 0) return 'Không đồng'
  if (num < 0) return 'Số tiền âm'

  let lan = 0
  let so = Math.round(num)
  let KetQua = ''
  const ViTri = []

  ViTri[5] = Math.floor(so / 1000000000000000)
  so = so - ViTri[5] * 1000000000000000
  ViTri[4] = Math.floor(so / 1000000000000)
  so = so - ViTri[4] * 1000000000000
  ViTri[3] = Math.floor(so / 1000000000)
  so = so - ViTri[3] * 1000000000
  ViTri[2] = parseInt(so / 1000000)
  ViTri[1] = parseInt((so % 1000000) / 1000)
  ViTri[0] = parseInt(so % 1000)

  if (ViTri[5] > 0) lan = 5
  else if (ViTri[4] > 0) lan = 4
  else if (ViTri[3] > 0) lan = 3
  else if (ViTri[2] > 0) lan = 2
  else if (ViTri[1] > 0) lan = 1
  else lan = 0

  for (let i = lan; i >= 0; i--) {
    const tmp = docSo3ChuSo(ViTri[i])
    KetQua += tmp
    if (ViTri[i] > 0) KetQua += Tien[i]
    if (i > 0 && tmp.length > 0) KetQua += ' '
  }

  KetQua = KetQua.trim().replace(/\s+/g, ' ')
  KetQua = KetQua.substring(0, 1).toUpperCase() + KetQua.substring(1)
  return KetQua + ' đồng'
}
