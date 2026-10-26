import { useState, useEffect } from 'react'

export default function PwaUpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let currentVersion = null

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data && data.version) {
          if (!currentVersion) {
            currentVersion = data.version
          } else if (currentVersion !== data.version) {
            setHasUpdate(true)
          }
        }
      } catch {}
    }

    const timer = setTimeout(checkVersion, 2000)
    const interval = setInterval(checkVersion, 20000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  if (!hasUpdate) return null

  return (
    <div style={{
      position: 'fixed',
      top: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      background: '#2563eb',
      color: '#fff',
      padding: '8px 18px',
      borderRadius: 30,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
      fontWeight: 700,
    }}>
      <span>🎉 Có bản cập nhật mới nhất!</span>
      <button
        onClick={() => window.location.reload(true)}
        style={{
          background: '#fff',
          color: '#2563eb',
          border: 'none',
          borderRadius: 20,
          padding: '4px 12px',
          fontWeight: 800,
          fontSize: 12,
          cursor: 'pointer'
        }}
      >
        Làm mới ngay ➔
      </button>
      <button
        onClick={() => setHasUpdate(false)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.8)',
          cursor: 'pointer',
          padding: '0 4px',
          fontSize: 14
        }}
      >
        ✕
      </button>
    </div>
  )
}
