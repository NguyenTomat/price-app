import { useState, useEffect, useMemo, useRef } from 'react'
import { getPriceLists, getProducts, updateProduct, uploadProductImageFile, uploadWebCategoryImage, getProductDetail, getWebCategories, saveWebCategories, getWebHeroSlides, saveWebHeroSlides, subscribeWebOrders, updateWebOrderStatus, deleteWebOrder, ensureProductStorageUrls } from '../firebase/firebase'
import { useToast } from '../components/Toast'
import MobileTableWrap from '../components/MobileTableWrap'

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 700
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Không thể nén ảnh')),
          'image/jpeg',
          0.55
        )
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

const compressCategoryImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 180 // Aggressive compression for category thumbnail icons
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Không thể nén ảnh danh mục')),
          'image/jpeg',
          0.40 // Low quality for super small base64 payload
        )
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
  })
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

const compressBase64Image = (base64Str) => {
  if (!base64Str || !base64Str.startsWith('data:')) return Promise.resolve(base64Str);
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 500; // Nhỏ gọn vừa đủ hiển thị web đẹp
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.5); // Nén chất lượng 0.5 cực nhẹ (~15KB)
      resolve(compressed);
    };
    img.onerror = () => resolve(base64Str); // Giữ nguyên nếu lỗi
  });
};

export const DEFAULT_HERO_SLIDES = [
  {
    id: 'slide-1',
    title: 'BƠM BIẾN TẦN THÔNG MINH',
    sub: 'CDLF SERIES · INVERTER · 380V/3PH',
    defaultImg: './pump_vertical_cdlf.jpg',
    img: './pump_vertical_cdlf.jpg',
    showText: false,
    textPos: 'bottom-left',
    badge: 'BƠM BIẾN TẦN THÔNG MINH',
    headline: 'ỔN ĐỊNH ÁP LỰC — TIẾT KIỆM 60% ĐIỆN',
    desc: 'Tự động biến thiên tần số theo nhu cầu lưu lượng thực tế, vận hành siêu êm và tiết kiệm điện.',
    category: 'BƠM BIẾN TẦN'
  },
  {
    id: 'slide-2',
    title: 'BƠM TĂNG ÁP ĐIỆN TỬ',
    sub: 'ELECTRONIC BOOSTER · 220V · IP55',
    defaultImg: './pump_booster_green.jpg',
    img: './pump_booster_green.jpg',
    showText: false,
    textPos: 'bottom-left',
    badge: 'BƠM TĂNG ÁP ĐIỆN TỬ',
    headline: 'ÁP LỰC MẠNH MẼ CHO MỌI VÒI SEN',
    desc: 'Cảm biến áp lực điện tử, tự ngắt chống cạn an toàn tuyệt đối.',
    category: 'BƠM TĂNG ÁP'
  },
  {
    id: 'slide-3',
    title: 'BƠM CHÌM GIẾNG KHOAN',
    sub: 'SUBMERSIBLE PUMP · HMAX 300M · OIL COOLED',
    defaultImg: './pump_submersible_blue.jpg',
    img: './pump_submersible_blue.jpg',
    showText: false,
    textPos: 'bottom-left',
    badge: 'BƠM CHÌM GIẾNG KHOAN',
    headline: 'KHAI THÁC NƯỚC SÂU ĐẾN 300M',
    desc: 'Động cơ ngâm dầu giải nhiệt 24/7, thân Inox 304 chống ăn mòn.',
    category: 'BƠM CHÌM'
  },
  {
    id: 'slide-4',
    title: 'BƠM LY TÂM CÔNG SUẤT LỚN',
    sub: 'CENTRIFUGAL HEAVY DUTY · QMAX 200M³/H',
    defaultImg: './pump_horizontal_blue.jpg',
    img: './pump_horizontal_blue.jpg',
    showText: false,
    textPos: 'bottom-left',
    badge: 'BƠM LY TÂM CÔNG NGHIỆP',
    headline: 'LƯU LƯỢNG SIÊU LỚN 200 M³/H',
    desc: 'Cánh đúc hợp kim, tiêu chuẩn Châu Âu cho nhà máy & nông nghiệp.',
    category: 'BƠM LY TÂM'
  },
  {
    id: 'slide-5',
    title: 'HỆ THỐNG CỤM DÀN BƠM',
    sub: 'MULTI-PUMP BOOSTER · PLC INVERTER',
    defaultImg: './pump_showroom.jpg',
    img: './pump_showroom.jpg',
    showText: false,
    textPos: 'bottom-left',
    badge: 'HỆ THỐNG CỤM DÀN BƠM',
    headline: 'GIẢI PHÁP CẤP NƯỚC TÒA NHÀ CAO TẦNG',
    desc: 'Chạy luân phiên 2-4 bơm song song, kiểm soát áp lực liên tục 24/7.',
    category: 'DÀN BƠM'
  },
  {
    id: 'slide-6',
    title: 'MÁY BƠM CÔNG NGHIỆP',
    sub: 'INDUSTRIAL GRADE · CLASS F · IP55',
    defaultImg: './pump_vertical.jpg',
    img: './pump_vertical.jpg',
    showText: false,
    textPos: 'bottom-left',
    badge: 'MÁY BƠM CÔNG NGHIỆP',
    headline: 'CHỊU TẢI LIÊN TỤC 24/7 SIÊU BỀN',
    desc: 'Thân gang cầu dày dặn, phớt Ceramic kép chống rò rỉ hóa chất.',
    category: 'BƠM CÔNG NGHIỆP'
  }
];

export const normalizeHeroSlides = (raw) => {
  if (!raw) return DEFAULT_HERO_SLIDES;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item, idx) => ({
      id: item.id || `slide-${idx + 1}`,
      title: item.title || `Slide ${idx + 1}`,
      sub: item.sub || '',
      defaultImg: item.defaultImg || '',
      img: item.img || item.defaultImg || '',
      showText: typeof item.showText === 'boolean' ? item.showText : false,
      textPos: item.textPos || 'bottom-left',
      badge: item.badge || item.eyebrow || '',
      headline: item.headline || item.headlineL1 || '',
      desc: item.desc || '',
      category: item.category || 'TẤT CẢ',
      link: item.link || ''
    }));
  }
  if (typeof raw === 'object') {
    return DEFAULT_HERO_SLIDES.map((def, idx) => ({
      ...def,
      img: raw[idx] || def.defaultImg
    }));
  }
  return DEFAULT_HERO_SLIDES;
};

