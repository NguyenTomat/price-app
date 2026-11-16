import { useState, useEffect, useRef } from 'react'
import { subscribeWebOrders } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'

const formatOrderTime = (ts) => {
  if (!ts) return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  if (typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  const d = new Date(ts)
  return isNaN(d.getTime())
    ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

export default function WebOrderNotifier({ onOpenOrder, onUpdatePendingCount }) {
  const { canManageWeb } = useAuth()
  const [newOrderAlert, setNewOrderAlert] = useState(null)
  const [desktopPerm, setDesktopPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const isFirstLoad = useRef(true)
  const knownOrderIds = useRef(new Set())

  // Play a crisp, pleasant 3-tone chime (A5 -> C#6 -> E6) using Web Audio API
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()

      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
        gain.gain.setValueAtTime(0.001, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }

      playTone(880, 0, 0.22)        // A5
      playTone(1108.73, 0.12, 0.22) // C#6
      playTone(1318.51, 0.24, 0.40) // E6
    } catch (e) {
      console.warn('Audio chime failed:', e)
    }
  }

  // Request browser desktop notification permission
  const handleRequestPermission = async () => {
    if (typeof Notification !== 'undefined') {
      try {
        const res = await Notification.requestPermission()
        setDesktopPerm(res)
      } catch (err) {
        console.warn('Notification permission error:', err)
      }
    }
  }

  useEffect(() => {
    if (!canManageWeb) {
      onUpdatePendingCount?.(0)
      return
    }

    const unsub = subscribeWebOrders((orders) => {
      const pendingOrders = orders.filter(o => o.status === 'pending')
      onUpdatePendingCount?.(pendingOrders.length)

      if (isFirstLoad.current) {
        // Ghi nhận các đơn đã có trong hệ thống khi mở app để không phát chuông lại
        orders.forEach(o => knownOrderIds.current.add(o.id))
        isFirstLoad.current = false
        return
      }

      // Phát hiện đơn mới phát sinh chưa từng có trong danh sách
      const newIncomingOrders = orders.filter(
        o => !knownOrderIds.current.has(o.id) && o.status === 'pending'
      )

      // Cập nhật tất cả đơn vào danh sách đã biết
      orders.forEach(o => knownOrderIds.current.add(o.id))

      if (newIncomingOrders.length > 0) {
        const latest = newIncomingOrders[0]
        // 1. Phát chuông ting ting
        playChime()
        // 2. Hiện banner thông báo nổi
        setNewOrderAlert(latest)

        // 3. Hiện Desktop Notification của trình duyệt/Windows nếu được cấp quyền
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const notif = new Notification('🔔 Đơn hàng mới từ Web T&T!', {
              body: `${latest.customerName || 'Khách hàng'} (${latest.phone || ''}) vừa gửi yêu cầu báo giá/đặt hàng.`,
              icon: './icons/icon-192.png',
              tag: `web-order-${latest.id}`,
            })
            notif.onclick = () => {
              window.focus()
              onOpenOrder?.(latest)
              setNewOrderAlert(null)
            }
          } catch (e) {
            console.warn('Desktop notification error:', e)
          }
        }
      }
    })

    return () => unsub && unsub()
  }, [canManageWeb])

  if (!newOrderAlert) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999999,
        maxWidth: 420,
        width: 'calc(100vw - 48px)',
        background: '#ffffff',
        color: '#1e293b',
        borderRadius: 14,
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08), 0 0 24px rgba(239, 68, 68, 0.25)',
        borderLeft: '5px solid #ef4444',
        padding: '16px 18px',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🔔
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#b91c1c', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Đơn hàng mới từ Web!
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              Vừa nhận lúc {formatOrderTime(newOrderAlert.createdAt)}
            </div>
          </div>
        </div>
        <button
          onClick={() => setNewOrderAlert(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
          title="Đóng"
        >
          ✕
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          background: '#f8fafc',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.5,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ fontWeight: 700, color: '#0f172a' }}>
          👤 {newOrderAlert.customerName || 'Khách hàng'}
          {newOrderAlert.phone && (
            <span style={{ color: '#0284c7', marginLeft: 8, fontWeight: 600 }}>
              📞 {newOrderAlert.phone}
            </span>
          )}
        </div>
        {newOrderAlert.address && (
          <div style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>
            📍 {newOrderAlert.address}
          </div>
        )}
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            🛒 {newOrderAlert.items?.length || 1} sản phẩm
          </span>
          <span style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>
            {fmt(newOrderAlert.totalAmount)}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => {
            onOpenOrder?.(newOrderAlert)
            setNewOrderAlert(null)
          }}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          📋 Xem đơn & Gọi tư vấn
        </button>
        {newOrderAlert.phone && (
          <a
            href={`tel:${newOrderAlert.phone}`}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              background: '#22c55e',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Gọi ngay"
          >
            📞 Gọi
          </a>
        )}
      </div>

      {desktopPerm === 'default' && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 8px',
            background: '#eff6ff',
            borderRadius: 6,
            fontSize: 11,
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <span>🖥️ Bật thông báo Windows/Desktop:</span>
          <button
            onClick={handleRequestPermission}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cho phép
          </button>
        </div>
      )}
    </div>
  )
}
