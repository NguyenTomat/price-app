import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Tự động cập nhật ứng dụng PWA / Web app nền ngầm khi có bản mới (không hỏi người dùng) */
export default function PwaUpdateBanner() {
  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Tự động kiểm tra bản cập nhật mỗi 2 phút hoặc khi mở lại app
        setInterval(() => {
          r.update().catch(() => {})
        }, 2 * 60 * 1000)

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            r.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    },
  })

  // Tự động cập nhật ngầm ngay lập tức khi phát hiện có bản build mới
  useEffect(() => {
    if (needRefresh && !isElectron) {
      updateServiceWorker(true)
    }
  }, [needRefresh, isElectron, updateServiceWorker])

  return null
}

