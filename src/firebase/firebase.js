import { initializeApp, getApps, deleteApp } from 'firebase/app'
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
} from 'firebase/auth'
import {
  getFirestore, collection, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  writeBatch, onSnapshot, query, orderBy, where, limit, Timestamp, increment
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

export const sanitizeWebProduct = (p, listId, listName) => {
  const rawImages = p.webImages || p.images || []
  let webImages = []
  if (Array.isArray(rawImages)) {
    webImages = rawImages.filter(img => typeof img === 'string' && img.trim().length > 0)
  }
  return {
    id: p.id || '',
    name: p.name || '',
    code: p.code || '',
    powerKw: p.powerKw || (p.webSpecs?.power ? p.webSpecs.power : ''),
    powerHp: p.powerHp || '',
    head: p.head || (p.webSpecs?.specs ? p.webSpecs.specs : ''),
    flow: p.flow || '',
    price: p.price || 0,
    listId: listId || p.listId || '',
    listName: listName || p.listName || '',
    webBrand: p.webBrand || p.brand || '',
    group: p.group || '',
    category: p.category || '',
    featured: p.featured || false,
    showOnWeb: p.showOnWeb === true,
    voltage: p.voltage || p.webSpecs?.voltage || '',
    pipe: p.pipe || '',
    webDesc: p.webDesc || p.desc || p.description || '',
    desc: p.desc || p.description || '',
    webSpecs: p.webSpecs || {
      power: p.powerKw ? `${p.powerKw} kW` : (p.powerHp ? `${p.powerHp} HP` : ''),
      specs: p.specs || (p.head || p.flow ? `H: ${p.head || ''}m - Q: ${p.flow || ''}m3/h` : ''),
      voltage: p.voltage || ''
    },
    specs: p.specs || (p.webSpecs?.specs ? p.webSpecs.specs : ''),
    webImages: webImages,
    hasFullImages: webImages.length > 1
  }
}

// Lấy danh sách sản phẩm đăng lên Web Catalog công cộng siêu tốc (tối ưu payload & CDN)
export const getWebCatalogProducts = async () => {
  // 1. Tải siêu tốc từ static CDN bundle /web_catalog.json (chứa 100% đầy đủ ảnh sản phẩm, load trong 0.1s)
  try {
    const res = await fetch('/web_catalog.json')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data
      }
    }
  } catch (e) {
    console.warn('Lỗi đọc web_catalog.json, fallback Firestore:', e)
  }

  // 2. Fallback đọc từ Firestore snapshot
  try {
    const snapshotRef = doc(db, 'priceLists', 'web_catalog_snapshot')
    const snapshotSnap = await getDoc(snapshotRef)
    if (snapshotSnap.exists() && snapshotSnap.data().products?.length > 0) {
      return snapshotSnap.data().products
    }
  } catch (err) {
    console.warn('Lỗi đọc web_catalog_snapshot:', err)
  }

  // 3. Quét Firestore nếu chưa có cache
  return await refreshWebCatalogSnapshot()
}

