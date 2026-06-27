import { useState, useMemo, useRef, useEffect } from 'react'

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

/** Chọn giá vốn: gõ mã/tên → chọn từ danh sách lọc */
export default function CostPricePicker({ items = [], value, onChange, placeholder = 'Gõ mã hoặc tên hàng...' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef()

  const selected = items.find(i => i.id === value)

  useEffect(() => {
    if (selected && !query) setQuery(selected.code || '')
  }, [selected?.id])

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 40)
    return items.filter(i =>
      (i.code || '').toLowerCase().includes(q) ||
      (i.name || '').toLowerCase().includes(q)
    ).slice(0, 40)
  }, [items, query])

  const pick = (item) => {
    onChange(item)
    setQuery(item.code || '')
    setOpen(false)
  }

  const clear = () => {
    onChange(null)
    setQuery('')
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
          onFocus={() => setOpen(true)}
        />
        {selected && (
          <button type="button" className="btn sm" onClick={clear} title="Bỏ chọn">✕</button>
        )}
      </div>

      {selected && (
        <div style={{
          marginTop: 8, padding: '8px 10px', background: 'var(--accent-s)',
          borderRadius: 'var(--radius-sm)', fontSize: 12, border: '1px solid rgba(59,130,246,0.2)',
        }}>
          <div style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{selected.code}</div>
          <div style={{ color: 'var(--text2)', marginTop: 2 }}>{selected.name}</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>Giá vốn: {fmt(selected.avgPrice)}</div>
        </div>
      )}

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4,
          maxHeight: 260, overflowY: 'auto', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {filtered.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent',
                cursor: 'pointer', fontSize: 12,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{item.code}</span>
              <span style={{ color: 'var(--text2)', marginLeft: 8 }}>{item.name?.slice(0, 50)}</span>
              <span style={{ float: 'right', fontWeight: 600 }}>{fmt(item.avgPrice)}</span>
            </button>
          ))}
        </div>
      )}

      {open && query && filtered.length === 0 && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4,
          padding: 12, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text2)',
        }}>
          Không tìm thấy mã phù hợp
        </div>
      )}
    </div>
  )
}
