import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import WebCatalog from './pages/WebCatalog.jsx'

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

  return isWeb ? <WebCatalog /> : <App />
}

const rootEl = document.getElementById('root')
createRoot(rootEl).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>
)
