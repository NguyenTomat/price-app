import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Banner thông báo & cập nhật ứng dụng PWA / Web app */
export default function PwaUpdateBanner() {
  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  const [hasNewVersion, setHasNewVersion] = useState(false)
  const [countdown, setCountdown] = useState(6)
  const [updating, setUpdating] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        r.update().catch(() => {})
        setInterval(() => {
          r.update().catch(() => {})
        }, 15 * 1000)
      }
    },
  })

  useEffect(() => {
    if (needRefresh && !isElectron) {
      setHasNewVersion(true)
    }
  }, [needRefresh, isElectron])

  // Lắng nghe controllerchange -> Reload trang
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

  // Kiểm tra version.json từ server
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
          setHasNewVersion(true)
        }
      } catch (err) {}
    }

    checkVersion()
    const interval = setInterval(checkVersion, 10 * 1000)

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

  const applyUpdate = async () => {
    setUpdating(true)
    try {
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
      if (needRefresh) {
        await updateServiceWorker(true)
      }
    } catch (e) {}
    window.location.reload()
  }

  // Đếm ngược tự động cập nhật
  useEffect(() => {
    if (!hasNewVersion || isElectron || updating) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          applyUpdate()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasNewVersion, isElectron, updating])

  return null
}



