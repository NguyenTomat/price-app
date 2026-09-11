import React, { StrictMode, useState, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import WebCatalog from './pages/WebCatalog.jsx'
import PwaUpdateBanner from './components/PwaUpdateBanner.jsx'
const App = lazy(() => import('./App.jsx'))

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error in application:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAFC',
          padding: '24px',
          fontFamily: "'Inter', system-ui, sans-serif"
        }}>
          <div style={{
            maxWidth: 480,
            background: '#FFFFFF',
            borderRadius: 16,
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              Đã xảy ra lỗi khi tải trang
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 24 }}>
              Hệ thống đã tự động ghi nhận. Vui lòng bấm nút bên dưới để tải lại dữ liệu mới nhất.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('tt_web_products_cache')
                  } catch {}
                  window.location.hash = '#web'
                  window.location.reload()
                }}
                style={{
                  background: '#0878D9',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '11px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔄 Tải lại trang chủ
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const APP_HASH_PREFIXES = ['#app', '#login', '#dashboard', '#prices', '#orders', '#cost', '#inventory', '#admin', '#bus', '#revenue', '#manage', '#catalog']
const WEB_HASH_PREFIXES = ['#web', '#products', '#applications', '#brands', '#about', '#contact', '#policy', '#intro']

function isWebRoute(hash) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isCustomWebDomain = hostname.includes('maybomtandt.com.vn')

  if (isCustomWebDomain) {
    // Trên tên miền maybomtandt.com.vn: Mặc định vào Website, trừ khi có hash #app
    const isAppExplicit = APP_HASH_PREFIXES.some(prefix => hash.startsWith(prefix))
    return !isAppExplicit
  } else {
    // Trên app điện thoại / bang-gia-tandt.web.app: Mặc định vào App Bảng Giá, trừ khi có hash #web
    const isWebExplicit = WEB_HASH_PREFIXES.some(prefix => hash.startsWith(prefix))
    return isWebExplicit
  }
}

function RootRouter() {
  const [isWeb, setIsWeb] = useState(() => {
    return isWebRoute(typeof window !== 'undefined' ? window.location.hash : '')
  })

  useEffect(() => {
    const handleHashChange = () => {
      setIsWeb(isWebRoute(window.location.hash))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <>
      <PwaUpdateBanner />
      {isWeb ? (
        <WebCatalog />
      ) : (
        <Suspense fallback={
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: '#0878D9', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>Đang nạp Bảng Giá T&T...</div>
            </div>
          </div>
        }>
          <App />
        </Suspense>
      )}
    </>
  )
}

const rootEl = document.getElementById('root')
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <RootRouter />
    </ErrorBoundary>
  </StrictMode>
)
