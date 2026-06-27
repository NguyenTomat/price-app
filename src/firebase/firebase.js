import { initializeApp, getApps, deleteApp } from 'firebase/app'
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
} from 'firebase/auth'
import {
  getFirestore, collection, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  writeBatch, onSnapshot, query, orderBy, where, limit,
} from 'firebase/firestore'
import {
  getStorage, ref, uploadString, uploadBytes, getDownloadURL, deleteObject,
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
    if (filters.uid) orders = orders.filter(o => o.uid === filters.uid)
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
export const getDashboardStats = async () => {
  const [listsSnap, ordersSnap, usersSnap, invSnap] = await Promise.all([
    getDocs(collection(db, 'priceLists')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'inventory')),
  ])
  const orders = ordersSnap.docs.map(d => d.data())
  const totalRevenue = orders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total ?? 0), 0)
  const lowStock = invSnap.docs
    .map(d => d.data())
    .filter(i => i.qty != null && i.lowStockAlert != null && i.qty <= i.lowStockAlert).length
  return {
    priceLists:   listsSnap.size,
    orders:       ordersSnap.size,
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
