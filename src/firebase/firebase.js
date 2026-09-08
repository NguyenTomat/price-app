import { initializeApp, getApps, deleteApp } from 'firebase/app'
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
} from 'firebase/auth'
import {
  getFirestore, collection, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  writeBatch, onSnapshot, query, orderBy, where, limit, Timestamp
} from 'firebase/firestore'
export { Timestamp }
import {
  getStorage, ref, uploadString, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata
} from 'firebase/storage'
import { sanitizeFirestoreId } from '../utils/excelParse'

// ── CONFIG ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCF8mukNn5WeuysfCdAP_An8C-6fyE8Pas",
  authDomain: "bang-gia-tandt.firebaseapp.com",
  projectId: "bang-gia-tandt",
  storageBucket: "bang-gia-tandt.firebasestorage.app",
  messagingSenderId: "366056284899",
  appId: "1:366056284899:web:ce85f213aeac6a23a79bd6",
}

const app = initializeApp(firebaseConfig)
export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)
storage.maxUploadRetryTime = 2500 // fail fast after 2.5 seconds on upload CORS/network errors
storage.maxOperationRetryTime = 2500 // fail fast on other storage operations

// ── AUTH ───────────────────────────────────────────────────────────────────
export const login  = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const logout = () => signOut(auth)
export const onAuth = (cb) => onAuthStateChanged(auth, cb)

// ── USER PROFILE ───────────────────────────────────────────────────────────
export const getUserProfile = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (e) {
    console.warn('getUserProfile failed:', e.code)
    return null
  }
}
export const setUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid), data, { merge: true })

// ── PRICE LISTS — realtime ─────────────────────────────────────────────────
// Returns unsubscribe function. Calls cb(lists[]) on every change.
export const subscribePriceLists = (cb) => {
  const q = collection(db, 'priceLists')
  return onSnapshot(q, (snap) => {
    const lists = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.id !== 'categories_settings')
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0
        const tb = b.createdAt?.toMillis?.() ?? 0
        return tb - ta
      })
    cb(lists)
  }, (err) => console.error('subscribePriceLists error:', err))
}

