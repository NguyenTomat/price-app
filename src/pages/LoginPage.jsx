import { useState } from 'react'
import { login } from '../firebase/firebase'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return }
    setLoading(true); setError('')
    try {
      await login(email, password)
      // onLogin is triggered via onAuthStateChanged in AuthProvider
    } catch (err) {
      const msgs = {
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
        'auth/user-not-found': 'Tài khoản không tồn tại',
        'auth/too-many-requests': 'Đăng nhập thất bại quá nhiều lần. Thử lại sau.',
        'auth/network-request-failed': 'Lỗi kết nối mạng',
      }
      setError(msgs[err.code] || 'Lỗi đăng nhập: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--accent)',
            borderRadius: 14, margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Bảng Giá T&T</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Hệ thống quản lý bảng giá sản phẩm</p>
        </div>

        <div className="card" style={{ padding: '28px 24px' }}>
          <h2 style={{ marginBottom: 20, fontSize: 16 }}>Đăng nhập</h2>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="email@congty.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Mật khẩu</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div style={{
                background: '#fee2e0', color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)', padding: '9px 12px',
                fontSize: 13, marginBottom: 14,
              }}>
                {error}
              </div>
            )}
            <button
              className="btn primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 14 }}
            >
              {loading ? <span className="spinner" style={{width:16,height:16}}/> : null}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12, marginTop: 16 }}>
          Liên hệ admin để được cấp tài khoản
        </p>
      </div>
    </div>
  )
}
