import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Render modal ra body — tránh bị .main overflow cắt trên mobile */
export default function ModalPortal({ children, lockScroll = true }) {
  useEffect(() => {
    if (!lockScroll) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [lockScroll])

  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
