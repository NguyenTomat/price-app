import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import { docTienBangChu } from '../utils/numberToVietnameseWords'
import headerFullImg from '../assets/quote/header_full.png'
import commitmentsBarImg from '../assets/quote/commitments_bar.png'
import footerWaveImg from '../assets/quote/footer_wave.png'
import qrBoxExactImg from '../assets/quote/qr_box_exact.png'

const fmtVND = (n) => {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : Number(n)
  if (num == null || isNaN(num)) return '0'
  return num.toLocaleString('vi-VN')
}

export default function ZaloQuoteModal({ isOpen, onClose, initialData = {} }) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [items, setItems] = useState([])
  const [discount, setDiscount] = useState(0)
  const [vatMode, setVatMode] = useState('none')
  const [useExactQrBox, setUseExactQrBox] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const cardRef = useRef(null)
  const previewScrollRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    setCustomerName(initialData.customerName || 'Khách hàng')
    setCustomerPhone(initialData.customerPhone || '0912. 345. 678')

    if (initialData.items && initialData.items.length > 0) {
      setItems(
        initialData.items.map((it, idx) => ({
          id: it.id || Date.now() + idx,
          selected: true,
          name: it.name || 'MÁY BƠM NƯỚC T&T',
          model: it.model || it.spec1 || '',
          specs: it.specs || it.spec2 || '',
          qty: it.qty || 1,
          price: it.price || it.sellPrice || 0,
        }))
      )
    } else {
      setItems([
        {
          id: 1,
          selected: true,
          name: 'BƠM TĂNG ÁP BIẾN TẦN Model: MHI-202EA-220V-0.37KW',
          model: '0.37',
          specs: '0.37 Hmax 27m - Qmax 4.0 m3/h',
          qty: 1,
          price: 6000000,
        },
      ])
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const activeItems = items.filter((it) => it.selected)
  const subtotal = activeItems.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const discountNum = Number(discount) || 0
  const afterDiscount = Math.max(0, subtotal - discountNum)

  let vatAmount = 0
  let grandTotal = afterDiscount

  if (vatMode === '8') {
    vatAmount = Math.round(afterDiscount * 0.08)
    grandTotal += vatAmount
  } else if (vatMode === '10') {
    vatAmount = Math.round(afterDiscount * 0.1)
    grandTotal += vatAmount
  }

  const textInWords = docTienBangChu(grandTotal)

  const handleUpdateItem = (id, field, value) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        selected: true,
        name: 'MÁY BƠM NƯỚC T&T',
        model: 'Model mới (220V)',
        specs: 'Hmax: ... • Qmax: ...',
        qty: 1,
        price: 1500000,
      },
    ])
  }

  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      alert('Cần có ít nhất 1 sản phẩm!')
      return
    }
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Chụp ảnh toàn bộ thẻ không bao giờ bị cắt chân
  const generateCanvas = async () => {
    const card = cardRef.current
    if (!card) return null

    // Cuộn vùng xem trước về đỉnh để tránh lệch viewport
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0
      previewScrollRef.current.scrollLeft = 0
    }

    // Đợi 80ms để layout và hình ảnh ổn định
    await new Promise((r) => setTimeout(r, 80))

    const totalHeight = card.offsetHeight || card.scrollHeight
    const totalWidth = 740

    return await html2canvas(card, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: totalWidth,
      height: totalHeight,
      windowWidth: totalWidth,
      windowHeight: totalHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const clonedCard = clonedDoc.getElementById('zalo-quote-card')
        if (clonedCard) {
          clonedCard.style.boxShadow = 'none'
          clonedCard.style.transform = 'none'
          clonedCard.style.position = 'static'
          clonedCard.style.maxHeight = 'none'
          clonedCard.style.overflow = 'visible'
          clonedCard.style.height = `${totalHeight}px`
        }
      },
    })
  }

  const handleCopyImage = async () => {
    setIsExporting(true)
    try {
      const canvas = await generateCanvas()
      if (!canvas) throw new Error('Không tìm thấy thẻ báo giá')

      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          showToast('Đã copy ảnh đầy đủ! Mở Zalo bấm Ctrl + V là gửi được ngay.')
        } catch (clipErr) {
          console.warn('Clipboard write fallback:', clipErr)
          const link = document.createElement('a')
          link.download = `Bao-Gia-Zalo-${Date.now()}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
          showToast('Đã tự động tải file ảnh về máy cho bạn!')
        }
        setIsExporting(false)
      }, 'image/png')
    } catch (err) {
      console.error('Lỗi tạo ảnh:', err)
      alert('Lỗi tạo ảnh: ' + err.message)
      setIsExporting(false)
    }
  }

  const handleDownloadImage = async () => {
    setIsExporting(true)
    try {
      const canvas = await generateCanvas()
      if (!canvas) throw new Error('Không tìm thấy thẻ báo giá')

      const link = document.createElement('a')
      link.download = `Bao-Gia-May-Bom-TT-${Date.now()}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.96)
      link.click()
      showToast('Đã tải ảnh JPG nét cao thành công!')
    } catch (err) {
      console.error('Lỗi tải ảnh:', err)
      alert('Lỗi tải ảnh: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
      }}
    >
      {/* Top Header Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: '#fff',
              fontSize: 16,
              boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
            }}
          >
            T&T
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              Xuất Báo Giá Zalo (3 Giây)
              <span style={{ fontSize: 11, background: '#10b98120', color: '#34d399', border: '1px solid #10b98140', padding: '2px 8px', borderRadius: 999 }}>
                Đầy đủ chân trang
              </span>
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
              Đúng mẫu thiết kế • Chuẩn tỷ lệ mobile • Không bị cắt góc • Kèm QR MB Bank Napas 247
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleCopyImage}
            disabled={isExporting}
            style={{
              background: '#059669',
              color: '#fff',
              border: 'none',
              padding: '9px 20px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
            }}
          >
            {isExporting ? '⏳ Đang kết xuất...' : '📋 Copy ảnh (Gửi Zalo)'}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '9px 16px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            📥 Tải ảnh JPG
          </button>

          <button
            onClick={onClose}
            style={{
              background: '#334155',
              color: '#f8fafc',
              border: 'none',
              padding: '9px 16px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ✕ Đóng
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 440px) 1fr',
          overflow: 'hidden',
          gap: 16,
          padding: 16,
        }}
      >
        {/* LEFT: Quick Editor Form */}
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: 16,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            fontSize: 12,
          }}
        >
          {/* Customer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              1. Khách hàng nhận báo giá
            </span>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>Tên khách hàng:</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: '100%', background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>Điện thoại / Zalo:</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ width: '100%', background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Items */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                2. Danh sách máy bơm ({activeItems.length}/{items.length} món)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                style={{ background: '#064e3b', color: '#34d399', border: '1px solid #059669', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                + Thêm máy
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  style={{
                    background: it.selected ? '#020617' : '#090e1a',
                    border: it.selected ? '1px solid #1e293b' : '1px dashed #334155',
                    borderRadius: 10,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    opacity: it.selected ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700, color: '#38bdf8', fontSize: 11 }}>
                      <input
                        type="checkbox"
                        checked={it.selected}
                        onChange={(e) => handleUpdateItem(it.id, 'selected', e.target.checked)}
                      />
                      <span>#{idx + 1}. Sản phẩm</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: 12 }}
                      title="Xóa máy này"
                    >
                      🗑️
                    </button>
                  </div>

                  <input
                    type="text"
                    value={it.name}
                    placeholder="Tên máy bơm & Model"
                    onChange={(e) => handleUpdateItem(it.id, 'name', e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', color: '#fff', fontSize: 11, boxSizing: 'border-box', fontWeight: 600 }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input
                      type="text"
                      value={it.model}
                      placeholder="Công suất (kW/HP)"
                      onChange={(e) => handleUpdateItem(it.id, 'model', e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', color: '#cbd5e1', fontSize: 11 }}
                    />
                    <input
                      type="text"
                      value={it.specs}
                      placeholder="Hmax - Qmax"
                      onChange={(e) => handleUpdateItem(it.id, 'specs', e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', color: '#cbd5e1', fontSize: 11 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>SL</span>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => handleUpdateItem(it.id, 'qty', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 6px', color: '#fff', fontSize: 11, boxSizing: 'border-box', textAlign: 'center' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>Đơn giá (VNĐ)</span>
                      <input
                        type="number"
                        step="10000"
                        value={it.price}
                        onChange={(e) => handleUpdateItem(it.id, 'price', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 11, boxSizing: 'border-box', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & VAT */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              3. Chiết khấu & Thuế VAT
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>Chiết khấu thêm (VNĐ):</label>
                <input
                  type="number"
                  step="50000"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  style={{ width: '100%', background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>Thuế VAT:</label>
                <select
                  value={vatMode}
                  onChange={(e) => setVatMode(e.target.value)}
                  style={{ width: '100%', background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                >
                  <option value="none">Không tính VAT</option>
                  <option value="8">Thêm VAT 8%</option>
                  <option value="10">Thêm VAT 10%</option>
                  <option value="included">Giá đã gồm VAT</option>
                </select>
              </div>
            </div>
          </div>

          {/* QR Option */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              4. Khung mã QR MB Bank
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
              <input
                type="checkbox"
                checked={useExactQrBox}
                onChange={(e) => setUseExactQrBox(e.target.checked)}
              />
              <span>Dùng khung chuẩn ảnh mẫu (MB Bank - 860088688888)</span>
            </label>
          </div>
        </div>

        {/* RIGHT: LIVE CAPTURE CARD (Matching User's Photo EXACTLY) */}
        <div
          ref={previewScrollRef}
          style={{
            background: '#020617',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* THE CAPTURE CARD */}
          <div
            ref={cardRef}
            id="zalo-quote-card"
            style={{
              width: 740,
              background: '#ffffff',
              color: '#0f172a',
              boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
            }}
          >
            {/* 1. TOP HEADER IMAGE (Includes logo, 4 pumps, ribbon, company details, water splash divider) */}
            <div style={{ width: '100%', flexShrink: 0 }}>
              <img src={headerFullImg} alt="MÁY BƠM NƯỚC T&T" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>

            {/* 2. CUSTOMER INFO STRIPE */}
            <div
              style={{
                margin: '10px 24px 14px 24px',
                background: '#f0f7ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '8px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                color: '#1e293b',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>👤</span>
                <span>
                  Kính gửi khách hàng: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{customerName}</strong>
                </span>
              </div>

              <div style={{ color: '#94a3b8', fontSize: 14 }}>|</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>📞</span>
                <span>
                  Điện thoại / Zalo: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{customerPhone}</strong>
                </span>
              </div>
            </div>

            {/* 3. TITLE CAPSULE "BÁO GIÁ SẢN PHẨM" */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, flexShrink: 0 }}>
              <div
                style={{
                  background: '#0d3b66',
                  color: '#ffffff',
                  padding: '7px 44px',
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 19,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  boxShadow: '0 3px 8px rgba(13, 59, 102, 0.35)',
                }}
              >
                BÁO GIÁ SẢN PHẨM
              </div>
            </div>

            {/* 4. PRODUCTS TABLE (Matching User Screenshot: Clean modern light header) */}
            <div style={{ padding: '0 24px 10px 24px', flexShrink: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 8px', border: '1px solid #e2e8f0', width: 50, textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '10px 14px', border: '1px solid #e2e8f0', textAlign: 'center' }}>SẢN PHẨM &amp; THÔNG SỐ</th>
                    <th style={{ padding: '10px 8px', border: '1px solid #e2e8f0', width: 55, textAlign: 'center' }}>SL</th>
                    <th style={{ padding: '10px 12px', border: '1px solid #e2e8f0', width: 125, textAlign: 'center' }}>ĐƠN GIÁ</th>
                    <th style={{ padding: '10px 12px', border: '1px solid #e2e8f0', width: 135, textAlign: 'center' }}>THÀNH TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((p, idx) => {
                    const rowTotal = (Number(p.qty) || 0) * (Number(p.price) || 0)
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #cbd5e1', background: '#ffffff' }}>
                        <td style={{ padding: '11px 8px', textAlign: 'center', fontWeight: 800, color: '#0f172a', borderRight: '1px solid #cbd5e1', fontSize: 14 }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px', borderRight: '1px solid #cbd5e1' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, lineHeight: 1.35 }}>
                            {p.name}
                          </div>
                          {p.model && (
                            <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, marginTop: 2 }}>
                              {p.model}
                            </div>
                          )}
                          {p.specs && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                              {p.specs}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '11px 8px', textAlign: 'center', fontWeight: 800, color: '#0f172a', borderRight: '1px solid #cbd5e1', fontSize: 14 }}>
                          {p.qty}
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'center', fontWeight: 600, color: '#0f172a', borderRight: '1px solid #cbd5e1', fontSize: 13 }}>
                          {fmtVND(p.price)}
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                          đ {fmtVND(rowTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 5. PAYMENT & TOTAL SECTION */}
            <div style={{ padding: '6px 24px 14px 24px', flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 16, alignItems: 'center' }}>
                {/* Left: QR Box */}
                {useExactQrBox ? (
                  <div style={{ width: '100%', overflow: 'hidden' }}>
                    <img src={qrBoxExactImg} alt="Mã VietQR MB Bank" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10 }} />
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 12,
                      padding: '8px 12px',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ background: '#fff', padding: 2, borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }}>
                      <img
                        src={`https://api.vietqr.io/image/970422-860088688888-compact.jpg?accountName=CT%20TNHH%20TMAI%20MAY%20CONG%20NGHIEP%20T%26T&amount=${grandTotal}&addInfo=BAO%20GIA%20TT`}
                        alt="VietQR"
                        style={{ width: 88, height: 88, objectFit: 'contain', borderRadius: 6, display: 'block' }}
                      />
                    </div>
                    <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3, color: '#1e293b', lineHeight: 1.25 }}>
                      <div style={{ fontWeight: 800, color: '#0d3b66', fontSize: 12 }}>
                        🏛️ MB Bank - 860088688888
                      </div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 10 }}>
                        👤 Chủ TK: CT TNHH TMAI MAY CONG NGHIEP T&T
                      </div>
                      <div style={{ color: '#0284c7', fontWeight: 600, fontSize: 10, paddingTop: 2 }}>
                        ✔️ Quét mã tự động điền tiền &amp; nội dung
                      </div>
                    </div>
                  </div>
                )}

                {/* Right: Total calculation Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      background: '#bae6fd',
                      color: '#0f172a',
                      fontWeight: 800,
                      padding: '7px 14px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <span>TỔNG TIỀN HÀNG:</span>
                    <span style={{ fontWeight: 900, fontSize: 14 }}>{fmtVND(subtotal)} đ</span>
                  </div>

                  <div
                    style={{
                      background: '#0d3b66',
                      color: '#ffffff',
                      fontWeight: 900,
                      padding: '8px 14px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 14,
                    }}
                  >
                    <span>TỔNG CỘNG:</span>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#ffffff' }}>{fmtVND(grandTotal)} đ</span>
                  </div>

                  <div style={{ fontSize: 11, color: '#334155', fontStyle: 'italic', textAlign: 'right', lineHeight: 1.25 }}>
                    Bằng chữ: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{textInWords}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. COMMITMENTS BAR IMAGE (Bảo hành 12 tháng, Giao hàng, CO/CQ, Hỗ trợ xe) */}
            <div style={{ width: '100%', flexShrink: 0, margin: 0, padding: 0 }}>
              <img src={commitmentsBarImg} alt="4 Cam kết" style={{ width: '100%', height: 'auto', display: 'block', margin: 0 }} />
            </div>

            {/* 7. WATER SPLASH & FOOTER WAVE (Address & Cảm ơn quý khách) */}
            <div style={{ width: '100%', flexShrink: 0, margin: 0, padding: 0 }}>
              <img src={footerWaveImg} alt="Footer Địa chỉ T&T" style={{ width: '100%', height: 'auto', display: 'block', margin: 0 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#0f172a',
            color: '#fff',
            border: '1px solid #334155',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 10000,
          }}
        >
          <span style={{ color: '#34d399', fontSize: 16 }}>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}
