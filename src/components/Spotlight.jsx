import { useState, useEffect, useRef, useCallback } from 'react'

// Accepts: allProducts = [{ id, name, group, price, listId, listName }]
// onNavigate(page, extra?) - navigate to a page
// onSelectProduct(product) - open product modal

export default function Spotlight({ allProducts = [], onNavigate, onClose }) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  const navItems = [
    { icon: '📊', name: 'Bảng giá', page: 'lists' },
    { icon: '⭐', name: 'Bảng giá của tôi', page: 'my-prices' },
    { icon: '🛒', name: 'Quản lý đơn bán', page: 'orders' },
    { icon: '📦', name: 'Tồn kho', page: 'inventory' },
    { icon: '👥', name: 'Quản lý user', page: 'admin-users' },
    { icon: '📥', name: 'Import bảng giá', page: 'admin-import' },
    { icon: '🏠', name: 'Dashboard', page: 'dashboard' },
  ]

  const q = query.trim().toLowerCase()

  const matchedNav = q
    ? navItems.filter(n => n.name.toLowerCase().includes(q))
    : navItems

  const matchedProducts = q
    ? allProducts
        .filter(p => p.name?.toLowerCase().includes(q) || p.group?.toLowerCase().includes(q))
        .slice(0, 8)
    : []

  const allItems = [
    ...matchedNav.map(n => ({ kind: 'nav', ...n })),
    ...matchedProducts.map(p => ({ kind: 'product', ...p })),
  ]

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      const item = allItems[sel]
      if (!item) return
      if (item.kind === 'nav') onNavigate(item.page)
      else onNavigate('lists', item)
      onClose()
    }
    if (e.key === 'Escape') onClose()
  }

  useEffect(() => { setSel(0) }, [query])

  const fmtPrice = (n) => n != null && !isNaN(n)
    ? Number(n).toLocaleString('vi-VN') + ' ₫'
    : '—'

  return (
    <div className="spotlight-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="spotlight">
        <div className="spotlight-input-wrap">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{color:'var(--text3)',flexShrink:0}}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="spotlight-input"
            placeholder="Tìm sản phẩm, trang, tính năng..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && (
            <button className="btn ghost xs" onClick={() => setQuery('')} style={{padding:'2px 6px'}}>✕</button>
          )}
        </div>

        <div className="spotlight-results">
          {matchedNav.length > 0 && (
            <div className="spotlight-section">
              <div className="spotlight-section-label">Điều hướng</div>
              {matchedNav.map((item, i) => (
                <div
                  key={item.page}
                  className={`spotlight-item ${sel === i ? 'selected' : ''}`}
                  onClick={() => { onNavigate(item.page); onClose() }}
                  onMouseEnter={() => setSel(i)}
                >
                  <span className="spotlight-item-icon">{item.icon}</span>
                  <span className="spotlight-item-name">{item.name}</span>
                </div>
              ))}
            </div>
          )}

          {matchedProducts.length > 0 && (
            <div className="spotlight-section">
              <div className="spotlight-section-label">Sản phẩm ({matchedProducts.length})</div>
              {matchedProducts.map((p, i) => {
                const idx = matchedNav.length + i
                return (
                  <div
                    key={p.id}
                    className={`spotlight-item ${sel === idx ? 'selected' : ''}`}
                    onClick={() => { onNavigate('lists', p); onClose() }}
                    onMouseEnter={() => setSel(idx)}
                  >
                    <span className="spotlight-item-icon">🔧</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="spotlight-item-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                      <div className="spotlight-item-sub">{p.group} · {p.listName}</div>
                    </div>
                    <span className="spotlight-item-price">{fmtPrice(p.price)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {allItems.length === 0 && q && (
            <div style={{padding:'32px 16px',textAlign:'center',color:'var(--text2)',fontSize:13}}>
              Không tìm thấy kết quả cho "<strong>{query}</strong>"
            </div>
          )}
        </div>

        <div className="spotlight-footer">
          <span className="spotlight-hint"><kbd>↑↓</kbd> Điều hướng</span>
          <span className="spotlight-hint"><kbd>Enter</kbd> Chọn</span>
          <span className="spotlight-hint"><kbd>Esc</kbd> Đóng</span>
        </div>
      </div>
    </div>
  )
}
