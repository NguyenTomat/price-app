import { createContext, useContext, useEffect, useState } from 'react'
import { onAuth, getUserProfile } from '../firebase/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Firebase user
  const [profile, setProfile] = useState(null) // Firestore profile (role, name)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // An toàn: nếu sau 8s vẫn chưa biết trạng thái đăng nhập
    // (thường do cấu hình Firebase sai hoặc lỗi mạng), vẫn cho hiện
    // màn đăng nhập thay vì kẹt mãi ở "Đang tải...".
    const safety = setTimeout(() => setLoading(false), 8000)

    const unsub = onAuth((firebaseUser) => {
      clearTimeout(safety)
      // Biết được trạng thái đăng nhập là cho app chạy tiếp NGAY,
      // không chờ tải hồ sơ Firestore (tránh kẹt nếu Firestore lỗi/chậm).
      setUser(firebaseUser || null)
      setLoading(false)
      if (firebaseUser) {
        getUserProfile(firebaseUser.uid)
          .then(setProfile)
          .catch((e) => {
            console.error('Không tải được hồ sơ user:', e)
            setProfile(null)
          })
      } else {
        setProfile(null)
      }
    })

    return () => { clearTimeout(safety); if (unsub) unsub() }
  }, [])

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
