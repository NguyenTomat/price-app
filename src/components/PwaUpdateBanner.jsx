import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Tự động cập nhật ứng dụng PWA / Web app nền ngầm ngay khi mở app */
export default function PwaUpdateBanner() {
  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Kiểm tra ngay khi khởi động
        r.update().catch(() => {})

        // Kiểm tra định kỳ mỗi 15 giây
        setInterval(() => {
          r.update().catch(() => {})
        }, 15 * 1000)

        // Kiểm tra khi người dùng mở lại app / tab
        const handleCheck = () => {
          if (document.visibilityState === 'visible') {
            r.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', handleCheck)
        window.addEventListener('focus', handleCheck)
      }
    },
  })

  // Tự động kích hoạt bản mới ngay lập tức
  useEffect(() => {
    if (needRefresh && !isElectron) {
      updateServiceWorker(true)
    }
  }, [needRefresh, isElectron, updateServiceWorker])

  // Lắng nghe sự kiện controllerchange khi Service Worker mới đã tải xong -> Tự reload trang mượt mà
  useEffect(() => {
    if ('serviceWorker' in navigator && !isElectron) {
      let refreshing = false
      const onControllerChange = () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      }
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      }
    }
  }, [isElectron])

  return null
}


