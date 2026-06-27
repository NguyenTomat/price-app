import { useState } from 'react'
import ImageGallery from './ImageGallery'
import { useAuth } from '../hooks/useAuth'

// ✅ Fixed: parse đúng mọi kiểu đầu vào
const fmt = (n) => {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : Number(n)
  if (n == null || n === '' || isNaN(num)) return '—'
  return num.toLocaleString('vi-VN') + ' ₫'
}

export default function ProductModal({ product, onClose, onSave, readOnly = false }) {
  const { isAdmin } = useAuth()
  const canEditInfo = isAdmin && !readOnly
  const canEditImages = !readOnly

  const [tab, setTab] = useState(canEditImages && !canEditInfo ? 'images' : 'info')
  const [name,   setName]   = useState(product.name  || '')
  const [group,  setGroup]  = useState(product.group || '')
  const [spec1,  setSpec1]  = useState(product.spec1 || '')
  const [spec2,  setSpec2]  = useState(product.spec2 || '')
  const [price,  setPrice]  = useState(product.price != null ? String(product.price) : '')
  const [images, setImages] = useState(product.images || [])

  const [disc,   setDisc]   = useState('0')
  const [margin, setMargin] = useState('0')
  const [vat,    setVat]    = useState('0')

  const basePrice   = parseFloat(price) || 0
  const afterDisc   = basePrice * (1 - (parseFloat(disc)   || 0) / 100)
  const afterMargin = afterDisc * (1 + (parseFloat(margin) || 0) / 100)
  const vatAmt      = parseFloat(vat) ? afterMargin * 0.08 : 0
  const finalPrice  = afterMargin + vatAmt

  const handleSave = () => {
    if (canEditInfo) {
      if (!name.trim()) return
      onSave({
        ...product,
        name:   name.trim(),
        group:  group.trim(),
        spec1:  spec1.trim(),
        spec2:  spec2.trim(),
        price:  price !== '' && !isNaN(parseFloat(price)) ? parseFloat(price) : null,
        images,
      })
      return
    }
    if (canEditImages) {
      onSave({ ...product, images })
    }
  }

  const displayPrice = price !== '' && !isNaN(parseFloat(price)) ? parseFloat(price) : product.price

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontFamily: 'var(--mono)', fontSize: 13.5, letterSpacing: '.02em' }}>
              {product.name || 'Sản phẩm mới'}
            </h2>
            {product.group && <div className="text-sm text-muted" style={{ marginTop: 2 }}>{product.group}</div>}
          </div>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="tabs">
            {['info', 'calc', 'images'].map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'info' ? '📋 Thông tin' : t === 'calc' ? '🧮 Tính giá' : '🖼 Hình ảnh'}
              </button>
            ))}
          </div>

          {/* Tab: Info */}
          {tab === 'info' && (
            <div>
              {canEditInfo ? (
                <>
                  <div className="field">
                    <label className="field-label">Tên / Mã sản phẩm *</label>
                    <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="VD: FCM-100F/T-0.75KW"/>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label className="field-label">Nhóm hàng</label>
                      <input className="input" value={group} onChange={e => setGroup(e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="field-label">Công suất (kW)</label>
                      <input className="input" value={spec1} onChange={e => setSpec1(e.target.value)} placeholder="0.55"/>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Lưu lượng / Thông số kỹ thuật</label>
                    <input className="input" value={spec2} onChange={e => setSpec2(e.target.value)} placeholder="Hmax 11.5 - Qmax 17m3/h"/>
                  </div>
                  <div className="field">
                    <label className="field-label">Đơn giá gốc (VNĐ, chưa VAT)</label>
                    <input className="input" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" min="0"/>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Tên / Mã hàng', product.name],
                    ['Nhóm', product.group],
                    ['Công suất', product.spec1 ? product.spec1 + ' kW' : '—'],
                    ['Thông số', product.spec2 || '—'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{val || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Giá gốc (chưa VAT)', fmt(displayPrice)],
                  ['Giá gốc + VAT 8%', displayPrice != null ? fmt(Math.round(Number(displayPrice) * 1.08)) : '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--accent-s)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Calc */}
          {tab === 'calc' && (
            <div>
              <p className="text-muted text-sm mb-2">
                Tính giá bán từ giá gốc {fmt(displayPrice)}:
              </p>
              <div className="calc-box" style={{ marginBottom: 12 }}>
                <div className="calc-row">
                  <label>% Chiết khấu từ gốc</label>
                  <input className="input" type="number" value={disc} min="0" max="99" step="0.5"
                    onChange={e => setDisc(e.target.value)} style={{ maxWidth: 90 }}/>
                  <span className="text-muted">%</span>
                </div>
                <div className="calc-row">
                  <label>% Lợi nhuận cộng vào</label>
                  <input className="input" type="number" value={margin} min="0" step="0.5"
                    onChange={e => setMargin(e.target.value)} style={{ maxWidth: 90 }}/>
                  <span className="text-muted">%</span>
                </div>
                <div className="calc-row">
                  <label>Bao gồm VAT 8%</label>
                  <select className="input select" value={vat} onChange={e => setVat(e.target.value)} style={{ maxWidth: 160 }}>
                    <option value="0">Không tính VAT</option>
                    <option value="8">Có VAT 8%</option>
                  </select>
                </div>
              </div>
              <div className="calc-result">
                {[
                  ['Giá gốc',                   fmt(displayPrice)],
                  [`Sau chiết khấu ${disc}%`,   fmt(Math.round(afterDisc))],
                  [`Sau lợi nhuận +${margin}%`, fmt(Math.round(afterMargin))],
                  ['VAT 8%', parseFloat(vat) ? fmt(Math.round(vatAmt)) : 'Không tính'],
                  ['Giá bán ra',                fmt(Math.round(finalPrice))],
                ].map(([label, val], i) => (
                  <div key={label} className="cr-row">
                    <span className="cr-label">{label}</span>
                    <span>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Images */}
          {tab === 'images' && (
            <>
              {canEditImages && !canEditInfo && (
                <p className="text-muted text-sm" style={{ marginBottom: 10 }}>
                  Bạn có thể thêm/sửa ảnh sản phẩm. Bấm <strong>Lưu ảnh</strong> khi xong.
                </p>
              )}
            <ImageGallery
              images={images}
              onChange={canEditImages ? setImages : undefined}
              readOnly={!canEditImages}
            />
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Đóng</button>
          {canEditInfo && <button className="btn primary" onClick={handleSave}>💾 Lưu</button>}
          {!canEditInfo && canEditImages && (
            <button className="btn primary" onClick={handleSave}>💾 Lưu ảnh</button>
          )}
        </div>
      </div>
    </div>
  )
}
