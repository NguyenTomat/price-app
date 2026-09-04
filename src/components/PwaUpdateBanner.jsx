import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Banner & cơ chế tự động cập nhật PWA / Web app trên PC & mobile */
export default function PwaUpdateBanner() {
  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Kiểm tra bản cập nhật mỗi 5 phút hoặc khi mở lại app
        setInterval(() => {
          r.update().catch(() => {})
        }, 5 * 60 * 1000)

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            r.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    },
  })

  // Tự động cập nhật ngay khi phát hiện phiên bản mới
  useEffect(() => {
    if (!isElectron && needRefresh) {
      updateServiceWorker(true)
    }
  }, [isElectron, needRefresh, updateServiceWorker])

  return null
}
