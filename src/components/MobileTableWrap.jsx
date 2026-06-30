import { useRef, useEffect, useCallback } from 'react'

/** Bọc bảng — trên mobile chuyển sang dạng thẻ, không cắt chữ dài */
export default function MobileTableWrap({ children, className = '', style }) {
  const ref = useRef(null)

  const enhance = useCallback(() => {
    const wrap = ref.current
    if (!wrap) return
    const mobile = window.matchMedia('(max-width: 768px)').matches
    wrap.classList.toggle('table-mobile-cards', mobile)

    const table = wrap.querySelector('table')
    if (!table || !mobile) return

    const headers = [...table.querySelectorAll('thead th')].map(th =>
      th.textContent.replace(/\s+/g, ' ').trim()
    )

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = [...tr.querySelectorAll('td')]
      const firstTd = cells[0]
      const isGroup =
        tr.classList.contains('group-row') ||
        (firstTd && firstTd.colSpan > 1)
      tr.classList.toggle('table-card-group', isGroup)

      cells.forEach(td => td.classList.remove('table-card-title'))

      if (!isGroup) {
        const firstData = cells.find(td => td.colSpan <= 1)
        if (firstData) firstData.classList.add('table-card-title')
      }

      cells.forEach((td, i) => {
        if (td.colSpan > 1) {
          td.removeAttribute('data-label')
          return
        }
        const label = headers[i] || ''
        if (label) td.dataset.label = label
        else td.removeAttribute('data-label')
        td.style.removeProperty('max-width')
        td.style.removeProperty('overflow')
        td.style.removeProperty('text-overflow')
        td.style.removeProperty('white-space')
      })
    })
  }, [])

  useEffect(() => {
    const wrap = ref.current
    if (!wrap) return

    enhance()
    window.addEventListener('resize', enhance)

    const mo = new MutationObserver(() => enhance())
    mo.observe(wrap, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', enhance)
      mo.disconnect()
    }
  }, [children, enhance])

  return (
    <div ref={ref} className={`table-wrap ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}
