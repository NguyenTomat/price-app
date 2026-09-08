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

  if (isElectron || !hasNewVersion) return null

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 999999,
      maxWidth: 380,
      width: 'calc(100vw - 40px)',
      background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
      color: '#FFFFFF',
      borderRadius: 14,
      padding: '16px 18px',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'slideInDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <style>{`
        @keyframes slideInDown {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>🚀</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#F8FAFC', marginBottom: 4 }}>
            Đã có bản cập nhật mới!
          </div>
          <div style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.45, marginBottom: 12 }}>
            Tự động làm mới sau <span style={{ color: '#38BDF8', fontWeight: 700 }}>{countdown}s</span> hoặc bấm cập nhật ngay bên dưới:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={updating}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 8,
                border: 'none',
                background: updating ? '#64748B' : '#2563EB',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: updating ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
              }}
              onClick={applyUpdate}
            >
              {updating ? 'Đang cập nhật...' : '✓ Cập nhật ngay'}
            </button>
            <button
              type="button"
              disabled={updating}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'transparent',
                color: '#CBD5E1',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={() => {
                setHasNewVersion(false)
                if (setNeedRefresh) setNeedRefresh(false)
              }}
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



