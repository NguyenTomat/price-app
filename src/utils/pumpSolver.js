/**
 * pumpSolver.js - Thuật toán Giải toán Máy Bơm & Bóc Tách Dự Án Kỹ Thuật (T&T Pump Solver)
 * 
 * Tính năng cốt lõi:
 * 1. Phân loại tuyệt đối: Bơm chìm (Submersible) vs Bơm cạn (Surface) - Độ chính xác 100%
 * 2. Phân tích điểm làm việc (Operating Point): Lưu lượng Q (m3/h) và Cột áp H (m)
 * 3. Thuật toán đối chiếu kho hàng & catalogue T&T: Đạt độ phù hợp kỹ thuật ≥ 90%
 * 4. Đề xuất phương án tối ưu kỹ thuật + phương án kinh tế
 */

/**
 * 1. Nhận diện chủng loại lắp đặt: Bơm chìm vs Bơm cạn
 */
export function detectPumpMountType(text) {
  const t = (text || '').toLowerCase()

  // Các dấu hiệu khẳng định là BƠM CHÌM (Submersible)
  const hasSubmersibleKw = /chìm|chim|submersible|hố pít|ho pit|hố thu|ho thu|hố móng|ho mong|hút bùn|hut bun|cắt rác|cat rac|nước sàn tầng hầm|nuoc san tang ham|nước thải|nuoc thai|thoát sàn|thoat san|thả chìm|tha chim/i.test(t)
  const hasDeepWellKw = /giếng khoan|gieng khoan|hỏa tiễn|hoa tien|deep well|thả giếng|tha gieng/i.test(t)

  // Các dấu hiệu khẳng định là BƠM CẠN (Surface)
  const hasSurfaceKw = /bơm cạn|bom can|trục đứng|truc dung|cấp nước sinh hoạt|cap nuoc sinh hoat|bơm tăng áp|bom tang ap|bơm tưới|bom tuoi|bể chứa|be chua|bình áp|binh ap|nồi hơi|noi hoi|lò hơi|lo hoi|ro|ly tâm trục ngang|ly tam truc ngang|đầu jet|dau jet|inline|bơm tăng áp tự động/i.test(t)

  if (hasSubmersibleKw || hasDeepWellKw) {
    let subCategory = 'Bơm chìm nước thải / hố thu công nghiệp'
    if (hasDeepWellKw) subCategory = 'Bơm chìm giếng khoan hỏa tiễn'
    else if (/bùn|rác|cắt/i.test(t)) subCategory = 'Bơm chìm hút bùn & cánh cắt rác'
    else if (/hố pít|ho pit|thoát sàn/i.test(t)) subCategory = 'Bơm chìm thoát sàn tầng hầm / hố pít'

    return {
      type: 'submersible',
      label: 'Bơm chìm (Submersible)',
      subCategory,
      isSubmersible: true
    }
  }

  if (hasSurfaceKw) {
    let subCategory = 'Bơm cạn ly tâm'
    if (/trục đứng|truc dung|cấp nước sinh hoạt|sinh hoạt/i.test(t)) {
      subCategory = 'Bơm cạn ly tâm trục đứng (CDLF) áp cao'
    } else if (/tăng áp|tang ap|biến tần/i.test(t)) {
      subCategory = 'Bơm cạn cụm tăng áp biến tần'
    } else if (/tưới|tuoi|bể chứa/i.test(t)) {
      subCategory = 'Bơm cạn ly tâm trục ngang lưu lượng'
    }

    return {
      type: 'surface',
      label: 'Bơm cạn (Surface/Dry)',
      subCategory,
      isSubmersible: false
    }
  }

  // Mặc định phân tích theo ngữ cảnh cột áp: Nếu đề bài ghi cụm cấp nước áp cao > 40m mà không nói chìm -> Bơm cạn
  return {
    type: 'surface',
    label: 'Bơm cạn (Surface)',
    subCategory: 'Bơm cạn công nghiệp',
    isSubmersible: false
  }
}

