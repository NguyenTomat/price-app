import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Banner thông báo & tự động cập nhật PWA / Web app trên PC & mobile */
export default function PwaUpdateBanner() {
  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  const [countdown, setCountdown] = useState(4)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Kiểm tra bản cập nhật mỗi 3 phút hoặc khi quay lại app
        setInterval(() => {
          r.update().catch(() => {})
        }, 3 * 60 * 1000)

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            r.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    },
  })

  // Đếm ngược 4s tự động cập nhật khi có bản mới
  useEffect(() => {
    if (!needRefresh || isElectron) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          updateServiceWorker(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [needRefresh, isElectron, updateServiceWorker])

  if (isElectron || !needRefresh) return null

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
      borderRadius: 12,
      padding: '16px 18px',
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'slideInTop 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <style>{`
        @keyframes slideInTop {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, lineHeight: 1 }}>🚀</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#F8FAFC', marginBottom: 3 }}>
            Đã có bản cập nhật mới!
          </div>
          <div style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.4, marginBottom: 12 }}>
            Tự động tải phiên bản mới nhất sau <span style={{ color: '#38BDF8', fontWeight: 700 }}>{countdown}s</span>...
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 650,
                fontSize: 12.5,
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onClick={() => updateServiceWorker(true)}
            >
              ✓ Cập nhật ngay
            </button>
            <button
              type="button"
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'transparent',
                color: '#CBD5E1',
                fontSize: 12,
                cursor: 'pointer'
              }}
              onClick={() => setNeedRefresh(false)}
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
