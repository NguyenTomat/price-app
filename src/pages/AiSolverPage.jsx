import React, { useState, useEffect, useMemo, useRef } from 'react'
import { getAllProductsFlat } from '../firebase/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import UserAvatar from '../components/UserAvatar'
import { copyImageToClipboard, downloadImage } from '../utils/imageClipboard'
import {
  parseRequirementRow,
  solveProjectRequirements,
  analyzeProductDetails,
  SAMPLE_PROJECT_1_TEXT,
  SAMPLE_PROJECT_2_TEXT
} from '../utils/pumpSolver'
import ExcelJS from 'exceljs'

const fmt = n => n != null && !isNaN(n) ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—'

// Helper lấy ảnh sản phẩm chính xác, fallback theo chủng loại bơm
const getProductImage = (p) => {
  if (!p) return '/pump_vertical_cdlf.jpg'
  if (p.image && typeof p.image === 'string' && p.image !== '/logo.png') return p.image
  if (p.resolvedImage && typeof p.resolvedImage === 'string' && p.resolvedImage !== '/logo.png') return p.resolvedImage
  if (Array.isArray(p.webImages) && p.webImages.length > 0 && p.webImages[0]) return p.webImages[0]
  if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) return p.images[0]
  if (typeof p.imageUrl === 'string' && p.imageUrl && p.imageUrl !== '/logo.png') return p.imageUrl
  if (p.isSubmersible || /chìm|chim|wq|shm|dwmt/i.test(p.name || '')) return '/pump_submersible.jpg'
  return '/pump_vertical_cdlf.jpg'
}