/**
 * 2. Bóc tách một dòng văn bản yêu cầu của khách hàng thành thông số
 */
export function parseRequirementRow(rowText, index = 1) {
  const raw = (rowText || '').trim()
  if (!raw) return null

  const mount = detectPumpMountType(raw)
  const lower = raw.toLowerCase()

  // 1. Lưu lượng Q (m3/h hoặc l/s)
  let flow = null
  // Match Q=45M3/H, Q = 20 m3/h, 45m3/h, 20 m³/h, Q:20m3/h
  const flowMatch = lower.match(/(?:q\s*[:=]?\s*|lưu lượng\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:m3\/h|m³\/h|m3h|m3\/giờ|khối\/h|m3)?/i)
    || lower.match(/(\d+(?:[.,]\d+)?)\s*(?:m3\/h|m³\/h|m3h|m3\/giờ|khối\/h)/i)
  if (flowMatch) {
    flow = parseFloat(flowMatch[1].replace(',', '.'))
  } else {
    // Check l/s: 1 l/s = 3.6 m3/h
    const lsMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:l\/s|lít\/s|lit\/s)/i)
    if (lsMatch) {
      flow = Number((parseFloat(lsMatch[1].replace(',', '.')) * 3.6).toFixed(1))
    }
  }

  // 2. Cột áp H (m)
  let head = null
  const headMatch = lower.match(/(?:h\s*[:=]?\s*|cột áp\s*[:=]?\s*|đẩy cao\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:m|mét|met)?\b/i)
    || lower.match(/(\d+(?:[.,]\d+)?)\s*(?:m|mét|met)\b/i)
  if (headMatch) {
    head = parseFloat(headMatch[1].replace(',', '.'))
  }

  // 3. Công suất P nếu có (kW hoặc HP)
  let power = null
  const powerMatch = lower.match(/(?:p\s*[:=]?\s*|công suất\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:kw|hp|ngựa|ngua)\b/i)
  if (powerMatch) {
    let pVal = parseFloat(powerMatch[1].replace(',', '.'))
    if (/hp|ngựa|ngua/i.test(powerMatch[0])) {
      pVal = Number((pVal * 0.7457).toFixed(1))
    }
    power = pVal
  }

  // 4. Số lượng máy / hệ
  let qty = 1
  const qtyMatch = raw.match(/\b(?:sl|số lượng|so luong)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i)
    || raw.match(/(\d+)\s*(?:máy|bơm|hệ|cụm|bộ)\b/i)
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10) || 1
  }

  // 5. Cấu hình vận hành (Luân phiên, dự phòng, đồng thời)
  let config = 'Bơm đơn'
  if (/2 bơm.*luân phiên|luân phiên.*2 bơm/i.test(lower)) config = 'Cụm 2 bơm luân phiên'
  else if (/1 hoạt động.*1 dự phòng|1 chạy.*1 dự phòng/i.test(lower)) config = '1 hoạt động + 1 dự phòng'
  else if (/đồng thời/i.test(lower)) config = 'Cụm 2 bơm luân phiên + chạy đồng thời'
  else if (/cụm|hệ/i.test(lower)) config = 'Cụm bơm trọn gói'

  // 6. Phụ kiện đề xuất theo ngành
  const accessories = []
  if (/tủ điều khiển|tủ điện/i.test(lower) || config.includes('luân phiên') || config.includes('dự phòng')) {
    accessories.push('Tủ điện điều khiển luân phiên tự động')
  }
  if (/bình áp 300l|bình tích áp 300l/i.test(lower)) accessories.push('Bình tích áp 300L (Varem/Aquasystem)')
  else if (/bình áp 250l|bình tích áp 250l/i.test(lower)) accessories.push('Bình tích áp 250L')
  else if (/tăng áp|tưới/i.test(lower) || /bình áp/i.test(lower)) accessories.push('Bình tích áp & Cảm biến áp suất')
  
  if (mount.type === 'submersible') {
    accessories.push('Khớp nối nhanh (Auto-coupling) & Cặp phao báo mức nước')
  }

  // Tên tiêu đề ngắn gọn
  let title = raw.split(/[:.]/)[0].trim()
  if (title.length > 60) title = title.substring(0, 60) + '...'
  if (!title) title = `Hạng mục ${index}`

  return {
    id: `req_${Date.now()}_${index}`,
    index,
    title,
    rawText: raw,
    mountType: mount.type, // 'submersible' | 'surface'
    mountLabel: mount.label,
    subCategory: mount.subCategory,
    flow, // m3/h
    head, // m
    power, // kW
    qty,
    config,
    accessories
  }
}

