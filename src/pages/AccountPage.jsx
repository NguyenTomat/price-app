import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../components/Toast'
import UserAvatar from '../components/UserAvatar'
import {
  updateUserProfileData,
  changeUserPassword,
  changeUserEmail,
  subscribeCompanyUsers,
  logout
} from '../firebase/firebase'

// Modern geometric line icons (Clean SaaS minimalist, no emoji AI style)
const Icon = ({ name, size = 16, color = 'currentColor', style = {} }) => {
  const icons = {
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </>
    ),
    mail: (
      <>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </>
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    key: (
      <path d="M21 2l-2 2m-1.5 1.5L14 9l2 2-2 2-2-2-4 4a5.5 5.5 0 1 1-2-2l4-4-2-2 2-2 2 2 3.5-3.5z" />
    ),
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    briefcase: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
    creditCard: (
      <>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ),
    check: (
      <polyline points="20 6 9 17 4 12" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    moon: (
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </>
    ),
    logOut: (
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {icons[name] || icons.user}
    </svg>
  )
}

export default function AccountPage({ setPage }) {
  const { user, profile, isAdmin } = useAuth()
  const { dark, toggle } = useTheme()
  const toast = useToast()

  // Profile fields state
  const [displayName, setDisplayName] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankOwner, setBankOwner] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef(null)

  // Teammates state
  const [companyUsers, setCompanyUsers] = useState([])

  // Change Email state
  const [newEmail, setNewEmail] = useState('')
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('')
  const [showEmailPw, setShowEmailPw] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Active section tab
  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'security' | 'team'

  // Sync profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || user?.displayName || '')
      setPhotoURL(profile.photoURL || user?.photoURL || '')
      setPhone(profile.phone || localStorage.getItem('zalo_seller_hotline') || '')
      setJobTitle(profile.jobTitle || '')
      setBankName(profile.bankName || '')
      setBankAccount(profile.bankAccount || '')
      setBankOwner(profile.bankOwner || '')
    } else if (user) {
      setDisplayName(user.displayName || '')
      setPhotoURL(user.photoURL || '')
      setPhone(localStorage.getItem('zalo_seller_hotline') || '')
    }
  }, [profile, user])

  // Subscribe company users so everybody sees each other
  useEffect(() => {
    const unsub = subscribeCompanyUsers(setCompanyUsers)
    return unsub
  }, [])

  // Process & compress uploaded avatar to square canvas (max 260x260, fast & sharp)
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast('Vui lòng chọn file hình ảnh (JPG, PNG, WEBP)', 'error')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('Kích thước ảnh không được vượt quá 10MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const size = 260
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')

          // Center crop square
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          const compressed = canvas.toDataURL('image/jpeg', 0.82)
          setPhotoURL(compressed)
          toast('Đã chọn ảnh đại diện. Bấm "Lưu thay đổi" để áp dụng.', 'default')
        } catch (err) {
          console.error('Avatar resize error:', err)
          toast('Không thể xử lý hình ảnh này. Hãy thử ảnh khác.', 'error')
        }
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Remove avatar
  const handleRemoveAvatar = () => {
    setPhotoURL('')
    toast('Đã bỏ chọn avatar. Bấm "Lưu thay đổi" để áp dụng.', 'default')
  }

  // Save full profile info
  const handleSaveProfile = async (e) => {
    e?.preventDefault()
    if (!user) return
    setSavingProfile(true)
    try {
      const cleanPhone = phone.trim()
      const cleanName = displayName.trim()

      await updateUserProfileData(user.uid, {
        displayName: cleanName,
        photoURL: photoURL || '',
        phone: cleanPhone,
        jobTitle: jobTitle.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        bankOwner: bankOwner.trim(),
      })

      // Đồng bộ Hotline và Tên vào localStorage để tự điền báo giá Zalo
      if (cleanPhone) localStorage.setItem('zalo_seller_hotline', cleanPhone)
      if (cleanName) localStorage.setItem('zalo_seller_name', cleanName)

      toast('Cập nhật hồ sơ thành công!', 'success')
    } catch (err) {
      console.error(err)
      toast('Lỗi cập nhật: ' + (err.message || 'Thử lại sau'), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // Change Login Email
  const handleChangeEmail = async (e) => {
    e?.preventDefault()
    const cleanEmail = newEmail.trim().toLowerCase()
    if (!cleanEmail) {
      toast('Vui lòng nhập địa chỉ email mới!', 'error')
      return
    }
    if (!currentPasswordForEmail) {
      toast('Vui lòng nhập mật khẩu hiện tại để xác thực!', 'error')
      return
    }
    if (cleanEmail === (user?.email || '').toLowerCase()) {
      toast('Email mới phải khác email hiện tại!', 'error')
      return
    }

    setSavingEmail(true)
    try {
      await changeUserEmail(currentPasswordForEmail, cleanEmail)
      toast('Đổi email thành công! Dùng email này cho lần đăng nhập tới.', 'success')
      setNewEmail('')
      setCurrentPasswordForEmail('')
    } catch (err) {
      console.error('Change email error:', err)
      let msg = err.message
      if (err.code === 'auth/wrong-password') msg = 'Mật khẩu hiện tại không chính xác'
      else if (err.code === 'auth/email-already-in-use') msg = 'Email này đã có người sử dụng'
      else if (err.code === 'auth/invalid-email') msg = 'Địa chỉ email không hợp lệ'
      else if (err.code === 'auth/too-many-requests') msg = 'Quá nhiều lần thử sai. Vui lòng đợi ít phút'
      toast('Lỗi đổi email: ' + msg, 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e) => {
    e?.preventDefault()
    if (!currentPassword) {
      toast('Vui lòng nhập mật khẩu hiện tại!', 'error')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      toast('Mật khẩu mới phải có tối thiểu 6 ký tự!', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('Mật khẩu nhập lại không khớp!', 'error')
      return
    }
    if (newPassword === currentPassword) {
      toast('Mật khẩu mới không được trùng mật khẩu cũ!', 'error')
      return
    }

    setSavingPassword(true)
    try {
      await changeUserPassword(currentPassword, newPassword)
      toast('Đổi mật khẩu thành công!', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('Change password error:', err)
      let msg = err.message
      if (err.code === 'auth/wrong-password') msg = 'Mật khẩu hiện tại không chính xác'
      else if (err.code === 'auth/weak-password') msg = 'Mật khẩu mới quá yếu (tối thiểu 6 ký tự)'
      else if (err.code === 'auth/too-many-requests') msg = 'Quá nhiều lần thử sai. Thử lại sau ít phút'
      toast('Lỗi đổi mật khẩu: ' + msg, 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  // Copy UID helper
  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard?.writeText(user.uid)
      toast('Đã sao chép UID người dùng', 'default')
    }
  }

  const creationDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

  const lastSignInDate = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 22px 50px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Top Header */}
        <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <UserAvatar
              user={{ ...user, ...profile, photoURL: photoURL || profile?.photoURL || user?.photoURL }}
              size={46}
              showStatus={true}
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {displayName || 'Tài khoản của bạn'}
              </h2>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>
                {user?.email} · {isAdmin ? 'Quản trị viên' : 'Nhân viên kinh doanh'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: isAdmin ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                color: isAdmin ? '#f59e0b' : '#3b82f6',
                border: `1px solid ${isAdmin ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              }}
            >
              <Icon name="shield" size={13} color={isAdmin ? '#f59e0b' : '#3b82f6'} />
              <span>{isAdmin ? 'Quản trị viên' : 'Nhân viên'}</span>
            </span>

            <button
              type="button"
              className="btn ghost sm"
              onClick={toggle}
              title="Đổi giao diện Sáng / Tối"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <Icon name={dark ? 'sun' : 'moon'} size={14} />
              <span>{dark ? 'Giao diện Sáng' : 'Giao diện Tối'}</span>
            </button>
          </div>
        </div>

        {/* Tab selection segmented control */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 20,
            background: 'var(--surface2)',
            padding: 4,
            borderRadius: 12,
            border: '1px solid var(--border)',
            width: 'fit-content',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 9,
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'profile' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'profile' ? '#ffffff' : 'var(--text2)',
              boxShadow: activeTab === 'profile' ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
              transition: 'all .15s',
            }}
          >
            <Icon name="user" size={14} color={activeTab === 'profile' ? '#fff' : 'currentColor'} />
            <span>Hồ sơ &amp; Bán hàng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 9,
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'security' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'security' ? '#ffffff' : 'var(--text2)',
              boxShadow: activeTab === 'security' ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
              transition: 'all .15s',
            }}
          >
            <Icon name="lock" size={14} color={activeTab === 'security' ? '#fff' : 'currentColor'} />
            <span>Đổi Email &amp; Mật khẩu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('team')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 9,
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'team' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'team' ? '#ffffff' : 'var(--text2)',
              boxShadow: activeTab === 'team' ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
              transition: 'all .15s',
            }}
          >
            <Icon name="users" size={14} color={activeTab === 'team' ? '#fff' : 'currentColor'} />
            <span>Đội ngũ ({companyUsers.length})</span>
          </button>
        </div>

        {/* TAB 1: PROFILE & SALES DETAILS */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
              {/* Card 1: Avatar & Họ tên */}
              <div className="card" style={{ padding: 22, border: '1px solid var(--border)', borderRadius: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: 14,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="user" size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Thông tin cá nhân &amp; Avatar</h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Hiển thị trên hệ thống và đơn báo giá</div>
                  </div>
                </div>

                {/* Avatar picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <UserAvatar
                      user={{ photoURL, displayName, email: user?.email }}
                      size={82}
                      showStatus={false}
                      style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Đổi ảnh đại diện"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#fff',
                        border: '2px solid var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                      }}
                    >
                      <Icon name="camera" size={13} color="#fff" />
                    </button>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAvatarChange}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                      >
                        <Icon name="upload" size={13} />
                        <span>Chọn ảnh mới</span>
                      </button>
                      {photoURL && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={handleRemoveAvatar}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444' }}
                        >
                          <Icon name="trash" size={13} color="#ef4444" />
                          <span>Xóa ảnh</span>
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
                      Ảnh được tối ưu kích thước và tự động hiển thị cho đồng nghiệp xem.
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="field-label" style={{ fontWeight: 700 }}>
                      Tên hiển thị / Họ tên *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A..."
                      required
                      style={{ width: '100%', fontSize: 13 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                      Tên người lập đơn, xuất hiện trên góc menu và báo giá Zalo.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="field-label" style={{ fontWeight: 700 }}>
                        Số điện thoại / Zalo *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="input"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="VD: 0984.273.806"
                          style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
                        />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                          <Icon name="phone" size={14} />
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="field-label" style={{ fontWeight: 700 }}>
                        Chức danh / Vị trí
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="input"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder="VD: Kinh doanh máy bơm"
                          style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
                        />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                          <Icon name="briefcase" size={14} />
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn primary"
                    disabled={savingProfile}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontWeight: 700, alignSelf: 'flex-start', marginTop: 6 }}
                  >
                    <Icon name="check" size={14} color="#fff" />
                    <span>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                  </button>
                </form>
              </div>

              {/* Card 2: Thông tin ngân hàng & Tài khoản hệ thống */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Bank Account */}
                <div className="card" style={{ padding: 22, border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: '1px solid var(--border)',
                      paddingBottom: 14,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="creditCard" size={16} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Tài khoản ngân hàng cá nhân</h3>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Dùng nhận hoa hồng hoặc thanh toán đối soát</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="field-label" style={{ fontWeight: 600 }}>Tên Ngân hàng</label>
                      <input
                        type="text"
                        className="input"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="VD: MB Bank, Techcombank, Vietcombank..."
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                      <div>
                        <label className="field-label" style={{ fontWeight: 600 }}>Số tài khoản (STK)</label>
                        <input
                          type="text"
                          className="input"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="VD: 860088688888"
                          style={{ width: '100%', fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label className="field-label" style={{ fontWeight: 600 }}>Chủ tài khoản</label>
                        <input
                          type="text"
                          className="input"
                          value={bankOwner}
                          onChange={(e) => setBankOwner(e.target.value)}
                          placeholder="VD: NGUYEN VAN A"
                          style={{ width: '100%', fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, fontWeight: 600 }}
                    >
                      <Icon name="check" size={13} color="#fff" />
                      <span>Lưu thông tin ngân hàng</span>
                    </button>
                  </div>
                </div>

                {/* System Metadata Card */}
                <div className="card" style={{ padding: 18, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="clock" size={13} color="var(--primary)" />
                    <span>Thông tin đăng nhập &amp; Thiết bị</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Email đăng nhập:</span>
                      <strong style={{ color: 'var(--text)' }}>{user?.email || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Ngày tham gia:</span>
                      <span>{creationDate}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Lần đăng nhập gần nhất:</span>
                      <span>{lastSignInDate}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px dashed var(--border)' }}>
                      <span>Mã định danh (UID):</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ fontSize: 10.5, color: 'var(--text3)' }}>{user?.uid?.slice(0, 14)}...</code>
                        <button
                          type="button"
                          onClick={handleCopyUid}
                          title="Sao chép UID"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, padding: 2 }}
                        >
                          <Icon name="copy" size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn ghost xs"
                      onClick={logout}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ef4444' }}
                    >
                      <Icon name="logOut" size={12} color="#ef4444" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Teammates Horizontal Showcase */}
            {companyUsers.length > 0 && (
              <div className="card" style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="users" size={16} color="var(--primary)" />
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                      Đồng nghiệp trong công ty ({companyUsers.length} thành viên)
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setActiveTab('team')}
                    style={{ fontSize: 11.5, color: 'var(--primary)', padding: '2px 8px' }}
                  >
                    Xem chi tiết →
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
                  {companyUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setActiveTab('team')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        minWidth: 100,
                        cursor: 'pointer',
                        transition: 'transform .12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                    >
                      <UserAvatar user={u} size={42} showStatus={true} />
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 650,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          maxWidth: 88,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                        }}
                      >
                        {u.displayName || u.email?.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {u.role === 'admin' ? 'Admin' : 'Nhân viên'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SECURITY (EMAIL & PASSWORD) */}
        {activeTab === 'security' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {/* Card: Đổi Email */}
            <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="mail" size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Đổi Email đăng nhập</h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Dùng email mới cho các lần đăng nhập tiếp theo</div>
                </div>
              </div>

              <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>Email hiện tại</label>
                  <input
                    type="text"
                    className="input"
                    value={user?.email || ''}
                    disabled
                    style={{ width: '100%', opacity: 0.7, background: 'var(--surface2)', cursor: 'not-allowed', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 700 }}>Email mới *</label>
                  <input
                    type="email"
                    className="input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="VD: emailmoi@gmail.com"
                    required
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 700 }}>
                    Mật khẩu hiện tại (để xác thực bảo mật) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showEmailPw ? 'text' : 'password'}
                      className="input"
                      value={currentPasswordForEmail}
                      onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại..."
                      required
                      style={{ width: '100%', paddingRight: 38, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailPw(!showEmailPw)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.6,
                        padding: 4,
                      }}
                    >
                      <Icon name={showEmailPw ? 'eyeOff' : 'eye'} size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                    Yêu cầu bảo mật để bảo vệ tài khoản tránh bị chiếm quyền.
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={savingEmail || !newEmail || !currentPasswordForEmail}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 700, alignSelf: 'flex-start' }}
                >
                  <Icon name="check" size={13} color="#fff" />
                  <span>{savingEmail ? 'Đang cập nhật...' : 'Cập nhật Email'}</span>
                </button>
              </form>
            </div>

            {/* Card: Đổi Mật khẩu */}
            <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="lock" size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Đổi Mật khẩu</h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Đổi sang mật khẩu mới an toàn hơn</div>
                </div>
              </div>

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="field-label" style={{ fontWeight: 700 }}>Mật khẩu hiện tại *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      className="input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại..."
                      required
                      style={{ width: '100%', paddingRight: 38, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.6,
                        padding: 4,
                      }}
                    >
                      <Icon name={showCurrentPw ? 'eyeOff' : 'eye'} size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ fontWeight: 700 }}>Mật khẩu mới *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        className="input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự..."
                        required
                        style={{ width: '100%', paddingRight: 34, fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{
                          position: 'absolute',
                          right: 6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.6,
                          padding: 4,
                        }}
                      >
                        <Icon name={showNewPw ? 'eyeOff' : 'eye'} size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="field-label" style={{ fontWeight: 700 }}>Nhập lại mật khẩu mới *</label>
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      className="input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Xác nhận lại..."
                      required
                      style={{ width: '100%', fontSize: 13 }}
                    />
                  </div>
                </div>

                {confirmPassword && newPassword !== confirmPassword && (
                  <div style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 600 }}>
                    Mật khẩu xác nhận không khớp!
                  </div>
                )}

                <button
                  type="submit"
                  className="btn primary"
                  disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 700, alignSelf: 'flex-start' }}
                >
                  <Icon name="key" size={13} color="#fff" />
                  <span>{savingPassword ? 'Đang đổi mật khẩu...' : 'Cập nhật Mật khẩu'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: TEAM MEMBERS LIST */}
        {activeTab === 'team' && (
          <div className="card" style={{ padding: 22, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Danh sách thành viên &amp; Đội ngũ ({companyUsers.length})
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  Mọi người trong công ty có thể xem ảnh đại diện, số điện thoại và chức vụ của nhau
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => setPage('admin-users')}
                  style={{ fontWeight: 600 }}
                >
                  + Thêm / Cấp quyền tài khoản
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 14,
              }}
            >
              {companyUsers.map((u) => {
                const isSelf = u.id === user?.uid
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: isSelf ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface2)',
                      border: isSelf ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <UserAvatar user={u} size={48} showStatus={true} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.displayName || u.email?.split('@')[0]}
                        </div>
                        {isSelf && (
                          <span style={{ fontSize: 10, background: 'var(--primary)', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                            Bạn
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                        {u.jobTitle || (u.role === 'admin' ? 'Quản trị viên' : 'Nhân viên kinh doanh')}
                      </div>

                      {u.phone ? (
                        <a
                          href={`tel:${u.phone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: 'var(--primary)',
                            marginTop: 4,
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <Icon name="phone" size={11} />
                          <span>{u.phone}</span>
                        </a>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                          {u.email}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
