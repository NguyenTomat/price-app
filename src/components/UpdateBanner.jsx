import { useState, useEffect } from 'react'

/**
 * Hiển thị banner update ở góc phải dưới.
 * Chỉ hoạt động khi chạy trong Electron (window.electronUpdater tồn tại).
 */
export default function UpdateBanner() {
  const [status, setStatus] = useState(null) // null | {type, ...}
  const updater = typeof window !== 'undefined' ? window.electronUpdater : null

  useEffect(() => {
    if (!updater) return
    updater.onStatus(setStatus)
  }, [])

  if (!updater || !status) return null

  const { type, version, percent } = status

  if (type === 'not-available' || type === 'checking') return null

  const styles = {
    wrap: {
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      maxWidth: 340, borderRadius: 10, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      fontFamily: 'var(--font-sans, system-ui)',
    },
    inner: {
      padding: '14px 16px',
      background: type === 'error' ? '#fee2e2' : '#1e3a5f',
      color: type === 'error' ? '#991b1b' : '#fff',
    },
    title: { fontWeight: 700, fontSize: 14, marginBottom: 4 },
    sub:   { fontSize: 12, opacity: 0.8, marginBottom: 10 },
    bar:   { height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', marginBottom: 10, overflow: 'hidden' },
    fill:  { height: '100%', background: '#60a5fa', borderRadius: 2, transition: 'width .3s', width: `${percent ?? 0}%` },
    notes: {
      background: 'rgba(0,0,0,0.25)',
      borderRadius: 6,
      padding: '10px 12px',
      fontSize: 11.5,
      maxHeight: 120,
      overflowY: 'auto',
      marginBottom: 14,
      lineHeight: '1.4',
      textAlign: 'left',
      whiteSpace: 'pre-line',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    btns:  { display: 'flex', gap: 8 },
    btn:   { flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  }

  const getNotesHtml = (notes) => {
    if (!notes) return ''
    if (typeof notes === 'string') return notes
    if (Array.isArray(notes)) {
      return notes.map(n => typeof n === 'string' ? n : (n.note || '')).join('<br/>')
    }
    return ''
  }

  const notesHtml = getNotesHtml(status.releaseNotes)

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        {type === 'error' && (
          <>
            <div style={styles.title}>⚠ Lỗi kiểm tra cập nhật</div>
            <div style={styles.sub}>{status.message}</div>
            <div style={styles.btns}>
              <button style={{ ...styles.btn, background: '#fca5a5', color: '#7f1d1d' }} onClick={() => setStatus(null)}>Đóng</button>
            </div>
          </>
        )}

        {type === 'available' && (
          <>
            <div style={styles.title}>🎉 Có phiên bản mới: v{version}</div>
            <div style={{ ...styles.sub, marginBottom: 8 }}>Thông tin phiên bản mới:</div>
            
            {notesHtml && (
              <div 
                style={styles.notes} 
                className="custom-thin-scrollbar" 
                dangerouslySetInnerHTML={{ __html: notesHtml }} 
              />
            )}

            <div style={styles.btns}>
              <button style={{ ...styles.btn, background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => setStatus(null)}>Bỏ qua</button>
              <button style={{ ...styles.btn, background: '#3b82f6', color: '#fff' }} onClick={() => updater.download()}>Tải về</button>
            </div>
          </>
        )}

        {type === 'downloading' && (
          <>
            <div style={styles.title}>⬇ Đang tải bản cập nhật...</div>
            <div style={styles.sub}>{percent ?? 0}% — hoàn thành khi đóng app sẽ tự cài</div>
            <div style={styles.bar}><div style={styles.fill}/></div>
          </>
        )}

        {type === 'downloaded' && (
          <>
            <div style={styles.title}>✅ Đã tải xong — sẵn sàng cập nhật</div>
            <div style={styles.sub}>Cài ngay và khởi động lại app, hoặc để tự cài khi đóng app</div>
            <div style={styles.btns}>
              <button style={{ ...styles.btn, background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => setStatus(null)}>Để sau</button>
              <button style={{ ...styles.btn, background: '#22c55e', color: '#fff' }} onClick={() => updater.install()}>Cài & Khởi động lại</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
