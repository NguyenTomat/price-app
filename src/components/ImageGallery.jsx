import { useState, useRef } from 'react'
import { useToast } from './Toast'
import ModalPortal from './ModalPortal'

export default function ImageGallery({ images = [], onChange, readOnly = false }) {
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()
  const toast = useToast()

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
    else if (lightbox != null && lightbox > idx) setLightbox(lightbox - 1)
  }

  const handleCopy = async (src) => {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      toast('Đã copy ảnh vào clipboard', 'success')
    } catch {
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

  const closeLightbox = () => setLightbox(null)

  return (
    <div>
      <div className="img-gallery-toolbar">
        <span style={{ fontSize: 13, fontWeight: 500 }}>Hình ảnh ({images.length})</span>
        {!readOnly && (
          <div className="img-gallery-actions">
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

      {lightbox !== null && (
        <ModalPortal lockScroll>
          <div
            className="overlay img-lightbox-overlay"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={`Xem ảnh ${lightbox + 1}`}
          >
            <button
              type="button"
              className="img-lightbox-close"
              onClick={closeLightbox}
              aria-label="Đóng"
            >
              ✕
            </button>

            {lightbox > 0 && (
              <button
                type="button"
                className="img-lightbox-nav img-lightbox-nav-prev"
                onClick={e => { e.stopPropagation(); setLightbox(l => l - 1) }}
                aria-label="Ảnh trước"
              >
                ‹
              </button>
            )}
            {lightbox < images.length - 1 && (
              <button
                type="button"
                className="img-lightbox-nav img-lightbox-nav-next"
                onClick={e => { e.stopPropagation(); setLightbox(l => l + 1) }}
                aria-label="Ảnh sau"
              >
                ›
              </button>
            )}

            <div className="img-lightbox-inner" onClick={e => e.stopPropagation()}>
              <div className="img-lightbox-stage">
                <img
                  src={images[lightbox]}
                  alt={`Ảnh ${lightbox + 1}`}
                  className="img-lightbox-img"
                />
              </div>
              <div className="img-lightbox-bar">
                <div className="img-lightbox-actions">
                  <button type="button" className="btn sm" onClick={() => handleCopy(images[lightbox])}>
                    📋 Copy
                  </button>
                  {!readOnly && (
                    <button type="button" className="btn sm danger" onClick={() => handleRemove(lightbox)}>
                      🗑 Xóa
                    </button>
                  )}
                  <button type="button" className="btn sm primary" onClick={closeLightbox}>
                    Đóng
                  </button>
                </div>
                <div className="img-lightbox-counter">
                  {lightbox + 1} / {images.length}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
