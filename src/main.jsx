import React, { StrictMode, useState, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

const App = lazy(() => import('./App.jsx'))
const WebCatalog = lazy(() => import('./pages/WebCatalog.jsx'))

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

const WEB_HASH_PREFIXES = ['#web', '#home', '#products', '#applications', '#brands', '#about', '#contact', '#policy', '#catalog', '#intro']

function isWebRoute(hash) {
  if (!hash) return false
  return WEB_HASH_PREFIXES.some(prefix => hash.startsWith(prefix))
}

function RootRouter() {
  const [isWeb, setIsWeb] = useState(() => {
    return typeof window !== 'undefined' && (isWebRoute(window.location.hash) || window.location.hash.startsWith('#web'))
  })

  useEffect(() => {
    const handleHashChange = () => {
      setIsWeb(isWebRoute(window.location.hash) || window.location.hash.startsWith('#web'))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: '#0878D9', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>Đang nạp Máy Bơm T&T...</div>
        </div>
      </div>
    }>
      {isWeb ? <WebCatalog /> : <App />}
    </Suspense>
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