export default function WebManagePage() {
  const toast = useToast()
  
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)

  // Web custom categories management
  const [showCatModal, setShowCatModal] = useState(false)
  const [categoriesList, setCategoriesList] = useState([])
  const [savingCats, setSavingCats] = useState(false)

  // Form states for modal
  const [showOnWeb, setShowOnWeb] = useState(false)
  const [webBrand, setWebBrand] = useState('UPTI PUMP')
  const [webGroup, setWebGroup] = useState('')
  const [power, setPower] = useState('')
  const [head, setHead] = useState('')
  const [flow, setFlow] = useState('')
  const [voltage, setVoltage] = useState('220V')
  const [webDesc, setWebDesc] = useState('')
  const [webName, setWebName] = useState('')
  const [webCode, setWebCode] = useState('')
  const [webImages, setWebImages] = useState([]) // State lưu danh sách URL ảnh thực tế của sản phẩm
  const [uploadingImages, setUploadingImages] = useState(false) // Trạng thái đang tải ảnh lên Storage
  const [savingProduct, setSavingProduct] = useState(false) // Trạng thái đang lưu sản phẩm
  const [draggedIndex, setDraggedIndex] = useState(null) // Drag & drop index state

  // Web Admin tabs: 'products' | 'orders' | 'hero_slides'
  const [activeAdminTab, setActiveAdminTab] = useState('products')
  const [orders, setOrders] = useState([])
  const [newOrderAlert, setNewOrderAlert] = useState(null)
  const isFirstLoad = useRef(true)

  // Hero Slides Banner Config (Unlimited list with custom text & position)
  const [heroSlidesList, setHeroSlidesList] = useState(() => {
    try {
      const saved = localStorage.getItem('tt_custom_hero_slides_list')
      if (saved) return normalizeHeroSlides(JSON.parse(saved))
      const oldConfig = localStorage.getItem('tt_custom_hero_images')
      if (oldConfig) return normalizeHeroSlides(JSON.parse(oldConfig))
    } catch {
      // fallback
    }
    return DEFAULT_HERO_SLIDES
  })
  const [savingHeroSlides, setSavingHeroSlides] = useState(false)

  // Load Hero Slides from Firebase on mount
  useEffect(() => {
    getWebHeroSlides().then(data => {
      if (data) {
        const normalized = normalizeHeroSlides(data)
        setHeroSlidesList(normalized)
        try {
          localStorage.setItem('tt_custom_hero_slides_list', JSON.stringify(normalized))
        } catch (e) {
          console.warn(e)
        }
      }
    }).catch(err => console.warn('Lỗi tải hero slides từ firebase:', err))
  }, [])

  const handleSaveHeroSlides = async () => {
    setSavingHeroSlides(true)
    try {
      await saveWebHeroSlides(heroSlidesList)
      try {
        localStorage.setItem('tt_custom_hero_slides_list', JSON.stringify(heroSlidesList))
      } catch (e) {
        console.warn(e)
      }
      toast(`Đã lưu và xuất bản thành công ${heroSlidesList.length} Banner Hero lên Website!`, 'success')
    } catch (err) {
      toast('Lỗi lưu Banner Hero: ' + err.message, 'error')
    } finally {
      setSavingHeroSlides(false)
    }
  }

  const handleAddNewSlide = () => {
    setHeroSlidesList(prev => [
      ...prev,
      {
        id: `slide-${Date.now()}`,
        title: `Banner 0${prev.length + 1}`,
        sub: 'Dòng sản phẩm / Chương trình mới',
        defaultImg: '',
        img: '',
        showText: false,
        textPos: 'bottom-left',
        badge: 'SẢN PHẨM MỚI',
        headline: 'TIÊU ĐỀ BANNER MỚI',
        desc: 'Mô tả thông tin chi tiết về sản phẩm hoặc chương trình...',
        category: 'TẤT CẢ',
        link: ''
      }
    ])
    toast('Đã thêm 1 Banner mới! Bạn có thể tải ảnh và cấu hình chữ.', 'success')
  }

  const handleDeleteSlide = (idx) => {
    if (heroSlidesList.length <= 1) {
      toast('Phải giữ lại tối thiểu 1 banner!', 'warning')
      return
    }
    setHeroSlidesList(prev => prev.filter((_, i) => i !== idx))
    toast('Đã xóa Banner.', 'success')
  }

  const handleMoveSlide = (idx, dir) => {
    setHeroSlidesList(prev => {
      const next = [...prev]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= next.length) return prev
      const temp = next[idx]
      next[idx] = next[target]
      next[target] = temp
      return next
    })
  }

  const handleUpdateSlideField = (idx, field, value) => {
    setHeroSlidesList(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const handleUploadSlideImage = async (slideIdx, file) => {
    try {
      const blob = await compressImage(file)
      try {
        const url = await uploadWebCategoryImage(blob, 'jpg')
        handleUpdateSlideField(slideIdx, 'img', url)
        toast(`Đã tải ảnh Banner 0${slideIdx + 1} thành công! Nhớ bấm "Lưu cấu hình" để xuất bản.`, 'success')
      } catch (storageErr) {
        console.warn("Storage upload failed, falling back to base64:", storageErr)
        const base64Url = await blobToBase64(blob)
        handleUpdateSlideField(slideIdx, 'img', base64Url)
        toast(`Đã lưu ảnh tạm thời Banner 0${slideIdx + 1}! Nhớ bấm "Lưu cấu hình" để xuất bản.`, 'success')
      }
    } catch (err) {
      toast('Lỗi xử lý ảnh: ' + err.message, 'error')
    }
  }

  // AI Assistant states
  const [aiQuoteModal, setAiQuoteModal] = useState(null)
  const [aiQuoteDraft, setAiQuoteDraft] = useState('')
  const [generatingQuote, setGeneratingQuote] = useState(false)
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [aiCustomInstruction, setAiCustomInstruction] = useState('')

  // Listen to Web Orders in realtime
  useEffect(() => {
    const unsub = subscribeWebOrders((data) => {
      setOrders(data)
      
      // If not the initial load and new orders arrived
      if (!isFirstLoad.current && data.length > 0) {
        // Find if there is a new order (status === 'pending') that we didn't have before
        const newOrder = data[0]
        if (newOrder && newOrder.status === 'pending') {
          // Play sound
          playNotificationSound()
          // Show popup alert
          setNewOrderAlert(newOrder)
        }
      }
      
      if (isFirstLoad.current) {
        isFirstLoad.current = false
      }
    })
    return unsub
  }, [])

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      
      oscillator.start()
      setTimeout(() => {
        oscillator.frequency.setValueAtTime(1109.73, audioContext.currentTime) // C#6
      }, 150)
      
      setTimeout(() => {
        oscillator.stop()
      }, 400)
    } catch (err) {
      console.warn('Cannot play synth sound:', err)
    }
  }

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateWebOrderStatus(orderId, newStatus)
      toast('Đã cập nhật trạng thái đơn hàng!', 'success')
    } catch (err) {
      toast('Lỗi cập nhật đơn hàng: ' + err.message, 'error')
    }
  }

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đơn hàng này khỏi hệ thống?')) return
    try {
      await deleteWebOrder(orderId)
      toast('Đã xóa đơn hàng thành công!', 'success')
    } catch (err) {
      toast('Lỗi xóa đơn hàng: ' + err.message, 'error')
    }
  }

  // Load price lists and web categories
  useEffect(() => {
    ;(async () => {
      try {
        const data = await getPriceLists()
        setLists(data)
        if (data.length > 0) {
          setSelectedListId(data[0].id)
        }
      } catch (err) {
        toast('Không tải được danh sách bảng giá: ' + err.message, 'error')
      }
      try {
        const cats = await getWebCategories()
        const parsed = cats.map(c => {
          if (typeof c === 'string') return { name: c, image: '' }
          return c
        })
        setCategoriesList(parsed)
      } catch (err) {
        console.warn("Lỗi tải danh mục:", err)
      }
    })()
  }, [])

  // Load products of selected list
  useEffect(() => {
    if (!selectedListId) return
    let cancelled = false
    setLoadingProducts(true)
    ;(async () => {
      try {
        const data = await getProducts(selectedListId)
        if (!cancelled) setProducts(data)
      } catch (err) {
        if (!cancelled) toast('Lỗi tải sản phẩm: ' + err.message, 'error')
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedListId])

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => 
      !q ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q)
    )
  }, [products, search])

  const openEditModal = async (p) => {
    setEditingProduct(p)
    setShowOnWeb(p.showOnWeb || false)
    setWebBrand(p.webBrand || 'UPTI PUMP')
    setWebGroup(p.group || '')
    setWebName(p.name || '')
    setWebCode(p.code || '')
    setAiCustomInstruction('')
    
    // Gộp chung thông số H và Q: Lấy trực tiếp từ webSpecs.specs cấu hình cũ hoặc tự điền từ spec2 của bảng gốc
    const defaultSpecs = p.webSpecs?.specs || p.spec2 || ''
    const defaultPower = p.webSpecs?.power || p.spec1 || ''
    const defaultVoltage = p.webSpecs?.voltage || (p.spec2?.includes('380V') ? '380V' : '220V')

    setPower(defaultPower)
    setHead(defaultSpecs) // Sử dụng biến state head đại diện cho trường thông số gộp
    setVoltage(defaultVoltage)
    setWebDesc(p.webDesc || '')
    setWebImages(p.webImages || []) // Gán mặc định ban đầu
    
    try {
      const detail = await getProductDetail(selectedListId, p.id)
      if (detail) {
        // Ưu tiên webImages (đã upload lên Storage), fallback sang images cũ
        const imgs = (detail.webImages && detail.webImages.length > 0)
          ? detail.webImages
          : (detail.images || [])
        setWebImages(imgs)
      }
    } catch (err) {
      console.warn("Lỗi tải chi tiết ảnh sản phẩm:", err)
    }
  }

  const handleEditProduct = openEditModal

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length || !editingProduct) return
    if (webImages.length + files.length > 5) {
      toast('Chỉ cho phép tải tối đa 5 hình ảnh thực tế!', 'error')
      return
    }

    setUploadingImages(true)
    try {
      const uploadedUrls = []
      // Kiểm tra môi trường: nếu là trình duyệt Web thông thường (không phải Electron) thì bypass Storage luôn để tránh CORS retry làm treo giao diện
      const isElectron = typeof window !== 'undefined' && (!!window.electronUpdater || navigator.userAgent.indexOf('Electron') >= 0)
      const useBase64Directly = !isElectron

      for (let i = 0; i < files.length; i++) {
        const blob = await compressImage(files[i])
        
        if (useBase64Directly) {
          const base64Url = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(blob)
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
          })
          uploadedUrls.push(base64Url)
        } else {
          try {
            const url = await uploadProductImageFile(
              selectedListId, editingProduct.id, blob, 'jpg', webImages.length + i
            )
            uploadedUrls.push(url)
          } catch (storageErr) {
            console.warn("Storage upload failed, falling back to base64 Data URL:", storageErr)
            const base64Url = await new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.readAsDataURL(blob)
              reader.onloadend = () => resolve(reader.result)
              reader.onerror = reject
            })
            uploadedUrls.push(base64Url)
          }
        }
      }
      setWebImages(prev => [...prev, ...uploadedUrls])
      toast('Đã tải ảnh lên thành công!', 'success')
    } catch (err) {
      toast('Lỗi tải ảnh: ' + err.message, 'error')
    } finally {
      setUploadingImages(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = (indexToRemove) => {
    setWebImages(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleMoveImage = (index, direction) => {
    setWebImages(prev => {
      const newImages = [...prev]
      if (direction === 'left' && index > 0) {
        const temp = newImages[index]
        newImages[index] = newImages[index - 1]
        newImages[index - 1] = temp
      } else if (direction === 'right' && index < newImages.length - 1) {
        const temp = newImages[index]
        newImages[index] = newImages[index + 1]
        newImages[index + 1] = temp
      }
      return newImages
    })
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.style.opacity = '0.4'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
    setDraggedIndex(null)
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) return

    setWebImages(prev => {
      const newList = [...prev]
      const [draggedItem] = newList.splice(draggedIndex, 1)
      newList.splice(targetIndex, 0, draggedItem)
      return newList
    })
  }

  // AI Assistant Services using Gemini API
  const callGeminiAI = async (promptText) => {
    const apiKey = atob('QVEuQWI4Uk42SWVYb05mSjI0ZTh3RmVFR3JJXy1OS1JrWWZjSUprZS1NZENqTzRzUDN6RGc=')
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    })
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData?.error?.message || `HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textResult) {
      throw new Error('Không nhận được phản hồi từ AI.')
    }
    return textResult
  }

  const handleGenerateAIQuote = async (order) => {
    setAiQuoteModal(order)
    setGeneratingQuote(true)
    setAiQuoteDraft('')
    try {
      let prompt = `Bạn là kỹ sư tư vấn của Công Ty Máy Bơm T&T (Việt Nam). Hãy soạn một tin nhắn tư vấn và báo giá sỉ/lẻ qua Zalo thật lịch sự, ngắn gọn và đầy thuyết phục để gửi cho khách hàng sau:
Tên khách hàng: ${order.customerName}
SĐT: ${order.customerPhone}
Địa chỉ: ${order.customerAddress || 'Chưa cung cấp'}
Loại yêu cầu: ${order.orderType === 'callback' ? 'Yêu cầu gọi lại tư vấn kỹ thuật' : 'Yêu cầu báo giá sản phẩm'}
`

      if (order.orderType === 'callback') {
        prompt += `Nội dung yêu cầu tính chọn / tư vấn của khách: "${order.orderNote || 'Cần tư vấn chọn máy bơm nước'}"`
      } else {
        prompt += `Các sản phẩm khách chọn:
` + order.items?.map(item => `- ${item.name} (${item.brand}) x ${item.quantity}`).join('\n') + `
Ghi chú của khách: "${order.orderNote || 'Không có'}"`
      }

      prompt += `

Yêu cầu nội dung tin nhắn soạn thảo:
1. Xưng hô lịch sự (Chào anh/chị ${order.customerName}).
2. Xác nhận thông tin nhu cầu của khách hàng (Cột áp, lưu lượng, hoặc mã máy bơm họ quan tâm).
3. Đưa ra đề xuất máy bơm hoặc phương án kỹ thuật phù hợp, nhấn mạnh thế mạnh bơm T&T (độ bền, bảo hành dài hạn, thương hiệu uy tín, phân phối chính hãng).
4. Đề nghị gửi thêm catalog chi tiết và báo giá có chiết khấu tốt nhất qua Zalo.
5. Giọng điệu chuyên nghiệp, ngắn gọn (dưới 300 từ), có biểu tượng icon sinh động để gửi Zalo/SMS. Không có placeholder chưa điền, nếu thiếu thông số hãy khéo léo hỏi khách thêm.`

      const result = await callGeminiAI(prompt)
      setAiQuoteDraft(result)
    } catch (err) {
      console.error(err)
      setAiQuoteDraft(`Chào anh/chị ${order.customerName},\n\nEm đã nhận được yêu cầu cần tư vấn máy bơm của mình trên website. Kỹ sư T&T sẽ liên hệ trực tiếp hỗ trợ mình ngay nhé ạ! SĐT liên hệ của em: 0984.273.806.\n\n(Lỗi AI: ${err.message})`)
    } finally {
      setGeneratingQuote(false)
    }
  }

  const handleGenerateAIDesc = async () => {
    if (!editingProduct?.name) {
      alert('Vui lòng nhập tên sản phẩm trước khi gọi AI viết mô tả!')
      return
    }
    setGeneratingDesc(true)
    try {
      const prompt = `Viết một bài mô tả sản phẩm máy bơm nước chi tiết cho Công Ty Máy Bơm T&T dựa trên các thông số sau:
Tên sản phẩm: ${editingProduct.name}
Thương hiệu: ${webBrand || 'UPTI PUMP'}
Thông số công suất đầu vào (ĐƠN VỊ LÀ kW): ${power || 'chưa rõ'} kW. (Lưu ý quan trọng: Giá trị này là kW. Hãy đổi kW ra HP theo quy đổi: 1 kW ≈ 1.36 HP. Ví dụ: 0.37 kW ≈ 0.5 HP, 0.55 kW ≈ 0.75 HP, 0.75 kW ≈ 1.0 HP, 1.1 kW ≈ 1.5 HP, 1.5 kW ≈ 2.0 HP, 2.2 kW ≈ 3.0 HP. Làm tròn HP đẹp mắt).
Thông số Cột áp H và Lưu lượng Q do Admin nhập: ${head || 'chưa rõ'}.

Hãy lấy các thông số trên để thay đổi và hoàn thiện bài viết theo ĐÚNG BỐ CỤC VÀ STYLE của biểu mẫu dưới đây. Giữ nguyên định dạng tiêu đề, các dấu gạch ngang phân cách, các chữ viết hoa. Không được tóm tắt.

BIỂU MẪU MẪU CẦN TUÂN THỦ (Thay các thông số trong ngoặc vuông [] bằng thông số của sản phẩm hiện tại):

BƠM HỎA TIỄN [Thương hiệu viết HOA, ví dụ: SELANNI] [Tên sản phẩm, ví dụ: 2.5SLM1.5/17-0.37] ([Công suất kW]kW - [Công suất HP]HP | [Điện áp, ví dụ: 1 PHA 220V hoặc 3 PHA 380V])
Giải pháp bơm chìm giếng khoan đường kính nhỏ [Đường kính inch, ví dụ: 2.5 Inch hoặc 3 Inch hoặc 4 Inch] – Công nghệ Ý (Italy)

===============================================================
I. TỔNG QUAN & LỢI THẾ CẠNH TRANH ĐỘC QUYỀN

[Tên sản phẩm] là dòng máy bơm chìm giếng khoan (bơm hỏa tiễn) đa tầng cánh chất lượng cao được thiết kế theo tiêu chuẩn kỹ thuật hiện đại của thương hiệu [Thương hiệu]. Sản phẩm là lựa chọn tối ưu cho hệ thống cấp nước hộ gia đình, khu trọ hoặc tưới tiêu nông nghiệp với những ưu điểm nổi bật:

Khắc phục giới hạn giếng khoan nhỏ: Với đường kính thân bơm nhỏ gọn chỉ [Đường kính inch, ví dụ: 2.5 Inch (~63 mm) cho ống giếng 70-76mm, hoặc 3 Inch (~75 mm) cho ống giếng 90-110mm, hoặc 4 Inch (~96 mm) cho ống giếng 110mm trở lên], máy thả vừa vặn vào các ống giếng. Đây là giải pháp hoàn hảo cho các giếng khoan lâu năm bị hẹp, cong lượn hoặc hộ gia đình sử dụng giếng khoan ống nhỏ để tiết kiệm chi phí khoan giếng.

Hiệu suất lưu lượng và áp lực cân bằng tối ưu: Sở hữu cụm buồng bơm [Số tầng cánh, ví dụ: lấy số sau dấu gạch chéo trong tên bơm như 2.5SLM1.5/17-0.37 là 17 tầng cánh, 3SLM3/16-0.55 là 16 tầng cánh] tầng cánh ly tâm kết hợp động cơ công suất [Công suất kW]kW ([Công suất HP]HP), máy có thể đẩy cao lên đến [Cột áp đẩy cao tối đa] với lưu lượng nước rất lớn đạt tối đa [Lưu lượng tối đa]. Sản phẩm hoạt động cực kỳ tiết kiệm điện và bền bỉ trong mạng lưới điện [Điện áp].

II. THÔNG SỐ KỸ THUẬT & ƯỚC TÍNH HIỆU SUẤT THỦY LỰC

THÔNG SỐ KỸ THUẬT CHI TIẾT:

Thương hiệu / Công nghệ: [Thương hiệu] (Ý - Italy)

Mã sản phẩm (Model): [Tên sản phẩm] (Mã Web: [Tên mã rút gọn, ví dụ: bỏ đuôi công suất như 2.5SLM1.5/17-0.37 thành 2.5SLM1.5/17])

Chủng loại: Bơm hỏa tiễn / Bơm chìm giếng khoan đa tầng cánh

Công suất định mức: [Công suất kW] kW (~ [Công suất HP] HP)

Điện áp / Tần số: [Điện áp] / 50Hz (Điện dân dụng hoặc điện công nghiệp)

Cột áp đẩy cao tối đa (H max): [Cột áp tối đa]

Lưu lượng tối đa (Q max): [Lưu lượng tối đa]

Cấu tạo buồng bơm: [Số tầng cánh] tầng cánh tạo áp

Đường kính thân bơm: [Đường kính thân bơm, ví dụ: 2.5 Inch (~63 mm), 3 Inch (~75 mm), 4 Inch (~96 mm)] – Phù hợp ống giếng từ [Đường kính ống giếng tương ứng] trở lên

Đường kính họng xả: Chuẩn ren trong [Ren trong họng xả, ví dụ: 1 inch (34 mm) hoặc 1.25 inch (42 mm)]

Cấp bảo vệ chống nước: IP68 (Chống ngập nước tuyệt đối)

Cấp cách điện động cơ: Lớp B / F (Chịu nhiệt tốt, bảo vệ động cơ)

ƯỚC TÍNH HIỆU SUẤT THỰC TẾ THEO ĐỘ SÂU:
(Lưu ý: Cột áp H và Lưu lượng Q tỷ lệ nghịch với nhau. Đẩy càng cao thì lưu lượng nước ra sẽ giảm dần theo quy luật thủy lực. Hãy tính toán ước lượng hợp lý dựa trên H max và Q max của máy bơm này):
- Ở cột áp thấp (ví dụ bằng 1/4 cột áp tối đa): Lưu lượng đạt khoảng [ước lượng Q cao] m3/h => Nước ra cực kỳ đều và mạnh.
- Ở cột áp trung bình (ví dụ bằng 1/2 cột áp tối đa): Lưu lượng đạt khoảng [ước lượng Q trung bình] m3/h => Mức vận hành tối ưu hiệu suất cho sinh hoạt gia đình.
- Ở cột áp cao (ví dụ bằng 3/4 cột áp tối đa): Lưu lượng đạt khoảng [ước lượng Q thấp] m3/h => Phù hợp đẩy lên bồn chứa sân thượng nhà cao tầng.
- Ở cột áp tối đa [Cột áp tối đa]: Lưu lượng tiến về ngưỡng tối thiểu.

III. CẤU TẠO VẬT LIỆU & CÔNG NGHỆ BẢO VỆ

Vỏ bơm & Thân động cơ: Chế tạo từ Inox 304 chống oxy hóa, chống ăn mòn điện hóa, chịu được áp lực nước ngầm và không rỉ sét khi ngâm lâu năm trong giếng.

Hệ thống [Số tầng cánh] tầng cánh: Chế tạo từ nhựa kỹ thuật cao cấp Noryl/POM chịu ma sát tốt, thiết kế cánh ly tâm giảm tải cho động cơ và hạn chế tối đa hiện tượng kẹt cát mịn.

Trục bơm đồng trục: Thép không gỉ gia công độ chính xác cao, giúp động cơ và buồng cánh quay êm ái, hạn chế rung chấn khi hoạt động.

Phớt cơ khí kép: Chuẩn chống nước IP68, ngăn nước và cát mịn xâm nhập tuyệt đối vào khoang stato của động cơ.

Động cơ quấn 100% dây đồng nguyên chất: Hiệu suất truyền tải cao, máy chạy êm, tản nhiệt tốt, bảo vệ máy bền bỉ qua nhiều năm sử dụng.

IV. HƯỚNG DẪN CHỌN VẬT TƯ ĐỒNG BỘ CHO KỸ THUẬT VIÊN

Đường ống dẫn nước: Khuyến nghị sử dụng ống nhựa HDPE hoặc ống PVC chịu áp có đường kính [đường kính ống nước phù hợp với họng xả] để khớp ren họng xả, giúp duy trì áp lực đẩy đều nhất.

Dây cáp điện chống nước:
- Với độ sâu dưới 45 mét: Sử dụng cáp đồng đúc chống nước 2 lõi chuyên dụng tiết diện 2 x 1.5 mm2 (hoặc 2 x 2.5 mm2 tùy công suất).
- Các điểm nối cáp ngầm dưới nước bắt buộc phải quấn chống ngấm nước bằng băng keo tự nóng chảy chuyên dụng.

Aptomat / Cầu dao bảo vệ: Sử dụng Aptomat (CB) phù hợp với công suất. Nên kết hợp thêm rơ-le chống cạn hoặc Tủ điện bảo vệ để tránh trường hợp bơm chạy khô khi mực nước giếng hạ xuống thấp.

V. QUY TRÌNH KỸ THUẬT LẮP ĐẶT & VẬN HÀNH CHUẨN

Khảo sát & Vệ sinh giếng: Sục bồn giếng sạch cát trước khi thả bơm. Đảm bảo kích thước lòng giếng thông thoáng tối thiểu phù hợp với thân bơm.

Vị trí treo máy bơm:
- Bơm cần được ngập dưới mực nước tĩnh ít nhất 2 đến 3 mét để giải nhiệt cho động cơ.
- Khoảng cách an toàn với đáy giếng: Máy phải cách đáy giếng tối thiểu 2 đến 3 mét để tránh hút phải bùn cát đáy gây mòn cánh bơm.

Kỹ thuật neo treo: Dùng dây cáp Inox hoặc dây cáp chịu lực chuyên dụng neo vào mắt treo trên đầu bơm. Tuyệt đối không dùng dây điện hoặc ống nước làm dây chịu lực kéo/thả máy.

Kích hoạt lần đầu: Cho máy chạy xả nước ra ngoài trong 15 - 30 phút đầu cho đến khi nước giếng hoàn toàn trong sạch mới kết nối lên bồn chứa sinh hoạt.

VI. BẢNG CHẨN ĐOÁN & KHẮC PHỤC SỰ CỐ THƯỜNG GẶP

TRƯỜNG HỢP 1: Máy chạy nhưng nước không lên hoặc lên rất yếu
- Nguyên nhân: Mực nước ngầm tụt thấp hơn miệng hút; điện áp quá yếu (<180V); chiều cao đẩy thực tế vượt quá [Cột áp tối đa].
- Khắc phục: Kiểm tra chiều sâu mực nước giếng, hạ chiều sâu treo bơm thêm; kiểm tra lại nguồn điện.

TRƯỜNG HỢP 2: Máy tự ngắt / Nhảy Aptomat khi vừa bật máy
- Nguyên nhân: Cát lớn hoặc sỏi làm kẹt buồng [Số tầng cánh] tầng cánh; mối nối cáp điện ngầm dưới nước bị thâm nước rò điện; buồng cánh bám cặn phèn lâu ngày.
- Khắc phục: Kéo máy lên kiểm tra, tháo xịt thau rửa cụm cánh bơm cho sạch cát phèn; kiểm tra lại độ kín nước của mối nối dây điện.

TRƯỜNG HỢP 3: Nước bơm lên có nhiều cát, đục lợn cợn
- Nguyên nhân: Treo bơm quá sát đáy giếng; giếng khoan chưa được sục lọc tầng cát kỹ.
- Khắc phục: Kéo cao dây treo bơm lên thêm 1.5 - 2 mét để tránh hút bùn cát ở đáy giếng.

VII. CHÍNH SÁCH BẢO HÀNH, ĐỔI TRẢ & THÔNG TIN LIÊN HỆ

Nhằm mang lại sự an tâm tuyệt đối cho khách hàng khi sử dụng các dòng máy bơm cao cấp [Thương hiệu] (Ý), chúng tôi áp dụng quy trình hỗ trợ đổi/trả sản phẩm minh bạch và chuyên nghiệp theo 3 bước:
- Bước 1: Gọi ngay Hotline/Zalo: 0984.273.806 (Mr. Tuấn) và cho chúng tôi biết lý do cần đổi/trả sản phẩm.
- Bước 2: Sau khi công ty xác nhận phù hợp với quy định, quý vị gửi hàng về địa chỉ văn phòng:
📍 LK 27,28 KĐT Dương Nội, (Cạnh nhà máy SYM) Hà Đông, Hà Nội
📞 SĐT: 0984.273.806 – Mr. Tuấn
- Bước 3: Ngay sau khi nhận và kiểm tra hàng cần đổi, chúng tôi sẽ liên hệ khách hàng để gửi lại sản phẩm mới hoả tốc.

===============================================================
TƯ VẤN KỸ THUẬT & ĐẶT HÀNG NGAY:

Hotline / Zalo Tư vấn & Kỹ thuật: 0984.273.806 (Mr. Tuấn)

Văn phòng & Kho hàng: LK 27,28 KĐT Dương Nội (Cạnh nhà máy SYM), Hà Đông, Hà Nội.

CHÚ Ý QUAN TRỌNG:
1. KHÔNG được dùng bất kỳ dấu bôi đậm Markdown ** hay * hay # nào trong bài viết. Hãy dùng văn bản thuần (Plain Text).
2. Hãy thay đổi chính xác tất cả các thông tin về thương hiệu, tên máy bơm, công suất kW, HP tương ứng và ước lượng hiệu suất đẩy cao theo cột áp thực tế.
3. Chỉ xuất ra nội dung bài viết theo cấu trúc trên, tuyệt đối không viết thêm lời dẫn hay giải thích gì khác.
${aiCustomInstruction ? `\n5. YÊU CẦU ĐẶC BIỆT CỦA ADMIN (HÃY TUÂN THỦ TUYỆT ĐỐI): ${aiCustomInstruction}` : ''}`

      let result = await callGeminiAI(prompt)
      
      // Dọn dẹp các ký tự định dạng Markdown dư thừa để hiển thị văn bản thuần đẹp mắt
      result = result.replace(/\*\*/g, '') // Xóa dấu bôi đậm **
      result = result.replace(/^\s*\*\s+/gm, '- ') // Chuyển đổi bullet point * sang -
      result = result.replace(/([^\*])\*([^\*]+)\*([^\*])/g, '$1$2$3') // Xóa dấu in nghiêng *
      result = result.replace(/`{3,}[a-z]*\n?/g, '') // Xóa khối code ```
      result = result.replace(/`([^`]+)`/g, '$1') // Xóa inline code `
      result = result.replace(/^\s*#+\s+/gm, '') // Xóa ký tự tiêu đề #
      result = result.trim()

      setWebDesc(result)
      toast('Đã dùng AI tạo mô tả sản phẩm thành công!', 'success')
    } catch (err) {
      alert('Lỗi tạo mô tả AI: ' + err.message)
    } finally {
      setGeneratingDesc(false)
    }
  }

  const handleAutoFormatDesc = () => {
    if (!webDesc) return
    let formatted = webDesc
    
    // Dọn dẹp các ký tự định dạng Markdown dư thừa
    formatted = formatted.replace(/\*\*/g, '')
    formatted = formatted.replace(/^\s*\*\s+/gm, '- ')
    formatted = formatted.replace(/([^\*])\*([^\*]+)\*([^\*])/g, '$1$2$3')
    formatted = formatted.replace(/`{3,}[a-z]*\n?/g, '')
    formatted = formatted.replace(/`([^`]+)`/g, '$1')
    formatted = formatted.replace(/^\s*#+\s+/gm, '')
    
    // 1. Chuẩn hóa xuống dòng
    formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    
    // 2. Tách dòng trước các tiêu đề La Mã
    formatted = formatted.replace(/([^\n])\s*\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\./g, '$1\n\n$2.')
    
    // 3. Tự động sửa dấu chấm sát chữ viết hoa (Ví dụ: nhỏ.Hiệu suất -> nhỏ. Hiệu suất)
    const viCaps = 'A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸYĐ';
    const capRegex = new RegExp(`\\.([${viCaps}])`, 'g');
    formatted = formatted.replace(capRegex, '. $1')
    
    // 4. Xuống dòng trước các từ khóa tiêu đề quan trọng
    const keywords = ['Hiệu suất', 'Thông số', 'Ứng dụng', 'Cấu tạo', 'Ưu điểm', 'Đặc điểm', 'Lưu ý', 'Bảo hành'];
    keywords.forEach(keyword => {
      const kwRegex = new RegExp(`\\.\\s+(${keyword})`, 'g');
      formatted = formatted.replace(kwRegex, '.\n\n$1');
    });

    // 5. Tách dòng các ký tự đầu dòng (bullet points) bị dính liền
    formatted = formatted.replace(/([^\n])\s*([\-+•])\s+([A-ZÀ-Ỹa-zà-ỹ])/g, '$1\n$2 $3')

    // 6. Rút gọn nhiều dòng trống liên tiếp
    formatted = formatted.replace(/\n{3,}/g, '\n\n')

    setWebDesc(formatted.trim())
    toast('Đã tự động định dạng và xuống dòng mô tả!', 'success')
  }

  const handleSave = async () => {
    if (!editingProduct || savingProduct) return
    setSavingProduct(true)
    try {
      // 1. Nén toàn bộ ảnh trong webImages (nếu là base64)
      const compressedWebImages = []
      for (const img of webImages) {
        if (typeof img === 'string' && img.startsWith('data:')) {
          const comp = await compressBase64Image(img)
          compressedWebImages.push(comp)
        } else {
          compressedWebImages.push(img)
        }
      }

      // 2. Nén toàn bộ ảnh cũ trong trường images (nếu có base64) để giải phóng dung lượng document
      const compressedLegacyImages = []
      const legacyImages = editingProduct.images || []
      for (const img of legacyImages) {
        if (typeof img === 'string' && img.startsWith('data:')) {
          const comp = await compressBase64Image(img)
          compressedLegacyImages.push(comp)
        } else {
          compressedLegacyImages.push(img)
        }
      }

      // Cho phép lưu cả ảnh Storage (https://) và ảnh base64 đã nén
      const validImages = compressedWebImages.filter(
        img => typeof img === 'string' && (img.startsWith('https://') || img.startsWith('data:'))
      )

      const dataToUpdate = {
        showOnWeb,
        webBrand,
        name: webName,
        code: webCode,
        group: webGroup,
        webDesc,
        webImages: validImages,
        images: compressedLegacyImages, // Cập nhật lại trường ảnh cũ đã nén
        webSpecs: {
          power,
          specs: head,
          voltage
        }
      }
      await updateProduct(selectedListId, editingProduct.id, dataToUpdate)
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...dataToUpdate } : p))
      setEditingProduct(null)
      toast('Đã cập nhật thông tin Web cho sản phẩm!', 'success')
    } catch (err) {
      console.error('Lỗi lưu sản phẩm web:', err)
      toast('Lỗi cập nhật: ' + (err?.message || 'Không rõ lỗi. Kiểm tra Console.'), 'error')
    } finally {
      setSavingProduct(false)
    }
  }

  const handleSaveCategories = async () => {
    setSavingCats(true)
    try {
      const filtered = categoriesList.filter(c => c.name.trim())
      const migrated = []
      for (const cat of filtered) {
        if (cat.image && typeof cat.image === 'string' && cat.image.startsWith('data:')) {
          try {
            const blob = await dataUrlToBlob(cat.image)
            try {
              const url = await uploadWebCategoryImage(blob, 'jpg')
              migrated.push({ ...cat, image: url })
            } catch (uploadErr) {
              console.warn("Category image storage upload failed, compressing base64 directly...", uploadErr)
              // Aggressively re-compress base64 to keep payload tiny (3-5KB)
              const compressedBlob = await compressCategoryImage(blob)
              const base64Url = await blobToBase64(compressedBlob)
              migrated.push({ ...cat, image: base64Url })
            }
          } catch (err) {
            console.error("Error processing category image:", err)
            migrated.push(cat)
          }
        } else {
          migrated.push(cat)
        }
      }
      await saveWebCategories(migrated)
      setCategoriesList(migrated)
      toast('Đã lưu danh mục lọc thành công!', 'success')
      setShowCatModal(false)
    } catch (err) {
      toast('Lỗi lưu danh mục: ' + err.message, 'error')
    } finally {
      setSavingCats(false)
    }
  }

  const handleCategoryClassImageUpload = async (index, file) => {
    try {
      const blob = await compressCategoryImage(file)
      try {
        const url = await uploadWebCategoryImage(blob, 'jpg')
        setCategoriesList(prev => prev.map((item, idx) => idx === index ? { ...item, image: url } : item))
        toast('Tải ảnh danh mục thành công!', 'success')
      } catch (storageErr) {
        console.warn("Storage upload failed, falling back to compressed base64 Data URL:", storageErr)
        const base64Url = await blobToBase64(blob)
        setCategoriesList(prev => prev.map((item, idx) => idx === index ? { ...item, image: base64Url } : item))
        toast('Đã lưu ảnh danh mục tạm thời dưới dạng base64 đã nén!', 'success')
      }
    } catch (err) {
      toast('Lỗi tải ảnh danh mục: ' + err.message, 'error')
    }
  }

  const handleQuickToggleWeb = async (p, val) => {
    try {
      await updateProduct(selectedListId, p.id, { showOnWeb: val })
      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, showOnWeb: val } : item))
      toast(val ? 'Đã hiển thị trên Web!' : 'Đã ẩn khỏi Web!', 'success')
    } catch (err) {
      toast('Lỗi cập nhật: ' + err.message, 'error')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ flex: 1 }}>Cấu hình sản phẩm Web 🌐</h2>
        
        {/* Nút mở nhanh trang Web */}
        <button 
          className="btn" 
          onClick={() => window.open('https://bang-gia-tandt.web.app/#web', '_blank')}
          style={{ background: 'var(--accent-s)', color: 'var(--accent)', borderColor: 'rgba(45,76,247,0.2)', fontWeight: 'bold' }}
        >
          🔗 Mở Web Catalog
        </button>

        <button 
          className="btn" 
          onClick={() => setShowCatModal(true)}
          style={{ background: 'var(--surface2)', color: 'var(--text)', fontWeight: 'bold' }}
        >
          ⚙️ Quản lý danh mục lọc
        </button>

        {/* Selector bảng giá */}
        <select 
          className="select" 
          value={selectedListId} 
          onChange={e => setSelectedListId(e.target.value)}
          style={{ minWidth: 200, padding: '6px 12px' }}
        >
          {lists.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Input Tìm kiếm */}
        <div className="search-wrap" style={{ width: 220 }}>
          <span className="search-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input className="input" placeholder="Tìm mã, tên..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>
      {/* Admin Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 24px' }}>
        <button 
          onClick={() => setActiveAdminTab('products')}
          style={{
            padding: '14px 20px', background: 'none', border: 'none',
            borderBottom: activeAdminTab === 'products' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            color: activeAdminTab === 'products' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 'bold', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          📦 Cấu hình sản phẩm
        </button>
        <button 
          onClick={() => setActiveAdminTab('orders')}
          style={{
            padding: '14px 20px', background: 'none', border: 'none',
            borderBottom: activeAdminTab === 'orders' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            color: activeAdminTab === 'orders' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 'bold', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            position: 'relative'
          }}
        >
          🛒 Đơn hàng từ Web
          {orders.filter(o => o.status === 'pending').length > 0 && (
            <span style={{
              marginLeft: 6, background: '#ef4444', color: '#fff', fontSize: 9.5,
              fontWeight: 800, padding: '2px 6px', borderRadius: 10
            }}>
              {orders.filter(o => o.status === 'pending').length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveAdminTab('hero_slides')}
          style={{
            padding: '14px 20px', background: 'none', border: 'none',
            borderBottom: activeAdminTab === 'hero_slides' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            color: activeAdminTab === 'hero_slides' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 'bold', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          🖼️ Banner Hero Carousel ({heroSlidesList.length} Banner)
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {activeAdminTab === 'products' ? (
          <>
            <div className="card" style={{ marginBottom: 16, background: 'var(--accent-s)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 13, color: 'var(--accent)' }}>
                <strong>Quản lý hiển thị Web</strong> — Tích hợp trực tiếp với catalog công cộng của máy bơm T&T. Bật gạt để xuất bản sản phẩm, hoặc click "Cấu hình" để bổ sung thương hiệu, thông số kỹ thuật cho Trợ lý AI.
              </div>
            </div>

            <div className="card">
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ flex: 1 }}>Sản phẩm ({filteredProducts.length}/{products.length})</h3>
              </div>

              {loadingProducts ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <span className="spinner" style={{ width: 24, height: 24 }}/>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text3)' }}>Đang tải danh sách...</div>
                </div>
              ) : products.length === 0 ? (
                <div className="empty" style={{ padding: '40px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                  <div>Bảng giá này chưa có sản phẩm nào</div>
                </div>
              ) : (
                <MobileTableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 80, textAlign: 'center' }}>Đăng Web</th>
                        <th>Mã sản phẩm</th>
                        <th>Tên sản phẩm</th>
                        <th>Thương hiệu</th>
                        <th style={{ textAlign: 'right' }}>Giá gốc</th>
                        <th style={{ textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(p => (
                        <tr key={p.id}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={p.showOnWeb || false}
                              onChange={e => handleQuickToggleWeb(p, e.target.checked)}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td className="td-mono">{p.code}</td>
                          <td>
                            <div>{p.name}</div>
                            {p.group && <span className="badge badge-blue" style={{ fontSize: 9, padding: '2px 6px', marginTop: 4, display: 'inline-block' }}>{p.group}</span>}
                          </td>
                          <td>
                            {p.showOnWeb ? (
                              <span className="badge badge-amber" style={{ fontSize: 10 }}>{p.webBrand || 'UPTI PUMP'}</span>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.price)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn sm" onClick={() => handleEditProduct(p)} style={{ fontSize: 12 }}>
                              ⚙️ Cấu hình Web
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </MobileTableWrap>
              )}
            </div>
          </>
        ) : activeAdminTab === 'orders' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Danh sách đơn đặt hàng & yêu cầu gọi lại ({orders.length})</h3>
            </div>

            {orders.length === 0 ? (
              <div className="card empty" style={{ padding: '60px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>Chưa có đơn đặt hàng hoặc yêu cầu nào từ Web.</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Khi khách hàng gửi đơn trên Web, thông báo sẽ lập tức hiển thị tại đây.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.map(order => (
                  <div 
                    key={order.id} 
                    className="card" 
                    style={{
                      background: order.status === 'pending' ? 'rgba(59,130,246,0.03)' : 'var(--surface)',
                      border: order.status === 'pending' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 12
                    }}
                  >
                    {/* Header đơn */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>
                          {order.orderType === 'callback' ? '📞' : '🛒'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--text)' }}>
                            {order.customerName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            Mã đơn: #{order.id?.slice(0, 8)} • Loại: {order.orderType === 'callback' ? 'Yêu cầu tư vấn kỹ thuật' : 'Đặt mua sản phẩm'}
                          </div>
                        </div>
                      </div>

                      {/* Trạng thái đơn */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select 
                          value={order.status || 'pending'} 
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="select sm"
                          style={{
                            fontWeight: 'bold',
                            fontSize: 12,
                            background: order.status === 'done' ? '#ecfdf5' : order.status === 'contacted' ? '#eff6ff' : order.status === 'cancelled' ? '#fef2f2' : '#fffbeb',
                            color: order.status === 'done' ? '#059669' : order.status === 'contacted' ? '#2563eb' : order.status === 'cancelled' ? '#dc2626' : '#d97706',
                            borderColor: order.status === 'done' ? '#a7f3d0' : order.status === 'contacted' ? '#bfdbfe' : order.status === 'cancelled' ? '#fca5a5' : '#fde68a'
                          }}
                        >
                          <option value="pending">⏳ Chờ xử lý</option>
                          <option value="contacted">📞 Đã liên hệ</option>
                          <option value="done">✅ Hoàn thành</option>
                          <option value="cancelled">❌ Đã hủy</option>
                        </select>

                        <button 
                          onClick={() => handleDeleteOrder(order.id)}
                          className="btn xs"
                          style={{ color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
                          title="Xóa đơn hàng"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tab 3: Hero Slides Banner Management (Unlimited Slides + Custom Text Positioning) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Top Header Controls */}
            <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🖼️ Quản lý Banner Hero Carousel ({heroSlidesList.length} Banner)</span>
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
                  Thêm không giới hạn banner, tải ảnh trực tiếp, bật/tắt chữ đè lên ảnh và tùy chỉnh vị trí chữ (trái, phải, giữa...).
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleAddNewSlide}
                  className="btn"
                  style={{
                    background: '#10B981',
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    padding: '9px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  ➕ THÊM BANNER MỚI
                </button>

                <button
                  onClick={handleSaveHeroSlides}
                  disabled={savingHeroSlides}
                  className="btn"
                  style={{
                    background: 'var(--accent)',
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    padding: '9px 24px',
                    borderRadius: 8,
                    fontSize: 13.5,
                    cursor: savingHeroSlides ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(45,76,247,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {savingHeroSlides ? '⏳ Đang lưu...' : '💾 XUẤT BẢN BANNER LÊN WEB'}
                </button>
              </div>
            </div>

            {/* Unlimited Hero Slides List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
              {heroSlidesList.map((slide, sIdx) => {
                const currentImg = slide.img || slide.defaultImg;
                return (
                  <div key={slide.id || sIdx} className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    
                    {/* Header Row: Slide number + Name input + Move + Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', fontFamily: 'monospace', background: 'var(--accent-s)', padding: '3px 8px', borderRadius: 6 }}>
                          0{sIdx + 1}
                        </span>
                        <input
                          type="text"
                          className="input"
                          value={slide.title || ''}
                          onChange={e => handleUpdateSlideField(sIdx, 'title', e.target.value)}
                          placeholder="Tên slide / Dòng bơm..."
                          style={{ flex: 1, fontSize: 13, fontWeight: 'bold', padding: '4px 8px' }}
                        />
                      </div>

                      {/* Reorder and Delete */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleMoveSlide(sIdx, 'up')}
                          disabled={sIdx === 0}
                          className="btn xs"
                          style={{ padding: '4px 8px', cursor: sIdx === 0 ? 'not-allowed' : 'pointer' }}
                          title="Di chuyển lên trước"
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => handleMoveSlide(sIdx, 'down')}
                          disabled={sIdx === heroSlidesList.length - 1}
                          className="btn xs"
                          style={{ padding: '4px 8px', cursor: sIdx === heroSlidesList.length - 1 ? 'not-allowed' : 'pointer' }}
                          title="Di chuyển ra sau"
                        >
                          ▶
                        </button>
                        <button
                          onClick={() => handleDeleteSlide(sIdx)}
                          className="btn xs"
                          style={{ color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2', padding: '4px 8px' }}
                          title="Xóa banner này"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Live Preview Box with Realtime Text Overlay Positioning */}
                    <div style={{
                      position: 'relative',
                      height: 170,
                      background: '#071A2F',
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid rgba(8, 120, 217, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Image Layer */}
                      {currentImg ? (
                        <img
                          src={currentImg}
                          alt={slide.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            objectPosition: 'center',
                          }}
                        />
                      ) : (
                        <div style={{ color: '#64748B', fontSize: 12 }}>Chưa có ảnh banner</div>
                      )}

                      {/* Text Overlay (if enabled) */}
                      {slide.showText && (
                        <div style={{
                          position: 'absolute',
                          ...(slide.textPos === 'top-left' ? { top: 12, left: 12 } :
                             slide.textPos === 'top-right' ? { top: 12, right: 12 } :
                             slide.textPos === 'bottom-right' ? { bottom: 12, right: 12 } :
                             slide.textPos === 'center' ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' } :
                             { bottom: 12, left: 12 }),
                          background: 'rgba(7, 26, 47, 0.88)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          maxWidth: '65%',
                          backdropFilter: 'blur(6px)',
                          zIndex: 5,
                        }}>
                          {slide.badge && (
                            <div style={{ fontSize: 8.5, color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase' }}>
                              {slide.badge}
                            </div>
                          )}
                          {slide.headline && (
                            <div style={{ fontSize: 11.5, color: '#FFFFFF', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2 }}>
                              {slide.headline}
                            </div>
                          )}
                          {slide.desc && (
                            <div style={{ fontSize: 9.5, color: '#CBD5E1', lineHeight: 1.3, marginTop: 2 }}>
                              {slide.desc}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Image Controls: Upload File or URL */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        value={slide.img || ''}
                        placeholder="Dán link ảnh (URL) hoặc tải từ máy tính..."
                        onChange={e => handleUpdateSlideField(sIdx, 'img', e.target.value)}
                        style={{ flex: 1, fontSize: 12 }}
                      />

                      <label style={{
                        fontSize: 11.5,
                        fontWeight: 'bold',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        background: 'var(--accent-s)',
                        padding: '7px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(45,76,247,0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}>
                        📁 Tải ảnh
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadSlideImage(sIdx, file);
                          }}
                        />
                      </label>
                    </div>

                    {/* Text Overlay Settings Section */}
                    <div style={{ background: 'var(--surface2)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={!!slide.showText}
                            onChange={e => handleUpdateSlideField(sIdx, 'showText', e.target.checked)}
                            style={{ width: 16, height: 16 }}
                          />
                          <span>✍️ Hiển thị chữ đè lên Banner</span>
                        </label>

                        {slide.showText && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>Vị trí:</span>
                            <select
                              className="select"
                              value={slide.textPos || 'bottom-left'}
                              onChange={e => handleUpdateSlideField(sIdx, 'textPos', e.target.value)}
                              style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6 }}
                            >
                              <option value="bottom-left">Góc trái dưới</option>
                              <option value="top-left">Góc trái trên</option>
                              <option value="bottom-right">Góc phải dưới</option>
                              <option value="top-right">Góc phải trên</option>
                              <option value="center">Chính giữa</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {slide.showText && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Tag phụ (Badge):</label>
                              <input
                                type="text"
                                className="input"
                                value={slide.badge || ''}
                                placeholder="VD: BƠM BIẾN TẦN CHÂU ÂU"
                                onChange={e => handleUpdateSlideField(sIdx, 'badge', e.target.value)}
                                style={{ width: '100%', fontSize: 11.5, padding: '4px 8px' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Liên kết danh mục khi click:</label>
                              <input
                                type="text"
                                className="input"
                                value={slide.category || ''}
                                placeholder="VD: BƠM BIẾN TẦN"
                                onChange={e => handleUpdateSlideField(sIdx, 'category', e.target.value)}
                                style={{ width: '100%', fontSize: 11.5, padding: '4px 8px' }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Tiêu đề lớn (Headline):</label>
                            <input
                              type="text"
                              className="input"
                              value={slide.headline || ''}
                              placeholder="VD: ỔN ĐỊNH ÁP LỰC — TIẾT KIỆM ĐIỆN NĂNG"
                              onChange={e => handleUpdateSlideField(sIdx, 'headline', e.target.value)}
                              style={{ width: '100%', fontSize: 12, fontWeight: 'bold', padding: '4px 8px' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Mô tả ngắn:</label>
                            <input
                              type="text"
                              className="input"
                              value={slide.desc || ''}
                              placeholder="VD: Vận hành tự động hoàn toàn, êm ái 24/7..."
                              onChange={e => handleUpdateSlideField(sIdx, 'desc', e.target.value)}
                              style={{ width: '100%', fontSize: 11.5, padding: '4px 8px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Order Realtime Toast Alert */}
      {newOrderAlert && (
        <div style={{
          position: 'fixed', bottom: 30, left: 30, zIndex: 1100, background: '#fff',
          boxShadow: '0 12px 32px rgba(15,23,42,0.18)', borderRadius: 16, border: '2px solid var(--accent)',
          padding: 20, maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--accent)' }}>
              {newOrderAlert.orderType === 'callback' ? '📞 YÊU CẦU GỌI LẠI MỚI!' : '🔔 ĐƠN HÀNG MỚI TINH!'}
            </span>
            <button 
              onClick={() => setNewOrderAlert(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 12.5 }}>
            {newOrderAlert.orderType === 'callback' ? (
              <>
                Khách hàng <strong>{newOrderAlert.customerName}</strong> (SĐT: <strong>{newOrderAlert.customerPhone}</strong>) vừa gửi yêu cầu gọi lại tư vấn báo giá!
              </>
            ) : (
              <>
                Khách hàng <strong>{newOrderAlert.customerName}</strong> vừa đặt mua sản phẩm trị giá <strong>{fmt(newOrderAlert.totalAmount)}</strong>!
              </>
            )}
          </div>
          <button 
            onClick={() => {
              setActiveAdminTab('orders');
              setNewOrderAlert(null);
            }}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 12px', fontSize: 11.5, fontWeight: 'bold', cursor: 'pointer', marginTop: 4
            }}
          >
            {newOrderAlert.orderType === 'callback' ? 'XEM YÊU CẦU GỌI LẠI ➔' : 'XEM CHI TIẾT ĐƠN HÀNG ➔'}
          </button>
        </div>
      )}

      {/* Modal Edit */}
      {editingProduct && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              Cấu hình hiển thị Web: <span style={{ color: 'var(--accent)' }}>{editingProduct.code}</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '75vh', overflowY: 'auto', paddingRight: 4 }}>
              {/* Toggle showOnWeb & Thương hiệu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, background: 'var(--surface2)', padding: 10, borderRadius: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, marginBottom: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={showOnWeb}
                    onChange={e => setShowOnWeb(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  Đăng Web Catalog
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 'bold' }}>Hãng:</span>
                  <select className="select" value={webBrand} onChange={e => setWebBrand(e.target.value)} style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}>
                    <option value="UPTI PUMP">UPTI PUMP (Đài Loan)</option>
                    <option value="SELANNI">SELANNI (Ý)</option>
                    <option value="BERATI">BERATI (Ý)</option>
                    <option value="MASTRA">MASTRA (Trung Quốc)</option>
                  </select>
                </div>
              </div>

              {/* Sửa Tên sản phẩm & Mã hàng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>Tên sản phẩm trên Web:</label>
                  <input 
                    className="input" 
                    type="text" 
                    value={webName} 
                    onChange={e => setWebName(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>Mã hàng trên Web:</label>
                  <input 
                    className="input" 
                    type="text" 
                    value={webCode} 
                    onChange={e => setWebCode(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Sửa Danh mục nhóm bơm */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>Danh mục nhóm bơm (phục vụ bộ lọc):</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select 
                    className="select" 
                    value={categoriesList.map(c => c.name).includes(webGroup) ? webGroup : (webGroup ? '__CUSTOM__' : '')}
                    onChange={e => {
                      if (e.target.value !== '__CUSTOM__') {
                        setWebGroup(e.target.value)
                      } else {
                        setWebGroup('')
                      }
                    }}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="">-- Chọn từ danh mục mẫu sẵn có --</option>
                    {categoriesList.map((c, idx) => (
                      <option key={idx} value={c.name}>{c.name}</option>
                    ))}
                    <option value="__CUSTOM__">✨ Tự nhập tay danh mục mới...</option>
                  </select>
                  
                  {(!categoriesList.map(c => c.name).includes(webGroup) || webGroup === '') && (
                    <input 
                      className="input" 
                      style={{ padding: '6px 10px', fontSize: 13 }} 
                      placeholder="Hoặc tự gõ tên danh mục mới..." 
                      value={webGroup} 
                      onChange={e => setWebGroup(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Thông số AI */}
              <div style={{ border: '1px dashed var(--border)', padding: 10, borderRadius: 6 }}>
                <h4 style={{ fontSize: 12, marginBottom: 8, color: 'var(--accent)', fontWeight: 'bold' }}>⚙️ Thông số kỹ thuật phục vụ AI tư vấn</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>Công suất (HP/kW):</label>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} placeholder="Ví dụ: 3HP, 2.2kW..." value={power} onChange={e => setPower(e.target.value)}/>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>Điện áp:</label>
                    <select className="select" value={voltage} onChange={e => setVoltage(e.target.value)} style={{ padding: '5px 10px', fontSize: 13 }}>
                      <option value="220V">1 Pha (220V)</option>
                      <option value="380V">3 Pha (380V)</option>
                      <option value="220V/380V">220V/380V (Có cả 2 loại)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>Thông số H và Q (Cột áp - Lưu lượng):</label>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} placeholder="Ví dụ: H(m): 30-10 , Q(m3/h): 15-5..." value={head} onChange={e => setHead(e.target.value)}/>
                  </div>
                </div>
              </div>

              {/* Tải ảnh thực tế sản phẩm (Tối đa 5 ảnh) */}
              <div style={{ border: '1px solid var(--border)', padding: 10, borderRadius: 8, background: 'var(--surface2)' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>
                  📸 Hình ảnh thực tế sản phẩm (Tối đa 5 ảnh):
                </label>
                
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  {webImages.map((url, idx) => (
                    <div 
                      key={idx} 
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                      style={{ 
                        position: 'relative', width: 64, height: 64, border: '2.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff',
                        cursor: 'grab', userSelect: 'none', transition: 'opacity 0.2s, border-color 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
                      onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      title="Nhấn và kéo để sắp xếp lại ảnh"
                    >
                      <img src={url} alt={`Bơm ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                      
                      {/* Xóa ảnh */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                        style={{
                          position: 'absolute', top: 1, right: 1, width: 14, height: 14, borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', fontSize: 8,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                        }}
                        title="Xóa ảnh"
                      >
                        ✕
                      </button>

                      {/* Di chuyển ảnh sang trái */}
                      {idx > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveImage(idx, 'left'); }}
                          style={{
                            position: 'absolute', bottom: 1, left: 1, width: 14, height: 14, borderRadius: '4px',
                            background: 'rgba(15, 23, 42, 0.75)', color: '#fff', border: 'none', fontSize: 8,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                          }}
                          title="Di chuyển sang trái"
                        >
                          ◀
                        </button>
                      )}

                      {/* Di chuyển ảnh sang phải */}
                      {idx < webImages.length - 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveImage(idx, 'right'); }}
                          style={{
                            position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: '4px',
                            background: 'rgba(15, 23, 42, 0.75)', color: '#fff', border: 'none', fontSize: 8,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                          }}
                          title="Di chuyển sang phải"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {webImages.length < 5 && (
                    <label style={{
                      width: 64, height: 64, border: '2.5px dashed var(--border2)', borderRadius: 8,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: uploadingImages ? 'not-allowed' : 'pointer', fontSize: 14, color: 'var(--text2)', background: 'var(--surface)',
                      transition: 'border-color 0.2s'
                    }}>
                      {uploadingImages ? (
                        <span className="spinner" style={{ width: 12, height: 12 }} />
                      ) : (
                        <>
                          <span style={{ fontSize: 14, fontWeight: 'bold' }}>+</span>
                          <span style={{ fontSize: 8 }}>Tải ảnh</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        disabled={uploadingImages} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Mô tả sản phẩm / Ghi chú cho Web:</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                      type="text"
                      placeholder="Ý kiến chỉ đạo AI (ví dụ: viết ngắn thôi, nhấn mạnh bảo hành 2 năm...)"
                      value={aiCustomInstruction}
                      onChange={e => setAiCustomInstruction(e.target.value)}
                      style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', width: 270, outline: 'none' }}
                    />
                    <button 
                      className="btn xs" 
                      onClick={handleGenerateAIDesc} 
                      disabled={generatingDesc}
                      style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {generatingDesc ? '⏳ Đang viết AI...' : '🪄 AI Viết Mô Tả'}
                    </button>
                    <button 
                      className="btn xs" 
                      onClick={handleAutoFormatDesc} 
                      style={{ color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      🪄 Tự động sửa bố cục
                    </button>
                  </div>
                </div>
                <textarea 
                  className="textarea" 
                  placeholder="Nhập thông tin giới thiệu chi tiết cho khách hàng xem..." 
                  value={webDesc} 
                  onChange={e => setWebDesc(e.target.value)}
                  rows={8}
                  style={{ width: '100%', resize: 'vertical', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="btn" onClick={() => setEditingProduct(null)} disabled={savingProduct}>Hủy</button>
              <button
                className="btn primary"
                onClick={handleSave}
                disabled={savingProduct || uploadingImages}
                style={{ minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {savingProduct ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Đang lưu...
                  </>
                ) : 'Lưu thông tin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Custom Categories */}
      {showCatModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 650, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚙️ Quản lý các dòng máy bơm trên Web</span>
              <button 
                className="btn primary" 
                onClick={() => setCategoriesList(prev => [...prev, { name: '', image: '', desc: '', featured: false }])}
                style={{ fontSize: 11, padding: '6px 12px' }}
              >
                ➕ Thêm dòng bơm mới
              </button>
            </h3>
            
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
              Cấu hình các dòng máy bơm hiển thị ngoài trang chủ Web công cộng. Bạn có thể thay đổi tên, upload ảnh và chọn các mục "Nổi bật" ngoài trang chủ.
            </p>

            <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 6 }}>
              {categoriesList.map((cat, index) => (
                <div key={index} style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  background: '#fff', padding: '12px 14px', borderRadius: 12,
                  border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(15,23,42,0.02)'
                }}>
                  {/* Top row: Image input + Name input + Featured + Delete */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Category Image upload box */}
                    <label style={{ display: 'block', width: 50, height: 50, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer', border: '1.5px dashed #cbd5e1', position: 'relative', flexShrink: 0 }}>
                      {cat.image ? (
                        <img src={cat.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>📷 Ảnh</div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleCategoryClassImageUpload(index, file);
                          }
                        }}
                        style={{ display: 'none' }} 
                      />
                    </label>

                    {/* Name input */}
                    <input 
                      className="input" 
                      type="text" 
                      placeholder="Tên dòng máy bơm..." 
                      value={cat.name || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setCategoriesList(prev => prev.map((item, idx) => idx === index ? { ...item, name: val } : item))
                      }}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}
                    />

                    {/* Featured */}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: cat.featured ? '#3b82f6' : '#64748b', cursor: 'pointer', userSelect: 'none', background: cat.featured ? '#eff6ff' : '#f8fafc', padding: '6px 8px', borderRadius: 6, border: cat.featured ? '1px solid #bfdbfe' : '1px solid #e2e8f0', flexShrink: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={!!cat.featured} 
                        onChange={e => {
                          const val = e.target.checked;
                          setCategoriesList(prev => prev.map((item, idx) => idx === index ? { ...item, featured: val } : item))
                        }}
                        style={{ cursor: 'pointer', margin: 0 }}
                      />
                      Nổi bật
                    </label>

                    {/* Delete */}
                    <button 
                      className="btn" 
                      onClick={() => setCategoriesList(prev => prev.filter((_, idx) => idx !== index))}
                      style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 32, flexShrink: 0 }}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Bottom row: Description input */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 50 }} /> {/* spacer */}
                    <input 
                      className="input" 
                      type="text" 
                      placeholder="Mô tả phụ (ví dụ: Trục ngang công nghiệp, CDLF áp lực cao...)" 
                      value={cat.desc || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setCategoriesList(prev => prev.map((item, idx) => idx === index ? { ...item, desc: val } : item))
                      }}
                      style={{ flex: 1, padding: '6px 12px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc' }}
                    />
                  </div>
                </div>
              ))}
              {categoriesList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                  Chưa có dòng máy bơm nào được thêm. Nhấn "Thêm dòng bơm mới" ở góc trên để bắt đầu.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="btn" onClick={() => setShowCatModal(false)}>Hủy</button>
              <button className="btn primary" onClick={handleSaveCategories} disabled={savingCats}>
                {savingCats ? 'Đang lưu...' : 'Lưu danh mục lọc'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Trợ lý Báo giá AI */}
      {aiQuoteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 11000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, padding: 28,
            boxShadow: '0 20px 48px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🪄 Trợ lý AI Báo Giá & Tư Vấn</span>
              </h3>
              <button 
                onClick={() => setAiQuoteModal(null)} 
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
              AI đã phân tích yêu cầu của khách hàng <strong>{aiQuoteModal.customerName}</strong> và tự động dự thảo tin nhắn tư vấn / báo giá sỉ lẻ dưới đây:
            </div>

            {generatingQuote ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Gemini AI đang phân tích và soạn thảo văn bản...</div>
              </div>
            ) : (
              <>
                <textarea 
                  value={aiQuoteDraft}
                  onChange={e => setAiQuoteDraft(e.target.value)}
                  rows={12}
                  style={{
                    width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 10,
                    fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', resize: 'vertical'
                  }}
                />
                
                <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(aiQuoteDraft)
                      toast('Đã sao chép nội dung báo giá!', 'success')
                    }}
                    className="btn"
                    style={{ flex: 1, borderColor: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    📋 Sao chép nội dung
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(aiQuoteDraft)
                      window.open(`https://zalo.me/${aiQuoteModal.customerPhone}`, '_blank')
                    }}
                    className="btn primary"
                    style={{ flex: 1.2, background: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    💬 Chat Zalo với khách
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
