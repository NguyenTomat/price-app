import { useState, useRef } from 'react'
import { useToast } from './Toast'

export default function ImageGallery({ images = [], onChange, readOnly = false }) {
  const [lightbox, setLightbox] = useState(null) // index of full-screen image
  const fileRef = useRef()
  const toast = useToast()

  // Nén ảnh: thu về tối đa 1200px cạnh dài + JPEG quality 0.72.
  // Mục đích: data URL nhỏ gọn, tránh vượt giới hạn 1MB/document của Firestore
  // (ảnh chụp gốc thường 2-5MB -> lưu thẳng sẽ làm "Lỗi lưu sản phẩm").
  const compressImage = (fileOrBlob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = reject
      reader.onload = (ev) => {
        const img = new Image()
        img.onerror = reject
        img.onload = () => {
          const MAX = 1200
          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
            else { width = Math.round(width * MAX / height); height = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.72))
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(fileOrBlob)
    })

  const handleAdd = async (e) => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (!files.length) return
    try {
      const b64s = await Promise.all(files.map(compressImage))
      onChange([...images, ...b64s])
      toast('Đã thêm ' + b64s.length + ' ảnh', 'success')
    } catch {
      toast('Lỗi xử lý ảnh', 'error')
    }
  }

  const handleRemove = (idx) => {
    const next = images.filter((_, i) => i !== idx)
    onChange(next)
    if (lightbox === idx) setLightbox(null)
  }

  const handleCopy = async (src) => {
    try {
      // Try Clipboard API (works in Electron)
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      toast('Đã copy ảnh vào clipboard', 'success')
    } catch {
      // Fallback: copy URL/dataURL as text
      await navigator.clipboard.writeText(src)
      toast('Đã copy đường dẫn ảnh', 'default')
    }
  }

  const handlePaste = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const b64 = await compressImage(blob)
            onChange([...images, b64])
            toast('Đã paste ảnh từ clipboard', 'success')
            return
          }
        }
      }
      toast('Không có ảnh trong clipboard', 'error')
    } catch {
      toast('Không thể paste ảnh (kiểm tra quyền clipboard)', 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Hình ảnh ({images.length})</span>
        {!readOnly && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn sm" onClick={handlePaste} title="Paste ảnh từ clipboard (Ctrl+V)">
              📋 Paste
            </button>
            <button className="btn sm primary" onClick={() => fileRef.current.click()}>
              + Thêm ảnh
            </button>
            <input
              ref={fileRef} type="file" accept="image/*"
              multiple style={{ display: 'none' }} onChange={handleAdd}
            />
          </div>
        )}
      </div>

      <div className="img-gallery">
        {images.map((src, idx) => (
          <div key={idx} className="img-thumb" onClick={() => setLightbox(idx)}>
            <img src={src} alt={`Ảnh ${idx + 1}`} loading="lazy"/>
            <div className="img-actions">
              <button
                className="btn sm"
                style={{ background: 'rgba(255,255,255,0.9)', color: '#000', padding: '4px 8px', fontSize: 11 }}
                onClick={e => { e.stopPropagation(); handleCopy(src) }}
                title="Copy ảnh"
              >
                📋 Copy
              </button>
              {!readOnly && (
                <button
                  className="btn sm danger"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={e => { e.stopPropagation(); handleRemove(idx) }}
                  title="Xóa"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
        {!readOnly && (
          <div className="img-add" onClick={() => fileRef.current.click()}>
            <span style={{ fontSize: 22 }}>+</span>
            <span>Thêm ảnh</span>
          </div>
        )}
        {images.length === 0 && readOnly && (
          <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Chưa có ảnh</div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="overlay"
          style={{ background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out' }}
          onClick={() => setLightbox(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '85vh' }}
               onClick={e => e.stopPropagation()}>
            <img
              src={images[lightbox]}
              alt={`Ảnh ${lightbox + 1}`}
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
            />
            {/* Nav arrows */}
            {lightbox > 0 && (
              <button className="btn" onClick={() => setLightbox(l => l - 1)}
                style={{ position: 'absolute', left: -50, top: '50%', transform: 'translateY(-50%)',
                         background: 'rgba(255,255,255,0.8)', padding: '8px 12px' }}>
                ‹
              </button>
            )}
            {lightbox < images.length - 1 && (
              <button className="btn" onClick={() => setLightbox(l => l + 1)}
                style={{ position: 'absolute', right: -50, top: '50%', transform: 'translateY(-50%)',
                         background: 'rgba(255,255,255,0.8)', padding: '8px 12px' }}>
                ›
              </button>
            )}
            {/* Actions */}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn sm" onClick={() => handleCopy(images[lightbox])}>
                📋 Copy ảnh
              </button>
              {!readOnly && (
                <button className="btn sm danger" onClick={() => handleRemove(lightbox)}>
                  🗑 Xóa
                </button>
              )}
              <button className="btn sm" onClick={() => setLightbox(null)}>✕ Đóng</button>
            </div>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 }}>
              {lightbox + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
