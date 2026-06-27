import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import PriceListsPage from './pages/PriceListsPage'
import MyPricesPage from './pages/MyPricesPage'
import AdminImportPage from './pages/AdminImportPage'
import AdminUsersPage from './pages/AdminUsersPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import CostPricesPage from './pages/CostPricesPage'
import InventoryPage from './pages/InventoryPage'
import CatalogPage from './pages/CatalogPage'
import Spotlight from './components/Spotlight'
import UpdateBanner from './components/UpdateBanner'
import { getPriceLists, getProducts } from './firebase/firebase'
import './index.css'

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [allProducts, setAllProducts] = useState([])
  // extra = product to auto-open from spotlight
  const [spotlightTarget, setSpotlightTarget] = useState(null)

  // Load all products for spotlight search (runs once after login)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const lists = await getPriceLists()
        const chunks = await Promise.all(lists.map(l => getProducts(l.id).then(ps => ps.map(p => ({ ...p, listId: l.id, listName: l.name })))))
        if (!cancelled) setAllProducts(chunks.flat())
      } catch {}
    })()
    return () => { cancelled = true }
  }, [user])

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSpotlightOpen(s => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSpotlightNavigate = useCallback((p, extra) => {
    setPage(p)
    if (extra) setSpotlightTarget(extra)
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}/>
          <div style={{ marginTop: 14, color: 'var(--text2)', fontSize: 14 }}>Đang tải...</div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage/>

  const pageMap = {
    'dashboard':    <DashboardPage setPage={setPage}/>,
    'lists':        <PriceListsPage spotlightTarget={spotlightTarget} clearSpotlightTarget={() => setSpotlightTarget(null)}/>,
    'my-prices':    <MyPricesPage/>,
    'orders':       <OrdersPage/>,
    'cost-prices':  <CostPricesPage/>,
    'inventory':    <InventoryPage/>,
    'catalog':      <CatalogPage/>,
    'admin-import': <AdminImportPage/>,
    'admin-users':  <AdminUsersPage/>,
  }

  return (
    <>
      <Layout page={page} setPage={setPage} onSpotlight={() => setSpotlightOpen(true)}>
        {pageMap[page] || <DashboardPage setPage={setPage}/>}
      </Layout>

      {spotlightOpen && (
        <Spotlight
          allProducts={allProducts}
          onNavigate={handleSpotlightNavigate}
          onClose={() => setSpotlightOpen(false)}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent/>
          <UpdateBanner/>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
