import { useEffect, useState } from 'react'

/** Gợi ý cài PWA đúng cách trên Android / iOS (không phải shortcut Chrome) */
export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('pwa-install-dismiss') === '1'
  )
  const [isMobile, setIsMobile] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)

    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setStandalone(standaloneMode)

    const onInstall = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onInstall)

    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [])

  const isElectron = typeof window !== 'undefined' && window.electronUpdater
  if (isElectron || dismissed || standalone || !isMobile) return null

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    setDeferred(null)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismiss', '1')
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismiss', '1')
  }

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-prompt-inner">
        <div className="pwa-install-prompt-title">📲 Cài app lên màn hình chính</div>
        <div className="pwa-install-prompt-text">
          {deferred
            ? 'Bấm "Cài app" để mở full màn hình, không còn thanh địa chỉ Chrome.'
            : 'Vào Chrome ⋮ → chọn "Cài ứng dụng" (Install app). Shortcut thường vẫn mở trong trình duyệt.'}
        </div>
        <div className="pwa-install-prompt-actions">
          {deferred && (
            <button type="button" className="btn sm primary" onClick={install}>
              Cài app
            </button>
          )}
          <button type="button" className="btn sm" onClick={dismiss}>
            Để sau
          </button>
        </div>
      </div>
    </div>
  )
}