// One-time fetch (for pages that don't need realtime)
export const getPriceLists = async () => {
  const snap = await getDocs(collection(db, 'priceLists'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => d.id !== 'categories_settings')
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export const createPriceList = (data) =>
  addDoc(collection(db, 'priceLists'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
export const updatePriceList = (id, data) =>
  updateDoc(doc(db, 'priceLists', id), { ...data, updatedAt: serverTimestamp() })
export const deletePriceList = (id) =>
  deleteDoc(doc(db, 'priceLists', id))

// ── PRODUCTS — realtime ────────────────────────────────────────────────────
// Subscribe to products of a price list. Calls cb(products[]) on change.
export const subscribeProducts = (listId, cb) => {
  const q = collection(db, 'priceLists', listId, 'products')
  return onSnapshot(q, (snap) => {
    const products = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    cb(products)
  }, (err) => console.error('subscribeProducts error:', err))
}

export const getProducts = async (listId) => {
  const snap = await getDocs(collection(db, 'priceLists', listId, 'products'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export const saveProducts = async (listId, products) => {
  const colRef = collection(db, 'priceLists', listId, 'products')
  const BATCH  = 400
  const existing = await getDocs(colRef)
  for (let i = 0; i < existing.docs.length; i += BATCH) {
    const batch = writeBatch(db)
    existing.docs.slice(i, i + BATCH).forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = writeBatch(db)
    products.slice(i, i + BATCH).forEach((p, j) => {
      batch.set(doc(colRef), { ...p, order: i + j })
    })
    await batch.commit()
  }
}

// Batch-update the `order` field for a list of products (used when inserting a new product mid-group)
// updates: [{ id, order }]
export const reorderProducts = async (listId, updates) => {
  const BATCH = 400
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db)
    updates.slice(i, i + BATCH).forEach(({ id, order }) => {
      batch.update(doc(db, 'priceLists', listId, 'products', id), { order })
    })
    await batch.commit()
  }
}

export const getProductDetail = async (listId, productId) => {
  const snap = await getDoc(doc(db, 'priceLists', listId, 'products', productId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const addProduct = (listId, data) => {
  const { id: _id, ...rest } = data
  return addDoc(collection(db, 'priceLists', listId, 'products'), rest)
}

export const deleteProduct = (listId, productId) =>
  deleteDoc(doc(db, 'priceLists', listId, 'products', productId))

export const updateProduct = (listId, productId, data) => {
  const { id: _id, ...rest } = data
  return updateDoc(doc(db, 'priceLists', listId, 'products', productId), rest)
}

export const updateProductImages = (listId, productId, images) =>
  updateDoc(doc(db, 'priceLists', listId, 'products', productId), { images: images || [] })

// Load ALL products from ALL price lists — used in order form for "giá bảng giá" picker
// Returns flat array: [{ id, listId, listName, name, group, spec1, price, ... }]
export const getAllProductsFlat = async () => {
  const lists = await getPriceLists()
  const chunks = await Promise.all(
    lists.map(l =>
      getProducts(l.id).then(ps =>
        ps.map(p => ({ ...p, listId: l.id, listName: l.name }))
      )
    )
  )
  return chunks.flat()
}

// Lấy danh sách sản phẩm đăng lên Web Catalog công cộng
export const getWebCatalogProducts = async () => {
  const lists = await getPriceLists()
  const chunks = await Promise.all(
    lists.map(l =>
      getProducts(l.id).then(ps =>
        ps.filter(p => p.showOnWeb === true).map(p => ({ ...p, listId: l.id, listName: l.name }))
      )
    )
  )
  return chunks.flat()
}

const dataUrlToBlob = (dataUrl) => {
  try {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  } catch (err) {
    console.error("dataUrlToBlob failed:", err)
    return null
  }
}

export const ensureProductStorageUrls = async (images, listId, productId) => {
  const result = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (typeof img === 'string' && img.startsWith('data:')) {
      const blob = dataUrlToBlob(img)
      if (blob) {
        try {
          const url = await uploadProductImageFile(listId, productId, blob, 'jpg', i)
          result.push(url)
        } catch (uploadErr) {
          console.warn("Storage upload failed, keeping base64 in document:", uploadErr)
          result.push(img) // Fallback to base64
        }
      } else {
        result.push(img)
      }
    } else {
      result.push(img)
    }
  }
  return result
}

// ── USER PRICE LISTS ───────────────────────────────────────────────────────
export const getUserPriceLists = async (uid) => {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'myPriceLists'))
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.savedAt?.toMillis?.() ?? 0) - (a.savedAt?.toMillis?.() ?? 0))
  } catch { return [] }
}
export const saveUserPriceList = (uid, data) =>
  addDoc(collection(db, 'users', uid, 'myPriceLists'), { ...data, savedAt: serverTimestamp() })
export const updateUserPriceList = (uid, id, data) =>
  updateDoc(doc(db, 'users', uid, 'myPriceLists', id), data)
export const deleteUserPriceList = (uid, id) =>
  deleteDoc(doc(db, 'users', uid, 'myPriceLists', id))

// ── CREATE USER (Admin) ────────────────────────────────────────────────────
export const adminCreateUser = async (email, password, profileData) => {
  const SECONDARY = 'secondary-auth-' + Date.now()
  let secondaryApp
  try {
    secondaryApp = initializeApp(firebaseConfig, SECONDARY)
    const secondaryAuth = getAuth(secondaryApp)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid  = cred.user.uid
    await signOut(secondaryAuth)
    await setDoc(doc(db, 'users', uid), { email, ...profileData, createdAt: new Date().toISOString() })
    return uid
  } finally {
    if (secondaryApp) await deleteApp(secondaryApp).catch(() => {})
  }
}

// ── STORAGE ────────────────────────────────────────────────────────────────
export const uploadProductImageFile = async (listId, productId, blob, extension, index) => {
  // WORKAROUND: Uploading to catalogs/ folder instead of products/ just in case Storage rules block products/ path
  const imgRef = ref(storage, `catalogs/products_${listId}_${productId}_img_${index}_${Date.now()}.${extension}`)
  const snap = await uploadBytes(imgRef, blob)
  return getDownloadURL(snap.ref)
}
export const uploadWebCategoryImage = async (blob, extension = 'jpg') => {
  const imgRef = ref(storage, `catalogs/category_${Date.now()}.${extension}`)
  const snap = await uploadBytes(imgRef, blob)
  return getDownloadURL(snap.ref)
}
export const uploadImage = async (listId, productId, base64Data, index) => {
  const imgRef = ref(storage, `products/${listId}/${productId}/img_${index}.jpg`)
  await uploadString(imgRef, base64Data, 'data_url')
  return getDownloadURL(imgRef)
}
export const deleteImage = async (url) => {
  try { await deleteObject(ref(storage, url)) } catch {}
}

// ── ORDERS ─────────────────────────────────────────────────────────────────
// Collection: orders/{orderId}
// { uid, userName, items:[{productId,name,qty,price,myPrice}], total, status, note, createdAt, updatedAt }

export const subscribeOrders = (cb, filters = {}) => {
  const q = collection(db, 'orders')
  return onSnapshot(q, (snap) => {
    let orders = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    // Luôn lọc theo uid để bảo mật tuyệt đối, của ai người nấy xem
    if (filters.uid) {
      orders = orders.filter(o => o.uid === filters.uid)
    }
    cb(orders)
  }, (err) => console.error('subscribeOrders error:', err))
}

export const createOrder = (data) =>
  addDoc(collection(db, 'orders'), {
    ...data, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })

export const updateOrderStatus = (orderId, status) =>
  updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() })

