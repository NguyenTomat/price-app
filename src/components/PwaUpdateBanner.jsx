import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Tự động cập nhật ứng dụng PWA / Web app nền ngầm ngay khi mở app hoặc có bản mới */
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
      }
    },
  })

  // Tự động kích hoạt bản mới ngay lập tức qua Service Worker
  useEffect(() => {
    if (needRefresh && !isElectron) {
      updateServiceWorker(true)
    }
  }, [needRefresh, isElectron, updateServiceWorker])

  // Lắng nghe sự kiện controllerchange -> Tự reload trang mượt mà
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

  // Cơ chế so khớp phiên bản trực tiếp (Version Hash Check) - Đảm bảo tự động cập nhật 100%
  useEffect(() => {
    if (isElectron) return

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        })
        if (!res.ok) return
        const data = await res.json()
        const serverVersion = data?.version
        const currentVersion = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : null

        if (serverVersion && currentVersion && serverVersion !== currentVersion) {
          console.log('[AutoUpdate] Phát hiện bản mới:', serverVersion, 'Hiện tại:', currentVersion)
          // Xóa toàn bộ cache cũ để nạp mới hoàn toàn
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map(k => caches.delete(k)))
          }
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            for (const reg of regs) {
              await reg.update().catch(() => {})
              if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' })
              }
            }
          }
          window.location.reload()
        }
      } catch (err) {
        // Bỏ qua lỗi mạng nếu đang offline
      }
    }

    // Kiểm tra ngay khi khởi động
    checkVersion()

    // Kiểm tra mỗi 10 giây
    const interval = setInterval(checkVersion, 10 * 1000)

    // Kiểm tra khi người dùng mở lại tab hoặc mở lại app
    const handleCheck = () => {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    }
    document.addEventListener('visibilitychange', handleCheck)
    window.addEventListener('focus', handleCheck)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleCheck)
      window.removeEventListener('focus', handleCheck)
    }
  }, [isElectron])

  return null
}