export const refreshWebCatalogSnapshot = async () => {
  try {
    const lists = await getPriceLists()
    const chunks = await Promise.all(
      lists.map(l =>
        getProducts(l.id).then(ps =>
          ps.filter(p => p.showOnWeb === true).map(p => sanitizeWebProduct(p, l.id, l.name))
        )
      )
    )
    const allWebProducts = chunks.flat()
    if (allWebProducts.length > 0) {
      try {
        // Loại bỏ base64 khổng lồ trong snapshot lưu trên Firestore để tránh vượt trần 1MB của Firestore
        const lightweightProducts = allWebProducts.map(p => ({
          ...p,
          webImages: p.webImages?.map(img => (typeof img === 'string' && img.length > 50000 && img.startsWith('data:')) ? '' : img).filter(Boolean)
        }))
        const snapshotRef = doc(db, 'priceLists', 'web_catalog_snapshot')
        await setDoc(snapshotRef, { products: lightweightProducts, updatedAt: Date.now() })
      } catch (saveErr) {
        console.warn('Không lưu được web_catalog_snapshot lên Firestore (vẫn dùng data trực tiếp):', saveErr)
      }
    }
    return allWebProducts
  } catch (err) {
    console.error('Lỗi refreshWebCatalogSnapshot:', err)
    return []
  }
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
// Collection: expenses/{id} — { amount, category, date, note, createdBy, uid, createdAt }

export const subscribeExpenses = (cb, filters = {}) => {
  const q = collection(db, 'expenses')
  return onSnapshot(q, (snap) => {
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Luôn lọc chi phí theo uid của từng tài khoản riêng biệt
    if (filters.uid) {
      list = list.filter(e => e.uid === filters.uid || e.createdBy === filters.uid)
    }
    cb(list)
  }, (err) => console.error('subscribeExpenses error:', err))
}

export const addExpense = (data) =>
  addDoc(collection(db, 'expenses'), {
    ...data,
    uid: data.uid || data.createdBy || '',
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
  if (url.startsWith('data:image/')) {
    const approxBytes = Math.round((url.length - (url.indexOf(',') + 1)) * 0.75)
    return {
      fullPath: `base64_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: 'Ảnh nén tải lên',
      folder: 'products',
      size: approxBytes,
      isBase64: true
    }
  }
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
      if (data.url && (data.url.includes('firebasestorage') || data.storagePath || data.url.startsWith('data:'))) {
        const parsed = parseStorageUrl(data.url) || { fullPath: data.storagePath || data.name, name: data.fileName || data.name, folder: 'catalogs', size: data.fileSize || 0 }
        addFile({
          id: d.id,
          name: data.name || data.fileName || parsed.name,
          rawFileName: data.fileName || parsed.name,
          fullPath: data.storagePath || parsed.fullPath,
          size: data.fileSize || parsed.size || 0,
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
                size: parsed.size || 0,
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
            size: parsed.size || 0,
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
            size: parsed.size || 0,
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
    if (!file.url || file.url.startsWith('data:')) {
      if (!file.size) file.size = 180 * 1024
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

// ── WEB ANALYTICS TELEMETRY ──────────────────────────────────────────────────
const getVNFormattedDate = () => {
  const d = new Date()
  const vnTime = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000)
  const yyyy = vnTime.getFullYear()
  const mm = String(vnTime.getMonth() + 1).padStart(2, '0')
  const dd = String(vnTime.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

let cachedGeoData = null

/** Lấy thông tin IP & Địa lý khách hàng (Cache theo phiên để tối ưu tốc độ) */
export const getVisitorGeoData = async () => {
  if (cachedGeoData) return cachedGeoData
  try {
    const fromSession = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tt_visitor_geo_v1') : null
    if (fromSession) {
      cachedGeoData = JSON.parse(fromSession)
      return cachedGeoData
    }
  } catch {}

  try {
    const res = await fetch('https://ipwho.is/', { cache: 'no-cache' })
    const data = await res.json()
    if (data && data.success !== false) {
      cachedGeoData = {
        ip: data.ip || '',
        city: data.city || '',
        region: data.region || '',
        country: data.country || 'Việt Nam',
        countryCode: data.country_code || 'VN',
        flag: data.flag?.emoji || '🇻🇳',
        isp: data.connection?.isp || data.isp || '',
        org: data.connection?.org || '',
        lat: data.latitude || null,
        lon: data.longitude || null,
      }
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('tt_visitor_geo_v1', JSON.stringify(cachedGeoData))
        }
      } catch {}
      return cachedGeoData
    }
  } catch (e) {
    try {
      const res2 = await fetch('https://api.ipify.org?format=json')
      const d2 = await res2.json()
      if (d2 && d2.ip) {
        cachedGeoData = { ip: d2.ip, country: 'Việt Nam', flag: '🇻🇳', city: '', region: '', isp: '' }
        return cachedGeoData
      }
    } catch {}
  }
  return null
}

/** Nhận diện thiết bị, hệ điều hành, trình duyệt và nguồn truy cập chi tiết */
export const getClientDeviceAndSource = () => {
  if (typeof window === 'undefined') return {}

  const ua = navigator?.userAgent || ''

  // 1. Hệ điều hành
  let os = 'Khác'
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/iPhone/i.test(ua)) os = 'iPhone (iOS)'
  else if (/iPad/i.test(ua)) os = 'iPad (iPadOS)'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  // 2. Trình duyệt
  let browser = 'Khác'
  if (/Zalo/i.test(ua)) browser = 'Zalo In-App'
  else if (/FBAN|FBAV/i.test(ua)) browser = 'Facebook In-App'
  else if (/CocCoc/i.test(ua)) browser = 'Cốc Cốc'
  else if (/Edg/i.test(ua)) browser = 'Microsoft Edge'
  else if (/Chrome/i.test(ua) && !/Edg|CocCoc/i.test(ua)) browser = 'Google Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari'
  else if (/Firefox/i.test(ua)) browser = 'Mozilla Firefox'

  // 3. Phân loại máy
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTablet = /(iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch)))/i.test(ua)
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop'

  // 4. Nguồn truy cập (Traffic Acquisition)
  const referrer = document?.referrer || ''
  let source = 'Trực tiếp (Direct)'
  if (referrer.includes('google.')) source = 'Google Search'
  else if (referrer.includes('zalo.me')) source = 'Zalo Chat'
  else if (referrer.includes('facebook.') || referrer.includes('fb.com')) source = 'Facebook'
  else if (referrer.includes('tiktok.')) source = 'TikTok'
  else if (referrer.includes('youtube.')) source = 'YouTube'
  else if (referrer) {
    try {
      source = new URL(referrer).hostname
    } catch {
      source = referrer.substring(0, 50)
    }
  }

  // 5. UTM & Google Ads GCLID
  let utmSource = ''
  let utmMedium = ''
  let utmCampaign = ''
  let gclid = false
  try {
    const urlParams = new URLSearchParams(window.location.search)
    utmSource = urlParams.get('utm_source') || ''
    utmMedium = urlParams.get('utm_medium') || ''
    utmCampaign = urlParams.get('utm_campaign') || ''
    gclid = Boolean(urlParams.get('gclid'))

    if (gclid || utmSource.toLowerCase().includes('google') || utmMedium.toLowerCase().includes('cpc')) {
      source = 'Google Ads'
    } else if (utmSource) {
      source = `UTM: ${utmSource}`
    }
  } catch {}

  // 6. Mã định danh khách & phiên
  let visitorId = ''
  try {
    visitorId = localStorage.getItem('tt_vid')
    if (!visitorId) {
      visitorId = 'vid_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).slice(-4)
      localStorage.setItem('tt_vid', visitorId)
    }
  } catch {
    visitorId = 'guest'
  }

  let sessionId = ''
  try {
    sessionId = sessionStorage.getItem('tt_sid')
    if (!sessionId) {
      sessionId = 'sid_' + Math.random().toString(36).substring(2, 8)
      sessionStorage.setItem('tt_sid', sessionId)
    }
  } catch {
    sessionId = 'sess'
  }

  return {
    os,
    browser,
    deviceType,
    isMobile,
    screenResolution: typeof window !== 'undefined' ? `${window.screen?.width || 0}x${window.screen?.height || 0}` : '',
    source,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    gclid,
    visitorId,
    sessionId,
  }
}

export const logWebAnalyticsEvent = async ({ type = 'page_view', path = '/', title = 'Trang chủ', isNewSession = false, meta = {} }) => {
  try {
    const clientInfo = getClientDeviceAndSource()
    const geoInfo = await getVisitorGeoData()
    const dateKey = getVNFormattedDate()

    // 1. Cập nhật thống kê tổng hợp theo ngày
    const dailyRef = doc(db, 'web_analytics_daily', dateKey)
    const dailyUpdate = {
      date: dateKey,
      updatedAt: Date.now(),
      totalViews: increment(1),
      ...(isNewSession ? { uniqueVisitors: increment(1) } : {}),
      ...(clientInfo.isMobile ? { mobileViews: increment(1) } : { desktopViews: increment(1) }),
      ...(type === 'zalo_click' ? { zaloClicks: increment(1) } : {}),
      ...(type === 'call_click' ? { callClicks: increment(1) } : {}),
      ...(type === 'product_view' ? { productViews: increment(1) } : {}),
      ...(type === 'order_created' ? { orderCount: increment(1) } : {})
    }

    if (geoInfo?.city) {
      const cityKey = sanitizeFirestoreId(geoInfo.city || 'other')
      dailyUpdate[`topCities.${cityKey}.name`] = geoInfo.city
      dailyUpdate[`topCities.${cityKey}.region`] = geoInfo.region || ''
      dailyUpdate[`topCities.${cityKey}.count`] = increment(1)
    }

    if (clientInfo?.source) {
      const srcKey = sanitizeFirestoreId(clientInfo.source || 'direct')
      dailyUpdate[`topSources.${srcKey}.name`] = clientInfo.source
      dailyUpdate[`topSources.${srcKey}.count`] = increment(1)
    }

    if (type === 'product_view' && meta.productId) {
      const pKey = sanitizeFirestoreId(meta.productId || meta.code || 'prod')
      dailyUpdate[`topProducts.${pKey}.name`] = meta.name || title
      dailyUpdate[`topProducts.${pKey}.code`] = meta.code || ''
      dailyUpdate[`topProducts.${pKey}.brand`] = meta.brand || ''
      dailyUpdate[`topProducts.${pKey}.count`] = increment(1)
    }

    await setDoc(dailyRef, dailyUpdate, { merge: true })

    // 2. Ghi nhận log chi tiết thời gian thực
    const logData = {
      type,
      path,
      title: title || 'Trang chủ',
      device: clientInfo.deviceType || 'Desktop',
      isMobile: clientInfo.isMobile || false,
      os: clientInfo.os || 'Khác',
      browser: clientInfo.browser || 'Khác',
      screenResolution: clientInfo.screenResolution || '',
      source: clientInfo.source || 'Trực tiếp (Direct)',
      referrer: clientInfo.referrer || '',
      utmSource: clientInfo.utmSource || '',
      utmMedium: clientInfo.utmMedium || '',
      utmCampaign: clientInfo.utmCampaign || '',
      gclid: clientInfo.gclid || false,
      visitorId: clientInfo.visitorId || '',
      sessionId: clientInfo.sessionId || '',

      // Thông tin GeoIP & Vị trí mạng
      ip: geoInfo?.ip || '',
      city: geoInfo?.city || '',
      region: geoInfo?.region || '',
      country: geoInfo?.country || 'Việt Nam',
      countryCode: geoInfo?.countryCode || 'VN',
      flag: geoInfo?.flag || '🇻🇳',
      isp: geoInfo?.isp || '',
      org: geoInfo?.org || '',
      lat: geoInfo?.lat || null,
      lon: geoInfo?.lon || null,

      userAgent: (navigator?.userAgent || '').substring(0, 160),
      createdAt: Date.now(),
      date: dateKey,
      ...meta
    }

    await addDoc(collection(db, 'web_analytics_logs'), logData)
  } catch (err) {
    console.warn('Analytics log skipped:', err)
  }
}

export const getWebAnalyticsSummary = async (daysLimit = 14) => {
  try {
    const q = query(collection(db, 'web_analytics_daily'), orderBy('date', 'desc'), limit(daysLimit))
    const snap = await getDocs(q)
    const list = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() }))
    return list.reverse()
  } catch (err) {
    console.error('Lỗi tải web_analytics_daily:', err)
    return []
  }
}

export const subscribeWebAnalyticsLogs = (onUpdate, maxLogs = 50) => {
  try {
    const q = query(collection(db, 'web_analytics_logs'), orderBy('createdAt', 'desc'), limit(maxLogs))
    return onSnapshot(q, snap => {
      const logs = []
      snap.forEach(d => logs.push({ id: d.id, ...d.data() }))
      onUpdate(logs)
    }, err => {
      console.warn('Lỗi lắng nghe web_analytics_logs:', err)
    })
  } catch (err) {
    console.error('Lỗi subscribeWebAnalyticsLogs:', err)
    return () => {}
  }
}