export const deleteOrder = (orderId) =>
  deleteDoc(doc(db, 'orders', orderId))

// Cập nhật nội dung đơn hàng (chỉnh sửa sau khi tạo)
export const updateOrder = (orderId, data) =>
  updateDoc(doc(db, 'orders', orderId), { ...data, updatedAt: serverTimestamp() })


// ── EXPENSES (chi phí vận hành) ─────────────────────────────────────────────
// Collection: expenses/{id} — { amount, category, date, note, createdBy, createdAt }

export const subscribeExpenses = (cb) => {
  const q = collection(db, 'expenses')
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb(list)
  }, (err) => console.error('subscribeExpenses error:', err))
}

export const addExpense = (data) =>
  addDoc(collection(db, 'expenses'), {
    ...data,
    createdAt: serverTimestamp()
  })

export const deleteExpense = (id) =>
  deleteDoc(doc(db, 'expenses', id))


// ── COST PRICES (giá gốc tính chênh) ───────────────────────────────────────
// Collection: costPrices/{id} — { code, name, unit, avgPrice, updatedAt }

export const subscribeCostPrices = (cb) => {
  const q = collection(db, 'costPrices')
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    cb(items)
  }, (err) => console.error('subscribeCostPrices error:', err))
}

export const bulkUpsertCostPrices = async (items) => {
  const BATCH = 400
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = writeBatch(db)
    items.slice(i, i + BATCH).forEach(item => {
      const { id, ...rest } = item
      const docId = sanitizeFirestoreId(id)
      batch.set(doc(db, 'costPrices', docId), { ...rest, updatedAt: serverTimestamp() }, { merge: true })
    })
    await batch.commit()
  }
}

// ── INVENTORY ──────────────────────────────────────────────────────────────
// Collection: inventory/{productId}
// { productId, productName, listId, listName, qty, unit, lowStockAlert, updatedAt, updatedBy }

export const subscribeInventory = (cb) => {
  const q = collection(db, 'inventory')
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.productName || '').localeCompare(b.productName || ''))
    cb(items)
  }, (err) => console.error('subscribeInventory error:', err))
}

export const getInventory = async () => {
  const snap = await getDocs(collection(db, 'inventory'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const upsertInventoryItem = (productId, data) =>
  setDoc(doc(db, 'inventory', sanitizeFirestoreId(productId)), {
    ...data, updatedAt: serverTimestamp(),
  }, { merge: true })

export const bulkUpsertInventory = async (items) => {
  const BATCH = 400
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = writeBatch(db)
    items.slice(i, i + BATCH).forEach(item => {
      const { id, ...rest } = item
      const docId = sanitizeFirestoreId(id)
      batch.set(doc(db, 'inventory', docId), { ...rest, updatedAt: serverTimestamp() }, { merge: true })
    })
    await batch.commit()
  }
}

// ── DASHBOARD STATS ────────────────────────────────────────────────────────
export const getDashboardStats = async (uid) => {
  const [listsSnap, ordersSnap, usersSnap, invSnap] = await Promise.all([
    getDocs(collection(db, 'priceLists')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'inventory')),
  ])
  // Lọc orders theo uid (của riêng user đó, kể cả admin)
  const orders = ordersSnap.docs
    .map(d => d.data())
    .filter(o => !uid || o.uid === uid)

  const totalRevenue = orders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total ?? 0), 0)

  const lowStock = invSnap.docs
    .map(d => d.data())
    .filter(i => i.qty != null && i.lowStockAlert != null && i.qty <= i.lowStockAlert).length

  return {
    priceLists:   listsSnap.size,
    orders:       orders.length,
    users:        usersSnap.size,
    totalRevenue,
    lowStock,
    ordersByStatus: {
      pending:   orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
    },
  }
}

