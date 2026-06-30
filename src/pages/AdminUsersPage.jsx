import { useState, useEffect } from 'react'
import { db, adminCreateUser } from '../firebase/firebase'
import { collection, getDocs, setDoc, doc } from 'firebase/firestore'
import { useToast } from '../components/Toast'
import MobileTableWrap from '../components/MobileTableWrap'

const FIREBASE_ERRORS = {
  'auth/email-already-in-use': 'Email này đã được sử dụng',
  'auth/invalid-email':        'Định dạng email không hợp lệ',
  'auth/weak-password':        'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
  'auth/network-request-failed': 'Lỗi kết nối mạng, thử lại sau',
}

export default function AdminUsersPage() {
  const toast = useToast()
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ name: '', email: '', pass: '', role: 'user' })

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loadUsers = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setUsers(list)
    } catch (e) {
      toast('Lỗi tải danh sách: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async () => {
    const { name, email, pass, role } = form
    if (!name.trim() || !email.trim() || !pass.trim()) {
      toast('Vui lòng điền đầy đủ thông tin', 'error'); return
    }
    if (pass.length < 6) { toast('Mật khẩu tối thiểu 6 ký tự', 'error'); return }
    setSaving(true)
    try {
      await adminCreateUser(email.trim(), pass.trim(), {
        displayName: name.trim(),
        role,
      })
      toast(`✓ Đã tạo tài khoản: ${email}`, 'success')
      setShowAdd(false)
      setForm({ name: '', email: '', pass: '', role: 'user' })
      loadUsers()
    } catch (err) {
      toast(FIREBASE_ERRORS[err.code] || 'Lỗi: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = async (u) => {
    const next = u.role === 'admin' ? 'user' : 'admin'
    try {
      await setDoc(doc(db, 'users', u.id), { role: next }, { merge: true })
      setUsers(us => us.map(x => x.id === u.id ? { ...x, role: next } : x))
      toast(`Đã đổi quyền ${u.displayName || u.email} → ${next}`, 'success')
    } catch (e) {
      toast('Lỗi đổi quyền: ' + e.message, 'error')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header">
        <h2 style={{ flex: 1 }}>Quản lý tài khoản</h2>
        <button className="btn primary" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? '✕ Đóng' : '+ Thêm tài khoản'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Add user form */}
        {showAdd && (
          <div className="card" style={{ marginBottom: 20, maxWidth: 540 }}>
            <h3 style={{ marginBottom: 16 }}>Tạo tài khoản mới</h3>
            <div className="field">
              <label className="field-label">Tên hiển thị *</label>
              <input className="input" value={form.name} autoFocus
                onChange={e => setF('name', e.target.value)} placeholder="Nguyễn Văn A"/>
            </div>
            <div className="field">
              <label className="field-label">Email *</label>
              <input className="input" type="email" value={form.email}
                onChange={e => setF('email', e.target.value)} placeholder="nhanvien@congty.com"/>
            </div>
            <div className="row">
              <div className="field">
                <label className="field-label">Mật khẩu * (≥ 6 ký tự)</label>
                <input className="input" type="password" value={form.pass}
                  onChange={e => setF('pass', e.target.value)} placeholder="••••••••"/>
              </div>
              <div className="field">
                <label className="field-label">Vai trò</label>
                <select className="input select" value={form.role} onChange={e => setF('role', e.target.value)}>
                  <option value="user">👤 Người dùng</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn" onClick={() => setShowAdd(false)}>Hủy</button>
              <button className="btn primary" onClick={handleCreate} disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: 14, height: 14 }}/> Đang tạo...</>
                  : '✓ Tạo tài khoản'}
              </button>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ flex: 1 }}>Danh sách tài khoản</h3>
            <button className="btn sm ghost" onClick={loadUsers} title="Làm mới">↺ Làm mới</button>
            <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 10 }}>{users.length} tài khoản</span>
          </div>

          {loading ? (
            <div className="empty" style={{ padding: '40px 0' }}><span className="spinner"/></div>
          ) : users.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              <div style={{ marginBottom: 6 }}>Chưa có tài khoản nào trong Firestore</div>
              <div className="text-sm text-muted">Kiểm tra collection "users" trong Firebase Console</div>
            </div>
          ) : (
            <MobileTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ cursor: 'default' }}>
                      <td style={{ fontWeight: 500 }}>{u.displayName || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-amber' : 'badge-blue'}`}>
                          {u.role === 'admin' ? '👑 Admin' : '👤 Người dùng'}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn sm" onClick={() => toggleRole(u)}>
                          {u.role === 'admin' ? '↓ Hạ quyền' : '↑ Lên admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MobileTableWrap>
          )}
        </div>

        {/* Firestore Rules reminder */}
        <div className="card" style={{ background: '#fffbea', border: '1px solid #fde68a' }}>
          <h3 style={{ fontSize: 13, marginBottom: 10, color: 'var(--warning)' }}>
            ⚠ Firestore Security Rules (dán vào Firebase Console → Firestore → Rules)
          </h3>
          <pre style={{
            fontSize: 11, lineHeight: 1.65, color: '#78350f', overflowX: 'auto',
            background: 'rgba(0,0,0,0.04)', padding: '10px 12px', borderRadius: 6,
            whiteSpace: 'pre',
          }}>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function productImagesOnlyUpdate() {
      let n = request.resource.data;
      let o = resource.data;
      return n.name == o.name
        && n.group == o.group
        && n.spec1 == o.spec1
        && n.spec2 == o.spec2
        && n.price == o.price
        && n.order == o.order
        && n.phiHocng == o.phiHocng
        && request.resource.data.images is list;
    }

    match /users/{uid} {
      allow read: if request.auth.uid == uid || isAdmin();
      allow write: if isAdmin();
      match /myPriceLists/{id} {
        allow read, write: if request.auth.uid == uid;
      }
    }

    match /priceLists/{listId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
      match /products/{productId} {
        allow read: if request.auth != null;
        allow create, delete: if isAdmin();
        allow update: if isAdmin() || (request.auth != null && productImagesOnlyUpdate());
      }
    }

    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /costPrices/{itemId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /orders/{orderId} {
      allow read: if request.auth != null && (
        resource.data.uid == request.auth.uid || isAdmin()
      );
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && (
        resource.data.uid == request.auth.uid || isAdmin()
      );
    }
  }
}`}</pre>
        </div>
      </div>
    </div>
  )
}
