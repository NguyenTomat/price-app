import { createContext, useContext, useEffect, useState } from 'react'
import { onAuth, getUserProfile, db } from '../firebase/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Firebase user
  const [profile, setProfile] = useState(null) // Firestore profile (role, name, canManageWeb)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // An toàn: nếu sau 8s vẫn chưa biết trạng thái đăng nhập
    // (thường do cấu hình Firebase sai hoặc lỗi mạng), vẫn cho hiện
    // màn đăng nhập thay vì kẹt mãi ở "Đang tải...".
    const safety = setTimeout(() => setLoading(false), 8000)
    let profileUnsub = null

    const unsub = onAuth((firebaseUser) => {
      clearTimeout(safety)
      // Biết được trạng thái đăng nhập là cho app chạy tiếp NGAY,
      // không chờ tải hồ sơ Firestore (tránh kẹt nếu Firestore lỗi/chậm).
      setUser(firebaseUser || null)
      setLoading(false)

      if (profileUnsub) {
        profileUnsub()
        profileUnsub = null
      }

      if (firebaseUser) {
        // Lắng nghe hồ sơ Firestore realtime để khi Admin cấp quyền là cập nhật ngay
        try {
          profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              setProfile({ id: docSnap.id, ...docSnap.data() })
            } else {
              setProfile(null)
            }
          }, (e) => {
            console.warn('onSnapshot user profile failed, fallback to getDoc:', e)
            getUserProfile(firebaseUser.uid)
              .then(setProfile)
              .catch((err) => {
                console.error('Không tải được hồ sơ user:', err)
                setProfile(null)
              })
          })
        } catch {
          getUserProfile(firebaseUser.uid)
            .then(setProfile)
            .catch(() => setProfile(null))
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      clearTimeout(safety)
      if (unsub) unsub()
      if (profileUnsub) profileUnsub()
    }
  }, [])

  const currentEmail = (profile?.email || user?.email || '').trim().toLowerCase()
  const isMasterAdmin = currentEmail === 'tunbebong1126@gmail.com'
  const isAdmin = profile?.role === 'admin' || isMasterAdmin
  // CHỈ Master Admin (tunbebong1126@gmail.com) hoặc tài khoản được CẤP RIÊNG canManageWeb mới thấy Quản lý Web
  const canManageWeb = isMasterAdmin || profile?.canManageWeb === true || profile?.role === 'web_manager'

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, isMasterAdmin, canManageWeb, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