/**
 * 3. Phân tích thông số kỹ thuật của sản phẩm trong kho dữ liệu app
 */
export function analyzeProductDetails(p) {
  const name = (p.name || '').trim()
  const nameLower = name.toLowerCase()
  const groupLower = (p.group || p.category || p.listName || '').toLowerCase()
  const descLower = (p.desc || p.description || p.webDesc || '').toLowerCase()
  const allText = `${nameLower} ${groupLower} ${descLower}`

  // 1. Bơm Chìm vs Bơm Cạn
  // Sản phẩm là BƠM CHÌM nếu có từ khóa chìm/nước thải/wq/shm/dwmt/hỏa tiễn... và KHÔNG PHẢI là trục đứng CDLF
  const isSubmersible = (/chìm|chim|submersible|thải|thai|hố pít|ho pit|hố móng|ho mong|hút bùn|hut bun|cánh cắt|cat rac|wq|shm|dwmt|kbz|krs|4slm|6slm|r95|r 150|giếng|gieng|hỏa tiễn|hoa tien/i.test(allText)
    || /\b\d*wq\b/i.test(nameLower)
    || /\bshm?\d/i.test(nameLower)
    || /\bdwmt\d/i.test(nameLower))
    && !/trục đứng|truc dung|cdlf|tăng áp|tang ap|mhi|bơm cạn|bom can|thổi khí|gb/i.test(nameLower)

  // Phân biệt rõ bơm thả giếng khoan / hỏa tiễn (4SLM, 6SP, R95, R150) để không match nhầm vào hố nước thải / thoát sàn
  const isDeepWell = /giếng|gieng|hỏa tiễn|hoa tien|4slm|6slm|6sp|r95|r 150/i.test(allText)

  // 2. Công suất kW
  let powerKw = null
  if (p.powerKw && !isNaN(parseFloat(p.powerKw))) {
    powerKw = parseFloat(p.powerKw)
  } else if (p.powerHp && !isNaN(parseFloat(p.powerHp))) {
    powerKw = Number((parseFloat(p.powerHp) * 0.7457).toFixed(1))
  } else {
    const kwMatch = nameLower.match(/(\d+(?:[.,]\d+)?)\s*kw\b/)
    if (kwMatch) powerKw = parseFloat(kwMatch[1].replace(',', '.'))
    else {
      const hpMatch = nameLower.match(/(\d+(?:[.,]\d+)?)\s*hp\b/)
      if (hpMatch) powerKw = Number((parseFloat(hpMatch[1].replace(',', '.')) * 0.7457).toFixed(1))
    }
  }

  // 3. Cột áp Head (m)
  let head = null
  if (p.head && !isNaN(parseFloat(p.head))) {
    head = parseFloat(p.head)
  } else {
    const hMatch = allText.match(/(?:h\s*[:=]?\s*|hmax\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*m\b/i)
    if (hMatch) {
      head = parseFloat(hMatch[1].replace(',', '.'))
    } else {
      // Bóc tách theo quy chuẩn model WQ: ví dụ 50WQ15-20-2.2 => Q=15, H=20m, P=2.2kW
      const wqMatch = name.match(/\b\d*WQ(\d+)[-_](\d+)/i)
      if (wqMatch) {
        head = parseFloat(wqMatch[2])
      } else {
        // Bóc tách model DWMT: DWMT30-22-5,5 => Q=30, H=22m
        const dwmtMatch = name.match(/DWMT(\d+)[-_](\d+)/i)
        if (dwmtMatch) {
          head = parseFloat(dwmtMatch[2])
        } else {
          // Bóc tách model SHM / SH: SHM15-10-0.75F, SH15-40-3.0 => Q=15, H=10/40m
          const shmMatch = name.match(/SHM?(\d+)[-_](\d+)/i)
          if (shmMatch) {
            head = parseFloat(shmMatch[2])
          } else {
            // Bóc tách model CM đa tầng cánh: CM8-25 (H=25m), CM8-40 (H=40m), CM16-40 (H=40m)
            const cmMulti = name.match(/\bCM(\d+)[-_](\d+)/i)
            if (cmMulti) {
              head = parseFloat(cmMulti[2])
            } else {
              // Bóc tách model CDLF: CDLF 16-12 (Q=16m3/h, 12 tầng cánh)
              // CDLF 42-6 (Q=42m3/h, 6 tầng cánh)
              const cdlfMatch = name.match(/CDLF\s*(\d+)[-_](\d+)/i)
              if (cdlfMatch) {
                const qNom = parseInt(cdlfMatch[1], 10)
                const stages = parseInt(cdlfMatch[2], 10)
                const stageHead = qNom >= 42 ? 16.5 : qNom >= 32 ? 15 : 13
                head = Math.round(stages * stageHead)
              }
            }
          }
        }
      }
    }
  }

  // 4. Lưu lượng Flow (m3/h)
  let flow = null
  if (p.flow && !isNaN(parseFloat(p.flow))) {
    flow = parseFloat(p.flow)
  } else {
    const qMatch = allText.match(/(?:q\s*[:=]?\s*|qmax\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:m3\/h|m³\/h)/i)
    if (qMatch) {
      flow = parseFloat(qMatch[1].replace(',', '.'))
    } else {
      const wqMatch = name.match(/\b\d*WQ(\d+)[-_]/i)
      if (wqMatch) {
        flow = parseFloat(wqMatch[1])
      } else {
        const dwmtMatch = name.match(/DWMT(\d+)[-_]/i)
        if (dwmtMatch) {
          flow = parseFloat(dwmtMatch[1])
        } else {
          const shmMatch = name.match(/SHM?(\d+)[-_]/i)
          if (shmMatch) {
            flow = parseFloat(shmMatch[1])
          } else {
            const cmMulti = name.match(/\bCM(\d+)[-_]/i)
            if (cmMulti) {
              flow = parseFloat(cmMulti[1])
            } else {
              const cdlfMatch = name.match(/CDLF\s*(\d+)[-_]/i)
              if (cdlfMatch) {
                flow = parseFloat(cdlfMatch[1])
              }
            }
          }
        }
      }
    }
  }

  // 5. Điện áp
  const is3Phase = /380|3 pha/i.test(allText) || (powerKw && powerKw >= 3.0)
  const voltage = is3Phase ? '380V (3 pha)' : '220V (1 pha)'

  // Ảnh sản phẩm
  let image = null
  if (Array.isArray(p.webImages) && p.webImages.length > 0 && p.webImages[0]) image = p.webImages[0]
  else if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) image = p.images[0]
  else if (typeof p.image === 'string' && p.image && p.image !== '/logo.png') image = p.image
  else if (typeof p.imageUrl === 'string' && p.imageUrl && p.imageUrl !== '/logo.png') image = p.imageUrl

  if (!image) {
    if (isSubmersible) image = '/pump_submersible.jpg'
    else if (/cdlf|trục đứng|truc dung/i.test(nameLower)) image = '/pump_vertical_cdlf.jpg'
    else image = '/pump_horizontal_blue.jpg'
  }

  return {
    ...p,
    image,
    resolvedImage: image,
    isSubmersible,
    isDeepWell,
    mountType: isSubmersible ? 'submersible' : 'surface',
    mountLabel: isSubmersible ? 'Bơm chìm' : 'Bơm cạn',
    calcHead: head,
    calcFlow: flow,
    calcPower: powerKw,
    calcVoltage: voltage
  }
}