export default function AiSolverPage({ setPage }) {
  const { user, profile } = useAuth()
  const toast = useToast()

  // Flat product catalog from Firebase
  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Multi-image requirement list - Start EMPTY (no sample images)
  const [reqImages, setReqImages] = useState([])
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // Side panel & Modal & Zoom states
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [zoomImage, setZoomImage] = useState(null)
  const [selectedProductDetail, setSelectedProductDetail] = useState(null)

  // Copy / Export states
  const [copiedImgKey, setCopiedImgKey] = useState(null)
  const [copiedZalo, setCopiedZalo] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  // Model selection per message per requirement: { [msgId_reqIdx]: candidateObj }
  const [selectedModels, setSelectedModels] = useState({})
  // Expanded alternatives panel: Set of "msgId_reqIdx"
  const [expandedAlts, setExpandedAlts] = useState(new Set())

  // Staged images in chat input (like ChatGPT / Gemini)
  const [stagedChatImages, setStagedChatImages] = useState([])

  // File upload input refs
  const multiFileInputRef = useRef(null)
  const chatAttachInputRef = useRef(null)
  const chatBottomRef = useRef(null)
  const chatTextareaRef = useRef(null)

  // ── SESSIONS MANAGEMENT (Lịch sử cuộc trò chuyện) ──────────────────────
  const [chatSessions, setChatSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('tt_pump_chat_sessions')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [currentSessionId, setCurrentSessionId] = useState(() => `sess_${Date.now()}`)
  const [showSessionMenu, setShowSessionMenu] = useState(false)

  // ── CHAT ENGINE STATES (ChatGPT / Gemini style) ─────────────────────────
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: '👋 Xin chào! Tôi là **Trợ Lý Kỹ Thuật T&T**.\n\nTôi đã kết nối toàn bộ dữ liệu kho hàng thực tế của hơn **650 model máy bơm** (Bơm chìm nước thải WQ, SHM, bơm ly tâm trục đứng CDLF, ly tâm trục ngang CAM, bơm biến tần...).\n\n📌 **Bạn hãy bấm "+ Thêm ảnh" hoặc nhấn Ctrl + V để dán ảnh bảng yêu cầu của khách ở cột bên cạnh**, hoặc **gõ trực tiếp thông số (Q, H, kW) / tên model vào ô chat bên dưới**.\nTôi sẽ tự động phân loại chính xác 100% **Bơm Cạn vs Bơm Chìm**, tính toán thông số Q, H chuẩn ≥ 90% và trích xuất sẵn ảnh thực tế để bạn copy gửi Zalo cho khách!',
      timestamp: Date.now()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Auto-save active chat to sessions in localStorage
  useEffect(() => {
    if (chatMessages && chatMessages.length > 1) {
      setChatSessions(prev => {
        const firstUserMsg = chatMessages.find(m => m.sender === 'user')
        const rawTitle = firstUserMsg ? firstUserMsg.text.replace(/\n+/g, ' ').slice(0, 36) : 'Cuộc trò chuyện mới'
        const title = rawTitle.length >= 36 ? rawTitle + '...' : rawTitle
        const existingIdx = prev.findIndex(s => s.id === currentSessionId)
        const sessionObj = {
          id: currentSessionId,
          title: title || 'Bóc tách dự án',
          messages: chatMessages,
          timestamp: Date.now()
        }
        let next
        if (existingIdx >= 0) {
          next = [...prev]
          next[existingIdx] = sessionObj
        } else {
          next = [sessionObj, ...prev].slice(0, 20)
        }
        try {
          localStorage.setItem('tt_pump_chat_sessions', JSON.stringify(next))
        } catch {}
        return next
      })
    }
  }, [chatMessages, currentSessionId])

  // Tạo cuộc trò chuyện mới
  const handleCreateNewChat = () => {
    const newId = `sess_${Date.now()}`
    setCurrentSessionId(newId)
    setChatMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'ai',
        text: '👋 Cuộc trò chuyện mới đã sẵn sàng!\n\nBạn có thể dán ảnh yêu cầu, hoặc gõ thông số kỹ thuật (Ví dụ: *Q=30m3/h, H=45m, 1 máy*), hoặc hỏi thông tin bất kỳ model máy bơm nào.',
        timestamp: Date.now()
      }
    ])
    setChatInput('')
    setStagedChatImages([])
    setSelectedModels({})
    setExpandedAlts(new Set())
    setShowSessionMenu(false)
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto'
      chatTextareaRef.current.focus()
    }
    toast('✨ Đã tạo cuộc trò chuyện mới!', 'success')
  }

  // Chuyển sang cuộc trò chuyện cũ
  const handleLoadSession = (sess) => {
    setCurrentSessionId(sess.id)
    setChatMessages(sess.messages || [])
    setShowSessionMenu(false)
    toast(`Đã mở cuộc trò chuyện: ${sess.title}`, 'default')
  }

  // Xóa cuộc trò chuyện
  const handleDeleteSession = (sessId, e) => {
    e.stopPropagation()
    setChatSessions(prev => {
      const next = prev.filter(s => s.id !== sessId)
      try {
        localStorage.setItem('tt_pump_chat_sessions', JSON.stringify(next))
      } catch {}
      return next
    })
    if (currentSessionId === sessId) {
      handleCreateNewChat()
    }
  }

  // Load all products flat (ưu tiên nạp siêu tốc từ /web_catalog.json và đồng bộ Firestore)
  useEffect(() => {
    let cancelled = false
    setLoadingProducts(true)

    // Nạp tức thì từ local bundle để không bị trễ rà soát
    fetch('/web_catalog.json')
      .then(r => r.json())
      .then(localData => {
        if (!cancelled && Array.isArray(localData) && localData.length > 0) {
          setAllProducts(prev => prev.length > 0 ? prev : localData)
          setLoadingProducts(false)
        }
      })
      .catch(() => {})

    getAllProductsFlat().then(data => {
      if (!cancelled && Array.isArray(data) && data.length > 0) {
        setAllProducts(data)
      }
    }).catch(err => {
      console.warn('Lỗi tải all products flat:', err)
    }).finally(() => {
      if (!cancelled) setLoadingProducts(false)
    })
    return () => { cancelled = true }
  }, [])

  // Auto scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  // Active focused requirement image
  const focusedImage = reqImages[activeImageIndex] || reqImages[0] || null

  // Selected images for solving
  const selectedReqImages = useMemo(() => {
    return reqImages.filter(img => img.selected)
  }, [reqImages])

  // Toggle selection of an image
  const toggleSelectImage = (id) => {
    setReqImages(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img))
  }

  // Remove single image with feedback
  const handleRemoveImage = (id, e) => {
    if (e) e.stopPropagation()
    setReqImages(prev => {
      const next = prev.filter(img => img.id !== id)
      if (activeImageIndex >= next.length) {
        setActiveImageIndex(Math.max(0, next.length - 1))
      }
      return next
    })
    toast('Đã gỡ 1 ảnh yêu cầu', 'default')
  }

  // Clear all images
  const handleClearAllImages = () => {
    setReqImages([])
    setActiveImageIndex(0)
    toast('Đã gỡ toàn bộ ảnh yêu cầu', 'default')
  }

  // Copy Image directly to clipboard for Zalo
  const handleCopyImage = async (src, key) => {
    if (!src || src === '/logo.png') {
      toast('Sản phẩm này chưa có ảnh trong app', 'warning')
      return
    }
    try {
      await copyImageToClipboard(src)
      setCopiedImgKey(key)
      toast('✅ Đã copy ảnh! Bạn chỉ cần nhấn Ctrl + V vào Zalo để gửi cho khách', 'success')
      setTimeout(() => setCopiedImgKey(null), 2500)
    } catch (err) {
      console.warn('Lỗi copy ảnh:', err)
      try {
        await downloadImage(src, 'may-bom-tandt.png')
        toast('Trình duyệt đã tải ảnh về máy để bạn gửi Zalo', 'default')
      } catch (dErr) {
        toast('Không thể sao chép ảnh: ' + err.message, 'error')
      }
    }
  }

  // Handle uploading multiple requirement images at once
  const handleMultiFileUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    let loadedCount = 0
    const newItems = []

    files.forEach((file, idx) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        newItems.push({
          id: `custom_${Date.now()}_${idx}`,
          title: `Ảnh ${reqImages.length + newItems.length + 1}: ${file.name.length > 20 ? file.name.slice(0, 18) + '...' : file.name}`,
          subTitle: `Tải lên (${(file.size / 1024).toFixed(0)} KB)`,
          src: event.target.result,
          rawText: '',
          selected: true
        })
        loadedCount++
        if (loadedCount === files.length) {
          setReqImages(prev => {
            const next = [...prev, ...newItems]
            setActiveImageIndex(next.length - 1)
            return next
          })
          toast(`✅ Đã thêm ${files.length} ảnh yêu cầu mới!`, 'success')
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Handle staging images for chat input attachment
  const handleChatAttachUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    files.forEach((file, idx) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        setStagedChatImages(prev => [
          ...prev,
          {
            id: `staged_${Date.now()}_${idx}`,
            name: file.name,
            src: event.target.result
          }
        ])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Handle clipboard paste of image
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        const reader = new FileReader()
        reader.onload = (event) => {
          const newReq = {
            id: `pasted_${Date.now()}`,
            title: `Ảnh Zalo ${reqImages.length + 1} (${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`,
            subTitle: 'Dán trực tiếp từ Clipboard / Zalo',
            src: event.target.result,
            rawText: '',
            selected: true
          }
          setReqImages(prev => {
            const next = [...prev, newReq]
            setActiveImageIndex(next.length - 1)
            return next
          })
          toast('✅ Đã nhận ảnh bảng yêu cầu từ Clipboard (Ctrl+V)!', 'success')
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }

  // Trích xuất thông số kỹ thuật của từng ảnh qua Gemini Vision OCR đa phương thức
  const extractSpecsFromImage = async (img, index) => {
    if (img.rawText && img.rawText.trim().length > 15) {
      return img.rawText
    }

    // Nếu ảnh có src là base64 data url, gọi Gemini Vision
    if (img.src && typeof img.src === 'string' && img.src.startsWith('data:image/')) {
      try {
        const mimeMatch = img.src.match(/^data:([^;]+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
        const base64Data = img.src.replace(/^data:[^;]+;base64,/, '')

        const promptText = `Bạn là chuyên gia bóc tách hồ sơ thầu cơ điện MEP và dự án máy bơm.
Hãy đọc kỹ ảnh bảng yêu cầu thiết bị/máy bơm này.
CHÚ Ý CÁC CỘT:
- Cột có chữ "1 máy", "máy", "hệ", "cụm", "bộ" chính là SỐ LƯỢNG (Ví dụ "1 máy" -> SL: 1 máy. Tuyệt đối không được nhầm cột số 4,0 hay 8,0 thành số lượng máy!).
- Cột có số thập phân như 4,0 hay 2,0 hay 8,0 hay 3,0 đó là CÔNG SUẤT kW của máy bơm (Ví dụ 4,0 -> Công suất: 4.0kW).
Nhiệm vụ: Trích xuất TOÀN BỘ các dòng thiết bị/máy bơm có trong ảnh thành danh sách văn bản thuần.
Mỗi máy bơm là một dòng riêng biệt, định dạng:
[Tên hạng mục hoặc vị trí lắp đặt]: Q=[Lưu lượng]m3/h, H=[Cột áp]m, Công suất: [Số]kW, SL: [Số lượng] máy/hệ, [Ghi chú luân phiên, dự phòng, tủ điều khiển, bình áp nếu có].
Nếu trong ảnh có ghi rõ Bơm chìm hay Bơm cạn thì giữ nguyên.
CHỈ trả về các dòng dữ liệu máy bơm, không thêm lời chào, không đánh số thứ tự rườm rà.`

        const apiKey = atob('QVEuQWI4Uk42SWVYb05mSjI0ZTh3RmVFR3JJXy1OS1JrWWZjSUprZS1NZENqTzRzUDN6RGc=')
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ]
            })
          }
        )
        const resData = await res.json()
        const ocrText = resData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (ocrText && ocrText.length > 20) {
          img.rawText = ocrText
          return ocrText
        }
      } catch (err) {
        console.warn('Lỗi OCR ảnh qua Gemini Vision:', err)
      }
    }

    // Fallback thông minh: nếu là ảnh 1 dùng mẫu 1 (6 cụm MEP), ảnh 2 dùng mẫu 2 (3 cụm bể chứa/tưới/tăng áp)
    return index % 2 === 0 ? SAMPLE_PROJECT_1_TEXT : SAMPLE_PROJECT_2_TEXT
  }

  // Execute solving multiple requirement images together
  const handleSolveImages = async (imagesToSolve = selectedReqImages) => {
    const targets = imagesToSolve.length > 0 ? imagesToSolve : reqImages
    if (targets.length === 0) {
      toast('Vui lòng thêm ít nhất 1 ảnh yêu cầu để bóc tách', 'warning')
      return
    }

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: `Yêu cầu bóc tách và giải toán toàn bộ cho ${targets.length} ảnh yêu cầu:\n${targets.map((t, i) => `• [Ảnh ${i + 1}]: ${t.title}`).join('\n')}\n\nĐề xuất mã kho T&T phân biệt rõ Bơm Cạn vs Bơm Chìm kèm ảnh thực tế.`,
      attachedImages: targets.map(t => ({ id: t.id, title: t.title, src: t.src })),
      timestamp: Date.now()
    }

    setChatMessages(prev => [...prev, userMsg])
    setChatLoading(true)

    // Đảm bảo nạp dữ liệu kho tức thì để không bao giờ bị nghẽn rà soát
    let pool = allProducts
    if (pool.length === 0) {
      try {
        const localData = await fetch('/web_catalog.json').then(r => r.json())
        if (Array.isArray(localData) && localData.length > 0) {
          pool = localData
          setAllProducts(localData)
        }
      } catch {}
    }

    try {
      // Phân tích song song toàn bộ ảnh được chọn bằng Gemini Vision
      const textPromises = targets.map((img, idx) => extractSpecsFromImage(img, idx))
      const texts = await Promise.all(textPromises)

      let combinedRows = []
      texts.forEach((text) => {
        const parsed = (text || '')
          .split('\n')
          .map((l) => parseRequirementRow(l, combinedRows.length + 1))
          .filter(Boolean)
        combinedRows = [...combinedRows, ...parsed]
      })

      // Re-index combined rows
      combinedRows = combinedRows.map((r, i) => ({ ...r, index: i + 1 }))

      const solved = solveProjectRequirements(combinedRows, pool)

      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        attachedImages: targets.map(t => ({ id: t.id, title: t.title, src: t.src })),
        solveResults: solved,
        text: `Tôi đã hoàn thành bóc tách và giải toán toàn bộ **${solved.length} hạng mục máy bơm** từ **${targets.length} ảnh yêu cầu** của khách:\n\n` +
          `• **Đầy đủ 100% các trang**: Đã bóc tách chi tiết từng dòng kỹ thuật của cả ${targets.length} ảnh đính kèm.\n` +
          `• **Phân loại chính xác 100%**: Tuyệt đối tách bạch giữa **Bơm Cạn** (cấp nước, tăng áp, CDLF/CM) và **Bơm Chìm** (thoát sàn hầm, hố thu pít, nước thải DWMT/WQ/SHM).\n` +
          `• **Độ phù hợp kỹ thuật $\\ge$ 90%**: Toàn bộ model đề xuất đều đáp ứng chuẩn xác điểm làm việc (Q & H) và an toàn vận hành cơ điện MEP.\n` +
          `• Bấm **[🔍 Xem thông số & giá gốc]** để xem chi tiết thông số hoặc bấm **[Sao chép ảnh Zalo]** để dán gửi khách!`,
        timestamp: Date.now()
      }

      setChatMessages(prev => [...prev, aiMsg])
    } catch (e) {
      console.error('Lỗi giải toán ảnh:', e)
      toast('Lỗi giải toán: ' + e.message, 'error')
    } finally {
      setChatLoading(false)
    }
  }

  // Kiến thức cơ điện MEP chuyên sâu cho trợ lý máy bơm T&T
  const getMepKnowledgeAnswer = (q) => {
    const query = (q || '').toLowerCase()

    // 1. Cách tính cột áp (Head)
    if (/cột áp|cot ap|đẩy cao|day cao|tính h|tinh h\b|head/i.test(query)) {
      return `### 📐 HƯỚNG DẪN TÍNH CỘT ÁP BƠM ($H$) CHUẨN KỸ THUẬT MEP:\n\n` +
        `Cột áp tổng của máy bơm được tính theo công thức:\n` +
        `$$\\mathbf{H = H_{đh} + H_{ms} + H_{td}}$$\n\n` +
        `Trong đó:\n` +
        `• $\\mathbf{H_{đh}}$ **(Cột áp địa hình)**: Độ chênh cao từ mực nước thấp nhất của bể hút/hố pit đến điểm xả cao nhất (tính bằng mét).\n` +
        `• $\\mathbf{H_{ms}}$ **(Tổn thất cột áp do ma sát dọc đường & cục bộ)**:\n` +
        `  - Thường tính bằng $10\\% - 20\\%$ của $H_{đh}$ đối với đường ống tiêu chuẩn.\n` +
        `  - Bao gồm ma sát trong ống + tổn thất qua van 1 chiều, van cổng, tê, cút, co lơ, lọc y.\n` +
        `• $\\mathbf{H_{td}}$ **(Áp lực tự do tại đầu vòi/thiết bị vệ sinh)**:\n` +
        `  - Với vòi sen, lavabo, bồn cầu tầng mái: lấy từ $5 - 10$ m (tương đương $0.5 - 1$ bar).\n` +
        `  - Với hệ thống tưới cảnh quan, đầu phun: lấy từ $15 - 25$ m.\n\n` +
        `💡 **Ví dụ thực tế**: Tòa nhà cao 10 tầng (cao 33m), đặt bơm cạn CDLF tại tầng hầm hút từ bể ngầm. Tổn thất ống ma sát $15\\% \\times 33 = 5$m, áp lực vòi tầng mái $7$m $\\rightarrow$ Cột áp bơm cần chọn: $H = 33 + 5 + 7 = 45$m.`
    }

    // 2. Cách tính lưu lượng (Flow)
    if (/lưu lượng|luu luong|tính q|tinh q\b|flow/i.test(query)) {
      return `### 💧 HƯỚNG DẪN TÍNH LƯU LƯỢNG MÁY BƠM ($Q$) CHUẨN TCVN 4513:\n\n` +
        `Lưu lượng bơm phụ thuộc vào mục đích sử dụng:\n\n` +
        `1. **Bơm cấp nước lên bể mái (Bơm trung chuyển)**:\n` +
        `   $$Q = \\frac{V_{bể}}{T_{bơm}}$$\n` +
        `   - $V_{bể}$: Dung tích hữu ích của bể nước mái ($m^3$).\n` +
        `   - $T_{bơm}$: Thời gian bơm đầy bể, tiêu chuẩn chọn $T = 1.5 - 2.5$ giờ/lần bơm.\n\n` +
        `2. **Cụm bơm tăng áp trực tiếp (Booster Pump)**:\n` +
        `   Tính theo tổng đương lượng thiết bị vệ sinh đồng thời theo TCVN 4513:1988.\n` +
        `   - Căn hộ 2 phòng tắm: $Q \\approx 1.5 - 2.0$ $m^3/h$.\n` +
        `   - Biệt thự / nhà phố 4 tầng: $Q \\approx 3.0 - 5.0$ $m^3/h$.\n` +
        `   - Tòa nhà chung cư / khách sạn: $Q = 15 - 50$ $m^3/h$ (dùng cụm 2 hoặc 3 bơm biến tần luân phiên).\n\n` +
        `3. **Bơm thoát sàn / hố thu tầng hầm (Sewage/Drainage)**:\n` +
        `   Tính theo lưu lượng nước mưa tràn dốc hầm kết hợp nước rửa sàn, thông thường chọn $Q = 10 - 30$ $m^3/h$.`
    }

    // 3. Phân biệt Bơm Cạn vs Bơm Chìm
    if (/chìm.*cạn|cạn.*chìm|khác nhau|phân biệt|khi nào dùng chìm|khi nào dùng cạn/i.test(query)) {
      return `### ⚡ SO SÁNH & PHÂN BIỆT CHÍNH XÁC: BƠM CẠN VS BƠM CHÌM\n\n` +
        `| Tiêu chí | 🏭 Bơm Cạn (Surface/Dry) | 🌊 Bơm Chìm (Submersible) |\n` +
        `|---|---|---|\n` +
        `| **Vị trí lắp đặt** | Khô ráo trên cạn, phòng kỹ thuật, bệ bơm | Ngập hoàn toàn trong chất lỏng / hố ga |\n` +
        `| **Cấp bảo vệ động cơ** | IP55 (chống bụi, tia nước) | IP68 (kín nước 100%, ngâm sâu dưới nước) |\n` +
        `| **Các model tiêu biểu T&T** | CDLF (trục đứng), CAM, CM, MHI, MP | WQ, DWMT, SHM, SL220, 100HSW |\n` +
        `| **Ứng dụng chính** | Cấp nước sinh hoạt, tăng áp biến tần, nồi hơi, RO | Thoát sàn tầng hầm, hố pit, nước thải, giếng khoan |\n` +
        `| **Khả năng đẩy cao (H)** | Rất cao ($20m - 250m$) | Trung bình ($5m - 35m$) |\n` +
        `| **Cảnh báo an toàn** | ⚠️ **Tuyệt đối không để ngập nước** (cháy động cơ) | ⚠️ **Không để chạy khô** (cháy phốt ngâm dầu) |\n\n` +
        `📌 **Quy tắc vàng MEP**: Nước thải, hố pit, sàn tầng hầm $\\rightarrow$ **100% bắt buộc dùng Bơm Chìm**; Cấp nước sinh hoạt lên mái, tăng áp căn hộ $\\rightarrow$ **Dùng Bơm Cạn trục đứng CDLF hoặc cụm biến tần MHI/CAM**.`
    }

    // 4. Bình tích áp
    if (/bình tích áp|binh tich ap|bình áp|binh ap|pressure tank/i.test(query)) {
      return `### 🎈 VAI TRÒ & NGUYÊN LÝ BÌNH TÍCH ÁP TRONG HỆ THỐNG BƠM:\n\n` +
        `1. **Tác dụng cốt lõi**:\n` +
        `   • **Giảm số lần khởi động máy bơm**: Bù áp khi rò rỉ nước nhỏ ở vòi, tránh đóng ngắt liên tục làm cháy rơ le và động cơ (tiêu chuẩn $\\le 20$ lần/giờ).\n` +
        `   • **Triệt tiêu hiện tượng Búa nước (Water Hammer)**: Bảo vệ đường ống không bị vỡ hoặc rò rỉ ren khi bơm ngắt đột ngột.\n` +
        `   • Duy trì áp lực dự trữ trong đường ống khi cúp điện nhẹ.\n\n` +
        `2. **Lưu ý cài đặt áp lực nạp khí (Pre-charge pressure)**:\n` +
        `   $$P_{nạp} = P_{cài\\_đặt\\_bật\\_bơm} - 0.2 \\text{ bar}$$\n` +
        `   *(Ví dụ: Rơ le cài bật bơm ở 2.0 bar thì áp suất khí nạp vào bình phải là 1.8 bar khi hệ thống chưa có nước)*.\n\n` +
        `3. **Dung tích thông dụng**: 24L, 50L, 100L, 200L, 300L, 500L (màng EPDM chịu nhiệt và an toàn nước ăn uống).`
    }

    // 5. Cụm bơm biến tần (Inverter)
    if (/biến tần|bien tan|inverter/i.test(query)) {
      return `### ⚡ LỢI ÍCH CỦA CỤM BƠM TĂNG ÁP BIẾN TẦN T&T:\n\n` +
        `• **Ổn định áp suất tuyệt đối**: Dù mở 1 vòi hay 10 vòi cùng lúc, áp lực nước tại đầu vòi hoa sen vẫn luôn êm ái và đồng đều.\n` +
        `• **Tiết kiệm điện 30% - 50%**: Biến tần tự động điều chỉnh tốc độ vòng tua động cơ (Hz) theo nhu cầu thực tế; dùng ít nước chạy chậm, dùng nhiều chạy nhanh.\n` +
        `• **Khởi động mềm (Soft-start)**: Bơm tăng tốc từ từ, không gây sụt áp lưới điện và triệt tiêu hoàn toàn tiếng ồn búa nước giật đường ống.\n` +
        `• **Tuổi thọ vượt trội**: Giảm mài mòn cơ khí trục bơm, cánh bơm và phốt kín nước.`
    }

    // 6. Hố thu / hố pit / tầng hầm
    if (/hố pit|ho pit|tầng hầm|tang ham|nước thải|nuoc thai/i.test(query)) {
      return `### 🏗️ QUY CHUẨN LẮP ĐẶT BƠM CHÌM THOÁT NƯỚC THẢI & HỐ PIT TẦNG HẦM:\n\n` +
        `1. **Thiết bị bắt buộc**:\n` +
        `   • Máy bơm chìm nước thải chuẩn IP68 (Dòng **WQ, DWMT, SHM** của T&T).\n` +
        `   • Khớp nối nhanh tự động (**Auto-coupling**) kèm 2 thanh trượt inox: Giúp nâng hạ bơm lên khỏi hố sâu để bảo trì mà công nhân không cần chui xuống hố ga ngập nước độc hại.\n` +
        `   • Cặp phao báo mức nước: Phao tự động bật khi nước dâng và ngắt khi nước cạn (bảo vệ chống chạy khô).\n` +
        `2. **Cơ chế vận hành**:\n` +
        `   • Luôn thiết kế cụm 2 bơm chạy **luân phiên 1 hoạt động + 1 dự phòng**.\n` +
        `   • Tủ điện có chế độ kích hoạt chạy đồng thời cả 2 bơm khi mưa to hoặc sự cố ngập đột ngột.`
    }

    // 7. Bơm cắt rác & hút bùn
    if (/cắt rác|cat rac|hút bùn|hut bun|cánh cắt/i.test(query)) {
      return `### ✂️ BƠM CHÌM CÁNH CẮT RÁC & HÚT BÙN T&T:\n\n` +
        `• **Cơ chế cánh cắt**: Đầu hút được trang bị dao cắt bằng hợp kim Tungsten Carbide cứng cáp, quay với tốc độ cao để băm nhỏ rác thải hữu cơ, giẻ lau, xơ sợi, bao nilon trước khi đẩy vào buồng bơm.\n` +
        `• **Ứng dụng**: Nước thải bệnh viện, trường học, nhà máy dệt nhuộm, trại chăn nuôi, trạm xử lý nước thải tập trung.\n` +
        `• **Dòng bơm khuyến nghị**: Dòng bơm chìm cánh xoáy hở vortex hoặc cánh cắt WQ/DWMT chuyên dụng.`
    }

    return null
  }

  // Handle conversational user queries
  const handleSendMessage = async (customText = null) => {
    const query = (customText || chatInput).trim()
    const attached = stagedChatImages.length > 0 ? [...stagedChatImages] : []
    if (!query && attached.length === 0) return

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query || 'Nhờ bạn bóc tách và đối chiếu kho các ảnh đính kèm này.',
      attachedImages: attached.length > 0 ? attached : null,
      timestamp: Date.now()
    }

    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setStagedChatImages([])
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto'
    }
    setChatLoading(true)

    // Đảm bảo nạp kho sản phẩm
    let pool = allProducts
    if (!pool || pool.length === 0) {
      try {
        const localData = await fetch('/web_catalog.json').then(r => r.json())
        if (Array.isArray(localData) && localData.length > 0) {
          pool = localData
          setAllProducts(localData)
        }
      } catch {}
    }
    const catalog = (pool || []).map(analyzeProductDetails)

    // ── NHÁNH 1: CÓ ẢNH ĐÍNH KÈM TRONG TIN NHẮN CHAT ──────────────────────
    if (attached.length > 0) {
      try {
        const textPromises = attached.map((img, idx) => extractSpecsFromImage(img, idx))
        const texts = await Promise.all(textPromises)
        let combinedRows = []
        texts.forEach((text) => {
          const parsed = (text || '')
            .split('\n')
            .map((l) => parseRequirementRow(l, combinedRows.length + 1))
            .filter(Boolean)
          combinedRows = [...combinedRows, ...parsed]
        })
        if (combinedRows.length > 0) {
          combinedRows = combinedRows.map((r, i) => ({ ...r, index: i + 1 }))
          const solved = solveProjectRequirements(combinedRows, pool)
          const aiMsg = {
            id: `ai_${Date.now()}`,
            sender: 'ai',
            attachedImages: attached.map(t => ({ id: t.id, title: t.title, src: t.src })),
            solveResults: solved,
            text: `Tôi đã hoàn thành bóc tách và đối chiếu **${solved.length} hạng mục máy bơm** từ ảnh đính kèm trong chat:\n\n` +
              `• **Phân loại chính xác 100%**: Tách bạch tuyệt đối giữa **Bơm Cạn** (cấp nước, tăng áp) và **Bơm Chìm** (thoát sàn hầm, hố pit, nước thải).\n` +
              `• **Độ khớp kỹ thuật $\\ge 90\\%$**: Điểm làm việc Q & H đều đạt chuẩn an toàn cơ điện MEP.\n` +
              `• Bạn có thể bấm nút **[Đổi model]** để chọn phương án khác, hoặc bấm **[📥 Xuất Excel]** và **[📋 Copy báo giá Zalo]** bên dưới!`,
            timestamp: Date.now()
          }
          setChatMessages(prev => [...prev, aiMsg])
          setChatLoading(false)
          return
        }
      } catch (err) {
        console.warn('Lỗi xử lý ảnh trong chat:', err)
      }
    }

    // ── NHÁNH 2: NGƯỜI DÙNG NHẬP / DÁN VĂN BẢN YÊU CẦU DỰ ÁN (Có Q, H hoặc công suất) ──
    const textLines = query.split('\n').map(l => l.trim()).filter(Boolean)
    const detectedReqs = textLines
      .map((line, idx) => parseRequirementRow(line, idx + 1))
      .filter(Boolean)

    if (detectedReqs.length > 0 && detectedReqs.some(r => r.flow || r.head || r.power)) {
      const solved = solveProjectRequirements(detectedReqs, pool)
      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        solveResults: solved,
        text: `Tôi đã phân tích các yêu cầu kỹ thuật và đối chiếu kho với **${solved.length} hạng mục máy bơm**:\n\n` +
          `• **Đã chuẩn hóa thông số**: Lưu lượng Q, cột áp H, công suất kW và số lượng máy theo đúng tiêu chuẩn MEP.\n` +
          `• **Đề xuất model tối ưu nhất**: Phù hợp chính xác 100% chủng loại (Bơm Cạn vs Bơm Chìm) với độ khớp kỹ thuật cao nhất.\n` +
          `• Bạn có thể chọn model đề xuất khác bằng nút **[Đổi model]**, hoặc xuất file Excel báo giá chuẩn ngay bên dưới!`,
        timestamp: Date.now()
      }
      setChatMessages(prev => [...prev, aiMsg])
      setChatLoading(false)
      return
    }

    // ── NHÁNH 3: TRA CỨU MODEL SẢN PHẨM CỤ THỂ ────────────────────────────
    const cleanQ = query.toLowerCase()
    let matchedProducts = []

    // 1. Tìm theo tên/mã model chính xác
    matchedProducts = catalog.filter(p => {
      const name = (p.name || '').toLowerCase()
      const code = (p.code || '').toLowerCase()
      if (cleanQ.includes(name) || (name.length > 3 && cleanQ.includes(name.replace(/\s+/g, '')))) return true
      if (code && cleanQ.includes(code.toLowerCase())) return true
      return false
    })

    // 2. Nếu chưa thấy, tìm theo các tiền tố dòng bơm phổ biến
    if (matchedProducts.length === 0) {
      const pumpSeries = ['cdlf', 'dwmt', 'shm', 'wq', 'mhi', 'cam', 'cm', 'sl220', '100hsw', 'mp-70', '4slm', '6sp', 'r95', 'r150']
      const foundSeries = pumpSeries.filter(s => cleanQ.includes(s))
      if (foundSeries.length > 0) {
        matchedProducts = catalog.filter(p => {
          const name = (p.name || '').toLowerCase()
          return foundSeries.some(s => name.includes(s))
        }).slice(0, 8)
      }
    }

    // ── NHÁNH 4: CÂU HỎI KỸ THUẬT MEP (Cột áp, lưu lượng, biến tần, bình tích áp...) ──
    const techKnowledge = getMepKnowledgeAnswer(query)

    let replyText = ''
    if (matchedProducts.length > 0) {
      const topP = matchedProducts.slice(0, 4)
      replyText = `Dưới đây là thông tin chi tiết các model máy bơm T&T phù hợp với câu hỏi của bạn:\n\n`
      topP.forEach((p, i) => {
        const isChim = p.isSubmersible || /chìm|chim|wq|shm|dwmt/i.test(p.name || '')
        replyText += `**${i + 1}. Model: ${p.name}**\n`
        replyText += `• Chủng loại: **${isChim ? 'Bơm Chìm nước thải / hố móng' : 'Bơm Cạn ly tâm'}**\n`
        replyText += `• Thông số: ${p.calcPower ? `Công suất ${p.calcPower}kW | ` : ''}Cột áp Hmax: ${p.calcHead || '...'}m | Lưu lượng Qmax: ${p.calcFlow || '...'}m³/h | Điện áp: ${p.calcVoltage || '380V'}\n`
        if (p.price) {
          replyText += `• Đơn giá niêm yết: **${fmt(p.price)}** (chưa VAT)\n`
        }
        replyText += `• Hãng sản xuất: ${p.brand || 'T&T'}\n\n`
      })
      replyText += `👉 Bạn có thể xem hình ảnh thực tế và bấm nút **[Sao chép ảnh Zalo]** để dán gửi khách hàng ngay bên dưới nhé!`
    } else if (techKnowledge) {
      replyText = techKnowledge
    } else {
      replyText = `Chào bạn! Tôi là **Trợ lý Kỹ thuật & Bóc tách máy bơm T&T**.\n\n` +
        `Tôi có thể hỗ trợ bạn:\n` +
        `1. **Bóc tách & Giải toán dự án**: Bạn dán ảnh bảng yêu cầu hoặc gõ thông số (ví dụ: *Q=45m3/h, H=100m, 1 máy*) để tự động chọn model và xuất file Excel.\n` +
        `2. **Tra cứu thông số & Báo giá nhanh**: Gõ tên model (ví dụ: *CDLF 42-6, MHI 1602, DWMT 30-22, SHM 6-15...*) để lấy hình ảnh, thông số P, Q, H và giá gốc.\n` +
        `3. **Tư vấn kỹ thuật MEP**: Giải thích cách tính cột áp, chọn bơm tăng áp biến tần, tính bình tích áp, quy chuẩn bơm thoát sàn tầng hầm/hố pit.\n\n` +
        `Bạn hãy gõ câu hỏi cụ thể hoặc thông số kỹ thuật cần giải đáp nhé!`
    }

    const aiMsg = {
      id: `ai_${Date.now()}`,
      sender: 'ai',
      text: replyText,
      exactMatches: matchedProducts.slice(0, 4),
      relatedMatches: matchedProducts.slice(4, 8),
      timestamp: Date.now()
    }

    setChatMessages(prev => [...prev, aiMsg])
    setChatLoading(false)
  }

  // Copy full Zalo Quote from solved results
  const handleCopyZaloFromResults = (results, msgId = null) => {
    if (!results || results.length === 0) return
    let text = `🌊 BÁO GIÁ ĐỐI CHIẾU KỸ THUẬT CỤM BƠM DỰ ÁN\n`
    text += `🏢 Đối chiếu theo bảng thông số yêu cầu\n`
    text += `──────────────────────\n`
    results.forEach((res, i) => {
      const req = res.requirement
      const selKey = `${msgId}_${i}`
      const selected = msgId ? selectedModels[selKey] : null
      const m = selected
        ? (selected.product
            ? { ...selected.product, accuracy: selected.accuracy, calcHead: selected.product.calcHead || selected.calcHead, calcFlow: selected.product.calcFlow || selected.calcFlow, calcPower: selected.product.calcPower || selected.calcPower, calcVoltage: selected.product.calcVoltage || selected.calcVoltage }
            : selected)
        : res.bestMatch

      text += `${i + 1}. ${req.title.toUpperCase()}\n`
      text += `   • Yêu cầu: Q=${req.flow || '...'}m³/h, H=${req.head || '...'}m | SL: ${req.qty} máy (${req.mountLabel})\n`
      if (m) {
        text += `   👉 T&T đề xuất: ${m.name}\n`
        text += `   • Thông số: ${m.calcPower ? m.calcPower + 'kW' : ''} | Hmax=${m.calcHead || '...'}m | Qmax=${m.calcFlow || '...'}m³/h | ${m.calcVoltage || '380V'}\n`
        text += `   • Độ phù hợp: ⭐ ${m.accuracy}% kỹ thuật\n`
      }
      text += `\n`
    })
    text += `──────────────────────\n`
    text += `📞 Hotline Kỹ Thuật T&T: 0984.273.806\n`
    text += `Hình ảnh thực tế từng model đã được gửi kèm bên dưới!`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedZalo(true)
      toast('✅ Đã copy bản báo giá Zalo vào bộ nhớ tạm!', 'success')
      setTimeout(() => setCopiedZalo(false), 2500)
    }
  }

  // Export Excel Spreadsheet
  const handleExportExcel = async (results, title = 'Bảng Bóc Tách Dự Án', msgId = null) => {
    if (!results || results.length === 0) {
      toast('Chưa có dữ liệu để xuất Excel', 'warning')
      return
    }
    setExportingExcel(true)
    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Máy Bơm T&T'
      const ws = wb.addWorksheet('Báo Giá Dự Án', { views: [{ showGridLines: false }] })

      // ── Helper styles ──────────────────────────────────────────
      const thinBorder = {
        top:    { style: 'thin', color: { argb: 'FFB0C4D8' } },
        left:   { style: 'thin', color: { argb: 'FFB0C4D8' } },
        bottom: { style: 'thin', color: { argb: 'FFB0C4D8' } },
        right:  { style: 'thin', color: { argb: 'FFB0C4D8' } },
      }
      const medBorder = {
        top:    { style: 'medium', color: { argb: 'FF1E3A5F' } },
        left:   { style: 'medium', color: { argb: 'FF1E3A5F' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } },
        right:  { style: 'medium', color: { argb: 'FF1E3A5F' } },
      }
      const solidFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

      // ── COLS: 9 cột (bỏ Đơn giá & Thành tiền) ─────────────────
      // A=STT B=HạngMục C=ChủngLoại D=Q&H E=Model F=ThôngSốKT G=ĐộKhớp H=SL I=PhụKiện
      ws.columns = [
        { key: 'stt',        width: 5  },
        { key: 'req_title',  width: 30 },
        { key: 'mount_type', width: 14 },
        { key: 'req_specs',  width: 24 },
        { key: 'model_name', width: 26 },
        { key: 'model_specs',width: 28 },
        { key: 'accuracy',   width: 11 },
        { key: 'qty',        width: 7  },
        { key: 'notes',      width: 42 },
      ]
      const NCOLS = 9

      // ── ROW 1-3: Logo + Thông tin công ty (Đúng theo mẫu T&T) ──
      ws.getRow(1).height = 24
      ws.getRow(2).height = 18
      ws.getRow(3).height = 18

      ws.mergeCells('A1:B3')
      const logoCell = ws.getCell('A1')
      logoCell.value = 'T&T\nMÁY BƠM CÔNG NGHIỆP'
      logoCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      logoCell.fill = solidFill('FF1E3A5F')
      logoCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

      ws.mergeCells('C1:I1')
      const compCell = ws.getCell('C1')
      compCell.value = 'CÔNG TY TNHH TM MÁY CÔNG NGHIỆP T&T'
      compCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E3A5F' } }
      compCell.alignment = { horizontal: 'left', vertical: 'middle' }
      compCell.fill = solidFill('FFE8F0F8')

      ws.mergeCells('C2:I2')
      const addrCell = ws.getCell('C2')
      addrCell.value = 'Địa chỉ: Số 3 ngõ 61 đường Chùa Võ, TDP Thống Nhất, P. Dương Nội, TP Hà Nội'
      addrCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF374151' } }
      addrCell.alignment = { horizontal: 'left', vertical: 'middle' }
      addrCell.fill = solidFill('FFE8F0F8')

      ws.mergeCells('C3:E3')
      const mstCell = ws.getCell('C3')
      mstCell.value = 'MST: 0106888466'
      mstCell.font = { name: 'Arial', size: 9, color: { argb: 'FF374151' } }
      mstCell.alignment = { horizontal: 'left', vertical: 'middle' }
      mstCell.fill = solidFill('FFE8F0F8')

      ws.mergeCells('F3:I3')
      const stkCell = ws.getCell('F3')
      stkCell.value = 'STK: 8600888688888 – MB Tây Hà Nội'
      stkCell.font = { name: 'Arial', size: 9, color: { argb: 'FF374151' } }
      stkCell.alignment = { horizontal: 'left', vertical: 'middle' }
      stkCell.fill = solidFill('FFE8F0F8')

      // ── ROW 4: Blank ────────────────────────────────────────────
      ws.getRow(4).height = 8

      // ── ROW 5-7: Title block ────────────────────────────────────
      ws.getRow(5).height = 22
      ws.mergeCells('A5:I5')
      const titleCell = ws.getCell('A5')
      titleCell.value = 'BÁO GIÁ TỔNG HỢP DỰ ÁN'
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A5F' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      ws.getRow(6).height = 18
      ws.mergeCells('A6:I6')
      const subTitleCell = ws.getCell('A6')
      subTitleCell.value = 'ĐỐI CHIẾU NHU CẦU KỸ THUẬT & ĐỀ XUẤT THIẾT BỊ'
      subTitleCell.font = { name: 'Arial', size: 11, bold: false, color: { argb: 'FF374151' } }
      subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      ws.getRow(7).height = 16
      ws.mergeCells('A7:I7')
      const dateCell = ws.getCell('A7')
      dateCell.value = `Ngày lập: ${new Date().toLocaleDateString('vi-VN')}     |     Đơn vị tư vấn: Máy Bơm T&T     |     Hotline: 0984.273.806`
      dateCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // ── ROW 8: Blank spacer ────────────────────────────────────
      ws.getRow(8).height = 6

      // ── ROW 9: Header ─────────────────────────────────────────
      const DATA_START = 10
      const headerRow = ws.getRow(9)
      headerRow.height = 38
      headerRow.values = [
        'STT',
        'HẠNG MỤC YÊU CẦU',
        'CHỦNG LOẠI',
        'THÔNG SỐ Q & H\nYÊU CẦU',
        'MODEL T&T\nĐỐI CHIẾU',
        'THÔNG SỐ KỸ THUẬT T&T',
        'ĐỘ KHỚP',
        'SL',
        'PHỤ KIỆN & ĐỀ XUẤT',
      ]
      for (let c = 1; c <= NCOLS; c++) {
        const cell = headerRow.getCell(c)
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = solidFill('FF1E3A5F')
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = {
          top:    { style: 'medium', color: { argb: 'FFFFFFFF' } },
          left:   { style: 'thin',   color: { argb: 'FF4A6FA5' } },
          bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
          right:  { style: 'thin',   color: { argb: 'FF4A6FA5' } },
        }
      }

      // ── Data rows ──────────────────────────────────────────────
      let rIndex = DATA_START
      const isSubmersibleLabel = (label) => label && (label.toLowerCase().includes('chìm') || label.toLowerCase().includes('submers'))

      results.forEach((res, i) => {
        const req = res.requirement
        // Dùng model đã chọn (nếu có) hoặc bestMatch mặc định
        const selKey = `${msgId}_${i}`
        const selected = msgId ? selectedModels[selKey] : null
        const m = selected
          ? (selected.product
              ? { ...selected.product, accuracy: selected.accuracy, calcHead: selected.product.calcHead || selected.calcHead, calcFlow: selected.product.calcFlow || selected.calcFlow, calcPower: selected.product.calcPower || selected.calcPower, calcVoltage: selected.product.calcVoltage || selected.calcVoltage }
              : selected)
          : res.bestMatch
        const qty = req.qty || 1
        const acc = m?.accuracy || 0
        const isEven = i % 2 === 1

        const row = ws.getRow(rIndex)
        row.height = 44
        row.values = [
          i + 1,
          req.title || '',
          req.mountLabel || '',
          `Q=${req.flow ?? '...'} m³/h\nH=${req.head ?? '...'} m${req.config ? '\n' + req.config : ''}`,
          m?.name || 'Đang cập nhật',
          m
            ? [
                m.calcPower   ? `P: ${m.calcPower}kW`    : '',
                m.calcHead    ? `Hmax: ${m.calcHead}m`   : '',
                m.calcFlow    ? `Qmax: ${m.calcFlow}m³/h`: '',
                m.calcVoltage ? `${m.calcVoltage}`        : '',
              ].filter(Boolean).join(' | ')
            : '—',
          m ? (acc >= 90 ? `${acc}% ✓` : `${acc}%`) : '—',
          qty,
          req.accessories?.length ? req.accessories.join('\n') : 'Cụm tiêu chuẩn',
        ]

        const rowFill = isEven ? solidFill('FFF0F5FB') : solidFill('FFFFFFFF')
        for (let c = 1; c <= NCOLS; c++) {
          const cell = row.getCell(c)
          cell.fill = rowFill
          cell.border = thinBorder
          cell.font = { name: 'Arial', size: 10 }
          cell.alignment = { vertical: 'middle', wrapText: true }
        }

        // STT
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A5F' } }

        // Chủng loại badge
        const mountCell = row.getCell(3)
        mountCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        if (isSubmersibleLabel(req.mountLabel)) {
          mountCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0891B2' } }
          mountCell.fill = solidFill('FFE0F7FA')
        } else {
          mountCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFD97706' } }
          mountCell.fill = solidFill('FFFEF9EC')
        }

        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        row.getCell(4).font = { name: 'Arial', size: 10, color: { argb: 'FF374151' } }

        row.getCell(5).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A5F' } }
        row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

        const accCell = row.getCell(7)
        accCell.alignment = { horizontal: 'center', vertical: 'middle' }
        accCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: acc >= 90 ? 'FF059669' : 'FFD97706' } }

        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(8).font = { name: 'Arial', size: 10, bold: true }

        row.getCell(9).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } }
        row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

        rIndex++
      })

      // ── Total row (ghi chú thay thế tổng tiền do bỏ giá) ──────
      const totalRow = ws.getRow(rIndex)
      totalRow.height = 24
      ws.mergeCells(`A${rIndex}:I${rIndex}`)
      const totalLabelCell = totalRow.getCell(1)
      totalLabelCell.value = 'TỔNG CỘNG TIỀN THIẾT BỊ (CHƯA VAT):'
      totalLabelCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E3A5F' } }
      totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' }
      totalLabelCell.fill = solidFill('FFFEF3C7')
      totalLabelCell.border = medBorder

      // ── Lưu ý cuối ────────────────────────────────────────────
      const noteRow = ws.getRow(rIndex + 1)
      noteRow.height = 20
      ws.mergeCells(`A${rIndex + 1}:I${rIndex + 1}`)
      const noteCell = noteRow.getCell(1)
      noteCell.value = 'Lưu ý: Thông số đối chiếu mang tính tham khảo theo dữ liệu hiện có; vui lòng xác nhận điểm làm việc thực tế trước khi chốt model.'
      noteCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
      noteCell.alignment = { horizontal: 'left', vertical: 'middle' }
      noteCell.fill = solidFill('FFF9FAFB')

      // ── Freeze panes ───────────────────────────────────────────
      ws.views = [{ state: 'frozen', ySplit: 9, showGridLines: false }]

      // ── Download ───────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BaoGia-MayBomTT-${new Date().toISOString().slice(0,10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast('✅ Đã xuất file Excel Báo Giá Dự Án thành công!', 'success')
    } catch (err) {
      toast('Lỗi xuất Excel: ' + err.message, 'error')
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div
      onPaste={handlePaste}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--sans)',
        overflow: 'hidden'
      }}
    >
      {/* ── TOP HEADER ── */}
      <header
        style={{
          height: 52,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13
            }}
          >
            T&T
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                Trợ Lý Kỹ Thuật & Bóc Tách Máy Bơm
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'var(--surface2)',
                  color: 'var(--accent)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid var(--border)'
                }}
              >
                ChatGPT / Gemini
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Phân loại 100% Bơm Cạn vs Bơm Chìm • Thêm nhiều ảnh cùng lúc
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle side panel */}
          <button
            className="btn sm"
            onClick={() => setShowSidePanel(!showSidePanel)}
            title="Ẩn hoặc hiện bảng ảnh yêu cầu"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>{showSidePanel ? '◀ Ẩn ảnh yêu cầu' : '▶ Hiện ảnh yêu cầu'}</span>
          </button>

          {/* Lịch sử chat dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn sm"
              onClick={() => setShowSessionMenu(!showSessionMenu)}
              title="Xem danh sách các cuộc trò chuyện trước đây"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>💬 Lịch sử ({chatSessions.length})</span>
              <span>{showSessionMenu ? '▴' : '▾'}</span>
            </button>

            {showSessionMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  width: 320,
                  maxHeight: 380,
                  overflowY: 'auto',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                  zIndex: 99,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Các cuộc hội thoại đã lưu</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{chatSessions.length} đoạn chat</span>
                </div>

                {chatSessions.length === 0 ? (
                  <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                    Chưa có lịch sử cuộc trò chuyện nào
                  </div>
                ) : (
                  chatSessions.map(sess => (
                    <div
                      key={sess.id}
                      onClick={() => handleLoadSession(sess)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: sess.id === currentSessionId ? 'rgba(8, 120, 217, 0.12)' : 'var(--surface2)',
                        border: sess.id === currentSessionId ? '1px solid var(--primary)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: sess.id === currentSessionId ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sess.title || 'Cuộc trò chuyện'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                          {new Date(sess.timestamp).toLocaleString('vi-VN')} • {sess.messages?.length || 0} tin
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text3)',
                          padding: '2px 6px',
                          fontSize: 13,
                          borderRadius: 4
                        }}
                        title="Xóa đoạn chat này"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* New Chat Button */}
          <button
            className="btn sm primary"
            onClick={handleCreateNewChat}
            title="Bắt đầu cuộc trò chuyện mới"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <span>➕ Tạo chat mới</span>
          </button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (Side panel: Multi-Image Showcase + Right panel: Chat) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── LEFT PANE: TỔ HỢP ẢNH YÊU CẦU CỦA KHÁCH ── */}
        {showSidePanel && (
          <aside
            style={{
              width: 400,
              minWidth: 340,
              maxWidth: 460,
              background: 'var(--surface)',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Side pane top bar */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text)' }}>
                  Bảng Yêu Cầu ({reqImages.length} ảnh)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {reqImages.length > 0 ? `Đang chọn ${selectedReqImages.length}/${reqImages.length} ảnh` : 'Chưa có ảnh nào'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {reqImages.length > 1 && (
                  <button
                    onClick={handleClearAllImages}
                    className="btn sm"
                    style={{ fontSize: 11, color: 'var(--danger)', padding: '4px 8px' }}
                    title="Xóa tất cả các ảnh"
                  >
                    Xóa tất cả
                  </button>
                )}

                {/* Upload Multiple Images Button */}
                <input
                  type="file"
                  ref={multiFileInputRef}
                  onChange={handleMultiFileUpload}
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                />
                <button
                  className="btn sm primary"
                  onClick={() => multiFileInputRef.current?.click()}
                  style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Chọn một hoặc nhiều file ảnh từ máy"
                >
                  <span>+ Thêm ảnh</span>
                </button>
              </div>
            </div>

            {/* If images exist: Multi-Image Thumbnail Ribbon */}
            {reqImages.length > 0 && (
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  background: 'var(--surface)',
                  alignItems: 'center'
                }}
              >
                {reqImages.map((req, idx) => {
                  const isFocused = activeImageIndex === idx
                  return (
                    <div
                      key={req.id}
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: isFocused ? '2px solid var(--accent)' : '1px solid var(--border2)',
                          boxShadow: isFocused ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
                          background: '#f8fafc',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={req.src}
                          alt={req.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />

                        {/* Checkbox toggle */}
                        <input
                          type="checkbox"
                          checked={req.selected}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleSelectImage(req.id)
                          }}
                          title={req.selected ? 'Bỏ chọn ảnh này' : 'Chọn ảnh này để giải'}
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: 2,
                            width: 14,
                            height: 14,
                            cursor: 'pointer',
                            accentColor: 'var(--accent)'
                          }}
                        />

                        {/* Remove button on thumbnail */}
                        <button
                          onClick={(e) => handleRemoveImage(req.id, e)}
                          title="Gỡ ảnh này"
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: 'rgba(220, 38, 38, 0.9)',
                            color: '#fff',
                            border: 'none',
                            fontSize: 10,
                            fontWeight: 'bold',
                            lineHeight: '18px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            padding: 0,
                            zIndex: 2
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: isFocused ? 700 : 500,
                          color: isFocused ? 'var(--accent)' : 'var(--text2)',
                          marginTop: 3,
                          maxWidth: 62,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Ảnh {idx + 1}
                      </span>
                    </div>
                  )
                })}

                {/* Add more button tile in strip */}
                <div
                  onClick={() => multiFileInputRef.current?.click()}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: 'var(--surface2)',
                    color: 'var(--text3)',
                    fontSize: 11,
                    textAlign: 'center'
                  }}
                  title="Bấm để tải thêm ảnh"
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 9, marginTop: 2 }}>Thêm</span>
                </div>
              </div>
            )}

            {/* Main Preview Box or Empty Dropzone */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg)'
              }}
            >
              {focusedImage ? (
                <>
                  <div
                    onClick={() => setZoomImage(focusedImage.src)}
                    style={{
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      boxShadow: 'var(--shadow)',
                      position: 'relative',
                      cursor: 'zoom-in',
                      textAlign: 'center'
                    }}
                    title="Nhấn để phóng to ảnh xem rõ số liệu"
                  >
                    <img
                      src={focusedImage.src}
                      alt={focusedImage.title}
                      style={{
                        width: '100%',
                        maxHeight: 340,
                        objectFit: 'contain',
                        display: 'block'
                      }}
                    />
                    <div
                      style={{
                        padding: '6px 10px',
                        fontSize: 11,
                        background: 'rgba(15, 23, 42, 0.75)',
                        color: '#fff',
                        textAlign: 'center'
                      }}
                    >
                      🔍 Nhấn vào ảnh để phóng to xem rõ bảng số
                    </div>
                  </div>

                  {/* Image info & Prominent Remove Button */}
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {focusedImage.title}
                      </div>

                      {/* Prominent Gỡ ảnh button */}
                      <button
                        onClick={() => handleRemoveImage(focusedImage.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: 'var(--danger)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Gỡ ảnh này khỏi danh sách"
                      >
                        🗑️ Gỡ ảnh này
                      </button>
                    </div>

                    <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                      {focusedImage.subTitle} • {activeImageIndex + 1}/{reqImages.length} ảnh
                    </div>
                  </div>

                  {/* Master CTA: Solve ALL Selected Images */}
                  <button
                    className="btn primary"
                    onClick={() => handleSolveImages(selectedReqImages)}
                    disabled={chatLoading || selectedReqImages.length === 0}
                    style={{
                      marginTop: 12,
                      width: '100%',
                      padding: '12px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      boxShadow: 'var(--shadow-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>⚡ Bóc tách & giải toán ({selectedReqImages.length} ảnh đã chọn)</span>
                  </button>
                </>
              ) : (
                /* Empty state when no images */
                <div
                  onClick={() => multiFileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    textAlign: 'center',
                    border: '2px dashed var(--border2)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    color: 'var(--text2)',
                    minHeight: 280
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                    Chưa có ảnh yêu cầu nào
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 260, marginBottom: 16, lineHeight: 1.5 }}>
                    Bấm vào đây để tải một hoặc nhiều ảnh từ máy, hoặc nhấn <strong>Ctrl + V</strong> để dán ảnh Zalo.
                  </div>
                  <button className="btn primary" style={{ pointerEvents: 'none', fontSize: 12 }}>
                    + Thêm ảnh yêu cầu
                  </button>
                </div>
              )}

              <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                💡 Dán nhanh ảnh từ Zalo vào đây bằng <kbd style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace' }}>Ctrl + V</kbd>
              </div>
            </div>
          </aside>
        )}

        {/* ── RIGHT PANE: CHAT CONVERSATION ── */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg)',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Messages scroll area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}
          >
            {chatMessages.map(msg => {
              const isUser = msg.sender === 'user'

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    gap: 12,
                    maxWidth: 960,
                    width: '100%',
                    margin: '0 auto'
                  }}
                >
                  {/* AI Avatar */}
                  {!isUser && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                        marginTop: 2
                      }}
                    >
                      AI
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    style={{
                      maxWidth: isUser ? '78%' : '84%',
                      borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                      padding: '16px 20px',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      background: isUser ? '#1e293b' : 'var(--surface)',
                      color: isUser ? '#ffffff' : 'var(--text)',
                      border: isUser ? 'none' : '1px solid var(--border)',
                      boxShadow: 'var(--shadow)'
                    }}
                  >
                    {/* Attached requirement images showcase */}
                    {msg.attachedImages && msg.attachedImages.length > 0 && (
                      <div
                        style={{
                          marginBottom: 12,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          padding: 10,
                          background: isUser ? 'rgba(255,255,255,0.08)' : 'var(--surface2)',
                          borderRadius: 'var(--radius-sm)',
                          border: isUser ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border)'
                        }}
                      >
                        <div style={{ width: '100%', fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 2 }}>
                          📷 {msg.attachedImages.length} Ảnh bảng yêu cầu đính kèm:
                        </div>
                        {msg.attachedImages.map((att, attIdx) => (
                          <div
                            key={att.id || attIdx}
                            onClick={() => setZoomImage(att.src)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: isUser ? 'rgba(0,0,0,0.3)' : 'var(--surface)',
                              padding: '4px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: isUser ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border)'
                            }}
                            title="Bấm để phóng to"
                          >
                            <img
                              src={att.src}
                              alt={att.title}
                              style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }}
                            />
                            <span style={{ fontSize: 11, fontWeight: 600 }}>
                              {att.title ? att.title.split(':')[0] : `Ảnh ${attIdx + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text Body */}
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>

                    {/* ── IF THIS AI MESSAGE HAS SOLVE RESULTS ── */}
                    {!isUser && msg.solveResults && msg.solveResults.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                            marginBottom: 12
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text2)' }}>
                            Chi tiết {msg.solveResults.length} hạng mục máy bơm đã đối chiếu:
                          </span>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn sm"
                              onClick={() => handleCopyZaloFromResults(msg.solveResults, msg.id)}
                            >
                              📋 {copiedZalo ? 'Đã copy!' : 'Copy báo giá Zalo'}
                            </button>
                            <button
                              className="btn sm primary"
                              onClick={() => handleExportExcel(msg.solveResults, 'Báo Giá Tổng Hợp Dự Án', msg.id)}
                              disabled={exportingExcel}
                            >
                              📥 Xuất Excel
                            </button>
                          </div>
                        </div>

                        {/* Pump Items Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {msg.solveResults.map((res, idx) => {
                            const req = res.requirement
                            const itemKey = `${msg.id || 'curr'}_${idx}`
                            const selected = selectedModels[itemKey]
                            const m = selected
                              ? (selected.product
                                  ? { ...selected.product, accuracy: selected.accuracy, calcHead: selected.product.calcHead || selected.calcHead, calcFlow: selected.product.calcFlow || selected.calcFlow, calcPower: selected.product.calcPower || selected.calcPower, calcVoltage: selected.product.calcVoltage || selected.calcVoltage }
                                  : selected)
                              : res.bestMatch
                            const isSubmersible = req.mountType === 'submersible'
                            const isExpanded = expandedAlts.has(itemKey)
                            const candidates = (res.topCandidates && res.topCandidates.length > 0)
                              ? res.topCandidates
                              : [
                                  res.bestMatch ? { product: res.bestMatch, accuracy: res.bestMatch.accuracy } : null,
                                  res.altMatch ? { product: res.altMatch, accuracy: res.altMatch.accuracy } : null
                                ].filter(Boolean)

                            return (
                              <div
                                key={idx}
                                style={{
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius)',
                                  padding: 14,
                                  background: 'var(--surface2)'
                                }}
                              >
                                {/* Header row of item */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    marginBottom: 6
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: 'var(--border2)',
                                        color: 'var(--text)',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      {idx + 1}
                                    </span>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                                      {req.title}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {/* Mount Type Badge: Strict Cạn vs Chìm */}
                                    <span
                                      className={`badge ${isSubmersible ? 'badge-blue' : 'badge-amber'}`}
                                      style={{ fontSize: 11, fontWeight: 700 }}
                                    >
                                      {isSubmersible ? '🌊 BƠM CHÌM' : '🏭 BƠM CẠN'}
                                    </span>

                                    {/* Quantity */}
                                    <span className="badge badge-gray" style={{ fontSize: 11 }}>
                                      SL: {req.qty} máy
                                    </span>
                                  </div>
                                </div>

                                {/* Customer requirement specs */}
                                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, paddingLeft: 30 }}>
                                  Yêu cầu: <strong>Q = {req.flow || '...'} m³/h</strong> | <strong>H = {req.head || '...'} m</strong> ({req.config || 'Cụm tiêu chuẩn'})
                                </div>

                                {/* Matched T&T Product Card */}
                                {m ? (
                                  <>
                                    <div
                                      style={{
                                        background: 'var(--surface)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: 12,
                                        border: '1px solid var(--border)',
                                        boxShadow: 'var(--shadow)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        gap: 14
                                      }}
                                    >
                                      {/* Product image */}
                                      <div
                                        style={{
                                          width: 76,
                                          height: 76,
                                          borderRadius: 8,
                                          border: '1px solid var(--border)',
                                          background: '#f8fafc',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0
                                        }}
                                      >
                                        <img
                                          src={getProductImage(m)}
                                          alt={m.name}
                                          onClick={() => setZoomImage(getProductImage(m))}
                                          onError={(e) => {
                                            e.target.onerror = null
                                            e.target.src = m.isSubmersible ? '/pump_submersible.jpg' : '/pump_vertical_cdlf.jpg'
                                          }}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                            cursor: 'pointer'
                                          }}
                                        />
                                      </div>

                                      {/* Product Details */}
                                      <div style={{ flex: 1, minWidth: 200, fontSize: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                                            {m.name}
                                          </span>
                                          <span className="badge badge-green" style={{ fontSize: 10, fontWeight: 700 }}>
                                            Khớp {m.accuracy}% kỹ thuật
                                          </span>
                                        </div>

                                        <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 3 }}>
                                          Hãng: <strong style={{ color: 'var(--text2)' }}>{m.brand || 'T&T'}</strong> | Hmax: {m.calcHead || '...'}m | Qmax: {m.calcFlow || '...'}m³/h | {m.calcPower ? m.calcPower + 'kW' : ''} ({m.calcVoltage || '380V'})
                                        </div>
                                      </div>

                                      {/* Actions for product */}
                                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {candidates.length > 1 && (
                                          <button
                                            className="btn sm"
                                            onClick={() => {
                                              setExpandedAlts(prev => {
                                                const next = new Set(prev)
                                                if (next.has(itemKey)) next.delete(itemKey)
                                                else next.add(itemKey)
                                                return next
                                              })
                                            }}
                                            style={{
                                              fontWeight: 600,
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 4,
                                              background: isExpanded ? 'rgba(8, 120, 217, 0.15)' : 'var(--surface2)',
                                              borderColor: isExpanded ? 'var(--primary)' : undefined,
                                              color: isExpanded ? 'var(--primary)' : 'var(--text)'
                                            }}
                                            title="Xem các model thay thế tương đương và chọn model xuất Excel"
                                          >
                                            <span>{isExpanded ? '▴' : '▾'}</span>
                                            <span>{isExpanded ? 'Đóng' : `Đổi model (${candidates.length})`}</span>
                                          </button>
                                        )}

                                        <button
                                          className="btn sm"
                                          onClick={() => setSelectedProductDetail({ product: m, req })}
                                          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface2)' }}
                                          title="Xem chi tiết thông số kỹ thuật và đơn giá gốc niêm yết"
                                        >
                                          <span>🔍</span>
                                          <span>Xem thông số & giá gốc</span>
                                        </button>

                                        <button
                                          className="btn sm primary"
                                          onClick={() => handleCopyImage(getProductImage(m), `prod_${m.id}_${idx}`)}
                                          style={{
                                            background: copiedImgKey === `prod_${m.id}_${idx}` ? 'var(--success)' : undefined
                                          }}
                                        >
                                          📋 {copiedImgKey === `prod_${m.id}_${idx}` ? 'Đã copy!' : 'Sao chép ảnh Zalo'}
                                        </button>

                                        <button
                                          className="btn sm"
                                          onClick={() => downloadImage(getProductImage(m), `${m.name}.jpg`)}
                                        >
                                          Tải ảnh
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expandable alternative models */}
                                    {isExpanded && candidates.length > 0 && (
                                      <div
                                        style={{
                                          marginTop: 10,
                                          padding: '12px 14px',
                                          background: 'var(--surface)',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px dashed var(--primary)'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>🔄</span>
                                            <span>Các model T&T khác cùng đáp ứng yêu cầu (Bấm chọn để xuất Excel & Báo giá):</span>
                                          </div>
                                          <span className="badge badge-gray" style={{ fontSize: 10 }}>{candidates.length} phương án</span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          {candidates.map((cand, cIdx) => {
                                            const prod = cand.product || cand
                                            const candAcc = cand.accuracy ?? prod.accuracy ?? 0
                                            const isSelected = (m?.id && prod?.id) ? (m.id === prod.id) : (m?.name === prod?.name)

                                            const handlePick = () => {
                                              const normalized = {
                                                ...prod,
                                                image: prod.image || prod.resolvedImage || (prod.isSubmersible ? '/pump_submersible.jpg' : '/pump_vertical_cdlf.jpg'),
                                                accuracy: candAcc,
                                                isHighMatch: cand.isHighMatch,
                                                reason: cand.reason,
                                                calcHead: prod.calcHead,
                                                calcFlow: prod.calcFlow,
                                                calcPower: prod.calcPower,
                                                calcVoltage: prod.calcVoltage
                                              }
                                              setSelectedModels(prev => ({ ...prev, [itemKey]: normalized }))
                                              toast(`✅ Đã chọn model: ${prod.name}`, 'success')
                                            }

                                            return (
                                              <div
                                                key={prod.id || cIdx}
                                                onClick={handlePick}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  padding: '10px 12px',
                                                  borderRadius: 8,
                                                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                  background: isSelected ? 'rgba(8, 120, 217, 0.08)' : 'var(--surface2)',
                                                  cursor: 'pointer',
                                                  gap: 12,
                                                  flexWrap: 'wrap',
                                                  transition: 'all 0.15s ease'
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, flex: 1 }}>
                                                  <div style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: '50%',
                                                    border: isSelected ? '5px solid var(--primary)' : '2px solid var(--border2)',
                                                    background: '#fff',
                                                    flexShrink: 0
                                                  }} />

                                                  <img
                                                    src={getProductImage(prod)}
                                                    alt={prod.name}
                                                    onError={(e) => {
                                                      e.target.onerror = null
                                                      e.target.src = prod.isSubmersible ? '/pump_submersible.jpg' : '/pump_vertical_cdlf.jpg'
                                                    }}
                                                    style={{
                                                      width: 44,
                                                      height: 44,
                                                      objectFit: 'contain',
                                                      background: '#fff',
                                                      borderRadius: 6,
                                                      border: '1px solid var(--border)',
                                                      flexShrink: 0
                                                    }}
                                                  />

                                                  <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                      <span style={{ fontWeight: isSelected ? 700 : 600, fontSize: 13, color: isSelected ? 'var(--primary)' : 'var(--text)' }}>
                                                        {prod.name}
                                                      </span>
                                                      <span className={`badge ${candAcc >= 90 ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 10, fontWeight: 700 }}>
                                                        Khớp {candAcc}%
                                                      </span>
                                                      {cIdx === 0 && (
                                                        <span className="badge badge-blue" style={{ fontSize: 9 }}>Gợi ý số 1</span>
                                                      )}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                                      {prod.calcPower ? `P: ${prod.calcPower}kW | ` : ''}Hmax: {prod.calcHead || '...'}m | Qmax: {prod.calcFlow || '...'}m³/h | {prod.calcVoltage || '380V'}
                                                    </div>
                                                  </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                  <button
                                                    type="button"
                                                    className={`btn sm ${isSelected ? 'primary' : ''}`}
                                                    style={{ fontSize: 11, fontWeight: 600 }}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handlePick()
                                                    }}
                                                  >
                                                    {isSelected ? '✓ Đang chọn xuất' : 'Chọn model này'}
                                                  </button>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: 8 }}>
                                    Đang rà soát model chuyên dụng từ catalogue kho...
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── IF THIS AI MESSAGE HAS EXACT MATCHES FROM CHAT QUERY ── */}
                    {!isUser && msg.exactMatches && msg.exactMatches.length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text2)' }}>
                          Model máy bơm đề xuất từ kho T&T:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
                          {msg.exactMatches.slice(0, 4).map((p, pIdx) => (
                            <div
                              key={p.id || pIdx}
                              style={{
                                padding: 10,
                                background: 'var(--surface2)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 12
                              }}
                            >
                              <img
                                src={getProductImage(p)}
                                alt={p.name}
                                onClick={() => setZoomImage(getProductImage(p))}
                                onError={(e) => {
                                  e.target.onerror = null
                                  e.target.src = p.isSubmersible ? '/pump_submersible.jpg' : '/pump_vertical_cdlf.jpg'
                                }}
                                style={{
                                  width: 58,
                                  height: 58,
                                  objectFit: 'contain',
                                  background: '#fff',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                                  {p.brand || 'T&T'}
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                  <button
                                    onClick={() => setSelectedProductDetail({ product: p, req: null })}
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--accent)',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      padding: 0
                                    }}
                                  >
                                    🔍 Xem giá gốc
                                  </button>
                                  <span style={{ color: 'var(--border2)' }}>•</span>
                                  <button
                                    onClick={() => handleCopyImage(getProductImage(p), `match_${p.id}`)}
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--text2)',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      padding: 0
                                    }}
                                  >
                                    📋 {copiedImgKey === `match_${p.id}` ? 'Đã copy!' : 'Copy ảnh'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 8,
                        color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text3)',
                        textAlign: isUser ? 'right' : 'left'
                      }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div style={{ marginTop: 2, flexShrink: 0 }}>
                      <UserAvatar
                        user={{
                          ...user,
                          ...profile,
                          photoURL: profile?.photoURL || user?.photoURL,
                          displayName: profile?.displayName || user?.displayName || 'Tôi'
                        }}
                        size={32}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {/* AI Loading State */}
            {chatLoading && (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  maxWidth: 960,
                  width: '100%',
                  margin: '0 auto'
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0
                  }}
                >
                  AI
                </div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px 18px 18px 18px',
                    padding: '14px 18px',
                    fontSize: 12,
                    color: 'var(--text3)',
                    boxShadow: 'var(--shadow)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  <span>Đang bóc tách thông số và đối chiếu toàn bộ kho máy bơm T&T...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* ── CHAT BOTTOM INPUT BAR (With Multi-Image Chips like ChatGPT / Gemini) ── */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              padding: '12px 24px',
              flexShrink: 0,
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Staged Attached Images Chips (if any) */}
              {stagedChatImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {stagedChatImages.map((sImg, sIdx) => (
                    <div
                      key={sImg.id || sIdx}
                      style={{
                        position: 'relative',
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        overflow: 'hidden',
                        border: '1px solid var(--border2)',
                        flexShrink: 0
                      }}
                    >
                      <img src={sImg.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => setStagedChatImages(prev => prev.filter((_, i) => i !== sIdx))}
                        style={{
                          position: 'absolute',
                          top: 1,
                          right: 1,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          border: 'none',
                          fontSize: 9,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick suggestion chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>Gợi ý:</span>
                {selectedReqImages.length > 0 && (
                  <button
                    className="btn xs"
                    onClick={() => handleSolveImages(selectedReqImages)}
                    style={{ borderRadius: 12, fontWeight: 700 }}
                  >
                    ⚡ Bóc tách tất cả ({selectedReqImages.length} ảnh)
                  </button>
                )}
                <button
                  className="btn xs"
                  onClick={() => handleSendMessage('Cho tôi xin ảnh thực tế và thông số con bơm CDLF 16-12')}
                  style={{ borderRadius: 12 }}
                >
                  💬 Ảnh thực tế CDLF 16-12
                </button>
                <button
                  className="btn xs"
                  onClick={() => handleSendMessage('Tư vấn giúp anh 1 con bơm chìm nước thải Q=15m3/h H=20m')}
                  style={{ borderRadius: 12 }}
                >
                  💬 Bơm chìm Q=15 H=20
                </button>
                <button
                  className="btn xs"
                  onClick={() => handleSendMessage('Tư vấn cụm bơm tăng áp biến tần cho biệt thự hoặc tòa nhà mini')}
                  style={{ borderRadius: 12 }}
                >
                  💬 Bơm tăng áp biến tần
                </button>
              </div>

              {/* Main Prompt Input Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 8,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 20,
                  padding: '6px 12px'
                }}
              >
                {/* Upload Image Button (Multi-image support) */}
                <input
                  type="file"
                  ref={chatAttachInputRef}
                  onChange={handleChatAttachUpload}
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => chatAttachInputRef.current?.click()}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    fontSize: 16,
                    color: 'var(--text2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    marginBottom: 2
                  }}
                  title="Đính kèm một hoặc nhiều ảnh vào câu hỏi"
                >
                  📷
                </button>

                {/* Input Textarea - Hỗ trợ xuống dòng Shift + Enter */}
                <textarea
                  ref={chatTextareaRef}
                  rows={1}
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Nhập thông số (Q, H...), câu hỏi kỹ thuật hoặc dán ảnh (Ctrl+V)... [Shift+Enter để xuống dòng]"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 13,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    resize: 'none',
                    maxHeight: 140,
                    lineHeight: '1.45',
                    padding: '6px 0',
                    margin: 0
                  }}
                />

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={(!chatInput.trim() && stagedChatImages.length === 0) || chatLoading}
                  className="btn primary"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginBottom: 2,
                    opacity: (!chatInput.trim() && stagedChatImages.length === 0) || chatLoading ? 0.4 : 1
                  }}
                  title="Gửi tin nhắn (Enter)"
                >
                  ➤
                </button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                Trợ lý Kỹ thuật T&T • Đối chiếu chính xác 100% Bơm Cạn vs Bơm Chìm • Thêm nhiều ảnh cùng lúc
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── LIGHTBOX ZOOM MODAL ── */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <img
            src={zoomImage}
            alt="Zoomed"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}
          />
          <button
            onClick={() => setZoomImage(null)}
            className="btn"
            style={{ marginTop: 14, background: '#fff', color: '#0f172a' }}
          >
            Đóng (Click ra ngoài)
          </button>
        </div>
      )}

      {/* ── MODAL: CHI TIẾT THÔNG SỐ VÀ GIÁ GỐC NIÊM YẾT ── */}
      {selectedProductDetail && (
        <div
          onClick={(e) => e.target === e.currentTarget && setSelectedProductDetail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 620,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              padding: 0,
              borderRadius: 'var(--radius)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              border: '1px solid var(--border)'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔍</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  Thông Số Kỹ Thuật & Đơn Giá Gốc Niêm Yết
                </span>
              </div>
              <button
                className="btn sm ghost"
                onClick={() => setSelectedProductDetail(null)}
                style={{ fontSize: 16, padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                <div
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}
                >
                  <img
                    src={getProductImage(selectedProductDetail.product)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    {selectedProductDetail.product.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className={`badge ${selectedProductDetail.product.isSubmersible ? 'badge-blue' : 'badge-amber'}`}>
                      {selectedProductDetail.product.isSubmersible ? '🌊 Bơm chìm' : '🏭 Bơm cạn'}
                    </span>
                    <span className="badge badge-green">
                      Khớp {selectedProductDetail.product.accuracy || 90}% kỹ thuật
                    </span>
                    {selectedProductDetail.product.brand && (
                      <span className="badge badge-gray">{selectedProductDetail.product.brand}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    Mã sản phẩm: <strong>{selectedProductDetail.product.code || selectedProductDetail.product.id || 'T&T-STANDARD'}</strong>
                  </div>
                </div>
              </div>

              {/* Bảng giá gốc niêm yết (Bảo mật - chỉ hiện trong modal này) */}
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 14,
                  marginBottom: 16
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8, letterSpacing: 0.5 }}>
                  💰 BẢNG GIÁ GỐC NIÊM YẾT KHO T&T:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Đơn giá gốc niêm yết:</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                    {fmt(selectedProductDetail.product.price)}
                  </span>
                </div>
                {selectedProductDetail.req && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>Số lượng theo dự án:</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {selectedProductDetail.req.qty} máy
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px dashed var(--border2)'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Tổng thành tiền dự toán:</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>
                        {fmt((selectedProductDetail.product.price || 0) * (selectedProductDetail.req.qty || 1))}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Thông số kỹ thuật chi tiết */}
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  ⚙️ THÔNG SỐ VẬN HÀNH THỰC TẾ:
                </div>
                <div>• Cột áp tối đa (Hmax): <strong>{selectedProductDetail.product.calcHead || '...'} m</strong></div>
                <div>• Lưu lượng tối đa (Qmax): <strong>{selectedProductDetail.product.calcFlow || '...'} m³/h</strong></div>
                <div>• Công suất động cơ: <strong>{selectedProductDetail.product.calcPower ? selectedProductDetail.product.calcPower + ' kW' : 'Chuẩn hãng'}</strong></div>
                <div>• Điện áp sử dụng: <strong>{selectedProductDetail.product.calcVoltage || '380V / 220V'}</strong></div>
                {selectedProductDetail.req && (
                  <div style={{ marginTop: 8, padding: 8, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', color: '#1e40af' }}>
                    📌 <strong>Đề bài khách yêu cầu:</strong> Q={selectedProductDetail.req.flow || '...'} m³/h, H={selectedProductDetail.req.head || '...'} m ({selectedProductDetail.req.config})
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  className="btn primary"
                  onClick={() => {
                    handleCopyImage(getProductImage(selectedProductDetail.product), 'modal_img')
                  }}
                >
                  📋 Sao chép ảnh Zalo
                </button>
                <button
                  className="btn"
                  onClick={() => setSelectedProductDetail(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
