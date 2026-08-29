/** Chuyển data URL / URL ảnh → PNG blob (clipboard cần PNG) */
export function srcToPngBlob(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('toBlob'))),
        'image/png'
      )
    }
    img.onerror = () => reject(new Error('load'))
    img.src = src
  })
}

export function srcToDataUrl(src) {
  if (typeof src === 'string' && src.startsWith('data:')) {
    return Promise.resolve(src)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = (err) => reject(new Error('Image failed to load for conversion'))
    img.src = src
  })
}

export async function downloadImage(src, filename = 'san-pham.png') {
  if (typeof window !== 'undefined' && window.electronClipboard?.saveImage) {
    try {
      const dataUrl = await srcToDataUrl(src)
      const res = await window.electronClipboard.saveImage(dataUrl, filename)
      if (res?.ok) return
      if (res?.canceled) throw new Error('canceled')
    } catch (err) {
      console.warn("Electron saveImage failed:", err)
    }
  }
  const blob = await srcToPngBlob(src)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function copyImageToClipboard(src) {
  if (typeof window !== 'undefined' && window.electronClipboard?.copyImage) {
    try {
      const dataUrl = await srcToDataUrl(src)
      const res = await window.electronClipboard.copyImage(dataUrl)
      if (res?.ok) return
    } catch (err) {
      console.warn("Electron copyImage failed:", err)
    }
  }
  if (!navigator.clipboard?.write) throw new Error('no clipboard write')
  const pngBlob = await srcToPngBlob(src)
  const item = { 'image/png': pngBlob }
  try {
    await navigator.clipboard.write([new ClipboardItem(item)])
  } catch {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': Promise.resolve(pngBlob) })
    ])
  }
}

/** Mobile: chia sẻ / lưu khi clipboard không hỗ trợ ảnh */
export async function shareImageFile(src, filename = 'san-pham.png') {
  const blob = await srcToPngBlob(src)
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] })
    return true
  }
  return false
}

export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 768px)').matches
}

export async function copyOrSaveImage(src, filename, toast) {
  try {
    await copyImageToClipboard(src)
    toast('Đã copy ảnh — dán bằng Ctrl+V hoặc giữ ô nhập → Dán', 'success')
    return
  } catch { /* fallback below */ }

  try {
    if (isMobileDevice() && await shareImageFile(src, filename)) {
      toast('Chọn Lưu ảnh hoặc app để dán ảnh', 'success')
      return
    }
  } catch { /* user cancelled share */ }

  try {
    await downloadImage(src, filename)
    toast('Trình duyệt không copy ảnh trực tiếp — đã tải file PNG về máy', 'default')
  } catch {
    toast('Không copy được — thử nút Lưu ảnh', 'error')
  }
}