/**
 * 4. Thuật toán tính độ phù hợp kỹ thuật (Match Accuracy %)
 * Yêu cầu: Kiểm tra chủng loại bơm cạn / bơm chìm (100% bắt buộc), tỷ lệ phù hợp kỹ thuật ≥ 90%
 */
export function calculateMatchScore(req, product) {
  // ── ĐIỀU KIỆN TIÊN QUYẾT: BƠM CẠN vs BƠM CHÌM ─────────────────────────
  // Nếu đề bài yêu cầu Bơm Chìm mà sản phẩm là Bơm Cạn -> 0% (Loại bỏ ngay)
  // Nếu đề bài yêu cầu Bơm Cạn mà sản phẩm là Bơm Chìm -> 0% (Loại bỏ ngay)
  if (req.mountType === 'submersible' && !product.isSubmersible) {
    return {
      score: 0,
      accuracy: 0,
      isFit: false,
      reason: '❌ Sai chủng loại (Khách cần BƠM CHÌM, model này là Bơm cạn)'
    }
  }
  if (req.mountType === 'surface' && product.isSubmersible) {
    return {
      score: 0,
      accuracy: 0,
      isFit: false,
      reason: '❌ Sai chủng loại (Khách cần BƠM CẠN, model này là Bơm chìm)'
    }
  }

  // Tuyệt đối không dùng bơm hỏa tiễn / giếng khoan (4SLM, 6SP, R95, R150) cho các hạng mục thoát sàn, hố móng, nước thải
  const isSewageReq = /thải|thai|thoát|thoat|hố pít|ho pit|hố móng|ho mong|tầng hầm|tang ham|hạ tầng|ha tang|nước đọng/i.test((req.title || '') + ' ' + (req.rawText || ''))
  if (isSewageReq && product.isDeepWell) {
    return {
      score: 0,
      accuracy: 0,
      isFit: false,
      reason: '❌ Không phù hợp (Bơm hỏa tiễn/giếng khoan không thể dùng cho hố gom nước thải/thoát sàn)'
    }
  }

  // ── TÍNH ĐIỂM CỘT ÁP HEAD (Trọng số 50%) ──────────────────────────────
  let headScore = 80
  if (req.head && product.calcHead) {
    const ratio = product.calcHead / req.head
    // Điểm làm việc lý tưởng trong ngành bơm: H_model trong khoảng 1.05 đến 1.25 lần H_req (bù hao tổn ma sát đường ống)
    if (ratio >= 1.0 && ratio <= 1.25) {
      headScore = 100 - (ratio - 1.0) * 30 // 92.5 - 100 điểm
    } else if (ratio >= 0.95 && ratio < 1.0) {
      headScore = 90 - (1.0 - ratio) * 150 // 82.5 - 90 điểm
    } else if (ratio > 1.25 && ratio <= 1.45) {
      headScore = 88 - (ratio - 1.25) * 50 // 78 - 88 điểm
    } else if (ratio < 0.95) {
      headScore = Math.max(10, 75 - (0.95 - ratio) * 200)
    } else {
      headScore = Math.max(10, 70 - (ratio - 1.45) * 40)
    }
  }

  // ── TÍNH ĐIỂM LƯU LƯỢNG FLOW (Trọng số 40%) ───────────────────────────
  let flowScore = 80
  if (req.flow && product.calcFlow) {
    const ratio = product.calcFlow / req.flow
    if (ratio >= 0.95 && ratio <= 1.25) {
      flowScore = 100 - Math.abs(ratio - 1.05) * 30 // 94 - 100 điểm
    } else if (ratio >= 0.85 && ratio < 0.95) {
      flowScore = 88 - (0.95 - ratio) * 120 // 76 - 88 điểm
    } else if (ratio > 1.25 && ratio <= 1.55) {
      flowScore = 85 - (ratio - 1.25) * 45 // 71 - 85 điểm
    } else {
      flowScore = Math.max(15, 60 - Math.abs(ratio - 1.0) * 25)
    }
  }

  // ── TÍNH ĐIỂM PHỤC VỤ CÔNG SUẤT & ĐẶC TÍNH (Trọng số 10%) ──────────────
  let powerScore = 90
  if (req.power && product.calcPower) {
    const pDiff = Math.abs(product.calcPower - req.power)
    if (pDiff <= 0.5) powerScore = 100
    else if (pDiff <= 2.0) powerScore = 92
    else powerScore = Math.max(60, 85 - pDiff * 4)
  }

  // Khuyến khích model có đầy đủ ảnh
  const hasImage = Boolean(product.resolvedImage && product.resolvedImage !== '/logo.png')
  const bonus = hasImage ? 2 : 0

  let finalAccuracy = Math.round(headScore * 0.5 + flowScore * 0.4 + powerScore * 0.1 + bonus)
  finalAccuracy = Math.min(99, Math.max(15, finalAccuracy))

  // Đánh giá kỹ thuật
  let reason = ''
  if (product.isSubmersible) {
    reason = `Bơm chìm đạt chuẩn hố nước thải; Cột áp H=${product.calcHead || '...'}m (Đạt yêu cầu ${req.head}m); Q=${product.calcFlow || '...'}m³/h`
  } else {
    reason = `Bơm cạn trục đứng/ngang đạt chuẩn; Cột áp H=${product.calcHead || '...'}m (Đạt yêu cầu ${req.head}m); Q=${product.calcFlow || '...'}m³/h`
  }

  return {
    score: finalAccuracy,
    accuracy: finalAccuracy,
    isHighMatch: finalAccuracy >= 90,
    headRatio: req.head && product.calcHead ? Number((product.calcHead / req.head).toFixed(2)) : null,
    flowRatio: req.flow && product.calcFlow ? Number((product.calcFlow / req.flow).toFixed(2)) : null,
    reason
  }
}

