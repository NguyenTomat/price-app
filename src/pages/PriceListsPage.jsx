import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { subscribePriceLists, subscribeProducts, subscribeInventory, updateProduct, updateProductImages, addProduct, deleteProduct, deletePriceList, reorderProducts, updatePriceList, ensureProductStorageUrls } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import ProductModal from '../components/ProductModal'
import MobileTableWrap from '../components/MobileTableWrap'
import QuickStockDrawer from '../components/QuickStockDrawer'

// ✅ Sửa lỗi định dạng số: đảm bảo parse đúng, tránh NaN hiển thị
const fmt = (n) => {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : Number(n)
  if (n == null || n === '' || isNaN(num)) return '—'
  return num.toLocaleString('vi-VN') + ' ₫'
}

export default function PriceListsPage({ spotlightTarget, clearSpotlightTarget }) {
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [lists, setLists] = useState([])
  const [listSearch, setListSearch] = useState('')
  const [selectedList, setSelectedList] = useState(null)
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', group: '', spec1: '', spec2: '', phiHocng: '', price: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Animation state for mobile horizontal swipe
  const [slideDir, setSlideDir] = useState('') // 'left' | 'right' | ''
  const [hasSwiped, setHasSwiped] = useState(() => {
    try { return localStorage.getItem('has_swiped_pl') === '1' } catch { return false }
  })

  // Rename bảng giá (admin)
  const [editingListId, setEditingListId] = useState(null)
  const [listNameDraft, setListNameDraft] = useState('')
  const [showStockDrawer, setShowStockDrawer] = useState(false)
  const touchRef = useRef(null)

  // Shortcut F2 or Ctrl+K to toggle Quick Stock Drawer
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setShowStockDrawer(s => !s)
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const selectList = useCallback((l) => {
    setSelectedList(l)
    setSearch('')
    setGroupFilter('')
    setStockFilter('')
  }, [])

  // Realtime price lists
  useEffect(() => {
    const unsub = subscribePriceLists((fetchedLists) => {
      setLists(fetchedLists)
      // On desktop only: auto select first list if none selected
      if (!window.matchMedia('(max-width: 768px)').matches) {
        setSelectedList(prev => prev || fetchedLists[0] || null)
      }
    })
    return unsub
  }, [])

  // Realtime inventory data for side-by-side matching
  useEffect(() => {
    const unsub = subscribeInventory(setInventory)
    return unsub
  }, [])

  // Kiểm tra từ khóa kỹ thuật / rác / thông số điện áp công suất không được làm mã model
  const isSpecOrNoise = useCallback((key) => {
    if (!key || key.length < 3) return true
    if (/^(?:\d+(?:[.,]\d+)?(?:kw|hp|w|v|m|a|uf|pha|f)|220v|380v|1pha|3pha|220380v|khongphao|cophao|tudong|phukien|buong|bom|tangap|chim|truc|than|vo|phot|sao|phao|buly|kho\d+|selanni|ewara|sumoto|peroni|showfou|upti|toanphat|howaki)$/i.test(key)) {
      return true
    }
    if (/^\d+$/.test(key) || /^[a-z]\d+$/i.test(key)) return true
    return false
  }, [])

  // Phân biệt mặt hàng phụ kiện (phớt, cánh, sáo, phao...) với máy bơm nguyên chiếc
  const isSparePart = useCallback((str) => {
    if (!str) return false
    return /^(?:K\d+-)?(?:PK|Phụ kiện|Phớt|Cánh|Sáo|Phao|Nắp|Vỏ|Ốp)\b/i.test(str) || /[-_\s](?:phớt|cánh|sáo|phao|nắp|vỏ|ốp)\b/i.test(str)
  }, [])

  // Chuẩn hóa mã model sản phẩm SIÊU CHÍNH XÁC (tự động loại bỏ tiền tố kho K4-U..., cắt đuôi kW/V/ghi chú, xử lý alias mã cũ/mã mới)
  const normalizeModel = useCallback((raw) => {
    if (!raw) return []
    const str = String(raw).trim()
    if (!str) return []
    const keys = new Set()

    const addClean = (s) => {
      if (!s) return
      const c = String(s).toLowerCase().replace(/[\s\-_/.,()]/g, '')
      if (c.length >= 3 && !isSpecOrNoise(c)) {
        keys.add(c)
      }
    }

    // 1. Cắt tiền tố kho & thương hiệu (K4-SI3..., K4-T1..., K4-SL..., K4-SM..., K4-U..., K4-PK..., K1-, K2-, KVP-...)
    const cleanPrefix = (s) => {
      return s
        .replace(/^K\d+[-_\s]+[A-Za-z0-9]+[-_\s]+/i, '')
        .replace(/^(?:K\d+|KVP)[-_]/i, '')
        .replace(/^(?:U|S|PK|SL|T\d|SI\d|SB\d|Ho|E|Tu)(?=[A-Za-z0-9])/i, '')
        .replace(/^[-_\s]+/g, '')
        .trim()
    }

    // 2. Cắt bỏ đuôi thông số kỹ thuật (kW, HP, 220V, 380V, 1 pha, phao, tự động...)
    const stripTailSpecs = (s) => {
      let t = String(s).trim()
      t = t.replace(/[-_\s/]+(khong phao|không phao|co phao|có phao|tu dong|tự động)\b/gi, '')
      t = t.replace(/[-_\s/]+(220v|380v|220\/380v|1pha|3pha|3f-\d+v\/p)\b.*$/gi, '')
      t = t.replace(/[-_\s/]+\d+([.,]\d+)?\s*(kw|hp|w)\b.*$/gi, '')
      t = t.replace(/[-_\s/]+$/g, '').trim()
      return t
    }

    const noPrefix = cleanPrefix(str)
    const coreBase = stripTailSpecs(noPrefix)

    addClean(coreBase)
    addClean(stripTailSpecs(str))

    // 3. Nhận diện chú thích Mã Cũ / Mã Mới (ví dụ: "CM4-60... mã cũ CF" -> sinh alias "CF4-60")
    const matchOldCode = str.match(/(?:mã cũ|ma cu|mã mới|ma moi)[\s:]+([A-Za-z0-9]+)/i)
    if (matchOldCode && matchOldCode[1]) {
      const oldPrefix = matchOldCode[1].trim()
      const replaced = coreBase.replace(/^[A-Za-z]+(?=\d)/i, oldPrefix)
      if (replaced && replaced !== coreBase) {
        addClean(replaced)
      }
    }

    // 4. Mở rộng biến thể mã kép (F/T -> F và T, MA/T -> MA và T)
    if (coreBase.includes('/')) {
      const withF = coreBase.replace(/F\/T/i, 'F').replace(/MA\/T/i, 'MA')
      const withT = coreBase.replace(/F\/T/i, 'T').replace(/MA\/T/i, 'T')
      if (withF !== coreBase) addClean(stripTailSpecs(withF))
      if (withT !== coreBase) addClean(stripTailSpecs(withT))
    }

    // 5. Bỏ tiền tố SL đầu mã dạng SL8SP95-4 -> 8SP95-4
    const noSl = coreBase.replace(/^SL(?=\d)/i, '').trim()
    if (noSl && noSl !== coreBase) addClean(noSl)

    // 6. Bóc tách các mã model chuẩn (có chữ cái và chữ số) từ chuỗi tên (như CDLF32-120)
    const modelMatches = str.match(/[A-Za-z]{2,8}[-_]?\d+[-_]?(?:\d+|[A-Za-z0-9]+)*/g)
    if (modelMatches) {
      for (const m of modelMatches) {
        const c = cleanPrefix(stripTailSpecs(m))
        addClean(c)
      }
    }

    return Array.from(keys)
  }, [isSpecOrNoise])

  // Dual fast lookup maps: Main machines map & Spare parts map
  const { mainMap, spareMap } = useMemo(() => {
    const main = new Map()
    const spare = new Map()

    inventory.forEach(item => {
      const itemSpare = isSparePart(item.id) || isSparePart(item.productName)
      const itemKeys = new Set([
        ...normalizeModel(item.id),
        ...normalizeModel(item.productId),
        ...normalizeModel(item.code),
        ...normalizeModel(item.productName),
        ...normalizeModel(item.name),
      ])

      itemKeys.forEach(k => {
        if (itemSpare) {
          if (!spare.has(k)) spare.set(k, item)
        } else {
          if (!main.has(k)) main.set(k, item)
        }
      })
    })

    return { mainMap: main, spareMap: spare }
  }, [inventory, normalizeModel, isSparePart])

  // Get stock info for a product with strict exact model matching
  const getStockInfo = useCallback((product) => {
    if (!product) return null

    const pSpare = isSparePart(product.name)
    const targetMap = pSpare ? spareMap : mainMap

    // 1. Direct ID check
    if (product.id) {
      const idClean = product.id.toLowerCase().replace(/[\s\-_/.,()]/g, '')
      if (targetMap.has(idClean)) return targetMap.get(idClean)
    }

    // 2. Exact Model Keys check
    const pKeys = [
      ...normalizeModel(product.name),
      ...normalizeModel(product.code),
    ]

    for (const k of pKeys) {
      if (targetMap.has(k)) {
        return targetMap.get(k)
      }
    }

    return null
  }, [mainMap, spareMap, normalizeModel, isSparePart])

  // Filtered price lists in sidebar & mobile selector
  const filteredLists = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return lists
    return lists.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q)
    )
  }, [lists, listSearch])

  // Current index in price lists
  const currentIdx = useMemo(() => {
    if (!selectedList || !lists.length) return -1
    return lists.findIndex(l => l.id === selectedList.id)
  }, [lists, selectedList])

  // Realtime products for selected list
  useEffect(() => {
    if (!selectedList) return
    setLoadingList(true)
    setProducts([])
    const unsub = subscribeProducts(selectedList.id, (prods) => {
      setProducts(prods)
      setLoadingList(false)
    })
    return () => { unsub(); setLoadingList(false) }
  }, [selectedList?.id])

  // Handle spotlight navigation — auto-open a product
  useEffect(() => {
    if (!spotlightTarget || !products.length) return
    const found = products.find(p => p.id === spotlightTarget.id)
    if (found) {
      setSelectedProduct(found)
      clearSpotlightTarget?.()
    }
  }, [spotlightTarget, products])

  // Auto-select the list that spotlight target belongs to
  useEffect(() => {
    if (!spotlightTarget?.listId || !lists.length) return
    const list = lists.find(l => l.id === spotlightTarget.listId)
    if (list && list.id !== selectedList?.id) setSelectedList(list)
  }, [spotlightTarget, lists])

  const groups = useMemo(() =>
    [...new Set(products.map(p => p.group).filter(Boolean))], [products])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      if (groupFilter && p.group !== groupFilter) return false
      if (stockFilter) {
        const s = getStockInfo(p)
        const qty = s?.qty ?? 0
        if (stockFilter === 'in-stock' && qty <= 0) return false
        if (stockFilter === 'low-stock' && (qty <= 0 || qty > 5)) return false
        if (stockFilter === 'out-of-stock' && qty > 0) return false
      }
      if (!q) return true
      return (p.name || '').toLowerCase().includes(q) ||
             (p.group || '').toLowerCase().includes(q) ||
             (p.spec2 || '').toLowerCase().includes(q)
    })
  }, [products, search, groupFilter, stockFilter, getStockInfo])

  const rows = useMemo(() => {
    if (groupFilter || search) return filtered.map(p => ({ type: 'product', data: p }))
    const out = []
    let lastGroup = null
    for (const p of filtered) {
      if (p.group !== lastGroup) {
        out.push({ type: 'group', label: p.group })
        lastGroup = p.group
      }
      out.push({ type: 'product', data: p })
    }
    return out
  }, [filtered, groupFilter, search])

  // Swipe gesture for mobile price list switching
  const handleTouchStart = (e) => {
    if (!isMobile || !selectedList) return
    const target = e.target
    // Ignore swipe if touching inside inputs, buttons, select, or modals
    if (target.closest('input, select, textarea, button, .modal, .modal-backdrop')) {
      touchRef.current = null
      return
    }
    touchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    }
  }

  const handleTouchEnd = (e) => {
    if (!touchRef.current || !isMobile || !selectedList || lists.length <= 1) return
    const t = touchRef.current
    touchRef.current = null

    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    const dt = Date.now() - t.time

    // Require distinct horizontal swipe (>65px, horizontal > 1.4* vertical, within 600ms)
    if (Math.abs(dx) > 65 && Math.abs(dx) > 1.4 * Math.abs(dy) && dt < 600) {
      if (dx < 0) {
        // Swipe Left -> Next list
        if (currentIdx >= 0 && currentIdx < lists.length - 1) {
          const nextList = lists[currentIdx + 1]
          setSlideDir('left')
          selectList(nextList)
          if (!hasSwiped) {
            setHasSwiped(true)
            try { localStorage.setItem('has_swiped_pl', '1') } catch {}
          }
          setTimeout(() => setSlideDir(''), 260)
        }
      } else {
        // Swipe Right -> Prev list
        if (currentIdx > 0) {
          const prevList = lists[currentIdx - 1]
          setSlideDir('right')
          selectList(prevList)
          if (!hasSwiped) {
            setHasSwiped(true)
            try { localStorage.setItem('has_swiped_pl', '1') } catch {}
          }
          setTimeout(() => setSlideDir(''), 260)
        }
      }
    }
  }

  const handleSaveProduct = async (updated) => {
    try {
      const finalImages = await ensureProductStorageUrls(updated.images || [], selectedList.id, updated.id)
      const cleanProduct = { ...updated, images: finalImages }
      if (isAdmin) {
        await updateProduct(selectedList.id, updated.id, cleanProduct)
      } else {
        await updateProductImages(selectedList.id, updated.id, finalImages)
      }
      setSelectedProduct(null)
      toast(isAdmin ? 'Đã lưu sản phẩm' : 'Đã lưu ảnh', 'success')
    } catch (err) {
      console.error(err)
      toast('Lỗi lưu sản phẩm: ' + err.message, 'error')
    }
  }

  const handleAddProduct = async () => {
    if (!addForm.name.trim()) { toast('Nhập tên sản phẩm', 'error'); return }
    const price = parseFloat(addForm.price) || 0
    if (!price) { toast('Nhập đơn giá', 'error'); return }
    setAddSaving(true)
    try {
      const groupName = addForm.group.trim() || (groups[0] ?? '')
      const newKw     = parseFloat(addForm.spec1) || null

      const sameGroup = products
        .filter(p => p.group === groupName)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      let insertAfterOrder = null
      if (newKw !== null) {
        for (const p of sameGroup) {
          const pkw = parseFloat(p.spec1) || null
          if (pkw === null || pkw <= newKw) {
            insertAfterOrder = p.order ?? 0
          } else {
            break
          }
        }
      } else {
        if (sameGroup.length > 0) {
          insertAfterOrder = sameGroup[sameGroup.length - 1].order ?? 0
        }
      }

      let newOrder
      if (insertAfterOrder === null && sameGroup.length === 0) {
        newOrder = products.length
      } else if (insertAfterOrder === null) {
        newOrder = sameGroup.length > 0 ? (sameGroup[0].order ?? 0) : products.length
      } else {
        newOrder = insertAfterOrder + 1
      }

      const toReorder = products
        .filter(p => (p.order ?? 0) >= newOrder)
        .map(p => ({ id: p.id, order: (p.order ?? 0) + 1 }))
      if (toReorder.length > 0) {
        await reorderProducts(selectedList.id, toReorder)
      }

      await addProduct(selectedList.id, {
        name: addForm.name.trim(),
        group: groupName,
        spec1: addForm.spec1.trim(),
        spec2: addForm.spec2.trim(),
        phiHocng: addForm.phiHocng.trim(),
        price,
        order: newOrder,
        images: [],
      })
      setAddForm({ name: '', group: '', spec1: '', spec2: '', phiHocng: '', price: '' })
      setShowAddForm(false)
      toast('Đã thêm sản phẩm', 'success')
    } catch (e) { toast('Lỗi: ' + e.message, 'error') }
    finally { setAddSaving(false) }
  }

  const handleDeleteProduct = async (product) => {
    if (!confirm(`Xóa sản phẩm "${product.name}"?`)) return
    try {
      await deleteProduct(selectedList.id, product.id)
      toast('Đã xóa sản phẩm', 'success')
    } catch { toast('Lỗi xóa sản phẩm', 'error') }
  }

  const handleDeleteList = async () => {
    if (!isAdmin || !selectedList) return
    if (!confirm(`Xóa bảng giá "${selectedList.name}" và toàn bộ sản phẩm? Hành động này không thể hoàn tác.`)) return
    try {
      await deletePriceList(selectedList.id)
      setSelectedList(null)
      setProducts([])
      toast('Đã xóa bảng giá', 'success')
    } catch { toast('Lỗi xóa bảng giá', 'error') }
  }

  const handleRenameList = async (id, newName) => {
    const trimmed = newName.trim()
    setEditingListId(null)
    if (!trimmed) return
    const old = lists.find(l => l.id === id)
    if (old && old.name === trimmed) return
    try {
      await updatePriceList(id, { name: trimmed })
      if (selectedList?.id === id) setSelectedList(l => ({ ...l, name: trimmed }))
      toast(`Đã đổi tên thành "${trimmed}"`, 'success')
    } catch { toast('Lỗi đổi tên', 'error') }
  }

  return (
    <div
      className="price-lists-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Scoped styles for Modern B2B Price Lists & Mobile Native Navigation */}
      <style>{`
        /* Desktop Workspace Layout */
        .pl-workspace-sidebar {
          width: 196px;
          min-width: 196px;
          border-right: 1px solid #EAECF0;
          background: #FFFFFF;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .pl-sidebar-header {
          padding: 12px 10px 8px;
          border-bottom: 1px solid #F1F5F9;
        }
        .pl-sidebar-title {
          font-size: 11px;
          font-weight: 700;
          color: #667085;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
          padding-left: 2px;
        }
        .pl-sidebar-search {
          width: 100%;
          box-sizing: border-box;
          height: 30px;
          padding: 4px 8px;
          font-size: 12px;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          background: #F8FAFC;
          color: #101828;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .pl-sidebar-search:focus {
          border-color: #2563EB;
          background: #FFFFFF;
        }
        .pl-sidebar-list {
          flex: 1;
          overflow-y: auto;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pl-nav-item {
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12.5px;
          font-weight: 500;
          color: #334155;
          transition: all 0.12s ease;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-left: 2.5px solid transparent;
        }
        .pl-nav-item:hover {
          background: #F8FAFC;
          color: #0F172A;
        }
        .pl-nav-item.active {
          background: #EFF6FF;
          color: #1D4ED8;
          font-weight: 600;
          border-left-color: #2563EB;
        }
        .pl-nav-item .pl-item-row {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
        }
        .pl-nav-item .pl-icon {
          font-size: 13px;
          opacity: 0.65;
          flex-shrink: 0;
        }
        .pl-nav-item.active .pl-icon {
          opacity: 0.9;
        }
        .pl-nav-item .pl-name {
          flex: 1;
          line-height: 1.35;
          word-break: break-word;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .pl-nav-item .pl-edit-btn {
          opacity: 0;
          padding: 2px 4px;
          font-size: 11px;
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 4px;
          color: #667085;
          transition: opacity 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .pl-nav-item:hover .pl-edit-btn {
          opacity: 0.8;
        }
        .pl-nav-item .pl-edit-btn:hover {
          opacity: 1;
          background: #E2E8F0;
          color: #0F172A;
        }
        .pl-nav-item .pl-cat-tag {
          font-size: 10.5px;
          color: #64748B;
          padding-left: 19px;
          font-weight: 400;
        }

        /* Main Content Header & Toolbar Hierarchy */
        .pl-header-container {
          background: #FFFFFF;
          border-bottom: 1px solid #EAECF0;
          padding: 12px 20px 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pl-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pl-header-title {
          font-size: 18px;
          font-weight: 650;
          color: #101828;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .pl-header-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #667085;
          margin-top: 2px;
        }
        .pl-header-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pl-control-h {
          height: 34px !important;
          box-sizing: border-box;
        }
        .pl-count-badge {
          height: 34px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          background: #F1F5F9;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #475467;
          white-space: nowrap;
        }
        .pl-primary-btn {
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          background: #2563EB;
          color: #FFFFFF;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .pl-primary-btn:hover {
          background: #1D4ED8;
        }
        .pl-del-list-btn {
          height: 34px;
          width: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          color: #667085;
          cursor: pointer;
          transition: all 0.12s;
        }
        .pl-del-list-btn:hover {
          background: #FEE2E2;
          border-color: #FECACA;
          color: #DC2626;
        }

        /* Desktop Data Table */
        .pl-table-container {
          flex: 1;
          overflow: auto;
          background: #FFFFFF;
        }
        .pl-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
        }
        .pl-table thead th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #F8FAFC;
          border-bottom: 1px solid #EAECF0;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 650;
          color: #667085;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .pl-table tbody tr {
          border-bottom: 1px solid #F1F5F9;
          height: 44px;
          background: #FFFFFF;
          cursor: pointer;
          transition: background-color 0.12s ease;
        }
        .pl-table tbody tr:hover {
          background-color: #F8FAFC;
        }
        .pl-table tbody td {
          padding: 8px 14px;
          vertical-align: middle;
        }
        .pl-table tbody tr.pl-group-divider {
          background: #F8FAFC !important;
          cursor: default;
          height: 34px;
          border-top: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
        }
        .pl-group-text {
          font-size: 11.5px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pl-model-name {
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 550;
          line-height: 20px;
          color: #1D2939;
          letter-spacing: 0.05px;
          transition: color 0.12s ease;
        }
        .pl-table tbody tr:hover .pl-model-name {
          color: #1D4ED8;
        }
        .pl-spec-text {
          font-size: 12px;
          color: #475467;
        }
        .pl-price-val {
          font-size: 13px;
          font-weight: 650;
          color: #101828;
          font-variant-numeric: tabular-nums;
          text-align: right;
        }
        .pl-img-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #F1F5F9;
          border: 1px solid #E2E8F0;
          font-size: 11px;
          font-weight: 600;
          color: #475467;
        }
        .pl-row-del-btn {
          opacity: 0.35;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: #DC2626;
          transition: opacity 0.15s, background 0.15s;
        }
        .pl-table tbody tr:hover .pl-row-del-btn {
          opacity: 0.8;
        }
        .pl-row-del-btn:hover {
          opacity: 1 !important;
          background: #FEE2E2;
        }

        /* ── MOBILE SPECIFIC STYLES ── */
        .pl-mobile-selector-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #F8FAFC;
          overflow-y: auto;
          min-width: 0;
          width: 100%;
        }
        .pl-mobile-selector-header {
          background: #FFFFFF;
          padding: 16px 16px 14px;
          border-bottom: 1px solid #EAECF0;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .pl-mobile-selector-list {
          padding: 12px 14px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pl-mobile-selector-item {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 14px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
          transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .pl-mobile-selector-item:active {
          transform: scale(0.985);
          background: #F8FAFC;
        }

        /* Mobile Detail View */
        .pl-mobile-detail-header {
          background: #FFFFFF;
          border-bottom: 1px solid #EAECF0;
          padding: 10px 14px;
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pl-mobile-top-bar {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pl-mobile-back-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #F1F5F9;
          border: 1px solid #E2E8F0;
          color: #1E293B;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          padding: 0;
        }
        .pl-mobile-back-btn:active {
          background: #E2E8F0;
        }
        .pl-mobile-title-wrap {
          flex: 1;
          min-width: 0;
        }
        .pl-mobile-header-title {
          font-size: 16px;
          font-weight: 700;
          color: #101828;
          line-height: 1.3;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pl-mobile-header-sub {
          font-size: 11.5px;
          color: #64748B;
          margin-top: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pl-mobile-page-indicator {
          font-size: 11.5px;
          font-weight: 600;
          color: #2563EB;
          background: #EFF6FF;
          padding: 3px 8px;
          border-radius: 100px;
          border: 1px solid #DBEAFE;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pl-mobile-controls-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Swipe Transition animations */
        @keyframes slideFromRight {
          0% { transform: translateX(35px); opacity: 0.6; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideFromLeft {
          0% { transform: translateX(-35px); opacity: 0.6; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .slide-left {
          animation: slideFromRight 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .slide-right {
          animation: slideFromLeft 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Mobile Product Card List */
        .pl-mobile-list {
          padding: 10px 12px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          overflow-y: auto;
          background: #F8FAFC;
        }
        .pl-mobile-group {
          padding: 8px 6px 4px;
          font-size: 11.5px;
          font-weight: 700;
          color: #475467;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pl-mobile-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
          cursor: pointer;
        }
        .pl-mobile-card:active {
          background: #F8FAFC;
          border-color: #CBD5E1;
        }
        .pl-mobile-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .pl-mobile-name {
          font-size: 13.5px;
          font-weight: 600;
          color: #1D2939;
          line-height: 1.35;
          word-break: break-word;
        }
        .pl-mobile-specs {
          font-size: 12px;
          color: #64748B;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          line-height: 1.4;
        }
        .pl-mobile-specs .spec-dot {
          color: #CBD5E1;
          font-weight: bold;
        }
        .pl-mobile-card-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px dashed #F1F5F9;
        }
        .pl-mobile-price {
          font-size: 14px;
          font-weight: 700;
          color: #101828;
          font-variant-numeric: tabular-nums;
          margin-left: auto;
        }

        .pl-stock-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
          white-space: nowrap;
          line-height: 1.25;
        }
        .pl-stock-badge.stock-good {
          background: #ECFDF5;
          color: #047857;
          border: 1px solid #A7F3D0;
        }
        .pl-stock-badge.stock-warn {
          background: #FFFBEB;
          color: #B45309;
          border: 1px solid #FDE68A;
        }
        .pl-stock-badge.stock-empty {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FECACA;
        }
        .pl-stock-badge.stock-none {
          background: transparent;
          color: #94A3B8;
          font-weight: 500;
        }

        .pl-swipe-hint {
          text-align: center;
          font-size: 11px;
          color: #94A3B8;
          padding: 4px 0 2px;
          user-select: none;
        }

        .pl-stock-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%);
          color: #FFFFFF;
          border: none;
          border-radius: 50px;
          padding: 10px 18px;
          font-size: 13.5px;
          font-weight: 650;
          box-shadow: 0 4px 16px rgba(29, 78, 216, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 999;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pl-stock-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(29, 78, 216, 0.55);
        }
        .pl-stock-fab:active {
          transform: translateY(0);
        }
        @media (max-width: 768px) {
          .pl-stock-fab {
            bottom: 76px;
            right: 16px;
            padding: 9px 15px;
            font-size: 12.5px;
          }
        }
      `}</style>

      {/* ── MOBILE VIEW ── */}
      {isMobile ? (
        !selectedList ? (
          /* Mobile Screen 1: "CHỌN BẢNG GIÁ" */
          <div className="pl-mobile-selector-screen">
            <div className="pl-mobile-selector-header">
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#101828' }}>Chọn Bảng Giá</h2>
              <div style={{ fontSize: 12, color: '#667085', marginTop: 2 }}>
                {lists.length} bảng giá hiện có
              </div>
              <div style={{ marginTop: 10 }}>
                <input
                  className="pl-sidebar-search"
                  style={{ height: 36, fontSize: 13, padding: '0 10px', borderRadius: 8 }}
                  placeholder="⌕ Tìm bảng giá..."
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="pl-mobile-selector-list">
              {filteredLists.map((l) => (
                <div
                  key={l.id}
                  className="pl-mobile-selector-item"
                  onClick={() => selectList(l)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#101828', lineHeight: 1.35 }}>
                        {l.name}
                      </div>
                      {l.category && (
                        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                          {l.category}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: '#94A3B8', fontWeight: 600, marginLeft: 8 }}>›</span>
                </div>
              ))}

              {filteredLists.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94A3B8', fontSize: 13 }}>
                  Không tìm thấy bảng giá nào
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mobile Screen 2: "PRICE LIST DETAIL SCREEN" */
          <div className="price-lists-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div className="pl-mobile-detail-header">
              <div className="pl-mobile-top-bar">
                <button
                  className="pl-mobile-back-btn"
                  onClick={() => setSelectedList(null)}
                  title="Quay lại danh sách bảng giá"
                >
                  ←
                </button>
                <div className="pl-mobile-title-wrap">
                  <h2 className="pl-mobile-header-title">{selectedList.name}</h2>
                  <div className="pl-mobile-header-sub">
                    {selectedList.category && <span className="tag" style={{ margin: 0, padding: '1px 6px', fontSize: 10.5 }}>{selectedList.category}</span>}
                    <span>{products.length} SP · 🔴 Realtime</span>
                  </div>
                </div>
                {lists.length > 1 && (
                  <div className="pl-mobile-page-indicator">
                    ‹ {currentIdx + 1}/{lists.length} ›
                  </div>
                )}
              </div>

              {/* Toolbar search & filter */}
              <div className="pl-mobile-controls-row">
                <div className="search-wrap" style={{ flex: 1 }}>
                  <span className="search-icon">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </span>
                  <input
                    className="input pl-control-h"
                    style={{ fontSize: 12.5, borderRadius: 6, width: '100%' }}
                    placeholder="Tìm sản phẩm..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="input select pl-control-h"
                  style={{ width: 120, fontSize: 12, borderRadius: 6 }}
                  value={groupFilter}
                  onChange={e => setGroupFilter(e.target.value)}
                >
                  <option value="">Tất cả nhóm</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>

                <select
                  className="input select pl-control-h"
                  style={{ width: 105, fontSize: 12, borderRadius: 6 }}
                  value={stockFilter}
                  onChange={e => setStockFilter(e.target.value)}
                >
                  <option value="">Tất cả kho</option>
                  <option value="in-stock">🟢 Còn hàng</option>
                  <option value="low-stock">🟡 Sắp hết</option>
                  <option value="out-of-stock">🔴 Hết hàng</option>
                </select>

                <button
                  className="btn sm"
                  onClick={() => setShowStockDrawer(true)}
                  style={{
                    padding: '0 8px',
                    height: 34,
                    fontSize: 12,
                    background: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1.5px solid #BFDBFE',
                    fontWeight: 650,
                    borderRadius: 6,
                    whiteSpace: 'nowrap'
                  }}
                  title="Tra cứu kho siêu tốc"
                >
                  📦 Kho
                </button>

                {isAdmin && (
                  <button
                    className="pl-primary-btn"
                    style={{ padding: '0 10px', height: 34, fontSize: 12 }}
                    onClick={() => { setShowAddForm(s => !s); setAddForm({ name: '', group: '', spec1: '', spec2: '', phiHocng: '', price: '' }) }}
                  >
                    {showAddForm ? '✕' : '+ SP'}
                  </button>
                )}
              </div>

              {!hasSwiped && lists.length > 1 && (
                <div className="pl-swipe-hint">
                  ← Vuốt sang trái/phải để đổi bảng giá →
                </div>
              )}
            </div>

            {/* Add product form */}
            {isAdmin && showAddForm && (
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #EAECF0', background: '#F8FAFC' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label" style={{ fontSize: 11.5 }}>Tên / Mã sản phẩm *</label>
                    <input className="input pl-control-h" placeholder="VD: MHI-202EA-220V-0.37KW"
                      value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}/>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label" style={{ fontSize: 11.5 }}>Nhóm (group)</label>
                    <input className="input pl-control-h" placeholder="VD: BƠM TĂNG ÁP"
                      value={addForm.group} onChange={e => setAddForm(f => ({ ...f, group: e.target.value }))}
                      list="group-list"/>
                    <datalist id="group-list">
                      {[...new Set(products.map(p => p.group).filter(Boolean))].map(g => <option key={g} value={g}/>)}
                    </datalist>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="field-label" style={{ fontSize: 11.5 }}>Công suất (kW)</label>
                      <input className="input pl-control-h" placeholder="VD: 0.37"
                        value={addForm.spec1} onChange={e => setAddForm(f => ({ ...f, spec1: e.target.value }))}/>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="field-label" style={{ fontSize: 11.5 }}>Phi họng (mm)</label>
                      <input className="input pl-control-h" placeholder="VD: 65"
                        value={addForm.phiHocng} onChange={e => setAddForm(f => ({ ...f, phiHocng: e.target.value }))}/>
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label" style={{ fontSize: 11.5 }}>Lưu lượng / Thông số</label>
                    <input className="input pl-control-h" placeholder="VD: Hmax 27m - Qmax 4.0"
                      value={addForm.spec2} onChange={e => setAddForm(f => ({ ...f, spec2: e.target.value }))}/>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field-label" style={{ fontSize: 11.5 }}>Đơn giá (₫) *</label>
                    <input className="input pl-control-h" type="number" min="0" placeholder="VD: 4000000"
                      value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}/>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm" style={{ height: 32 }} onClick={() => setShowAddForm(false)}>Hủy</button>
                  <button className="btn sm primary" style={{ height: 32 }} onClick={handleAddProduct} disabled={addSaving}>
                    {addSaving ? '...' : '✓ Lưu'}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Product Card List with swipe animation */}
            <div className={`pl-mobile-list ${slideDir ? `slide-${slideDir}` : ''}`}>
              {loadingList ? (
                <div className="empty" style={{ padding: '40px 0', textAlign: 'center' }}><span className="spinner"/></div>
              ) : (
                <>
                  {rows.map((row, i) =>
                    row.type === 'group' ? (
                      <div key={'g-' + i} className="pl-mobile-group">
                        <span>📁</span>
                        <span>{row.label}</span>
                      </div>
                    ) : (() => {
                      const stock = getStockInfo(row.data)
                      return (
                        <div
                          key={row.data.id}
                          className="pl-mobile-card"
                          onClick={() => setSelectedProduct(row.data)}
                        >
                          <div className="pl-mobile-card-top">
                            <div className="pl-mobile-name">{row.data.name || '—'}</div>
                            {isAdmin && (
                              <button
                                className="pl-row-del-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteProduct(row.data)
                                }}
                                title="Xóa sản phẩm"
                              >
                                🗑
                              </button>
                            )}
                          </div>

                          <div className="pl-mobile-specs">
                            {row.data.spec1 && <span>{row.data.spec1} kW</span>}
                            {row.data.spec1 && row.data.spec2 && <span className="spec-dot">·</span>}
                            {row.data.spec2 && <span>{row.data.spec2}</span>}
                            {(row.data.spec1 || row.data.spec2) && row.data.phiHocng && <span className="spec-dot">·</span>}
                            {row.data.phiHocng && <span>φ{row.data.phiHocng}</span>}
                          </div>

                          <div className="pl-mobile-card-bottom">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {stock != null && stock.qty != null ? (
                                <span className={`pl-stock-badge ${stock.qty > 5 ? 'stock-good' : stock.qty > 0 ? 'stock-warn' : 'stock-empty'}`}>
                                  {stock.qty > 0 ? `Tồn: ${stock.qty}` : 'Hết hàng'}
                                </span>
                              ) : null}
                              {row.data.images?.length > 0 && (
                                <span className="pl-img-badge">📷 {row.data.images.length}</span>
                              )}
                            </div>
                            <div className="pl-mobile-price">{fmt(row.data.price)}</div>
                          </div>
                        </div>
                      )
                    })()
                  )}

                  {rows.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 12px', color: '#94A3B8', fontSize: 13 }}>
                      Không tìm thấy sản phẩm
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      ) : (
        /* ── DESKTOP VIEW (100% UNCHANGED) ── */
        <>
          {/* Desktop Workspace Sidebar */}
          <div className="pl-workspace-sidebar">
            <div className="pl-sidebar-header">
              <div className="pl-sidebar-title">BẢNG GIÁ</div>
              <input
                className="pl-sidebar-search"
                placeholder="⌕ Tìm bảng giá..."
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
              />
            </div>

            <div className="pl-sidebar-list">
              {filteredLists.map(l => (
                <div
                  key={l.id}
                  onClick={() => { if (editingListId !== l.id) selectList(l) }}
                  className={`pl-nav-item ${selectedList?.id === l.id ? 'active' : ''}`}
                >
                  <div className="pl-item-row">
                    {editingListId === l.id ? (
                      <input
                        className="input"
                        style={{ flex: 1, padding: '2px 6px', fontSize: 12, height: 26 }}
                        value={listNameDraft}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setListNameDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameList(l.id, listNameDraft)
                          if (e.key === 'Escape') setEditingListId(null)
                        }}
                        onBlur={() => handleRenameList(l.id, listNameDraft)}
                      />
                    ) : (
                      <>
                        <span className="pl-icon">📄</span>
                        <span className="pl-name">{l.name}</span>
                        {isAdmin && (
                          <button
                            className="pl-edit-btn"
                            title="Đổi tên bảng giá"
                            onClick={e => { e.stopPropagation(); setEditingListId(l.id); setListNameDraft(l.name) }}
                          >✏️</button>
                        )}
                      </>
                    )}
                  </div>
                  {l.category && <div className="pl-cat-tag">{l.category}</div>}
                </div>
              ))}

              {filteredLists.length === 0 && (
                <div style={{ padding: '12px 8px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                  {listSearch ? 'Không có kết quả' : (isAdmin ? 'Chưa có bảng giá. Vào Import để tạo.' : 'Chưa có bảng giá.')}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Main Content Area */}
          <div className="price-lists-main">
            {!selectedList ? (
              <div className="empty" style={{ margin: 'auto', textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#101828', marginBottom: 4 }}>Chọn một bảng giá để xem</div>
                <div style={{ fontSize: 13, color: '#667085' }}>Chọn từ danh sách bảng giá ở thanh bên trái</div>
              </div>
            ) : (
              <>
                {/* Header & Toolbar */}
                <div className="pl-header-container">
                  <div className="pl-header-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 className="pl-header-title">{selectedList.name}</h2>
                      <div className="pl-header-meta">
                        {selectedList.category && <span className="tag" style={{ margin: 0, padding: '2px 8px', fontSize: 11 }}>{selectedList.category}</span>}
                        <span>{products.length} sản phẩm · Realtime 🔴</span>
                        {!isAdmin && <span>· Bấm SP để xem chi tiết & ảnh</span>}
                      </div>
                    </div>

                    <button
                      className="btn sm"
                      onClick={() => window.open('https://bang-gia-tandt.web.app/#web', '_blank')}
                      style={{
                        height: 32,
                        background: '#F8FAFC',
                        color: '#2563EB',
                        border: '1px solid #E2E8F0',
                        fontWeight: 600,
                        fontSize: 12,
                        borderRadius: 6
                      }}
                    >
                      🔗 Mở Web Catalog
                    </button>
                  </div>

                  <div className="pl-header-toolbar">
                    <div className="search-wrap" style={{ width: 220 }}>
                      <span className="search-icon">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      </span>
                      <input
                        className="input pl-control-h"
                        style={{ fontSize: 12.5, borderRadius: 6 }}
                        placeholder="Tìm sản phẩm..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>

                    <select
                      className="input select pl-control-h"
                      style={{ width: 155, fontSize: 12.5, borderRadius: 6 }}
                      value={groupFilter}
                      onChange={e => setGroupFilter(e.target.value)}
                    >
                      <option value="">Tất cả nhóm</option>
                      {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <select
                      className="input select pl-control-h"
                      style={{ width: 125, fontSize: 12.5, borderRadius: 6 }}
                      value={stockFilter}
                      onChange={e => setStockFilter(e.target.value)}
                    >
                      <option value="">Tất cả kho</option>
                      <option value="in-stock">🟢 Còn hàng</option>
                      <option value="low-stock">🟡 Sắp hết</option>
                      <option value="out-of-stock">🔴 Hết hàng</option>
                    </select>

                    <div className="pl-count-badge">
                      {filtered.length}/{products.length} SP
                    </div>

                    <button
                      className="btn sm"
                      onClick={() => setShowStockDrawer(true)}
                      style={{
                        height: 34,
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        border: '1.5px solid #BFDBFE',
                        fontWeight: 650,
                        fontSize: 12.5,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      title="Tra cứu kho siêu tốc (Phím tắt F2 hoặc Ctrl+K)"
                    >
                      <span>📦 Tra cứu kho</span>
                      <span style={{ fontSize: 10.5, background: '#DBEAFE', padding: '1px 5px', borderRadius: 4, color: '#1E40AF' }}>F2</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          className="pl-primary-btn"
                          onClick={() => { setShowAddForm(s => !s); setAddForm({ name: '', group: '', spec1: '', spec2: '', phiHocng: '', price: '' }) }}
                        >
                          {showAddForm ? '✕ Đóng form' : '+ Thêm SP'}
                        </button>
                        <button
                          className="pl-del-list-btn"
                          onClick={handleDeleteList}
                          title="Xóa bảng giá này"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Add product form */}
                {isAdmin && showAddForm && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid #EAECF0', background: '#F8FAFC' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div className="field" style={{ marginBottom: 0, gridColumn: '1 / span 2' }}>
                        <label className="field-label" style={{ fontSize: 11.5 }}>Tên / Mã sản phẩm *</label>
                        <input className="input pl-control-h" placeholder="VD: MHI-202EA-220V-0.37KW"
                          value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}/>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field-label" style={{ fontSize: 11.5 }}>Nhóm (group)</label>
                        <input className="input pl-control-h" placeholder="VD: BƠM TĂNG ÁP BIẾN TẦN"
                          value={addForm.group} onChange={e => setAddForm(f => ({ ...f, group: e.target.value }))}
                          list="group-list"/>
                        <datalist id="group-list">
                          {[...new Set(products.map(p => p.group).filter(Boolean))].map(g => <option key={g} value={g}/>)}
                        </datalist>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field-label" style={{ fontSize: 11.5 }}>Công suất (kW)</label>
                        <input className="input pl-control-h" placeholder="VD: 0.37"
                          value={addForm.spec1} onChange={e => setAddForm(f => ({ ...f, spec1: e.target.value }))}/>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field-label" style={{ fontSize: 11.5 }}>Lưu lượng / Thông số</label>
                        <input className="input pl-control-h" placeholder="VD: Hmax 27m - Qmax 4.0"
                          value={addForm.spec2} onChange={e => setAddForm(f => ({ ...f, spec2: e.target.value }))}/>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field-label" style={{ fontSize: 11.5 }}>Phi họng (mm)</label>
                        <input className="input pl-control-h" placeholder="VD: 65"
                          value={addForm.phiHocng} onChange={e => setAddForm(f => ({ ...f, phiHocng: e.target.value }))}/>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="field-label" style={{ fontSize: 11.5 }}>Đơn giá (₫) *</label>
                        <input className="input pl-control-h" type="number" min="0" placeholder="VD: 4000000"
                          value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}/>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn sm" style={{ height: 32 }} onClick={() => setShowAddForm(false)}>Hủy</button>
                      <button className="btn sm primary" style={{ height: 32 }} onClick={handleAddProduct} disabled={addSaving}>
                        {addSaving ? '...' : '✓ Lưu sản phẩm'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Desktop Sticky Data Table */}
                <div className="pl-table-container">
                  {loadingList ? (
                    <div className="empty" style={{ padding: '60px 0', textAlign: 'center' }}><span className="spinner"/></div>
                  ) : (
                    <MobileTableWrap>
                      <table className="pl-table">
                        <thead>
                          <tr>
                            <th style={{ width: '27%' }}>Tên / Mã sản phẩm</th>
                            <th style={{ width: '10%' }}>Công suất</th>
                            <th style={{ width: '23%' }}>Lưu lượng / Thông số</th>
                            <th style={{ width: '8%' }}>Phi họng</th>
                            <th style={{ width: '11%', textAlign: 'center' }}>Tồn kho</th>
                            <th style={{ width: '13%', textAlign: 'right' }}>Đơn giá</th>
                            <th style={{ width: '48px', textAlign: 'center' }}>Ảnh</th>
                            {isAdmin && <th style={{ width: '36px', textAlign: 'center' }}></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) =>
                            row.type === 'group' ? (
                              <tr key={'g-' + i} className="pl-group-divider">
                                <td colSpan={isAdmin ? 8 : 7} style={{ padding: '6px 14px' }}>
                                  <div className="pl-group-text">
                                    <span>📁</span>
                                    <span>{row.label}</span>
                                  </div>
                                </td>
                              </tr>
                            ) : (() => {
                              const stock = getStockInfo(row.data)
                              return (
                                <tr key={row.data.id} onClick={() => setSelectedProduct(row.data)}>
                                  <td>
                                    <span className="pl-model-name">{row.data.name || '—'}</span>
                                  </td>
                                  <td>
                                    <span className="pl-spec-text">{row.data.spec1 ? row.data.spec1 + ' kW' : '—'}</span>
                                  </td>
                                  <td>
                                    <span className="pl-spec-text">{row.data.spec2 || '—'}</span>
                                  </td>
                                  <td>
                                    <span className="pl-spec-text">{row.data.phiHocng ? 'φ' + row.data.phiHocng : '—'}</span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {stock != null && stock.qty != null ? (
                                      <span
                                        className={`pl-stock-badge ${stock.qty > 5 ? 'stock-good' : stock.qty > 0 ? 'stock-warn' : 'stock-empty'}`}
                                        title={`Tồn kho thực tế: ${stock.qty} ${stock.unit || 'cái'}`}
                                      >
                                        {stock.qty > 0 ? `${stock.qty} ${stock.unit || ''}`.trim() : 'Hết hàng'}
                                      </span>
                                    ) : (
                                      <span className="pl-stock-badge stock-none" title="Chưa có dữ liệu tồn kho">—</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <span className="pl-price-val">{fmt(row.data.price)}</span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {(row.data.images?.length > 0) ? (
                                      <span className="pl-img-badge">📷 {row.data.images.length}</span>
                                    ) : (
                                      <span style={{ color: '#CBD5E1' }}>—</span>
                                    )}
                                  </td>
                                  {isAdmin && (
                                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '4px' }}>
                                      <button
                                        className="pl-row-del-btn"
                                        onClick={() => handleDeleteProduct(row.data)}
                                        title="Xóa sản phẩm"
                                      >
                                        🗑
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              )
                            })()
                          )}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
                                Không tìm thấy sản phẩm
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </MobileTableWrap>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          stock={selectedProduct ? getStockInfo(selectedProduct) : null}
          onClose={() => setSelectedProduct(null)}
          onSave={handleSaveProduct}
          readOnly={false}
        />
      )}

      {/* Floating Action Button for Instant Stock Lookup */}
      <button
        className="pl-stock-fab"
        onClick={() => setShowStockDrawer(true)}
        title="Tra cứu kho siêu tốc (Phím tắt F2 hoặc Ctrl+K)"
      >
        <span>📦 Tra kho</span>
        <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.22)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
          F2
        </span>
      </button>

      {/* Quick Stock Drawer */}
      <QuickStockDrawer
        isOpen={showStockDrawer}
        onClose={() => setShowStockDrawer(false)}
      />
    </div>
  )
}