// ── CATALOGS ───────────────────────────────────────────────────────────────
export const subscribeCatalogs = (cb) => {
  const q = query(collection(db, 'catalogs'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export const addCatalogLink = ({ name, brand, note, linkUrl }) =>
  addDoc(collection(db, 'catalogs'), {
    name, brand: brand || '', note: note || '',
    url: linkUrl,
    isExternalLink: true,
    fileSize: null,
    storagePath: null,
    createdAt: serverTimestamp(),
  })

export const uploadCatalog = async ({ file, name, brand, note }) => {
  const storageRef = ref(storage, `catalogs/${Date.now()}_${file.name}`)
  const snap = await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
  const url = await getDownloadURL(snap.ref)
  await addDoc(collection(db, 'catalogs'), {
    name: name || file.name,
    brand: brand || '',
    note: note || '',
    fileName: file.name,
    fileSize: file.size,
    storagePath: snap.ref.fullPath,
    url,
    createdAt: serverTimestamp(),
  })
  return url
}

export const deleteCatalog = async (catalog) => {
  if (catalog.storagePath) {
    try { await deleteObject(ref(storage, catalog.storagePath)) } catch {}
  }
  await deleteDoc(doc(db, 'catalogs', catalog.id))
}

// ── BUS STATIONS / BUS LINES (Nhà Xe) ────────────────────────────────────────
// Collection: busLines/{id}
// { name, phone, province, route, note, uid, userName, createdAt, updatedAt }

export const subscribeBusLines = (cb) => {
  const q = query(collection(db, 'busLines'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, (err) => console.error('subscribeBusLines error:', err))
}

export const addBusLine = (data) =>
  addDoc(collection(db, 'busLines'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

export const updateBusLine = (id, data) =>
  updateDoc(doc(db, 'busLines', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })

export const deleteBusLine = (id) =>
  deleteDoc(doc(db, 'busLines', id))

// ── WEB CATEGORIES ──────────────────────────────────────────────────────────
export const getWebCategories = async () => {
  try {
    // 1. Đọc trực tiếp từ tài liệu cấu hình chuyên dụng categories_settings
    const settingsRef = doc(db, 'priceLists', 'categories_settings')
    const settingsSnap = await getDoc(settingsRef)
    if (settingsSnap.exists() && settingsSnap.data().webCategories) {
      return settingsSnap.data().webCategories
    }
    
    // 2. Chế độ tương thích ngược & di trú dữ liệu: Tìm trong các bảng giá khác
    const snap = await getDocs(collection(db, 'priceLists'))
    const docWithCats = snap.docs.find(d => d.data().webCategories && d.data().webCategories.length > 0)
    if (docWithCats) {
      const cats = docWithCats.data().webCategories || []
      // Tự động di trú sang tài liệu categories_settings để các lần sau đọc siêu tốc
      await setDoc(settingsRef, { webCategories: cats })
      return cats
    }
  } catch (e) {
    console.warn("getWebCategories error:", e)
  }
  return []
}

export const saveWebCategories = async (categories) => {
  const settingsRef = doc(db, 'priceLists', 'categories_settings')
  await setDoc(settingsRef, { webCategories: categories })
}

// ── WEB HERO SLIDES ────────────────────────────────────────────────────────
export const getWebHeroSlides = async () => {
  try {
    const settingsRef = doc(db, 'priceLists', 'hero_slides_settings')
    const snap = await getDoc(settingsRef)
    if (snap.exists() && snap.data().slides) {
      return snap.data().slides
    }
  } catch (e) {
    console.warn("getWebHeroSlides error:", e)
  }
  return null
}

export const saveWebHeroSlides = async (slides) => {
  const settingsRef = doc(db, 'priceLists', 'hero_slides_settings')
  await setDoc(settingsRef, { slides })
}

// ── WEB ORDERS ──────────────────────────────────────────────────────────────
export const createWebOrder = (data) =>
  addDoc(collection(db, 'webOrders'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp()
  })

export const subscribeWebOrders = (cb) => {
  const q = query(collection(db, 'webOrders'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, (err) => console.error('subscribeWebOrders error:', err))
}

export const updateWebOrderStatus = (id, status) =>
  updateDoc(doc(db, 'webOrders', id), { status })

export const deleteWebOrder = (id) =>
  deleteDoc(doc(db, 'webOrders', id))

// ── CLOUD STORAGE MANAGEMENT ────────────────────────────────────────────────
export const parseStorageUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  if (!url.includes('firebasestorage.googleapis.com') && !url.includes('storage.googleapis.com')) {
    return null
  }
  try {
    const match = url.match(/\/o\/([^?]+)/)
    if (match && match[1]) {
      const fullPath = decodeURIComponent(match[1])
      const parts = fullPath.split('/')
      const name = parts[parts.length - 1]
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root'
      return { fullPath, name, folder }
    }
    const cleanUrl = url.split('?')[0]
    const parts = cleanUrl.split('/')
    const name = parts[parts.length - 1]
    return { fullPath: name, name, folder: 'storage' }
  } catch {
    return null
  }
}

export const getCloudStorageFiles = async () => {
  const allFiles = []
  const seenUrls = new Set()
  const seenPaths = new Set()

  const addFile = (f) => {
    const key = f.fullPath || f.url
    if (!key || seenPaths.has(f.fullPath) || (f.url && seenUrls.has(f.url))) return
    if (f.fullPath) seenPaths.add(f.fullPath)
    if (f.url) seenUrls.add(f.url)
    allFiles.push(f)
  }

  // 1. Quét từ collection 'catalogs'
  try {
    const catSnap = await getDocs(collection(db, 'catalogs'))
    catSnap.docs.forEach(d => {
      const data = d.data()
      if (data.url && (data.url.includes('firebasestorage') || data.storagePath)) {
        const parsed = parseStorageUrl(data.url) || { fullPath: data.storagePath || data.name, name: data.fileName || data.name, folder: 'catalogs' }
        addFile({
          id: d.id,
          name: data.name || data.fileName || parsed.name,
          rawFileName: data.fileName || parsed.name,
          fullPath: data.storagePath || parsed.fullPath,
          size: data.fileSize || 0,
          contentType: 'application/pdf',
          timeCreated: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          url: data.url,
          folder: 'catalogs',
          sourceDoc: `catalogs/${d.id}`,
          type: 'catalog',
        })
      }
    })
  } catch (e) {
    console.warn('Error reading catalogs for storage:', e)
  }

  // 2. Quét từ tất cả PriceLists & Subcollection Products
  try {
    const listsSnap = await getDocs(collection(db, 'priceLists'))
    for (const listDoc of listsSnap.docs) {
      if (listDoc.id.startsWith('categories_') || listDoc.id.startsWith('hero_')) continue
      try {
        const prodSnap = await getDocs(collection(db, 'priceLists', listDoc.id, 'products'))
        prodSnap.docs.forEach(pDoc => {
          const p = pDoc.data()
          const imgs = [...(p.webImages || []), ...(p.images || [])]
          imgs.forEach((imgUrl, idx) => {
            if (!imgUrl || typeof imgUrl !== 'string') return
            const parsed = parseStorageUrl(imgUrl)
            if (parsed) {
              addFile({
                id: `${pDoc.id}_${idx}`,
                name: `${p.code ? p.code + ' - ' : ''}Ảnh ${idx + 1} (${parsed.name})`,
                rawFileName: parsed.name,
                fullPath: parsed.fullPath,
                size: 0,
                contentType: 'image/jpeg',
                timeCreated: p.updatedAt?.toDate ? p.updatedAt.toDate() : new Date(),
                url: imgUrl,
                folder: parsed.folder || 'products',
                sourceDoc: `priceLists/${listDoc.id}/products/${pDoc.id}`,
                productCode: p.code,
                productName: p.name,
                type: 'product',
              })
            }
          })
        })
      } catch {}
    }
  } catch (e) {
    console.warn('Error reading priceLists for storage:', e)
  }

  // 3. Quét từ categories settings
  try {
    const catSetSnap = await getDoc(doc(db, 'priceLists', 'categories_settings'))
    if (catSetSnap.exists()) {
      const catData = catSetSnap.data()
      const list = catData.list || []
      list.forEach((c, idx) => {
        if (c.image && parseStorageUrl(c.image)) {
          const parsed = parseStorageUrl(c.image)
          addFile({
            id: `cat_${idx}`,
            name: `Danh mục: ${c.name} (${parsed.name})`,
            rawFileName: parsed.name,
            fullPath: parsed.fullPath,
            size: 0,
            contentType: 'image/jpeg',
            timeCreated: new Date(),
            url: c.image,
            folder: 'categories',
            type: 'category',
          })
        }
      })
    }
  } catch {}

  // 4. Quét từ hero slides settings
  try {
    const slideSetSnap = await getDoc(doc(db, 'priceLists', 'hero_slides_settings'))
    if (slideSetSnap.exists()) {
      const slideData = slideSetSnap.data()
      const slides = slideData.slides || slideData.list || []
      slides.forEach((s, idx) => {
        const img = s.img || s.url
        if (img && parseStorageUrl(img)) {
          const parsed = parseStorageUrl(img)
          addFile({
            id: `slide_${idx}`,
            name: `Banner: ${s.headline || s.title || `Slide ${idx + 1}`} (${parsed.name})`,
            rawFileName: parsed.name,
            fullPath: parsed.fullPath,
            size: 0,
            contentType: 'image/jpeg',
            timeCreated: new Date(),
            url: img,
            folder: 'banners',
            type: 'banner',
          })
        }
      })
    }
  } catch {}


  // 6. Tính dung lượng chính xác qua HEAD request (hoặc ước lượng nếu bị chặn CORS)
  await Promise.all(allFiles.map(async (file) => {
    if (file.size && file.size > 0) return file
    if (!file.url) {
      file.size = 180 * 1024
      return file
    }
    try {
      const res = await fetch(file.url, { method: 'HEAD' })
      const cl = res.headers.get('content-length')
      if (cl) {
        file.size = parseInt(cl, 10)
      } else {
        file.size = 200 * 1024
      }
    } catch {
      file.size = 200 * 1024
    }
    return file
  }))

  return allFiles.sort((a, b) => (b.size || 0) - (a.size || 0))
}

export const deleteCloudStorageFile = async (fileObj) => {
  const fullPath = typeof fileObj === 'string' ? fileObj : fileObj?.fullPath
  const url = typeof fileObj === 'object' ? fileObj?.url : null

  // 1. Delete from Firebase Storage bucket
  try {
    if (fullPath) await deleteObject(ref(storage, fullPath))
    else if (url) await deleteObject(ref(storage, url))
  } catch (e) {
    console.warn('Storage deleteObject notice:', e)
  }

  // 2. If it is attached to a Firestore document, clean reference
  if (typeof fileObj === 'object' && fileObj?.sourceDoc) {
    try {
      const parts = fileObj.sourceDoc.split('/')
      if (parts[0] === 'catalogs' && parts[1]) {
        await deleteDoc(doc(db, 'catalogs', parts[1]))
      } else if (parts[0] === 'priceLists' && parts[2] === 'products' && parts[3]) {
        const prodRef = doc(db, 'priceLists', parts[1], 'products', parts[3])
        const snap = await getDoc(prodRef)
        if (snap.exists()) {
          const data = snap.data()
          const newWebImages = (data.webImages || []).filter(u => u !== url && !u.includes(fileObj.rawFileName || fileObj.fullPath))
          const newImages = (data.images || []).filter(u => u !== url && !u.includes(fileObj.rawFileName || fileObj.fullPath))
          await updateDoc(prodRef, { webImages: newWebImages, images: newImages })
        }
      }
    } catch (e) {
      console.warn('Firestore doc reference cleanup notice:', e)
    }
  }
}