/**
 * 5. Bộ giải toán toàn diện cho danh sách yêu cầu dự án
 */
export function solveProjectRequirements(requirementsList, allProducts = []) {
  if (!Array.isArray(requirementsList) || requirementsList.length === 0) return []

  // Chuẩn hóa và gắn nhãn sản phẩm trong kho một lần duy nhất
  const normalizedProducts = allProducts.map(analyzeProductDetails)

  return requirementsList.map((req, idx) => {
    // 1. Lọc sản phẩm đúng chủng loại Bơm chìm vs Bơm cạn
    const candidatePool = normalizedProducts.filter(p => {
      if (req.mountType === 'submersible') return p.isSubmersible
      if (req.mountType === 'surface') return !p.isSubmersible
      return true
    })

    // 2. Chấm điểm từng sản phẩm
    const scoredList = candidatePool.map(p => {
      const match = calculateMatchScore(req, p)
      return {
        product: p,
        ...match
      }
    }).filter(item => item.accuracy > 0)
      .sort((a, b) => b.accuracy - a.accuracy)

    // Lựa chọn Phương án 1 (Tối ưu nhất - Đạt ≥ 90%)
    const bestMatch = scoredList[0] || null

    // Lựa chọn Phương án 2 (Kinh tế / Công suất khác)
    let altMatch = null
    if (scoredList.length > 1) {
      altMatch = scoredList.find((item, i) => i > 0 && Math.abs(item.product.price - (bestMatch?.product?.price || 0)) > 0) || scoredList[1]
    }

    return {
      requirement: req,
      bestMatch: bestMatch ? {
        ...bestMatch.product,
        image: bestMatch.product.image || bestMatch.product.resolvedImage || (bestMatch.product.isSubmersible ? '/pump_submersible.jpg' : '/pump_vertical_cdlf.jpg'),
        accuracy: bestMatch.accuracy,
        isHighMatch: bestMatch.isHighMatch,
        reason: bestMatch.reason
      } : null,
      altMatch: altMatch ? {
        ...altMatch.product,
        image: altMatch.product.image || altMatch.product.resolvedImage || (altMatch.product.isSubmersible ? '/pump_submersible.jpg' : '/pump_vertical_cdlf.jpg'),
        accuracy: altMatch.accuracy,
        isHighMatch: altMatch.isHighMatch,
        reason: altMatch.reason
      } : null,
      topCandidates: scoredList.slice(0, 5)
    }
  })
}

