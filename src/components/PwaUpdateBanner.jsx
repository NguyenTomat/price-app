import { useRegisterSW } from 'virtual:pwa-register/react'

/** Banner cập nhật PWA (điện thoại / trình duyệt) — không dùng trên Electron */
export default function PwaUpdateBanner() {
  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (isElectron || !needRefresh) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, left: 20, zIndex: 9999,
      maxWidth: 340, marginLeft: 'auto',
      borderRadius: 10, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      <div style={{ padding: '14px 16px', background: '#1e3a5f', color: '#fff' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Có bản cập nhật mới</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
          Bấm cập nhật để dùng phiên bản mới nhất.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => updateServiceWorker(true)}
          >
            Cập nhật
          </button>
          <button
            type="button"
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer' }}
            onClick={() => setNeedRefresh(false)}
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  )
}
