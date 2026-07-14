import { useState, useEffect, useMemo } from 'react'
import { subscribeBusLines, addBusLine, updateBusLine, deleteBusLine } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'

// Danh sách 63 Tỉnh / Thành phố Việt Nam sắp xếp theo bảng chữ cái để phân loại dễ dàng
const PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
  "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
  "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai",
  "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh", "Hải Dương",
  "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang",
  "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
  "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình",
  "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La",
  "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang",
  "TP. Hồ Chí Minh", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
]

export default function BusPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [busLines, setBusLines] = useState([])
  const [search, setSearch] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    province: 'Hà Nội',
    route: '',
    note: ''
  })

  useEffect(() => {
    const unsub = subscribeBusLines(setBusLines)
    return unsub
  }, [])

  // Mở modal thêm mới
  const handleOpenAdd = () => {
    setEditingItem(null)
    setForm({ name: '', phone: '', province: selectedProvince || 'Hà Nội', route: '', note: '' })
    setShowModal(true)
  }

  // Mở modal chỉnh sửa
  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setForm({
      name: item.name || '',
      phone: item.phone || '',
      province: item.province || 'Hà Nội',
      route: item.route || '',
      note: item.note || ''
    })
    setShowModal(true)
  }

  // Xử lý Lưu thêm / sửa
  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast('Vui lòng nhập tên nhà xe', 'error')
    if (!form.phone.trim()) return toast('Vui lòng nhập số điện thoại', 'error')

    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        province: form.province,
        route: form.route.trim(),
        note: form.note.trim(),
        uid: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'User'
      }

      if (editingItem) {
        await updateBusLine(editingItem.id, data)
        toast('Cập nhật nhà xe thành công', 'success')
      } else {
        await addBusLine(data)
        toast('Thêm nhà xe thành công', 'success')
      }
      setShowModal(false)
    } catch (err) {
      toast('Lỗi: ' + err.message, 'error')
    }
  }

  // Xóa nhà xe
  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa thông tin nhà xe "${item.name}"?`)) return
    try {
      await deleteBusLine(item.id)
      toast('Đã xóa nhà xe', 'success')
    } catch (err) {
      toast('Lỗi xóa nhà xe', 'error')
    }
  }

  // Copy số điện thoại nhanh
  const handleCopyPhone = (phone) => {
    navigator.clipboard.writeText(phone)
    toast('Đã copy số điện thoại!', 'success')
  }

  // Lọc thông tin theo tìm kiếm và tỉnh thành
  const filtered = useMemo(() => {
    return busLines.filter(item => {
      const matchProvince = !selectedProvince || item.province === selectedProvince
      const q = search.toLowerCase().trim()
      const matchSearch = !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        (item.route || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q)
      return matchProvince && matchSearch
    })
  }, [busLines, selectedProvince, search])

  // Đếm số lượng nhà xe của mỗi tỉnh để hiện badge hiển thị số lượng trực quan
  const provinceCounts = useMemo(() => {
    const counts = {}
    busLines.forEach(item => {
      if (item.province) {
        counts[item.province] = (counts[item.province] || 0) + 1
      }
    })
    return counts
  }, [busLines])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ flex: 1 }}>🚌 Danh Bạ Nhà Xe</h2>
        <button className="btn primary" onClick={handleOpenAdd}>
          + Thêm nhà xe
        </button>
      </div>

      {/* Tìm kiếm và Lọc nhanh */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200, margin: 0 }}>
          <span className="search-icon">🔍</span>
          <input
            className="input search-input"
            placeholder="Tìm theo tên nhà xe, số điện thoại, tuyến đường..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input select"
          style={{ width: 220 }}
          value={selectedProvince}
          onChange={e => setSelectedProvince(e.target.value)}
        >
          <option value="">-- Tất cả tỉnh thành --</option>
          {PROVINCES.map(p => (
            <option key={p} value={p}>
              {p} {provinceCounts[p] ? `(${provinceCounts[p]})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Thân trang */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--surface2)' }}>
        {filtered.length === 0 ? (
          <div className="empty" style={{ padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚌</div>
            <h3>Không tìm thấy nhà xe nào</h3>
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>
              Hãy thử thay đổi bộ lọc hoặc thêm mới một nhà xe.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(item => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  position: 'relative',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  borderRadius: 'var(--radius)'
                }}
              >
                {/* Tỉnh thành Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    className="order-status delivered"
                    style={{ fontSize: 11, padding: '2px 8px', fontWeight: 600 }}
                  >
                    📍 {item.province}
                  </span>
                  {/* Quyền sửa xóa: Admin hoặc người tạo */}
                  {(user.uid === item.uid) && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn xs ghost"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => handleOpenEdit(item)}
                        title="Sửa"
                      >✏️</button>
                      <button
                        className="btn xs ghost"
                        style={{ padding: '2px 6px', fontSize: 11, color: 'var(--danger)' }}
                        onClick={() => handleDelete(item)}
                        title="Xóa"
                      >✕</button>
                    </div>
                  )}
                </div>

                {/* Tên nhà xe */}
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {item.name}
                </div>

                {/* SĐT */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface2)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleCopyPhone(item.phone)}
                  title="Click để copy số điện thoại"
                >
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                    📞 {item.phone}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>📋 Copy</span>
                </div>

                {/* Tuyến chạy */}
                {item.route && (
                  <div style={{ fontSize: 12.5, color: 'var(--text)' }}>
                    <strong style={{ color: 'var(--text2)' }}>Tuyến:</strong> {item.route}
                  </div>
                )}

                {/* Ghi chú */}
                {item.note && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4 }}>
                    📝 {item.note}
                  </div>
                )}

                {/* Người đóng góp */}
                <div
                  style={{
                    marginTop: 'auto',
                    borderTop: '1px solid var(--border)',
                    paddingTop: 8,
                    fontSize: 10,
                    color: 'var(--text2)',
                    textAlign: 'right'
                  }}
                >
                  Đóng góp bởi: <strong>{item.userName || 'Ẩn danh'}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa */}
      {showModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <form className="modal" onSubmit={handleSave} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2>{editingItem ? '✏️ Sửa thông tin nhà xe' : '🚌 Thêm nhà xe mới'}</h2>
              <button type="button" className="btn ghost sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              <div className="field">
                <label className="field-label">Tên nhà xe *</label>
                <input
                  className="input"
                  placeholder="Nhập tên nhà xe (Ví dụ: Xe khách Thành Bưởi)"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Số điện thoại liên hệ *</label>
                <input
                  className="input"
                  placeholder="Số điện thoại gọi xe"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Tỉnh / Thành phố đi tỉnh *</label>
                <select
                  className="input select"
                  value={form.province}
                  onChange={e => setForm({ ...form, province: e.target.value })}
                >
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">Tuyến đường chạy</label>
                <input
                  className="input"
                  placeholder="Nhập lộ trình (Ví dụ: Bến xe Miền Đông - Đà Lạt)"
                  value={form.route}
                  onChange={e => setForm({ ...form, route: e.target.value })}
                />
              </div>

              <div className="field">
                <label className="field-label">Ghi chú thêm</label>
                <textarea
                  className="input"
                  style={{ minHeight: 60, resize: 'vertical' }}
                  placeholder="Nhập giờ chạy, địa điểm đón trả khách..."
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                />
              </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn ghost" onClick={() => setShowModal(false)}>Hủy</button>
              <button type="submit" className="btn primary">
                {editingItem ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