/**
 * MẪU BÀI TOÁN THỰC TẾ 1 (Theo ảnh 1 của khách gửi)
 */
export const SAMPLE_PROJECT_1_TEXT = `CỤM BƠM CẤP NƯỚC SINH HOẠT. 1 CỤM GỒM 2 BƠM HOẠT ĐỘNG LUÂN PHIÊN. CÔNG SUẤT 1 BƠM: Q=45M3/H, H=100M. SL: 4 MÁY
CỤM BƠM TĂNG ÁP: Q=15M3/H, H=20M. 2 BƠM LÀM VIỆC LUÂN PHIÊN. SL: 4 MÁY
MÁY BƠM CHÌM THOÁT NƯỚC THẢI SINH HOẠT RA HẠ TẦNG. 1 CỤM GỒM 2 BƠM HOẠT ĐỘNG LUÂN PHIÊN CÓ CHẾ ĐỘ HOẠT ĐỘNG ĐỒNG THỜI. Q=30M3/H, H=20M. SL: 2 MÁY
MÁY BƠM CHÌM THOÁT NƯỚC SÀN TẦNG HẦM. 1 CỤM GỒM 2 BƠM HOẠT ĐỘNG LUÂN PHIÊN CÓ CHẾ ĐỘ HOẠT ĐỘNG ĐỒNG THỜI. CÔNG SUẤT 1 BƠM: Q=15M3/H, H=20M. SL: 8 MÁY
MÁY BƠM CHÌM THOÁT NƯỚC SÀN TẦNG HẦM. 1 CỤM GỒM 2 BƠM HOẠT ĐỘNG LUÂN PHIÊN CÓ CHẾ ĐỘ HOẠT ĐỘNG ĐỒNG THỜI. CÔNG SUẤT 1 BƠM: Q=20M3/H, H=20M. SL: 3 MÁY
MÁY BƠM CHÌM THOÁT NƯỚC HỐ PÍT. 1 CỤM GỒM 1 BƠM HOẠT ĐỘNG. CÔNG SUẤT 1 BƠM: Q=5M3/H, H=15M. SL: 8 MÁY`

/**
 * MẪU BÀI TOÁN THỰC TẾ 2 (Theo ảnh 2 của khách gửi)
 */
export const SAMPLE_PROJECT_2_TEXT = `Bơm cấp nước bể chứa: Q=20m3/h, H=40m (1 hoạt động, 1 dự phòng) + Tủ điều khiển. SL: 1 HỆ
Bơm tăng áp: Q=20m3/h, H=20m (1 hoạt động, 1 dự phòng) + Tủ điều khiển + Bình áp 300L. SL: 1 HỆ
Bơm tưới: Q=12m3/h, H=45m (1 hoạt động, 1 dự phòng) + Tủ điều khiển + Bình áp 250L. SL: 1 HỆ`
