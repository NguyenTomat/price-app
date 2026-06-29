/** Trích logo PNG từ file Excel mẫu .xls — chạy: node scripts/extract-company-logo.js [đường-dẫn-file.xls] */
const fs = require('fs')
const path = require('path')

const defaultSrc =
  'c:/Users/Acer/Downloads/BẢNG BÁO GIÁ MÁY CON SÒ THỔI KHÍ ANH QUANG SƯA ĐÔI .xls'
const src = process.argv[2] || defaultSrc
const out = path.join(__dirname, '..', 'public', 'templates', 'company-logo.png')

if (!fs.existsSync(src)) {
  console.error('Không tìm thấy file:', src)
  process.exit(1)
}

const buf = fs.readFileSync(src)
const pngStart = buf.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
const iendPos = buf.indexOf(iend, pngStart)

if (pngStart < 0 || iendPos < 0) {
  console.error('Không tìm thấy logo PNG trong file')
  process.exit(1)
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, buf.slice(pngStart, iendPos + 12))
console.log('Đã lưu logo:', out)
