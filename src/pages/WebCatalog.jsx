import { useState, useEffect, useMemo, useRef } from 'react'
import { getWebCatalogProducts, getWebCategories, getWebHeroSlides, createWebOrder } from '../firebase/firebase'
import PwaUpdateBanner from '../components/PwaUpdateBanner'
import { DEFAULT_HERO_SLIDES, normalizeHeroSlides } from './WebManagePage'

// Bản đồ Logo & Xuất xứ các thương hiệu máy bơm
const BRAND_METADATA = {
  'UPTI PUMP': {
    name: 'UPTI PUMP',
    origin: 'Đài Loan',
    logo: './logo_upti.png',
    desc: 'Thương hiệu máy bơm nước tiêu chuẩn Đài Loan, bền bỉ, tiết kiệm điện năng.',
    badgeBg: '#e0f2fe',
    badgeColor: '#0369a1'
  },
  'SELANNI': {
    name: 'SELANNI',
    origin: 'Italia (Ý)',
    logo: './logo_selanni.png',
    desc: 'Dòng máy bơm ly tâm, bơm trục đứng cao cấp tiêu chuẩn Châu Âu.',
    badgeBg: '#f0fdf4',
    badgeColor: '#166534'
  },
  'BERATI': {
    name: 'BERATI',
    origin: 'Italia (Ý)',
    logo: './logo_berati.png',
    desc: 'Thương hiệu chuyên về máy sục khí con sò và thiết bị xử lý nước chuyên dụng.',
    badgeBg: '#fff7ed',
    badgeColor: '#c2410c'
  },
  'MASTRA': {
    name: 'MASTRA',
    origin: 'Trung Quốc',
    logo: './logo_mastra.png',
    desc: 'Thương hiệu máy bơm chìm, bơm hỏa tiễn công nghệ cao nhập khẩu chính hãng.',
    badgeBg: '#fef2f2',
    badgeColor: '#991b1b'
  }
}

// Sleek vector SVG icon components
const FolderIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
)

const ChevronRight = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
)

const ChevronLeft = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
)

const SparklesIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path>
  </svg>
)

const HomeIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
)

const LeafIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
    <path d="M2 22s13.79-4.04 18.06-8.31a8.87 8.87 0 0 0-12.72-12.72C3.04 5.24 2 22 2 22z"></path>
    <path d="M12 22a8.87 8.87 0 0 0 0-12.72"></path>
  </svg>
)

const DropletIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
  </svg>
)

const SearchIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
)

const TrendingUpIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
)

const SortAscendingIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>
)

const SortDescendingIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
)

const BoltIcon = ({ size = 13, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
)

const PlugIcon = ({ size = 13, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
    <path d="M18 10h-1.5M6 10H4.5M9 22V12h6v10M8 5h8v4H8z"></path>
  </svg>
)

const InfoIcon = ({ size = 13, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
)

const MapPinIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
)

const MailIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
)

const PhoneIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
)

const CheckCircleIcon = ({ size = 60, color = '#10b981' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 20px' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
)

// Local rule-based AI engine fallback
const localAIEngine = (promptText, products) => {
  const text = promptText.toLowerCase()
  let responseText = ""
  let matchedIds = []

  if (text.includes("hỏa tiễn") || text.includes("giếng khoan") || text.includes("khoan sâu") || text.includes("giếng sâu") || text.includes("mastra")) {
    responseText = "Với nhu cầu giếng khoan sâu hoặc sử dụng bơm hỏa tiễn, T&T khuyên dùng dòng bơm hỏa tiễn chuyên dụng hiệu UPTI PUMP hoặc MASTRA cánh inox. Dưới đây là các mã sản phẩm phù hợp tối ưu nhất cho bạn:"
    matchedIds = products.filter(p => 
      p.group?.toLowerCase().includes("hỏa tiễn") || 
      p.listName?.toLowerCase().includes("hỏa tiễn") ||
      p.webBrand?.toLowerCase().includes("mastra")
    ).map(p => p.id)
  } else if (text.includes("nước thải") || text.includes("hố ga") || text.includes("hút bùn") || text.includes("ngập hầm") || text.includes("bơm chìm") || text.includes("chìm")) {
    responseText = "Để hút nước thải, hố ga, chống ngập hầm hoặc bơm chìm chuyên dụng, bạn nên dùng dòng bơm chìm gang đen hoặc inox hiệu UPTI PUMP có độ bền cao. Dưới đây là các sản phẩm phù hợp nhất:"
    matchedIds = products.filter(p => 
      p.group?.toLowerCase().includes("chìm") || 
      p.listName?.toLowerCase().includes("chìm") ||
      p.listName?.toLowerCase().includes("nước thải") ||
      p.group?.toLowerCase().includes("thải")
    ).map(p => p.id)
  } else if (text.includes("tưới tiêu") || text.includes("sân vườn") || text.includes("nông nghiệp") || text.includes("tưới cỏ") || text.includes("sục khí") || text.includes("con sò") || text.includes("thổi khí") || text.includes("oxy")) {
    responseText = "Để sục khí nuôi tôm, sục bể gas hoặc tưới tiêu nông nghiệp sân vườn, T&T khuyên dùng dòng bơm ly tâm lưu lượng lớn hoặc máy sục khí con sò hiệu BERATI/UPTI PUMP. Dưới đây là gợi ý dành cho bạn:"
    matchedIds = products.filter(p => 
      p.group?.toLowerCase().includes("con sò") || 
      p.listName?.toLowerCase().includes("sục khí") ||
      p.group?.toLowerCase().includes("sục khí") ||
      p.listName?.toLowerCase().includes("con sò")
    ).map(p => p.id)
  } else if (text.includes("đẩy cao") || text.includes("nhà cao") || text.includes("tầng") || text.includes("trục đứng") || text.includes("lầu") || text.includes("tăng áp") || text.includes("cdlf")) {
    responseText = "Với nhu cầu đẩy nước lên nhà cao tầng, chung cư mini hoặc tăng áp lực đường ống, bạn nên sử dụng dòng bơm trục đứng CDLF/CDLFM hoặc bơm ly tâm đa tầng cánh hiệu SELANNI. Dưới đây là các mã phù hợp nhất:"
    matchedIds = products.filter(p => 
      p.group?.toLowerCase().includes("đứng") || 
      p.listName?.toLowerCase().includes("đứng") ||
      p.group?.toLowerCase().includes("tăng áp") ||
      p.listName?.toLowerCase().includes("tăng áp")
    ).map(p => p.id)
  } else {
    responseText = "T&T đã tiếp nhận nhu cầu của bạn. Chúng tôi đề xuất các dòng máy bơm ly tâm đa tầng cánh và bơm chìm bán chạy nhất phù hợp với đa số nhu cầu dân dụng và công nghiệp:"
    matchedIds = products.slice(0, 3).map(p => p.id)
  }

  const suggestedProducts = products.filter(p => matchedIds.includes(p.id)).slice(0, 3)
  return { responseText, suggestedProducts }
}

export default function WebCatalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeBrand, setActiveBrand] = useState('ALL')
  const [sortType, setSortType] = useState('bestseller')
  const [homeFeaturedTab, setHomeFeaturedTab] = useState('ALL')

  // Routing states: 'catalog' | 'product-detail'
  const [viewMode, setViewMode] = useState('catalog')
  const [detailProductId, setDetailProductId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isZoomed, setIsZoomed] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 })
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [detailTab, setDetailTab] = useState('desc')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [sliderInteracted, setSliderInteracted] = useState(false)
  const [hoveredCardId, setHoveredCardId] = useState(null)
  const [hoveredBtnId, setHoveredBtnId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('TẤT CẢ')
  const [activeTab, setActiveTab] = useState('home')
  const [dbCategories, setDbCategories] = useState([])
  const [catPages, setCatPages] = useState({}) // { [catIdx]: pageNum }
  const [filterGroups, setFilterGroups] = useState(new Set()) // multi-select product type filter

  // Product Finder states
  const [finderUse, setFinderUse] = useState('')
  const [finderFlow, setFinderFlow] = useState('')
  const [finderHead, setFinderHead] = useState('')
  const [finderVoltage, setFinderVoltage] = useState('220V')
  const [finderResults, setFinderResults] = useState([])
  const [hasFinderSearched, setHasFinderSearched] = useState(false)
  const [mobileFinderStep, setMobileFinderStep] = useState(1)

  // Catalog page filter states
  const [filterPower, setFilterPower] = useState('ALL')
  const [filterVoltage, setFilterVoltage] = useState('ALL')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showMegaMenu, setShowMegaMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [sliderHead, setSliderHead] = useState(60)
  const [sliderFlow, setSliderFlow] = useState(50)

  // Contact page form states
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactType, setContactType] = useState('Nhà ở dân dụng')
  const [contactNote, setContactNote] = useState('')

  // AI assistant states
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedNeed, setSelectedNeed] = useState('')
  const [customNeedText, setCustomNeedText] = useState('')
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  // Custom hero slider slides list management
  const [heroSlidesList, setHeroSlidesList] = useState(() => {
    try {
      const saved = localStorage.getItem('tt_custom_hero_slides_list');
      if (saved) return normalizeHeroSlides(JSON.parse(saved));
      const oldConfig = localStorage.getItem('tt_custom_hero_images');
      if (oldConfig) return normalizeHeroSlides(JSON.parse(oldConfig));
    } catch {}
    return DEFAULT_HERO_SLIDES;
  });
  const [sliderPaused, setSliderPaused] = useState(false);

  // Load custom hero slides from Firestore on mount
  useEffect(() => {
    getWebHeroSlides().then(data => {
      if (data) {
        const normalized = normalizeHeroSlides(data);
        setHeroSlidesList(normalized);
        try {
          localStorage.setItem('tt_custom_hero_slides_list', JSON.stringify(normalized));
        } catch (e) {}
      }
    }).catch(err => console.warn("Lỗi tải hero slides từ Firebase:", err));
  }, []);

  const defaultBentoItems = useMemo(() => [
    { name: 'Bơm ly tâm', desc: 'Trục ngang công nghiệp', img: './pump_horizontal_blue.jpg', searchKey: 'ly tâm', sizeClass: 'bento-large' },
    { name: 'Bơm ly tâm trục đứng', desc: 'CDLF áp lực cao', img: './pump_vertical.jpg', searchKey: 'trục đứng', sizeClass: 'bento-medium' },
    { name: 'Bơm chìm nước thải', desc: 'Thoát nước công nghiệp', img: './pump_submersible.jpg', searchKey: 'nước thải', sizeClass: 'bento-medium' },
    { name: 'Bơm giếng khoan', desc: 'Khai thác nước ngầm', img: './pump_submersible_blue.jpg', searchKey: 'giếng khoan', sizeClass: 'bento-small' },
    { name: 'Bơm hỏa tiễn', desc: 'Đẩy cao công suất lớn', img: './pump_submersible_ss.jpg', searchKey: 'hỏa tiễn', sizeClass: 'bento-small' },
    { name: 'Bơm tăng áp', desc: 'Duy trì áp lực ống dẫn', img: './pump_booster_green.jpg', searchKey: 'tăng áp', sizeClass: 'bento-small' },
    { name: 'Bơm KTZ hút bùn', desc: 'Hút nước hố móng bùn loãng', img: './pump_container.jpg', searchKey: 'hút bùn', sizeClass: 'bento-small' },
  ], [])

  const bentoItems = useMemo(() => {
    if (!dbCategories || dbCategories.length === 0) {
      return defaultBentoItems
    }
    const featuredCats = dbCategories.filter(cat => typeof cat === 'string' ? true : cat?.featured === true)
    if (featuredCats.length === 0) {
      return defaultBentoItems
    }
    return featuredCats.map((cat, idx) => {
      const sizeClass = idx === 0 ? 'bento-large' : (idx === 1 || idx === 2 ? 'bento-medium' : 'bento-small')
      const catName = typeof cat === 'string' ? cat : cat?.name || ''
      const catImage = typeof cat === 'string' ? '' : cat?.image || cat?.img || ''
      const catDesc = typeof cat === 'string' ? '' : cat?.desc || ''
      
      const matchedDefault = defaultBentoItems.find(def => 
        def.name.toLowerCase().includes(catName.toLowerCase()) || 
        catName.toLowerCase().includes(def.name.toLowerCase())
      )
      
      return {
        name: catName,
        desc: catDesc || matchedDefault?.desc || 'Thiết bị bơm chính hãng',
        img: catImage || matchedDefault?.img || './pump_horizontal_blue.jpg',
        searchKey: matchedDefault?.searchKey || catName.toLowerCase(),
        sizeClass
      }
    })
  }, [dbCategories, defaultBentoItems])

  const getCategoryGraphic = (item) => {
    if (item.image) return item.image;
    const normalized = (item.name || '').toLowerCase();
    if (normalized.includes('tăng áp')) return './pump_booster_green.jpg';
    if (normalized.includes('biến tần')) return './pump_vertical_cdlf.jpg';
    if (normalized.includes('ly tâm')) return './pump_horizontal_blue.jpg';
    if (normalized.includes('công nghiệp')) return './pump_vertical.jpg';
    if (normalized.includes('dàn bơm')) return './pump_showroom.jpg';
    if (normalized.includes('dân dụng')) return './pump_submersible_blue.jpg';
    return './pump_showroom.jpg';
  };

  const getCategorySliderData = (cat) => {
    const name = typeof cat === 'string' ? cat : cat?.name || '';
    const customImg = (typeof cat === 'object' && cat?.image) ? cat.image : '';

    const normalized = name.toLowerCase();
    if (normalized.includes('biến tần')) {
      return {
        eyebrow: 'BƠM BIẾN TẦN THÔNG MINH',
        headlineL1: 'ỔN ĐỊNH ÁP LỰC',
        headlineL2: 'TIẾT KIỆM ĐIỆN NĂNG',
        desc: 'Điều khiển áp suất tự động theo lưu lượng thực tế, vận hành ổn định và tối ưu năng lượng.',
        usps: ['⚡ TIẾT KIỆM ĐIỆN ĐẾN 60%', '◉ VẬN HÀNH ÊM ÁI', '✓ BẢO VỆ CHẠY KHÔ'],
        img: customImg || './pump_vertical_cdlf.jpg',
        techCode: 'CDLF SERIES · INVERTER · 380V',
        category: name
      };
    }
    if (normalized.includes('tăng áp')) {
      return {
        eyebrow: 'BƠM TĂNG ÁP ĐIỆN TỬ',
        headlineL1: 'ÁP LỰC ỔN ĐỊNH',
        headlineL2: 'CHO MỌI CÔNG TRÌNH',
        desc: 'Duy trì áp lực nước đầu ra liên tục cho vòi sen, bình nóng lạnh và hệ thống cấp nước sinh hoạt.',
        usps: ['⚡ TỰ ĐỘNG ĐÓNG NGẮT', '◉ CẢM BIẾN ÁP SUẤT', '✓ CHỐNG CẠN AN TOÀN'],
        img: customImg || './pump_booster_green.jpg',
        techCode: 'ELECTRONIC BOOSTER · 220V · IP55',
        category: name
      };
    }
    if (normalized.includes('chìm') || normalized.includes('dân dụng') || normalized.includes('giếng')) {
      return {
        eyebrow: 'BƠM CHÌM GIẾNG KHOAN',
        headlineL1: 'KHAI THÁC NƯỚC SÂU',
        headlineL2: 'HIỆU QUẢ VƯỢT TRỘI',
        desc: 'Thân vỏ Inox 304 nguyên khối chống ăn mòn, động cơ thả chìm giải nhiệt dầu bền bỉ 24/7.',
        usps: ['⚡ CỘT ÁP ĐẾN 300M', '◉ INOX 304 CHỐNG GỈ', '✓ ĐỘNG CƠ DẦU 24/7'],
        img: customImg || './pump_submersible_blue.jpg',
        techCode: 'SUBMERSIBLE PUMP · HMAX 300M · 380V/220V',
        category: name
      };
    }
    if (normalized.includes('ly tâm') || normalized.includes('hỏa tiễn')) {
      return {
        eyebrow: 'BƠM LY TÂM CÔNG SUẤT LỚN',
        headlineL1: 'LƯU LƯỢNG SIÊU LỚN',
        headlineL2: 'ĐẨY CAO — VƯỢT BẬC',
        desc: 'Phục vụ trạm cấp nước đô thị, nhà máy xưởng và hệ thống tưới tiêu nông nghiệp diện tích lớn.',
        usps: ['⚡ LƯU LƯỢNG 200M³/H', '◉ CÁNH ĐÚC HỢP KIM', '✓ TIÊU CHUẨN CHÂU ÂU'],
        img: customImg || './pump_horizontal_blue.jpg',
        techCode: 'CENTRIFUGAL HEAVY DUTY · QMAX 200M³/H',
        category: name
      };
    }
    if (normalized.includes('dàn bơm')) {
      return {
        eyebrow: 'HỆ THỐNG CỤM DÀN BƠM',
        headlineL1: 'GIẢI PHÁP CẤP NƯỚC',
        headlineL2: 'CHO TÒA NHÀ CAO TẦNG',
        desc: 'Cụm 2-4 máy bơm biến tần chạy luân phiên dự phòng, điều khiển PLC thông minh đồng bộ.',
        usps: ['⚡ ĐIỀU KHIỂN PLC', '◉ LUÂN PHIÊN DỰ PHÒNG', '✓ ÁP LỰC LIÊN TỤC 24/7'],
        img: customImg || './pump_showroom.jpg',
        techCode: 'MULTI-PUMP BOOSTER · PLC INVERTER',
        category: name
      };
    }
    return {
      eyebrow: 'MÁY BƠM CÔNG NGHIỆP',
      headlineL1: 'CHỊU TẢI LIÊN TỤC',
      headlineL2: 'VẬN HÀNH ỔN ĐỊNH 24/7',
      desc: 'Giải pháp bơm giải nhiệt máy móc xưởng đúc, xi mạ, công nghiệp nặng và xử lý nước ngập.',
      usps: ['⚡ THÂN GANG CẦU DÀY', '◉ CÁCH ĐIỆN LỚP F', '✓ BẢO VỆ TIÊU CHUẨN IP55'],
      img: customImg || './pump_vertical.jpg',
      techCode: 'INDUSTRIAL GRADE · CLASS F · IP55',
      category: name
    };
  };

  const homepageSlides = useMemo(() => {
    return heroSlidesList && heroSlidesList.length > 0 ? heroSlidesList : DEFAULT_HERO_SLIDES;
  }, [heroSlidesList]);

  // Auto-play Carousel Timer (every 4.5s, pause on hover)
  useEffect(() => {
    if (homepageSlides.length <= 1 || sliderPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % homepageSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [homepageSlides.length, sliderPaused]);

  const dynamicCategories = useMemo(() => {
    return dbCategories.length > 0 ? dbCategories.map(c => {
      if (typeof c === 'string') return { name: c, image: '', desc: '', featured: false };
      return c;
    }) : [
      { name: 'BƠM BIẾN TẦN', image: './pump_vertical_cdlf.jpg', desc: 'Tự động điều chỉnh tần số động cơ đáp ứng chính xác nhu cầu lưu lượng.', featured: true },
      { name: 'BƠM TĂNG ÁP', image: './pump_booster_green.jpg', desc: 'Vận hành tự động hoàn toàn, duy trì áp lực ổn định tại mọi vòi sen.', featured: true },
      { name: 'BƠM CHÌM GIẾNG KHOAN', image: './pump_submersible_blue.jpg', desc: 'Dòng bơm thả giếng khoan, bơm chìm hố móng bùn loãng nhập khẩu nguyên chiếc.', featured: true },
      { name: 'BƠM LY TÂM', image: './pump_horizontal_blue.jpg', desc: 'Bơm cấp thoát lưu lượng nước lớn cho sản xuất, khu công nghiệp và nông nghiệp.', featured: true },
      { name: 'DÀN BƠM', image: './pump_showroom.jpg', desc: 'Thiết kế lắp ráp cụm bơm song song phục vụ chung cư, trạm cấp nước.', featured: true },
      { name: 'BƠM CÔNG NGHIỆP', image: './pump_vertical.jpg', desc: 'Được tuyển chọn kỹ lưỡng, đạt tiêu chuẩn quốc tế và đầy đủ CO/CQ.', featured: true }
    ];
  }, [dbCategories]);

  useEffect(() => {
    if (homepageSlides.length > 0 && currentSlide >= homepageSlides.length) {
      setCurrentSlide(0);
    }
  }, [homepageSlides, currentSlide]);

  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set();
    products.forEach(p => {
      if (p.webBrand && p.showOnWeb) {
        brandsSet.add(p.webBrand.toUpperCase().trim());
      }
    });
    if (brandsSet.size === 0) {
      return ['UPTI PUMP', 'SELANNI', 'BERATI', 'MASTRA'];
    }
    return Array.from(brandsSet);
  }, [products]);
  const [aiResponseText, setAiResponseText] = useState('')

  // Floating AI Chat Box states
  const [showFloatingChat, setShowFloatingChat] = useState(false)
  const [showAiInvite, setShowAiInvite] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Xin chào! Tôi là Trợ lý AI của Máy Bơm T&T. Bạn đang cần tìm máy bơm đẩy cao, bơm chìm nước thải hay bơm tưới tiêu? Hãy chọn nhu cầu hoặc nhập yêu cầu cụ thể bên dưới để tôi tìm giúp bạn mã bơm phù hợp nhất nhé!'
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSuggestions, setChatSuggestions] = useState([])
  const [showContactMenu, setShowContactMenu] = useState(false)

  useEffect(() => {
    const closed = localStorage.getItem('tt_ai_chat_closed')
    let timer;
    if (!closed) {
      timer = setTimeout(() => {
        setShowAiInvite(true)
      }, 10000)
    }
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    }
  }, [])

  // Auto-slide product sliders — scroll each category's slider forward every 3.5s
  const touchStartXRef = useRef(null)
  const catStripRef = useRef(null)
  const autoSlideTimers = useRef({})
  const startAutoSlide = (id) => {
    if (autoSlideTimers.current[id]) return
    autoSlideTimers.current[id] = setInterval(() => {
      const el = document.getElementById(id)
      if (!el) return
      const maxScroll = el.scrollWidth - el.clientWidth
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 236, behavior: 'smooth' })
      }
    }, 3500)
  }
  const stopAutoSlide = (id) => {
    if (autoSlideTimers.current[id]) {
      clearInterval(autoSlideTimers.current[id])
      delete autoSlideTimers.current[id]
    }
  }
  useEffect(() => {
    return () => { Object.values(autoSlideTimers.current).forEach(clearInterval) }
  }, [])

  // Lock body scroll when mobile navigation drawer is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileMenu]);

  // Shopping Cart states
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('tt_web_cart')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showCartDrawer, setShowCartDrawer] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  // Smart Pump Selector States
  const [calcPumpType, setCalcPumpType] = useState('submersible')
  const [calcHeight, setCalcHeight] = useState(10)
  const [calcLength, setCalcLength] = useState(20)
  const [calcElbows, setCalcElbows] = useState(4)
  const [calcVolume, setCalcVolume] = useState(2)
  const [calcTime, setCalcTime] = useState(1)
  const [calcTaps, setCalcTaps] = useState(4)
  const [calcResults, setCalcResults] = useState(null)
  const [calculatedProducts, setCalculatedProducts] = useState([])


  // Callback form states
  const [callbackName, setCallbackName] = useState('')
  const [callbackPhone, setCallbackPhone] = useState('')
  const [callbackNote, setCallbackNote] = useState('')
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false)

  // Save cart changes
  useEffect(() => {
    localStorage.setItem('tt_web_cart', JSON.stringify(cart))
  }, [cart])
  // Smart Pump Calculator Helper Logic
  const parsePumpSpecs = (specStr) => {
    if (!specStr) return { hMin: 12, hMax: 45, qMin: 3.0, qMax: 12.0 };
    let hMin = 0, hMax = 0, qMin = 0, qMax = 0;

    // 1. Try to parse Hmax directly (e.g., "Hmax 134 m" or "Hmax: 134")
    const hMaxMatch = specStr.match(/Hmax\s*:?\s*([\d.]+)/i);
    if (hMaxMatch) {
      hMax = parseFloat(hMaxMatch[1]);
    }

    // 2. Try to parse H range (e.g. "H(m): 30-10" or "H: 30-10" or "cột áp: 8-32")
    const hRangeMatch = specStr.match(/(?:H\(m\)|H|cột áp)\s*:?\s*([\d.]+)\s*-\s*([\d.]+)/i);
    if (hRangeMatch) {
      const val1 = parseFloat(hRangeMatch[1]);
      const val2 = parseFloat(hRangeMatch[2]);
      hMin = Math.min(val1, val2);
      if (hMax <= 0) hMax = Math.max(val1, val2);
    } else if (hMax <= 0) {
      // Try single H value
      const hSingleMatch = specStr.match(/(?:H\(m\)|H|cột áp)\s*:?\s*([\d.]+)/i);
      if (hSingleMatch) {
        const val = parseFloat(hSingleMatch[1]);
        hMin = val * 0.5;
        hMax = val;
      }
    }

    // 3. Try to parse Qmax directly (e.g., "Qmax 3.5 m3/h" or "Qmax: 3.5")
    const qMaxMatch = specStr.match(/Qmax\s*:?\s*([\d.]+)/i);
    if (qMaxMatch) {
      qMax = parseFloat(qMaxMatch[1]);
    }

    // 4. Try to parse Q range (e.g. "Q(m3/h): 15-5" or "Q: 15-5")
    const qRangeMatch = specStr.match(/(?:Q\(m3\/h\)|Q|lưu lượng)\s*:?\s*([\d.]+)\s*-\s*([\d.]+)/i);
    if (qRangeMatch) {
      const val1 = parseFloat(qRangeMatch[1]);
      const val2 = parseFloat(qRangeMatch[2]);
      qMin = Math.min(val1, val2);
      if (qMax <= 0) qMax = Math.max(val1, val2);
    } else if (qMax <= 0) {
      // Try single Q value
      const qSingleMatch = specStr.match(/(?:Q\(m3\/h\)|Q|lưu lượng)\s*:?\s*([\d.]+)/i);
      if (qSingleMatch) {
        const val = parseFloat(qSingleMatch[1]);
        qMin = val * 0.3;
        qMax = val;
      }
    }

    // Dynamic fallback if parsed max specs are still 0
    if (hMax <= 0.1 || qMax <= 0.1) {
      const powerStr = specStr.toLowerCase();
      let powerkW = 0.75; // Default average power 1 HP
      const kwMatch = powerStr.match(/([\d.]+)\s*(?:kw|kilowatt)/i);
      const hpMatch = powerStr.match(/([\d.]+)\s*(?:hp|ngựa|luc|lực)/i);
      if (kwMatch) {
        powerkW = parseFloat(kwMatch[1]);
      } else if (hpMatch) {
        powerkW = parseFloat(hpMatch[1]) * 0.75;
      }

      if (powerkW <= 0.4) {
        if (hMax <= 0.1) { hMin = 4; hMax = 18; }
        if (qMax <= 0.1) { qMin = 1.2; qMax = 4.8; }
      } else if (powerkW <= 0.8) {
        if (hMax <= 0.1) { hMin = 8; hMax = 32; }
        if (qMax <= 0.1) { qMin = 2.0; qMax = 8.5; }
      } else if (powerkW <= 1.2) {
        if (hMax <= 0.1) { hMin = 12; hMax = 45; }
        if (qMax <= 0.1) { qMin = 3.0; qMax = 12.0; }
      } else if (powerkW <= 1.8) {
        if (hMax <= 0.1) { hMin = 16; hMax = 55; }
        if (qMax <= 0.1) { qMin = 3.6; qMax = 16.0; }
      } else if (powerkW <= 2.5) {
        if (hMax <= 0.1) { hMin = 20; hMax = 72; }
        if (qMax <= 0.1) { qMin = 4.5; qMax = 22.0; }
      } else if (powerkW <= 4.5) {
        if (hMax <= 0.1) { hMin = 24; hMax = 95; }
        if (qMax <= 0.1) { qMin = 6.0; qMax = 36.0; }
      } else if (powerkW <= 8.0) {
        if (hMax <= 0.1) { hMin = 32; hMax = 125; }
        if (qMax <= 0.1) { qMin = 8.0; qMax = 60.0; }
      } else {
        if (hMax <= 0.1) { hMin = 40; hMax = 160; }
        if (qMax <= 0.1) { qMin = 12.0; qMax = 120.0; }
      }
    }

    return { hMin, hMax, qMin, qMax };
  }

  const renderProductCard = (p) => {
    const pow = p.webSpecs?.power ? formatPower(p.webSpecs.power) : '';
    const volt = p.webSpecs?.voltage ? formatVoltage(p.webSpecs.voltage) : '';
    const parsedSpecs = parsePumpSpecs(p.webSpecs?.specs);

    const formatSpecNumber = (val) => {
      if (val === undefined || val === null) return '';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return Number(num.toFixed(1)).toString();
    };

    const qMin = parsedSpecs ? formatSpecNumber(parsedSpecs.qMin) : '';
    const qMax = parsedSpecs ? formatSpecNumber(parsedSpecs.qMax) : '';
    const hMin = parsedSpecs ? formatSpecNumber(parsedSpecs.hMin) : '';
    const hMax = parsedSpecs ? formatSpecNumber(parsedSpecs.hMax) : '';

    const qRange = qMax ? `${qMax} m³/h` : '';
    const hRange = hMax ? `${hMax} m` : '';
    
    const mainTitle = p.code && pow ? `${p.code} - ${pow}` : (p.code || pow || '');

    return (
      <div key={p.id} className="product-card">
        {/* Product image container */}
        <div className="product-card-image" onClick={() => navigateToProduct(p.id)}>
          <img
            src={((p.name && (p.name.includes('2-18') || p.code?.includes('2-18'))) ? './pump_vertical.jpg' : (p.webImages?.[0] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=400&q=80'))}
            alt={`Máy bơm nước ${p.name}`}
            className="bg-image-zoom"
            loading="lazy"
          />
          <div
            className="quick-view-overlay"
            onClick={(e) => { e.stopPropagation(); setQuickViewProduct(p); }}
          >
            <span>🔍 XEM NHANH</span>
          </div>
        </div>

        <div className="product-card-content">
          <span className="product-card-brand" style={{ fontSize: 10, fontWeight: 800, color: '#667085', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {p.group || 'MÁY BƠM NƯỚC'} / {p.webBrand || 'UPTI PUMP'}
          </span>

          <h4 className="product-card-title" onClick={() => navigateToProduct(p.id)} style={{ fontSize: 16, fontWeight: 700, color: '#071A2F', margin: '4px 0' }}>
            {p.name}
          </h4>

          <h3 className="product-card-model" style={{ fontSize: 12.5, fontWeight: 500, color: '#667085', margin: '0 0 10px 0' }}>
            {p.code || mainTitle}
          </h3>

          <div className="product-card-specs" style={{ borderTop: '1px dashed #EEF1F4', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
            {pow && (
              <div className="spec-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="spec-label" style={{ color: '#667085' }}>⚡ Công suất</span>
                <span className="spec-value" style={{ fontWeight: 700, color: '#101828' }}>{pow}</span>
              </div>
            )}
            {qRange && (
              <div className="spec-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="spec-label" style={{ color: '#667085' }}>💧 Lưu lượng</span>
                <span className="spec-value" style={{ fontWeight: 700, color: '#101828' }}>{qRange}</span>
              </div>
            )}
            {hRange && (
              <div className="spec-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="spec-label" style={{ color: '#667085' }}>↑ Cột áp</span>
                <span className="spec-value" style={{ fontWeight: 700, color: '#101828' }}>{hRange}</span>
              </div>
            )}
            {volt && (
              <div className="spec-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="spec-label" style={{ color: '#667085' }}>◉ Điện áp</span>
                <span className="spec-value" style={{ fontWeight: 700, color: '#101828' }}>{volt}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #EEF1F4', margin: '12px 0 8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px 0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase' }}>GIÁ</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0878D9' }}>LIÊN HỆ</span>
          </div>

          <div className="product-card-actions" style={{ display: 'flex', gap: 8, marginTop: 'auto', borderTop: 'none', paddingTop: 0 }}>
            <button
              onClick={() => navigateToProduct(p.id)}
              className="product-card-btn brand-btn"
              style={{ flex: 1, height: 38, border: '1px solid #EEF1F4', background: '#FFFFFF', color: '#071A2F', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase' }}
            >
              XEM CHI TIẾT
            </button>
            <button
              onClick={() => {
                const isAlreadyInCart = cart.some(item => item.product.id === p.id);
                if (!isAlreadyInCart) {
                  setCart(prev => [...prev, { product: p, quantity: 1 }]);
                }
                setShowCartDrawer(true);
              }}
              className="product-card-btn cta-btn"
              style={{ flex: 1, height: 38, border: 'none', background: '#0878D9', color: '#FFFFFF', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase' }}
            >
              BÁO GIÁ
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Compact homepage featured product card — separate from the main catalog card
  const renderFeaturedCard = (p) => {
    const pow = p.webSpecs?.power ? formatPower(p.webSpecs.power) : '';
    const volt = p.webSpecs?.voltage ? formatVoltage(p.webSpecs.voltage) : '';
    const parsedSpecs = parsePumpSpecs(p.webSpecs?.specs);
    const formatSpec = (val) => {
      if (val === undefined || val === null) return '';
      const n = parseFloat(val);
      return isNaN(n) ? val : Number(n.toFixed(1)).toString();
    };
    const qMax = parsedSpecs ? formatSpec(parsedSpecs.qMax) : '';
    const hMax = parsedSpecs ? formatSpec(parsedSpecs.hMax) : '';
    const qRange = qMax ? `${qMax} m³/h` : '';
    const hRange = hMax ? `${hMax} m` : '';

    // Prefer real product photo (webImages[0]) over promotional posters
    const imgSrc = p.webImages?.[0] || './pump_showroom.jpg';

    const specs = [
      pow && { icon: '⚡', label: 'CS', val: pow },
      qRange && { icon: '💧', label: 'Q', val: qRange },
      hRange && { icon: '↑', label: 'H', val: hRange },
      volt && { icon: '◉', label: 'U', val: volt },
    ].filter(Boolean);

    return (
      <div
        key={p.id}
        style={{
          background: '#FFFFFF',
          border: '1px solid #EEF1F4',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 8px rgba(7,26,47,0.03)',
        }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(7,26,47,0.09)';
          e.currentTarget.style.borderColor = '#0878D9';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(7,26,47,0.03)';
          e.currentTarget.style.borderColor = '#EEF1F4';
        }}
      >
        {/* Image area — 160-200px dominant image */}
        <div
          onClick={() => navigateToProduct(p.id)}
          style={{
            height: 180,
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <img
            src={imgSrc}
            alt={p.name}
            loading="lazy"
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: '10px',
              boxSizing: 'border-box',
              transition: 'transform 0.3s ease',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          />
        </div>

        {/* Content */}
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {/* Category / Brand */}
          <span style={{ fontSize: 10, fontWeight: 800, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {p.group || 'MÁY BƠM'} · {p.webBrand || 'T&T'}
          </span>

          {/* Model name (2 lines clamp) */}
          <div
            onClick={() => navigateToProduct(p.id)}
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: '#071A2F',
              lineHeight: 1.3,
              cursor: 'pointer',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              lineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 36,
            }}
          >
            {p.name}
          </div>

          {/* Compact 2-col specs grid */}
          {specs.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '3px 6px',
              borderTop: '1px dashed #EEF1F4',
              paddingTop: 8,
              marginTop: 2,
            }}>
              {specs.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <span style={{ fontSize: 11 }}>{s.icon}</span>
                  <span style={{ color: '#94A3B8', fontWeight: 600 }}>{s.label}:</span>
                  <span style={{ fontWeight: 800, color: '#101828' }}>{s.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>GIÁ</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#0878D9' }}>LIÊN HỆ</span>
          </div>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
            <button
              onClick={() => navigateToProduct(p.id)}
              style={{
                flex: 1,
                height: 34,
                border: '1px solid #BAE6FD',
                background: '#F0F9FF',
                color: '#0878D9',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 11.5,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.2px',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#0878D9'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#F0F9FF'; e.currentTarget.style.color = '#0878D9'; }}
            >
              XEM CHI TIẾT →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleFinderSearch = (e) => {
    if (e) e.preventDefault();
    const reqFlow = parseFloat(finderFlow) || 0;
    const reqHead = parseFloat(finderHead) || 0;

    const matched = products.filter(p => {
      if (!p.showOnWeb) return false;

      // Filter by Voltage
      if (finderVoltage) {
        const v = (p.webSpecs?.voltage || '').toLowerCase();
        if (finderVoltage === '220V' && !v.includes('220v') && !v.includes('1 pha')) return false;
        if (finderVoltage === '380V' && !v.includes('380v') && !v.includes('3 pha')) return false;
      }

      // Filter by Purpose/Group name
      if (finderUse) {
        const gp = (p.group || '').toLowerCase();
        if (finderUse === 'Giếng khoan' && !gp.includes('hỏa tiễn') && !gp.includes('giếng khoan')) return false;
        if (finderUse === 'Nước thải' && !gp.includes('nước thải') && !gp.includes('chìm') && !gp.includes('bùn') && !gp.includes('hố ga')) return false;
        if (finderUse === 'Tưới tiêu' && !gp.includes('ly tâm') && !gp.includes('lưu lượng') && !gp.includes('ngang')) return false;
        if (finderUse === 'Nhà dân' && !gp.includes('tăng áp') && !gp.includes('biến tần') && !gp.includes('chân không') && !gp.includes('ly tâm')) return false;
        if (finderUse === 'Nhà hàng / khách sạn' && !gp.includes('trục đứng') && !gp.includes('tăng áp') && !gp.includes('ly tâm')) return false;
        if (finderUse === 'Nhà xưởng' && !gp.includes('công nghiệp') && !gp.includes('trục đứng') && !gp.includes('ly tâm')) return false;
        if (finderUse === 'RO / lọc nước' && !gp.includes('trục đứng') && !gp.includes('đa tầng')) return false;
        if (finderUse === 'Công nghiệp' && !gp.includes('công nghiệp') && !gp.includes('trục đứng') && !gp.includes('lưu lượng')) return false;
      }

      // Parse and match Flow / Head if inputs provided
      if (reqFlow > 0 || reqHead > 0) {
        const parsed = parsePumpSpecs(p.webSpecs?.specs);
        if (!parsed) return false;
        const { hMin, hMax, qMin, qMax } = parsed;

        if (reqHead > 0) {
          if (reqHead < hMin || reqHead > hMax * 1.2) return false;
        }
        if (reqFlow > 0) {
          if (reqFlow < qMin || reqFlow > qMax * 1.2) return false;
        }
      }

      return true;
    });

    setFinderResults(matched);
    setHasFinderSearched(true);
    
    // Scroll to results
    setTimeout(() => {
      const el = document.getElementById('finder-results-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const runPumpCalculation = () => {
    let hReq = 0
    let qReq = 0

    if (calcPumpType === 'submersible') {
      hReq = calcHeight + (calcLength * 0.08) + (calcElbows * 0.8)
      qReq = calcVolume / calcTime
    } else if (calcPumpType === 'surface') {
      hReq = calcHeight + (calcLength * 0.1) + (calcElbows * 0.8)
      qReq = calcVolume / calcTime
    } else {
      // booster or inverter
      qReq = calcTaps * 0.5
      hReq = calcHeight + 20 // 2 bar booster pressure
    }

    hReq = parseFloat(hReq.toFixed(1))
    qReq = parseFloat(qReq.toFixed(1))

    setCalcResults({ head: hReq, flow: qReq })

    const matched = products.filter(p => {
      if (!p.showOnWeb) return false

      const groupName = (p.group || '').toLowerCase()
      let matchesType = false

      if (calcPumpType === 'submersible') {
        matchesType = groupName.includes('chìm') || groupName.includes('thải') || groupName.includes('hố ga') || groupName.includes('bùn') || groupName.includes('hỏa tiễn')
      } else if (calcPumpType === 'surface') {
        matchesType = groupName.includes('ly tâm') || groupName.includes('trục ngang') || groupName.includes('trục đứng') || groupName.includes('đẩy cao') || groupName.includes('bơm công nghiệp')
      } else {
        matchesType = groupName.includes('tăng áp') || groupName.includes('biến tần') || groupName.includes('thông minh') || groupName.includes('selanni')
      }

      if (!matchesType) return false

      const parsed = parsePumpSpecs(p.webSpecs?.specs)
      if (!parsed) return false

      const { hMin, hMax, qMin, qMax } = parsed

      // Match check with 15% upper limit buffer
      const hMatches = hReq >= hMin && hReq <= (hMax * 1.15)
      const qMatches = qReq >= qMin && qReq <= (qMax * 1.15)

      return hMatches && qMatches
    })

    matched.sort((a, b) => (a.price || 0) - (b.price || 0))
    setCalculatedProducts(matched)
  }

  // Auto run pump calculations when inputs change
  useEffect(() => {
    runPumpCalculation()
  }, [calcPumpType, calcHeight, calcLength, calcElbows, calcVolume, calcTime, calcTaps, products])

  // Phân luồng router dựa trên Hash URL (#web hoặc #web/product/123 hoặc qua query parameter)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      const params = new URLSearchParams(window.location.search)
      const queryProductId = params.get('product')

      if (queryProductId) {
        setDetailProductId(queryProductId)
        setViewMode('product-detail')
        setActiveImageIndex(0)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (hash.startsWith('#web/product/')) {
        const id = hash.replace('#web/product/', '')
        setDetailProductId(id)
        setViewMode('product-detail')
        setActiveImageIndex(0)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        const h = window.location.hash
        if (h === '#web/catalog' || h === '#products' || h === '#web/products') {
          setViewMode('catalog')
          setActiveTab('products')
        } else if (h === '#web/applications' || h === '#applications') {
          setViewMode('applications')
          setActiveTab('applications')
        } else if (h === '#web/brands' || h === '#brands') {
          setViewMode('brands')
          setActiveTab('brands')
        } else if (h === '#web/intro' || h === '#about' || h === '#web/about') {
          setViewMode('intro')
          setActiveTab('intro')
        } else if (h === '#web/contact' || h === '#contact') {
          setViewMode('contact')
          setActiveTab('contact')
        } else if (h === '#web/policy' || h === '#policy') {
          setViewMode('policy')
          setActiveTab('policy')
        } else if (h === '#web/calculator') {
          setViewMode('calculator')
          setActiveTab('calculator')
        } else {
          setViewMode('home')
          setActiveTab('home')
        }
        setDetailProductId('')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Auto-slide effect for homepage hero carousel (rotate slides every 6 seconds)
  useEffect(() => {
    if (sliderInteracted || homepageSlides.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % homepageSlides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [sliderInteracted, homepageSlides])

  // Load products with LocalStorage cache (Stale-While-Revalidate)
  useEffect(() => {
    const CACHE_KEY = 'tt_web_products_cache'
    const CACHE_TIME_KEY = 'tt_web_products_cache_time'

    const fetchCategories = async () => {
      try {
        const cats = await getWebCategories()
        setDbCategories(cats)
      } catch (err) {
        console.warn('Lỗi tải danh mục từ db:', err)
      }
    }

    const fetchAndCache = async () => {
      try {
        const data = await getWebCatalogProducts()
        setProducts(data)
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString())
      } catch (err) {
        console.error('Không tải được sản phẩm công cộng:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()

    const cachedData = localStorage.getItem(CACHE_KEY)
    if (cachedData) {
      setProducts(JSON.parse(cachedData))
      setLoading(false)
    } else {
      setLoading(true)
    }

    // Always fetch fresh data in background to stay up to date
    fetchAndCache()
  }, [])

  // Get current active product for detail page view
  const currentProduct = useMemo(() => {
    if (!detailProductId || !products.length) return null
    return products.find(p => p.id === detailProductId) || null
  }, [detailProductId, products])

  // Get categories (custom settings list entered by the user)
  const categories = useMemo(() => {
    return ['TẤT CẢ', ...dbCategories.map(c => typeof c === 'string' ? c : c?.name || '')]
  }, [dbCategories])

  // Brand, Category, Search Filtering & Sorting
  const processedProducts = useMemo(() => {
    let result = [...products]

    if (activeBrand !== 'ALL') {
      result = result.filter(p => (p.webBrand || '').toUpperCase() === activeBrand.toUpperCase())
    }

    if (selectedCategory !== 'TẤT CẢ') {
      result = result.filter(p =>
        (p.group || '').trim().toLowerCase() === selectedCategory.trim().toLowerCase()
      )
    }

    // Multi-select group filter (sidebar)
    if (filterGroups.size > 0) {
      result = result.filter(p => filterGroups.has((p.group || '').trim()))
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.webDesc || '').toLowerCase().includes(term) ||
        (p.webBrand || '').toLowerCase().includes(term) ||
        (p.group || '').toLowerCase().includes(term) ||
        (p.id || '').toLowerCase().includes(term)
      )
    }

    if (filterPower !== 'ALL') {
      result = result.filter(p => {
        const pow = (p.webSpecs?.power || '').toString().toLowerCase();
        return pow.includes(filterPower.toLowerCase());
      });
    }

    if (filterVoltage !== 'ALL') {
      result = result.filter(p => {
        const volt = (p.webSpecs?.voltage || '').toLowerCase();
        if (filterVoltage === '220V') return volt.includes('220v') || volt.includes('1 pha');
        if (filterVoltage === '380V') return volt.includes('380v') || volt.includes('3 pha');
        return true;
      });
    }

    if (sortType === 'price-asc') {
      result.sort((a, b) => (a.price || 0) - (b.price || 0))
    } else if (sortType === 'price-desc') {
      result.sort((a, b) => (b.price || 0) - (a.price || 0))
    }

    return result
  }, [products, activeBrand, selectedCategory, searchTerm, sortType, filterGroups, filterPower, filterVoltage])

  const calcListPrice = (basePrice) => {
    if (!basePrice) return 0
    return Math.round(Number(basePrice) * 1.6)
  }

  const calcPromoPrice = (basePrice) => {
    if (!basePrice) return 0
    return Math.round(Number(basePrice) * 1.5)
  }

  const formatVND = (price) => {
    return Number(price).toLocaleString('vi-VN') + ' ₫'
  }

  const formatVoltage = (vol) => {
    if (!vol) return ''
    if (vol === '220V') return '1 Pha (220V)'
    if (vol === '380V') return '3 Pha (380V)'
    if (vol === '220V/380V') return '220V / 380V (Có cả 2)'
    return vol
  }

  const handleSelectNeed = (need) => {
    setSelectedNeed(need)
    setCurrentStep(2)
  }

  const handleSelectParam = async (param) => {
    setAiLoading(true)
    setCurrentStep(3)
    
    const needText = selectedNeed === 'day-cao' 
      ? `Bơm cấp nước đẩy cao cho nhà ${param === '1-2' ? '1-2 tầng' : param === '3-4' ? '3-4 tầng' : 'trên 5 tầng'}`
      : `Bơm chìm nước thải/tưới tiêu dùng nguồn điện ${param === '220v' ? '1 Pha (220V)' : '3 Pha (380V)'}`

    await askGeminiAI(needText)
  }

  const submitCustomNeed = async () => {
    if (!customNeedText.trim()) {
      alert('Vui lòng nhập nhu cầu sử dụng của bạn!')
      return
    }
    setAiLoading(true)
    setCurrentStep(3)
    await askGeminiAI(customNeedText)
  }

  const askGeminiAI = async (promptQuery) => {
    try {
      const dbProductsInfo = products.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.webBrand || 'UPTI PUMP',
        specs: p.webSpecs || {}
      }))

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${atob('QVEuQWI4Uk42SWVYb05mSjI0ZTh3RmVFR3JJXy1OS1JrWWZjSUprZS1NZENqTzRzUDN6RGc=')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Bạn là trợ lý tư vấn chọn máy bơm chuyên nghiệp của Công ty T&T. Dưới đây là danh mục máy bơm thực tế có trong kho của chúng tôi:\n${JSON.stringify(dbProductsInfo)}\n\nHãy tư vấn ngắn gọn trong 3-4 câu cho khách hàng dựa trên nhu cầu: "${promptQuery}". Gợi ý chính xác tên mã sản phẩm máy bơm của T&T ở trên phù hợp nhất với cột áp và lưu lượng yêu cầu.`
                  }
                ]
              }
            ]
          })
        }
      )
      const resData = await response.json()
      if (resData.error) {
        throw new Error(resData.error.message || 'API Error')
      }
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Rất tiếc, tôi chưa tìm thấy máy bơm phù hợp. Bạn hãy gửi liên hệ để kỹ thuật viên T&T gọi điện hỗ trợ trực tiếp!'
      setAiResponseText(text)

      const matches = products.filter(p => text.toLowerCase().includes(p.name.toLowerCase()))
      setAiSuggestions(matches.slice(0, 2))
    } catch (err) {
      console.warn("Lỗi AI (Chuyển sang bộ quy tắc chuyên gia cục bộ):", err)
      const fallback = localAIEngine(promptQuery, products)
      setAiResponseText(fallback.responseText)
      setAiSuggestions(fallback.suggestedProducts)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSendChatMessage = async (msgText) => {
    if (!msgText.trim()) return
    const userMsg = { sender: 'user', text: msgText }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    // Add temporary AI placeholder
    const aiPlaceholder = { sender: 'ai', text: '...', isLoading: true }
    setChatMessages(prev => [...prev, aiPlaceholder])

    try {
      const dbProductsInfo = products.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.webBrand || 'UPTI PUMP',
        specs: p.webSpecs || {}
      }))

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${atob('QVEuQWI4Uk42SWVYb05mSjI0ZTh3RmVFR3JJXy1OS1JrWWZjSUprZS1NZENqTzRzUDN6RGc=')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Bạn là trợ lý tư vấn chọn máy bơm chuyên nghiệp của Công ty T&T. Dưới đây là danh mục máy bơm thực tế có trong kho của chúng tôi:\n${JSON.stringify(dbProductsInfo)}\n\nHãy tư vấn cực kỳ ngắn gọn trong 2-3 câu cho khách hàng dựa trên nhu cầu: "${msgText}". Gợi ý chính xác tên mã sản phẩm máy bơm của T&T ở trên phù hợp nhất.`
                  }
                ]
              }
            ]
          })
        }
      )
      const resData = await response.json()
      if (resData.error) {
        throw new Error(resData.error.message || 'API Error')
      }
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Rất tiếc, tôi chưa tìm thấy máy bơm phù hợp. Bạn hãy gửi liên hệ để kỹ thuật viên T&T gọi điện hỗ trợ trực tiếp!'
      
      // Update message
      setChatMessages(prev => {
        const next = [...prev]
        if (next.length > 0) {
          next[next.length - 1] = { sender: 'ai', text: text }
        }
        return next
      })

      // Suggest products
      const matches = products.filter(p => text.toLowerCase().includes(p.name.toLowerCase()))
      if (matches.length > 0) {
        setChatSuggestions(matches.slice(0, 2))
      } else {
        setChatSuggestions([])
      }
    } catch (err) {
      console.warn("Lỗi AI Chat (Chuyển sang bộ quy tắc chuyên gia cục bộ):", err)
      const fallback = localAIEngine(msgText, products)
      setChatMessages(prev => {
        const next = [...prev]
        if (next.length > 0) {
          next[next.length - 1] = { sender: 'ai', text: fallback.responseText }
        }
        return next
      })
      
      if (fallback.suggestedProducts && fallback.suggestedProducts.length > 0) {
        setChatSuggestions(fallback.suggestedProducts)
      } else {
        setChatSuggestions([])
      }
    } finally {
      setChatLoading(false)
    }
  }

  const handleSendToZalo = () => {
    if (!custName.trim() || !custPhone.trim()) {
      alert('Vui lòng điền đủ Họ tên và SĐT để chúng tôi gọi điện tư vấn!')
      return
    }
    const reqText = customNeedText || (selectedNeed === 'day-cao' ? 'Bơm cấp nước đẩy cao' : 'Bơm chìm nước thải/sục khí')
    const message = `Khách hàng: ${custName}\nSĐT: ${custPhone}\nYêu cầu tư vấn: ${reqText}\nPhản hồi AI tư vấn: ${aiResponseText}`
    window.open(`https://zalo.me/0984273806?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleCallbackSubmit = async (e) => {
    e.preventDefault()
    if (!callbackName.trim() || !callbackPhone.trim()) {
      alert('Vui lòng điền đầy đủ Họ tên và Số điện thoại!')
      return
    }
    setIsSubmittingCallback(true)
    try {
      await createWebOrder({
        customerName: callbackName.trim(),
        customerPhone: callbackPhone.trim(),
        customerAddress: 'Yêu cầu gọi lại (Trang chủ)',
        orderNote: callbackNote.trim(),
        items: [],
        totalAmount: 0,
        orderType: 'callback',
        status: 'pending'
      })
      alert('Yêu cầu gọi lại đã được gửi thành công! Kỹ thuật viên của Máy Bơm T&T sẽ liên hệ lại ngay với bạn.')
      setCallbackName('')
      setCallbackPhone('')
      setCallbackNote('')
    } catch (err) {
      console.error('Lỗi gửi yêu cầu gọi lại:', err)
      alert('Gửi yêu cầu thất bại. Vui lòng liên hệ hotline để nhận tư vấn trực tiếp!')
    } finally {
      setIsSubmittingCallback(false)
    }
  }

  const handleAddToCart = (product, quantity = 1) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id)
      if (idx > -1) {
        const next = [...prev]
        next[idx].quantity += quantity
        return next
      } else {
        return [...prev, { product, quantity }]
      }
    })
    // Show cart drawer immediately so they see it
    setShowCartDrawer(true)
  }

  const handleUpdateCartQty = (productId, delta) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === productId)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx].quantity += delta
      if (next[idx].quantity <= 0) {
        next.splice(idx, 1)
      }
      return next
    })
  }

  const handleRemoveFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault()
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      alert('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ giao nhận hàng!')
      return
    }
    if (cart.length === 0) {
      alert('Giỏ hàng của bạn đang trống!')
      return
    }

    setIsSubmittingOrder(true)
    try {
      const totalAmount = cart.reduce((sum, item) => sum + (calcPromoPrice(item.product.price) * item.quantity), 0)
      const orderItems = cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        brand: item.product.webBrand || 'UPTI PUMP',
        price: calcPromoPrice(item.product.price),
        quantity: item.quantity
      }))

      await createWebOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        orderNote: orderNote.trim(),
        items: orderItems,
        totalAmount,
        status: 'pending'
      })

      // Clear states
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setOrderNote('')
      setShowCartDrawer(false)
      setShowOrderSuccess(true)
    } catch (err) {
      console.error('Lỗi đặt hàng:', err)
      alert('Đặt hàng thất bại. Vui lòng liên hệ hotline để đặt trực tiếp!')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const navigateToProduct = (id) => {
    window.location.hash = `#web/product/${id}`
  }

  const goBackToCatalog = () => {
    window.location.hash = '#web'
  }

  const handleNavHome = () => {
    window.location.hash = '#web'
    setSelectedCategory('TẤT CẢ')
    setActiveBrand('ALL')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavProducts = () => {
    window.location.hash = '#web/catalog'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavApplications = () => {
    window.location.hash = '#web/applications'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavBrands = () => {
    window.location.hash = '#web/brands'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavIntro = () => {
    window.location.hash = '#web/intro'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavContact = () => {
    window.location.hash = '#web/contact'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavPolicy = () => {
    window.location.hash = '#web/policy'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getCategoryBannerImage = (catName) => {
    const name = (catName || '').toLowerCase();
    if (name.includes('chìm') || name.includes('thải') || name.includes('hố ga') || name.includes('bơm bùn')) {
      return './pump_submersible.jpg';
    }
    if (name.includes('trục đứng') || name.includes('ly tâm') || name.includes('nhiều tầng') || name.includes('trục ngang')) {
      return './pump_vertical.jpg';
    }
    return './pump_showroom.jpg';
  }

  const formatPower = (power) => {
    if (!power) return '';
    const pLower = power.toLowerCase();
    if (pLower.includes('kw') || pLower.includes('hp')) return power;
    return `${power} kW`;
  }

  return (
    <div id="home" style={{ background: '#F5F7FA', color: '#101828', minHeight: '100vh', fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        * {
          font-family: 'Inter', 'Be Vietnam Pro', sans-serif !important;
          box-sizing: border-box;
        }

        body {
          background-color: #F5F7FA;
          color: #101828;
          margin: 0;
          padding: 0;
        }

        /* Category and product card modern transitions */
        .premium-card {
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-shadow: 0 1px 3px rgba(7, 26, 47, 0.02) !important;
          border: 1px solid #EEF1F4 !important;
          border-radius: 6px !important;
          background: #FFFFFF !important;
        }
        .premium-card:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 24px rgba(7, 26, 47, 0.06) !important;
          border-color: #0878D9 !important;
        }
        .premium-card:hover img {
          transform: scale(1.02) !important;
        }
        .card-img-container img {
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        /* Scroll slider container for responsive horizontal categories */
        .scroll-slider-container {
          display: flex !important;
          gap: 16px !important;
          overflow-x: auto !important;
          scroll-behavior: smooth !important;
          scroll-snap-type: x mandatory !important;
          padding: 8px 4px 16px 4px !important;
          -webkit-overflow-scrolling: touch !important;
        }
        .scroll-slider-container::-webkit-scrollbar {
          height: 5px !important;
        }
        .scroll-slider-container::-webkit-scrollbar-track {
          background: #F1F5F9 !important;
          border-radius: 10px !important;
        }
        .scroll-slider-container::-webkit-scrollbar-thumb {
          background: #0878D9 !important;
          border-radius: 10px !important;
        }
        .scroll-slider-item {
          scroll-snap-align: start !important;
        }

        .cat-section {
          margin-bottom: 48px !important;
        }

        /* Category slider hero banners */
        .cat-hero-banner {
          border-radius: 10px !important;
          overflow: hidden !important;
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 16px 24px !important;
          margin-bottom: 16px !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          box-shadow: 0 4px 12px rgba(15,23,42,0.01) !important;
          border-left: 4px solid #0878D9 !important;
        }
        .cat-hero-content {
          display: flex !important;
          align-items: center !important;
          gap: 16px !important;
          flex: 1 !important;
          min-width: 0 !important;
        }
        .cat-hero-img-wrap {
          flex-shrink: 0 !important;
          width: 72px !important;
          height: 52px !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          border: 1px solid #E2E8F0 !important;
          background: #F8FAFC !important;
        }
        .cat-hero-img-wrap img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        .cat-hero-actions {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex-shrink: 0 !important;
        }

        .cat-section-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 24px !important;
          border-left: 3px solid #0878D9 !important;
          padding-left: 12px !important;
        }
        .cat-section-title {
          font-size: 18px !important;
          font-weight: 800 !important;
          color: #082B4C !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          margin: 0 !important;
        }
        .cat-nav-group {
          display: flex !important;
          gap: 8px !important;
        }
        .cat-nav-btn {
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          border: 1px solid #E2E8F0 !important;
          background: #FFFFFF !important;
          color: #64748B !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }
        .cat-nav-btn:hover {
          border-color: #0878D9 !important;
          color: #0878D9 !important;
          background: #EAF3FF !important;
        }

        /* Reusable Premium Product Card */
        .cat-product-card {
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-shadow: 0 2px 8px rgba(15,23,42,0.015) !important;
          cursor: pointer !important;
          position: relative !important;
        }
        .cat-product-card:hover {
          box-shadow: 0 10px 24px rgba(22, 119, 255, 0.08) !important;
          border-color: #0878D9 !important;
          transform: translateY(-3px) !important;
        }
        .cat-product-card:hover .quick-view-overlay {
          opacity: 1 !important;
        }
        .cat-card-img {
          width: 100% !important;
          height: 200px !important;
          background: #FFFFFF !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 12px !important;
          position: relative !important;
          border-bottom: 1px solid #E2E8F0 !important;
          overflow: hidden !important;
        }
        .cat-card-img img {
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain !important;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .cat-product-card:hover .cat-card-img img {
          transform: scale(1.05) !important;
        }
        .cat-card-body {
          padding: 16px !important;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          gap: 8px !important;
        }
        .cat-card-title {
          font-size: 13.5px !important;
          font-weight: 700 !important;
          color: #102A43 !important;
          line-height: 1.4 !important;
          cursor: pointer !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
          min-height: 38px !important;
        }
        .cat-card-title:hover {
          color: #0878D9 !important;
        }
        .cat-card-specs {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 6px !important;
        }
        .cat-spec-badge {
          display: flex !important;
          flex-direction: column !important;
          gap: 2px !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #102A43 !important;
          background: #F6F8FB !important;
          padding: 6px 8px !important;
          border-radius: 6px !important;
        }
        .cat-spec-label {
          font-size: 9px !important;
          font-weight: 700 !important;
          color: #64748B !important;
          text-transform: uppercase !important;
        }
        .cat-card-price {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #64748B !important;
          margin-top: auto !important;
          padding-top: 8px !important;
        }
        .cat-card-price span {
          color: #0878D9 !important;
          font-weight: 800 !important;
        }
        
        .cat-btn-outline {
          width: 100% !important;
          padding: 10px 0 !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          border: 1px solid #0878D9 !important;
          background: #FFFFFF !important;
          color: #0878D9 !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s !important;
        }
        .cat-btn-outline:hover {
          background: #EAF3FF !important;
        }
        .cat-btn-primary {
          width: 100% !important;
          padding: 10px 0 !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          border: none !important;
          background: #0878D9 !important;
          color: #FFFFFF !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 4px 12px rgba(22,119,255,0.18) !important;
          transition: all 0.2s !important;
        }
        .cat-btn-primary:hover {
          background: #0050b3 !important;
        }
        .cat-brand-tag {
          position: absolute !important;
          top: 12px !important;
          left: 12px !important;
          padding: 3px 8px !important;
          font-size: 9.5px !important;
          font-weight: 800 !important;
          border-radius: 4px !important;
          z-index: 2 !important;
          letter-spacing: 0.5px !important;
        }

        .category-cover-card {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          border-radius: 8px !important;
        }
        .category-cover-card:hover {
          transform: translateY(-6px) !important;
          box-shadow: 0 16px 36px rgba(22, 119, 255, 0.12) !important;
          border-color: #0878D9 !important;
        }
        
        .brand-btn {
          transition: all 0.2s ease !important;
        }
        .brand-btn:hover {
          transform: translateY(-1px) !important;
        }
        
        .cta-btn {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .cta-btn:hover {
          transform: translateY(-2px) !important;
          filter: brightness(1.05) !important;
        }

        /* Collapsible filter block styles */
        .filter-group-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          cursor: pointer !important;
          user-select: none !important;
          padding: 8px 0 !important;
        }
        
        /* Interactive ranges and custom checkboxes */
        .custom-checkbox {
          accent-color: #0878D9 !important;
          cursor: pointer !important;
        }

        /* ── RESPONSIVE PRODUCT DETAIL ────────────────────────────────────── */
        .product-detail-grid {
          display: grid !important;
          grid-template-columns: 280px 1fr !important;
          gap: 32px !important;
        }
        .product-detail-main-row {
          display: flex !important;
          flex-direction: row !important;
          gap: 36px !important;
          margin-bottom: 36px !important;
        }
        .product-image-container {
          flex: 0 0 42% !important;
        }

        .ai-chat-widget {
          position: fixed !important;
          bottom: 24px !important;
          right: 76px !important;
          width: 380px !important;
          height: 560px !important;
          max-height: calc(100vh - 48px) !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 16px !important;
          box-shadow: 0 12px 40px rgba(7, 26, 47, 0.22) !important;
          z-index: 9999 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        @media (max-width: 900px) {
          .ai-chat-widget {
            right: 12px !important;
            left: 12px !important;
            bottom: 12px !important;
            width: calc(100vw - 24px) !important;
            height: calc(100vh - 90px) !important;
            max-height: 560px !important;
            border-radius: 16px !important;
            border: 1px solid #E2E8F0 !important;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2) !important;
          .homepage-hero-section {
            padding: 16px 12px 24px !important;
          }
          .hero-tabs-strip {
            display: flex !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            padding-bottom: 6px !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .hero-tabs-strip button {
            min-width: 140px !important;
            flex-shrink: 0 !important;
          }
          .hero-trust-strip {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
            padding: 12px !important;
          }
        }
        @keyframes beaconRipple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        .hotspot-beacon {
          position: relative;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #38BDF8;
          box-shadow: 0 0 12px #38BDF8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .hotspot-beacon::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid #38BDF8;
          animation: beaconRipple 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .hotspot-card {
          background: rgba(7, 26, 47, 0.92);
          border: 1px solid rgba(56, 189, 248, 0.4);
          border-radius: 6px;
          padding: 5px 10px;
          color: #FFFFFF;
          backdrop-filter: blur(8px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.45);
          white-space: nowrap;
          pointer-events: auto;
          transition: all 0.2s ease;
        }
        .hotspot-card:hover {
          background: rgba(14, 165, 233, 0.95);
          border-color: #FFFFFF;
          transform: scale(1.04);
        }
        @keyframes levitate {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .levitate-pump {
          animation: levitate 4.5s ease-in-out infinite;
        }
      `}} />
      
      {/* Top Utility Bar */}
      <div style={{
        background: '#071A2F',
        color: '#94A3B8',
        fontSize: '11px',
        padding: '8px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        boxSizing: 'border-box'
      }} className="desktop-only">
        <div style={{ display: 'flex', gap: 20 }}>
          <span>🚚 Giao hàng toàn quốc</span>
          <span>🔧 Tư vấn kỹ thuật chuyên sâu</span>
          <span>🏢 Kênh B2B / Dự án / Nhà thầu</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>Hotline hỗ trợ: <strong style={{ color: '#FFFFFF' }}>0984.273.806</strong></span>
        </div>
      </div>

      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        height: 72,
        boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: 1440,
          height: '100%',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          gap: 16
        }}>
          {/* Logo & Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleNavHome}>
              <img src="./logo_tt.png" alt="T&T Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
            </div>
            
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} className="desktop-only">
              <span style={{ position: 'absolute', left: 12, color: '#667085', fontSize: 14 }}>🔍</span>
              <input
                type="text"
                placeholder="Tìm kiếm máy bơm theo tên hoặc mã..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (viewMode !== 'catalog') {
                    setViewMode('catalog');
                    setActiveTab('products');
                  }
                }}
                style={{
                  width: 250,
                  height: 38,
                  padding: '0 12px 0 34px',
                  background: '#F5F7FA',
                  border: '1px solid #EEF1F4',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#101828',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#0878D9'}
                onBlur={e => e.currentTarget.style.borderColor = '#EEF1F4'}
              />
            </div>
          </div>

          {/* Navigation Links */}
          <div className="header-nav" style={{ display: 'flex', gap: 14, fontSize: 13, fontWeight: 700, alignItems: 'center' }}>
            {[
              { label: 'TRANG CHỦ', handler: handleNavHome, active: viewMode === 'home' },
              { label: 'SẢN PHẨM', handler: handleNavProducts, active: viewMode === 'catalog' },
              { label: 'ỨNG DỤNG', handler: handleNavApplications, active: viewMode === 'applications' },
              { label: 'THƯƠNG HIỆU', handler: handleNavBrands, active: viewMode === 'brands' },
              { label: 'VỀ T&T', handler: handleNavIntro, active: viewMode === 'intro' },
              { label: 'LIÊN HỆ', handler: handleNavContact, active: viewMode === 'contact' }
            ].map((item, idx) => (
              <span
                key={idx}
                onClick={item.handler}
                className="brand-btn"
                style={{
                  color: item.active ? '#0878D9' : '#071A2F',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: item.active ? '#EFF6FF' : 'transparent',
                  transition: 'all 0.25s',
                  fontSize: 12.5,
                  fontWeight: 800,
                  userSelect: 'none'
                }}
              >
                {item.label}
              </span>
            ))}
          </div>

          {/* Hotline & Action */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="tel:0984273806" style={{ textDecoration: 'none', color: '#071A2F', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }} className="brand-btn">
              <span style={{ color: '#0878D9' }}>📞</span> 0984 273 806
            </a>
            <button 
              onClick={() => setShowCartDrawer(true)}
              style={{
                background: '#0878D9', color: '#fff', border: 'none', padding: '0 18px',
                height: 40, fontSize: 12, fontWeight: 800, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: 'none', transition: 'all 0.2s', boxSizing: 'border-box'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#065da9'}
              onMouseOut={e => e.currentTarget.style.background = '#0878D9'}
              className="cta-btn"
            >
              NHẬN BÁO GIÁ
            </button>
          </div>

          {/* Hamburger Menu Button for Mobile */}
          <button
            className="header-menu-btn"
            onClick={() => setShowMobileMenu(true)}
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              fontSize: 24,
              color: '#102A43',
              justifyContent: 'center',
              alignItems: 'center',
              justifySelf: 'end'
            }}
            aria-label="Mở menu điều hướng"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer (Rendered outside header at root level with highest z-index) */}
      <div 
        onClick={() => setShowMobileMenu(false)}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(7, 26, 47, 0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 99999999,
          display: 'flex',
          justifyContent: 'flex-end',
          opacity: showMobileMenu ? 1 : 0,
          visibility: showMobileMenu ? 'visible' : 'hidden',
          transition: 'opacity 0.28s ease, visibility 0.28s ease',
          pointerEvents: showMobileMenu ? 'auto' : 'none'
        }}
      >
        <div 
          onClick={e => e.stopPropagation()}
          style={{
            width: '82vw',
            maxWidth: 310,
            height: '100%',
            background: '#FFFFFF',
            boxShadow: '-6px 0 30px rgba(7, 26, 47, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            transform: showMobileMenu ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            overflowY: 'auto'
          }}
        >
          {/* Drawer Top Header (Clean Minimal Header) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 20px',
            borderBottom: '1px solid #EEF1F4',
            background: '#FFFFFF'
          }}>
            <span style={{ fontSize: 13.5, fontWeight: 900, color: '#071A2F', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              MENU ĐIỀU HƯỚNG
            </span>
            <button 
              onClick={() => setShowMobileMenu(false)}
              style={{
                border: 'none',
                background: '#F1F5F9',
                borderRadius: '50%',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 800,
                color: '#475569',
                cursor: 'pointer'
              }}
              aria-label="Đóng menu"
            >
              ✕
            </button>
          </div>

          {/* Menu Links */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 12px', gap: 4, flexGrow: 1 }}>
            {[
              { key: 'home', label: 'TRANG CHỦ', handler: handleNavHome, active: viewMode === 'home' },
              { key: 'products', label: 'SẢN PHẨM & BÁO GIÁ', handler: handleNavProducts, active: viewMode === 'catalog' },
              { key: 'applications', label: 'ỨNG DỤNG CÔNG TRÌNH', handler: handleNavApplications, active: viewMode === 'applications' },
              { key: 'brands', label: 'THƯƠNG HIỆU PHÂN PHỐI', handler: handleNavBrands, active: viewMode === 'brands' },
              { key: 'intro', label: 'VỀ MÁY BƠM T&T', handler: handleNavIntro, active: viewMode === 'intro' },
              { key: 'contact', label: 'LIÊN HỆ TRỰC TIẾP', handler: handleNavContact, active: viewMode === 'contact' },
            ].map(item => (
              <div
                key={item.key}
                onClick={() => {
                  item.handler();
                  setShowMobileMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '13px 14px',
                  fontSize: 13.5,
                  fontWeight: item.active ? 850 : 700,
                  color: item.active ? '#0878D9' : '#1E293B',
                  borderRadius: 8,
                  background: item.active ? '#EFF6FF' : 'transparent',
                  borderLeft: item.active ? '3px solid #0878D9' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: 14, color: item.active ? '#0878D9' : '#94A3B8' }}>›</span>
              </div>
            ))}
          </div>

          {/* Bottom Quick Contact Box */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderTop: '1px solid #EEF1F4',
            padding: '16px 16px 24px',
            background: '#F8FAFC'
          }}>
            <a
              href="tel:0984273806"
              style={{
                textDecoration: 'none',
                background: '#0878D9',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 14px',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(8, 120, 217, 0.25)'
              }}
            >
              <span>📞</span> HOTLINE: 0984.273.806
            </a>
            <a
              href="https://zalo.me/0984273806"
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: 'none',
                background: '#FFFFFF',
                color: '#071A2F',
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 750,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8
              }}
            >
              <span>💬</span> Chat Zalo Tư Vấn
            </a>
            <div style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 2, lineHeight: 1.4 }}>
              Kho LK180, Dương Nội, Hà Đông, Hà Nội
            </div>
          </div>
        </div>
      </div>

      {/* NỘI DUNG CHÍNH (Sẽ render tùy theo viewMode) */}
      {viewMode === 'home' && (
        <div style={{ background: '#F5F7FA', color: '#101828', minHeight: '100vh' }}>

          {/* 1. HERO BANNER — DEDICATED DESKTOP (SPLIT CINEMA) & DEDICATED MOBILE-FIRST COMPOSITION */}
          {(() => {
            const currentSlideItem = homepageSlides[currentSlide] || homepageSlides[0];
            const nextSlideIdx = (currentSlide + 1) % homepageSlides.length;
            const nextSlideItem = homepageSlides[nextSlideIdx];

            return (
              <>
                {/* ── DESKTOP HERO (Screens > 768px) ── */}
                <section
                  className="homepage-hero-cinema desktop-only"
                  style={{
                    background: 'linear-gradient(180deg, #051323 0%, #0A223B 50%, #071A2F 100%)',
                    padding: '36px 0 44px',
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: '1px solid rgba(8, 120, 217, 0.25)',
                  }}
                  onMouseEnter={() => setSliderPaused(true)}
                  onMouseLeave={() => setSliderPaused(false)}
                >
                  {/* Dynamic Ambient Glow Backlight */}
                  {currentSlideItem?.img && (
                    <div
                      key={`ambient-desk-${currentSlide}`}
                      style={{
                        position: 'absolute',
                        right: '5%',
                        top: '10%',
                        width: '50vw',
                        height: '50vw',
                        backgroundImage: `url(${currentSlideItem.img})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(90px) saturate(2)',
                        opacity: 0.22,
                        pointerEvents: 'none',
                        zIndex: 1,
                        transition: 'opacity 0.6s ease',
                      }}
                    />
                  )}

                  {/* Blueprint Grid Pattern */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.12) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                    opacity: 0.8,
                    zIndex: 2,
                    pointerEvents: 'none',
                  }} />

                  <div style={{
                    maxWidth: 1360,
                    margin: '0 auto',
                    padding: '0 24px',
                    position: 'relative',
                    zIndex: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 28,
                    boxSizing: 'border-box',
                  }}>
                    {/* Split Cinema 2-Column Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.15fr)',
                      alignItems: 'center',
                      gap: 40,
                      width: '100%',
                    }}>
                      {/* Left Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: 20,
                          padding: '6px 14px',
                          backdropFilter: 'blur(8px)',
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 10px #38BDF8', display: 'inline-block' }} />
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', letterSpacing: '1px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                            {currentSlideItem?.badge || currentSlideItem?.title || 'MÁY BƠM NƯỚC T&T'}
                          </span>
                        </div>

                        <h1 style={{
                          fontSize: 'clamp(26px, 3.2vw, 42px)',
                          fontWeight: 900,
                          color: '#FFFFFF',
                          margin: 0,
                          lineHeight: 1.18,
                          letterSpacing: '-0.5px',
                          textTransform: 'uppercase',
                          background: 'linear-gradient(135deg, #FFFFFF 40%, #BAE6FD 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}>
                          {currentSlideItem?.headline || currentSlideItem?.title}
                        </h1>

                        <p style={{ fontSize: 'clamp(13.5px, 1.1vw, 15px)', color: '#94A3B8', margin: 0, lineHeight: 1.6, maxWidth: 540 }}>
                          {currentSlideItem?.desc || 'Dòng máy bơm nước công nghiệp & dân dụng tiêu chuẩn Châu Âu, vận hành bền bỉ 24/7 và tối ưu điện năng vượt trội.'}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(7, 26, 47, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>
                            ⚡ TIẾT KIỆM 60% ĐIỆN
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(7, 26, 47, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>
                            ◉ VẬN HÀNH SIÊU ÊM
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(7, 26, 47, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>
                            ✓ BẢO HÀNH 12 THÁNG
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                          <button
                            onClick={() => {
                              const catName = currentSlideItem?.category || '';
                              setSelectedCategory(catName || 'TẤT CẢ');
                              setViewMode('catalog'); setActiveTab('products');
                              window.location.hash = '#web/catalog';
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #0878D9 0%, #0284C7 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 10,
                              padding: '13px 26px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              boxShadow: '0 8px 24px rgba(8, 120, 217, 0.45)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              transition: 'all 0.2s ease',
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                          >
                            🛒 XEM SẢN PHẨM &amp; BÁO GIÁ →
                          </button>

                          <a
                            href="tel:0984273806"
                            style={{
                              background: 'rgba(7, 26, 47, 0.6)',
                              color: '#38BDF8',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              borderRadius: 10,
                              padding: '12px 20px',
                              fontSize: 13.5,
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              backdropFilter: 'blur(6px)',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(7, 26, 47, 0.6)'; }}
                          >
                            📞 LIÊN HỆ: 0984.273.806
                          </a>
                        </div>

                        {/* Minimalist Story Progress Bars */}
                        <div style={{ display: 'flex', gap: 6, width: '100%', maxWidth: 540, marginTop: 14 }}>
                          {homepageSlides.map((_, idx) => (
                            <div
                              key={idx}
                              onClick={() => { setSliderInteracted(true); setCurrentSlide(idx); }}
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                background: 'rgba(255, 255, 255, 0.15)',
                                cursor: 'pointer',
                                overflow: 'hidden',
                              }}
                              title={`Chuyển sang Banner ${idx + 1}`}
                            >
                              <div style={{
                                height: '100%',
                                background: idx === currentSlide ? '#38BDF8' : (idx < currentSlide ? '#0878D9' : 'transparent'),
                                width: idx === currentSlide ? '100%' : (idx < currentSlide ? '100%' : '0%'),
                                transition: idx === currentSlide ? 'width 4.5s linear' : 'none',
                              }} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Column: Floating Banner */}
                      <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: 'clamp(360px, 42vw, 520px)',
                      }}>
                        <div style={{
                          position: 'absolute',
                          width: '90%',
                          height: '90%',
                          background: 'radial-gradient(ellipse at center, rgba(14,165,233,0.25) 0%, rgba(7,26,47,0) 70%)',
                          borderRadius: '50%',
                          pointerEvents: 'none',
                        }} />

                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                            maskComposite: 'intersect',
                            WebkitMaskComposite: 'destination-in',
                          }}
                          onClick={() => {
                            const catName = currentSlideItem?.category || '';
                            setSelectedCategory(catName || 'TẤT CẢ');
                            setViewMode('catalog'); setActiveTab('products');
                            window.location.hash = '#web/catalog';
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          {currentSlideItem?.img && (
                            <img
                              key={`desk-img-${currentSlide}`}
                              src={currentSlideItem.img}
                              alt={currentSlideItem?.title || 'Máy bơm T&T'}
                              loading="eager"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                objectPosition: 'center',
                                position: 'relative',
                                zIndex: 2,
                                transition: 'opacity 0.35s ease',
                                filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))',
                              }}
                            />
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSliderInteracted(true);
                            setCurrentSlide(prev => (prev - 1 + homepageSlides.length) % homepageSlides.length);
                          }}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'rgba(7, 26, 47, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#FFFFFF',
                            fontSize: 22,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#0878D9'; e.currentTarget.style.borderColor = '#38BDF8'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'rgba(7, 26, 47, 0.75)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
                          aria-label="Slide trước"
                        >
                          ‹
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSliderInteracted(true);
                            setCurrentSlide(prev => (prev + 1) % homepageSlides.length);
                          }}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'rgba(7, 26, 47, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#FFFFFF',
                            fontSize: 22,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#0878D9'; e.currentTarget.style.borderColor = '#38BDF8'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'rgba(7, 26, 47, 0.75)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
                          aria-label="Slide tiếp theo"
                        >
                          ›
                        </button>

                        {nextSlideItem && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSliderInteracted(true);
                              setCurrentSlide(nextSlideIdx);
                            }}
                            style={{
                              position: 'absolute',
                              bottom: 10,
                              right: 10,
                              zIndex: 10,
                              background: 'rgba(7, 26, 47, 0.88)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              borderRadius: 10,
                              padding: '6px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              backdropFilter: 'blur(8px)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseOver={e => e.currentTarget.style.borderColor = '#38BDF8'}
                            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)'}
                            title="Bấm để xem banner kế tiếp"
                          >
                            <img
                              src={nextSlideItem.img || nextSlideItem.defaultImg}
                              alt={nextSlideItem.title}
                              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: '#030B14' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 9, color: '#38BDF8', fontWeight: 800, letterSpacing: '0.8px' }}>KẾ TIẾP ▶</span>
                              <span style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 700, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {nextSlideItem.title}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trust Strip */}
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: 12,
                      padding: '14px 20px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 16,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                      border: '1px solid #EEF1F4',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>🛡️</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F' }}>100% Chính Hãng</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>Đầy đủ chứng từ CO/CQ</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>🚚</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F' }}>Giao Hàng Toàn Quốc</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>Hỏa tốc trong 24 - 48h</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>🔧</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F' }}>Tư Vấn Kỹ Thuật</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>Tính chọn lưu lượng &amp; cột áp</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>📞</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#0878D9' }}>Hotline Liên Hệ 24/7</div>
                          <a href="tel:0984273806" style={{ fontSize: 12.5, fontWeight: 800, color: '#071A2F', textDecoration: 'none' }}>0984.273.806</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── TRUE MOBILE-FIRST HERO (Screens <= 768px) ── */}
                <section
                  className="mobile-only-flex"
                  style={{
                    display: 'none',
                    background: 'linear-gradient(180deg, #071A2F 0%, #081E34 60%, #071A2F 100%)',
                    padding: '24px 16px 20px',
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: '1px solid rgba(8, 120, 217, 0.2)',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    gap: 10,
                  }}
                  onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (!touchStartXRef.current) return;
                    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
                    if (diff > 40) {
                      setSliderInteracted(true);
                      setCurrentSlide(prev => (prev + 1) % homepageSlides.length);
                    } else if (diff < -40) {
                      setSliderInteracted(true);
                      setCurrentSlide(prev => (prev - 1 + homepageSlides.length) % homepageSlides.length);
                    }
                    touchStartXRef.current = null;
                  }}
                >
                  {/* Subtle Technical Grid Overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    opacity: 0.7,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }} />

                  {/* 1. Small Category Label */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.28)',
                    borderRadius: 20,
                    padding: '4px 12px',
                    zIndex: 2,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 6px #38BDF8' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                      {currentSlideItem?.badge || currentSlideItem?.title || 'MÁY BƠM NƯỚC T&T'}
                    </span>
                  </div>

                  {/* 2. Mobile Headline (Max 2 lines, heavy bold, 24-28px) */}
                  <h1 style={{
                    fontSize: 'clamp(22px, 6.8vw, 28px)',
                    fontWeight: 900,
                    color: '#FFFFFF',
                    margin: '2px 0 0',
                    lineHeight: 1.12,
                    letterSpacing: '-0.4px',
                    textTransform: 'uppercase',
                    zIndex: 2,
                    maxWidth: 340,
                  }}>
                    {currentSlideItem?.headline || currentSlideItem?.title}
                  </h1>

                  {/* 3. Short Description (Max 2 lines) */}
                  <p style={{
                    fontSize: 13.5,
                    color: '#94A3B8',
                    margin: '0',
                    lineHeight: 1.45,
                    maxWidth: 320,
                    zIndex: 2,
                    fontWeight: 500,
                  }}>
                    {currentSlideItem?.desc || 'Giải pháp bơm nước hiệu suất cao cho công trình và dân dụng.'}
                  </p>

                  {/* 4. Single Compact Trust Line */}
                  <div style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#38BDF8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    zIndex: 2,
                    letterSpacing: '0.2px',
                  }}>
                    <span>✓</span> Chính hãng • CO/CQ • Tư vấn kỹ thuật
                  </div>

                  {/* 5. Product Visual (Dominant 55-65% width, max-height 210px, soft blue radial glow behind it) */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 320,
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '4px 0 2px',
                    zIndex: 2,
                  }}>
                    {/* Soft radial blue lighting behind product */}
                    <div style={{
                      position: 'absolute',
                      width: '80%',
                      height: '80%',
                      background: 'radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(7, 26, 47, 0) 70%)',
                      borderRadius: '50%',
                      pointerEvents: 'none',
                    }} />

                    {/* Product Image */}
                    {currentSlideItem?.img && (
                      <img
                        key={`mob-hero-img-${currentSlide}`}
                        src={currentSlideItem.img}
                        alt={currentSlideItem?.title || 'Máy bơm T&T'}
                        fetchpriority="high"
                        loading="eager"
                        style={{
                          width: '100%',
                          height: '100%',
                          maxHeight: 190,
                          objectFit: 'contain',
                          position: 'relative',
                          zIndex: 3,
                          filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.55))',
                        }}
                        onClick={() => {
                          const catName = currentSlideItem?.category || '';
                          setSelectedCategory(catName || 'TẤT CẢ');
                          setViewMode('catalog'); setActiveTab('products');
                          window.location.hash = '#web/catalog';
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    )}

                    {/* Small 32px circular arrows */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSliderInteracted(true);
                        setCurrentSlide(prev => (prev - 1 + homepageSlides.length) % homepageSlides.length);
                      }}
                      style={{
                        position: 'absolute',
                        left: -4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(7, 26, 47, 0.85)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#FFFFFF',
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 4,
                      }}
                      aria-label="Slide trước"
                    >
                      ‹
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSliderInteracted(true);
                        setCurrentSlide(prev => (prev + 1) % homepageSlides.length);
                      }}
                      style={{
                        position: 'absolute',
                        right: -4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(7, 26, 47, 0.85)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#FFFFFF',
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 4,
                      }}
                      aria-label="Slide tiếp theo"
                    >
                      ›
                    </button>
                  </div>

                  {/* 6. Primary CTA [ XEM DÒNG BƠM → ] */}
                  <button
                    onClick={() => {
                      const catName = currentSlideItem?.category || '';
                      setSelectedCategory(catName || 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products');
                      window.location.hash = '#web/catalog';
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #0878D9 0%, #0284C7 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      height: 46,
                      padding: '0 24px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 6px 18px rgba(8, 120, 217, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      zIndex: 2,
                      marginTop: 2,
                    }}
                  >
                    XEM DÒNG BƠM →
                  </button>

                  {/* 7. Compact Slider Dots Control + Counter */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 8,
                    zIndex: 2,
                  }}>
                    {homepageSlides.map((_, idx) => (
                      <div
                        key={idx}
                        onClick={() => { setSliderInteracted(true); setCurrentSlide(idx); }}
                        style={{
                          width: idx === currentSlide ? 18 : 6,
                          height: 6,
                          borderRadius: 3,
                          background: idx === currentSlide ? '#38BDF8' : 'rgba(255, 255, 255, 0.25)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                    <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', fontWeight: 700, marginLeft: 6 }}>
                      {String(currentSlide + 1).padStart(2, '0')} / {String(homepageSlides.length).padStart(2, '0')}
                    </span>
                  </div>
                </section>
              </>
            );
          })()}
          {/* 2. PRODUCT CATEGORY NAVIGATION */}
          <section style={{ maxWidth: 1240, margin: '48px auto 32px', padding: '0 20px', boxSizing: 'border-box' }} id="categories-section">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', letterSpacing: '1.2px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                DANH MỤC SẢN PHẨM
              </span>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#071A2F', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                DÒNG MÁY BƠM
              </h2>
              <p style={{ fontSize: 13.5, color: '#64748B', margin: '6px 0 0', fontWeight: 500 }}>
                Khám phá các giải pháp bơm phù hợp cho từng nhu cầu
              </p>
            </div>

            {/* Desktop View: Full Responsive Category Grid (Displays ALL categories cleanly) */}
            <div 
              className="desktop-only"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
                gap: '24px 12px',
                justifyContent: 'center',
                padding: '8px 0 16px',
                boxSizing: 'border-box',
              }}
            >
              {dynamicCategories.map((item, idx) => {
                const name = item.name || '';
                const img = getCategoryGraphic(item);
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedCategory(name);
                      setViewMode('catalog');
                      setActiveTab('products');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      borderRadius: 12,
                    }}
                    onMouseOver={e => {
                      const titleEl = e.currentTarget.querySelector('.cat-title');
                      const linkEl = e.currentTarget.querySelector('.cat-link');
                      const imgEl = e.currentTarget.querySelector('.cat-img-box');
                      if (titleEl) titleEl.style.color = '#0878D9';
                      if (linkEl) linkEl.style.color = '#071A2F';
                      if (imgEl) {
                        imgEl.style.borderColor = '#0878D9';
                        imgEl.style.boxShadow = '0 6px 18px rgba(8, 120, 217, 0.15)';
                      }
                      e.currentTarget.style.transform = 'translateY(-3px)';
                    }}
                    onMouseOut={e => {
                      const titleEl = e.currentTarget.querySelector('.cat-title');
                      const linkEl = e.currentTarget.querySelector('.cat-link');
                      const imgEl = e.currentTarget.querySelector('.cat-img-box');
                      if (titleEl) titleEl.style.color = '#071A2F';
                      if (linkEl) linkEl.style.color = '#0878D9';
                      if (imgEl) {
                        imgEl.style.borderColor = '#E2E8F0';
                        imgEl.style.boxShadow = 'none';
                      }
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div 
                      className="cat-img-box"
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: '50%',
                        background: '#EEF1F4',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                        boxSizing: 'border-box',
                        marginBottom: 10,
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <img 
                        src={img} 
                        alt={name} 
                        loading="lazy"
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'contain',
                          mixBlendMode: 'multiply',
                          filter: 'brightness(1.05)',
                          transition: 'all 0.2s'
                        }} 
                      />
                    </div>
                    <h3 
                      className="cat-title"
                      style={{ 
                        fontSize: 12, 
                        fontWeight: 800, 
                        color: '#071A2F', 
                        margin: '0 0 4px 0', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.1px', 
                        lineHeight: 1.35,
                        minHeight: 46,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        transition: 'color 0.2s'
                      }}
                    >
                      {name}
                    </h3>
                    <span
                      className="cat-link"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#0878D9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'color 0.2s'
                      }}
                    >
                      Xem dòng →
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile View: Circular Avatar Carousel with Image inside Circle and Name underneath */}
            <div
              className="mobile-only-flex"
              style={{
                display: 'none',
                overflowX: 'auto',
                gap: 12,
                padding: '6px 4px 14px',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}
            >
              {dynamicCategories.map((item, idx) => {
                const name = item.name || '';
                const img = getCategoryGraphic(item);
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedCategory(name);
                      setViewMode('catalog');
                      setActiveTab('products');
                      window.location.hash = '#web/catalog';
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      flex: '0 0 88px',
                      width: 88,
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: '#F1F5F9',
                      border: '1.5px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 7,
                      boxSizing: 'border-box',
                      marginBottom: 6,
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(15,23,42,0.04)'
                    }}>
                      <img 
                        src={img} 
                        alt={name} 
                        loading="lazy"
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'contain',
                          mixBlendMode: 'multiply',
                          filter: 'brightness(1.05)',
                        }} 
                      />
                    </div>
                    <span style={{ 
                      fontSize: 10.5, 
                      fontWeight: 800, 
                      color: '#071A2F', 
                      lineHeight: 1.25,
                      textTransform: 'uppercase',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      height: 27,
                      width: '100%'
                    }}>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. SẢN PHẨM NỔI BẬT */}
          <section style={{ maxWidth: 1200, margin: '48px auto 32px', padding: '0 16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1px' }}>Sản Phẩm Đắc Lực</span>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#082B4C', marginTop: 2, margin: 0 }}>SẢN PHẨM NỔI BẬT</h2>
              </div>
              
              {/* Brand filter tabs inside Homepage */}
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 6, overflowX: 'auto' }}>
                {[
                  { key: 'ALL', label: 'Tất cả' },
                  { key: 'UPTI PUMP', label: 'UPTI' },
                  { key: 'SELANNI', label: 'SELANNI' },
                  { key: 'BERATI', label: 'BERATI' },
                  { key: 'MASTRA', label: 'MASTRA' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setHomeFeaturedTab(tab.key)}
                    style={{
                      background: homeFeaturedTab === tab.key ? '#FFFFFF' : 'transparent',
                      color: homeFeaturedTab === tab.key ? '#0878D9' : '#64748B',
                      border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 11.5,
                      fontWeight: 700, cursor: 'pointer', boxShadow: homeFeaturedTab === tab.key ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s', whiteSpace: 'nowrap'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop View: 4-column compact featured cards */}
            <div className="desktop-only">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {products
                  .filter(p => p.showOnWeb && (homeFeaturedTab === 'ALL' || (p.webBrand || '').toUpperCase() === homeFeaturedTab.toUpperCase()))
                  .slice(0, 8)
                  .map(p => renderFeaturedCard(p))}
              </div>
            </div>

            {/* Mobile View: Clean 2-column grid */}
            <div className="mobile-only-flex" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {products
                  .filter(p => p.showOnWeb && (homeFeaturedTab === 'ALL' || (p.webBrand || '').toUpperCase() === homeFeaturedTab.toUpperCase()))
                  .slice(0, 6)
                  .map(p => renderFeaturedCard(p))}
              </div>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                onClick={() => { setViewMode('catalog'); setActiveTab('products'); setSelectedCategory('TẤT CẢ'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={{
                  background: '#FFFFFF', border: '1px solid #0878D9', color: '#0878D9',
                  padding: '10px 24px', fontSize: 12.5, fontWeight: 800, borderRadius: 6, cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="brand-btn"
              >
                XEM TẤT CẢ SẢN PHẨM →
              </button>
            </div>
          </section>



          {/* 4. GIẢI PHÁP THEO NHU CẦU */}
          {/* Note: This section has background White #FFFFFF to alternate */}
          <section style={{ background: '#FFFFFF', padding: '64px 0', borderTop: '1px solid #EEF1F4' }} id="applications-section">
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>TỐI ƯU CÔNG NĂNG</span>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#071A2F', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>GIẢI PHÁP THEO NHU CẦU</h2>
                <p style={{ fontSize: 14.5, color: '#667085', margin: '8px 0 0', fontWeight: 500 }}>Hệ thống máy bơm được cấu hình chuyên biệt cho từng lĩnh vực</p>
              </div>

              {/* Desktop View: Visually Distinct Asymmetrical Bento Grid */}
              <div className="desktop-only">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                  {/* Item 1: Nhà Ở */}
                  <div style={{
                    background: '#FFFFFF', border: '1px solid #EEF1F4', borderLeft: '4px solid #0878D9', borderRadius: 8,
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#0878D9', letterSpacing: '1px' }}>01 / DÂN DỤNG</span>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#071A2F', margin: '6px 0 0' }}>NHÀ Ở DÂN DỤNG</h3>
                      <p style={{ fontSize: 13.5, color: '#667085', margin: '8px 0 0', lineHeight: 1.5, fontWeight: 500 }}>
                        Tăng áp lực nước sinh hoạt đầu ra, cấp nước tự động ổn định cho vòi sen, máy giặt.
                      </p>
                    </div>
                    <span onClick={() => {
                      const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes('tăng áp'));
                      setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      KHÁM PHÁ →
                    </span>
                  </div>

                  {/* Item 2: Nhà trọ / Chung cư */}
                  <div style={{
                    background: '#FFFFFF', border: '1px solid #EEF1F4', borderLeft: '4px solid #071A2F', borderRadius: 8,
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#071A2F', letterSpacing: '1px' }}>02 / TÒA NHÀ</span>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#071A2F', margin: '6px 0 0' }}>NHÀ TRỌ &amp; CHUNG CƯ</h3>
                      <p style={{ fontSize: 13.5, color: '#667085', margin: '8px 0 0', lineHeight: 1.5, fontWeight: 500 }}>
                        Hệ thống cụm bơm đẩy cao biến tần đảm bảo lưu lượng nước đồng đều giữa các tầng.
                      </p>
                    </div>
                    <span onClick={() => {
                      const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes('trục đứng'));
                      setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      KHÁM PHÁ →
                    </span>
                  </div>

                  {/* Item 3: Nhà xưởng */}
                  <div style={{
                    background: '#071A2F', border: 'none', borderRadius: 8,
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, justifyContent: 'space-between',
                    boxShadow: '0 10px 24px rgba(7,26,47,0.15)', color: '#FFFFFF'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#0878D9', letterSpacing: '1px' }}>03 / CÔNG NGHIỆP</span>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#FFFFFF', margin: '6px 0 0' }}>NHÀ XƯỞNG SẢN XUẤT</h3>
                      <p style={{ fontSize: 13.5, color: '#94A3B8', margin: '8px 0 0', lineHeight: 1.5, fontWeight: 500 }}>
                        Tuần hoàn làm mát máy móc thiết bị, bơm xử lý nước thải công nghiệp và cứu hỏa.
                      </p>
                    </div>
                    <span onClick={() => {
                      const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes('công nghiệp'));
                      setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      KHÁM PHÁ →
                    </span>
                  </div>

                  {/* Item 4: Công trình */}
                  <div style={{
                    background: '#F5F7FA', border: '1px dashed #0878D9', borderRadius: 8,
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#0878D9', letterSpacing: '1px' }}>04 / XÂY DỰNG</span>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#071A2F', margin: '6px 0 0' }}>CÔNG TRÌNH XÂY DỰNG</h3>
                      <p style={{ fontSize: 13.5, color: '#667085', margin: '8px 0 0', lineHeight: 1.5, fontWeight: 500 }}>
                        Bơm hố móng cát bùn, thoát nước ngầm thi công và trạm cấp nước sạch.
                      </p>
                    </div>
                    <span onClick={() => {
                      const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes('ly tâm'));
                      setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      KHÁM PHÁ →
                    </span>
                  </div>

                  {/* Item 5: Nông nghiệp */}
                  <div style={{
                    background: '#FFFFFF', border: '1px solid #EEF1F4', borderBottom: '4px solid #0878D9', borderRadius: 8,
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', letterSpacing: '1px' }}>05 / TƯỚI TIÊU</span>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#071A2F', margin: '6px 0 0' }}>NÔNG NGHIỆP</h3>
                      <p style={{ fontSize: 13.5, color: '#667085', margin: '8px 0 0', lineHeight: 1.5, fontWeight: 500 }}>
                        Bơm lưu lượng lớn tưới nhỏ giọt trang trại, cấp thoát nước ao hồ thủy sản.
                      </p>
                    </div>
                    <span onClick={() => {
                      const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes('ly tâm'));
                      setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      KHÁM PHÁ →
                    </span>
                  </div>

                  {/* Item 6: Hệ thống cấp nước */}
                  <div style={{
                    background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 8,
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', letterSpacing: '1px' }}>06 / HẠ TẦNG</span>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#071A2F', margin: '6px 0 0' }}>HỆ THỐNG CẤP NƯỚC</h3>
                      <p style={{ fontSize: 13.5, color: '#667085', margin: '8px 0 0', lineHeight: 1.5, fontWeight: 500 }}>
                        Trạm bơm điều áp đô thị, khai thác mạch nước ngầm giếng khoan sâu.
                      </p>
                    </div>
                    <span onClick={() => {
                      const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes('giếng khoan'));
                      setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                      setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      KHÁM PHÁ →
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile View: Horizontal scrolling carousel */}
              <div className="mobile-only-flex" style={{
                display: 'none',
                overflowX: 'auto',
                gap: 16,
                padding: '8px 16px 20px 16px',
                margin: '0 -16px',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch'
              }}>
                {[
                  { title: 'NHÀ Ở DÂN DỤNG', desc: 'Tăng áp lực nước sinh hoạt đầu ra, vòi sen, máy giặt.', img: 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=400&q=80', searchKey: 'tăng áp' },
                  { title: 'NHÀ TRỌ / CHUNG CƯ', desc: 'Cụm bơm đẩy cao biến tần phân phối nước ổn định.', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80', searchKey: 'trục đứng' },
                  { title: 'NHÀ XƯỞNG SẢN XUẤT', desc: 'Hệ thống tuần hoàn làm mát và thoát nước công nghiệp.', img: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=400&q=80', searchKey: 'công nghiệp' },
                  { title: 'CÔNG TRÌNH XÂY DỰNG', desc: 'Bơm hố móng cát bùn, thoát nước ngầm thi công.', img: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=400&q=80', searchKey: 'ly tâm' },
                  { title: 'NÔNG NGHIỆP', desc: 'Bơm lưu lượng lớn phục vụ tưới tiêu trang trại ao hồ.', img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&q=80', searchKey: 'ly tâm' },
                  { title: 'CẤP NƯỚC SẠCH', desc: 'Trạm bơm điều áp đô thị và giếng khoan sâu.', img: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?auto=format&fit=crop&w=400&q=80', searchKey: 'giếng khoan' }
                ].map((app, i) => (
                  <div key={i} style={{
                    background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 6,
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    width: '78vw', minWidth: '78vw', maxWidth: 280, scrollSnapAlign: 'start'
                  }}>
                    <div style={{ height: 140, overflow: 'hidden' }}>
                      <img src={app.img} alt={app.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 900, color: '#071A2F', margin: 0 }}>{app.title}</h3>
                      <p style={{ fontSize: 12, color: '#667085', margin: 0, lineHeight: 1.4, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>{app.desc}</p>
                      <span
                        onClick={() => {
                          const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes(app.searchKey));
                          setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                          setViewMode('catalog'); setActiveTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', cursor: 'pointer', marginTop: 10, display: 'inline-block' }}
                      >
                        KHÁM PHÁ SẢN PHẨM →
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <button
                  onClick={handleNavApplications}
                  style={{
                    background: '#FFFFFF', border: '1px solid #0878D9', color: '#0878D9',
                    padding: '11px 26px', fontSize: 13, fontWeight: 800, borderRadius: 6, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="brand-btn"
                >
                  XEM TẤT CẢ ỨNG DỤNG →
                </button>
              </div>
            </div>
          </section>

          {/* 5. THƯƠNG HIỆU */}
          {/* Note: This section has background Light Gray #F5F7FA to alternate */}
          <section style={{ background: '#F5F7FA', padding: '64px 0', borderTop: '1px solid #EEF1F4', borderBottom: '1px solid #EEF1F4' }} id="brands-section">
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>ĐỐI TÁC TIN CẬY</span>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#071A2F', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>THƯƠNG HIỆU HỢP TÁC</h2>
                <p style={{ fontSize: 14, color: '#667085', margin: '6px 0 0', fontWeight: 500 }}>Sản phẩm chính hãng nhập khẩu nguyên chiếc đầy đủ CO/CQ</p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 20
              }} className="brand-logos-grid">
                {['SELANNI', 'UPTI PUMP', 'BERATI', 'MASTRA'].map((brandName, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setActiveBrand(brandName);
                      setViewMode('catalog');
                      setActiveTab('products');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="brand-logo-card"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #EEF1F4',
                      borderRadius: 6,
                      padding: 20,
                      height: 90,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box',
                      boxShadow: '0 1px 3px rgba(7,26,47,0.01)'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.borderColor = '#0878D9';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(7,26,47,0.03)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.borderColor = '#EEF1F4';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(7,26,47,0.01)';
                    }}
                  >
                    {(() => {
                      const normalized = brandName.toLowerCase();
                      let src = '';
                      if (normalized.includes('selanni')) src = './logo_selanni.png';
                      else if (normalized.includes('upti')) src = './logo_upti.png';
                      else if (normalized.includes('berati')) src = './logo_berati.png';
                      else if (normalized.includes('mastra')) src = './logo_mastra.png';

                      if (src) {
                        const isSelanni = brandName === 'SELANNI';
                        return (
                          <img 
                            src={src} 
                            alt={brandName} 
                            style={{ 
                              height: isSelanni ? '42px' : '28px', 
                              width: 'auto', 
                              objectFit: 'contain', 
                              filter: 'grayscale(100%)',
                              opacity: 0.7,
                              transition: 'all 0.2s'
                            }} 
                            onMouseOver={e => { e.currentTarget.style.filter = 'grayscale(0%)'; e.currentTarget.style.opacity = '1'; }}
                            onMouseOut={e => { e.currentTarget.style.filter = 'grayscale(100%)'; e.currentTarget.style.opacity = '0.7'; }}
                          />
                        );
                      }

                      return (
                        <div className="brand-logo-visual" style={{
                          fontSize: 15,
                          fontWeight: 900,
                          color: '#071A2F',
                          letterSpacing: '0.5px',
                          fontFamily: 'monospace',
                          textAlign: 'center'
                        }}>
                          {brandName}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <button
                  onClick={handleNavBrands}
                  style={{
                    background: '#FFFFFF', border: '1px solid #0878D9', color: '#0878D9',
                    padding: '11px 26px', fontSize: 13, fontWeight: 800, borderRadius: 6, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="brand-btn"
                >
                  XEM TẤT CẢ THƯƠNG HIỆU →
                </button>
              </div>
            </div>
          </section>

          {/* 6. VỀ T&T — Editorial Company Introduction */}
          <section style={{ background: '#071A2F', color: '#FFFFFF', padding: '80px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }} id="about-section">
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 52, alignItems: 'center' }} className="hero-editorial-grid">
                {/* Left Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    VỀ T&amp;T
                  </span>
                  <h2 style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 900, color: '#FFFFFF', margin: 0, textTransform: 'uppercase', lineHeight: 1.2 }}>
                    HƠN 10 NĂM ĐỒNG HÀNH CÙNG CÔNG TRÌNH VIỆT
                  </h2>
                  <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                    Công ty TNHH Máy Bơm T&amp;T là đơn vị uy tín hàng đầu trong lĩnh vực nhập khẩu và phân phối trực tiếp các giải pháp máy bơm nước tiêu chuẩn quốc tế cho công trình dân dụng, tòa nhà cao tầng, hệ thống tưới tiêu và nhà xưởng công nghiệp.
                  </p>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
                    Với đội ngũ kỹ sư am hiểu kỹ thuật cùng kho hàng sẵn sàng hàng ngàn model, chúng tôi cam kết mang lại sự an tâm tuyệt đối về chất lượng, giá thành và tiến độ cho mọi đối tác.
                  </p>

                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={handleNavIntro}
                      style={{
                        background: '#0878D9', color: '#FFFFFF', border: 'none',
                        padding: '13px 30px', fontSize: 13, fontWeight: 800, borderRadius: 6,
                        cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
                        boxShadow: '0 4px 16px rgba(8,120,217,0.35)', letterSpacing: '0.5px'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#0660B8'}
                      onMouseOut={e => e.currentTarget.style.background = '#0878D9'}
                    >
                      KHÁM PHÁ VỀ T&amp;T →
                    </button>
                  </div>
                </div>

                {/* Right Showroom Image */}
                <div>
                  <img
                    src="./pump_showroom.jpg"
                    alt="Showroom và Kho Hàng Máy Bơm T&T"
                    style={{
                      width: '100%',
                      borderRadius: 10,
                      objectFit: 'cover',
                      maxHeight: 380,
                      boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                    loading="lazy"
                  />
                </div>
              </div>

              {/* 4 Strong Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 20,
                marginTop: 64,
                paddingTop: 48,
                borderTop: '1px solid rgba(255,255,255,0.08)'
              }} className="tt-trust-grid">
                {[
                  { number: '10+', label: 'NĂM KINH NGHIỆM', desc: 'Thành lập từ 2015' },
                  { number: '100%', label: 'CHÍNH HÃNG CO/CQ', desc: 'Nhập khẩu nguyên chiếc' },
                  { number: 'TOÀN QUỐC', label: 'GIAO HÀNG TẬN NƠI', desc: 'Hỗ trợ chân công trình' },
                  { number: '24/7', label: 'HỖ TRỢ KỸ THUẬT', desc: 'Tư vấn thông số chuẩn' }
                ].map((metric, mi) => (
                  <div key={mi} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 'clamp(26px, 2.8vw, 34px)', fontWeight: 900, color: '#0878D9', letterSpacing: '-0.5px' }}>
                      {metric.number}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {metric.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                      {metric.desc}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </section>

        </div>
      )}

      {viewMode === 'catalog' && (
        <div style={{ background: '#F6F8FB', minHeight: '100vh', color: '#102A43' }}>
          
          {/* 1. HERO BANNER (Height 150px, background Deep Navy) */}
          <section style={{
            height: '150px',
            background: '#082B4C',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 250, height: '100%', background: 'rgba(8, 120, 217, 0.08)', filter: 'blur(80px)', pointerEvents: 'none' }}></div>
            
            <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: '1 1 60%' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                  DANH MỤC MÁY BƠM
                </h1>
                <p style={{ color: '#cbd5e1', fontSize: 13, margin: 0, maxWidth: 520, lineHeight: 1.5, fontWeight: 650 }}>
                  {products.filter(p => p.showOnWeb).length} sản phẩm &middot; Máy bơm chính hãng &middot; CO/CQ đầy đủ
                </p>
              </div>
              <div className="desktop-only" style={{ flex: '1 1 40%', display: 'flex', justifyContent: 'end', alignItems: 'center', height: '120px' }}>
                <img
                  src="./pump_showroom.jpg"
                  alt="Máy bơm nước T&T"
                  style={{ maxHeight: '110px', objectFit: 'contain', borderRadius: 8, filter: 'drop-shadow(0 10px 20px rgba(8,120,217,0.2))' }}
                />
              </div>
            </div>
          </section>

          {/* 2. INTEGRATED SEARCH BAR & TRUST BAR */}
          <div style={{ maxWidth: 1200, margin: '-25px auto 0', padding: '0 20px', position: 'relative', zIndex: 10 }}>
            <div style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, height: 50,
              boxShadow: '0 2px 12px rgba(15,23,42,0.03)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12
            }}>
              <span style={{ color: '#64748B', display: 'flex' }}><SearchIcon size={18} /></span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm model, công suất, lưu lượng, cột áp hoặc thương hiệu..."
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13.5, fontWeight: 600, color: '#102A43', background: 'transparent' }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ border: 'none', background: 'transparent', color: '#64748B', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 6 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Row of modern trust badges */}
            <div className="desktop-only" style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 750, color: '#475569' }}>
                <span style={{ color: '#0878D9', fontSize: 13 }}>✓</span> Đầy đủ CO/CQ chứng quy
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 750, color: '#475569' }}>
                <span style={{ color: '#0878D9', fontSize: 13 }}>✓</span> Bảo hành hãng 12 tháng
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 750, color: '#475569' }}>
                <span style={{ color: '#0878D9', fontSize: 13 }}>✓</span> Hàng sẵn kho số lượng lớn
              </div>
            </div>
          </div>

          <div className="catalog-container" style={{ maxWidth: 1400, margin: '14px auto 0', padding: '24px 20px 80px' }}>
            
            {/* 3. BREADCRUMB */}
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20, fontWeight: 500 }}>
              <span style={{ cursor: 'pointer' }} onClick={() => handleNavHome()}>Trang chủ</span> / <span style={{ fontWeight: 700, color: '#082B4C' }}>Sản phẩm</span>
            </div>

            {/* Mobile Filter Button & Sort Bar */}
            {(() => {
              const activeChips = [];
              if (selectedCategory !== 'TẤT CẢ') {
                activeChips.push({ label: selectedCategory, onRemove: () => setSelectedCategory('TẤT CẢ') });
              }
              if (activeBrand !== 'ALL') {
                activeChips.push({ label: activeBrand, onRemove: () => setActiveBrand('ALL') });
              }
              if (filterPower !== 'ALL') {
                activeChips.push({ label: filterPower, onRemove: () => setFilterPower('ALL') });
              }
              if (filterVoltage !== 'ALL') {
                activeChips.push({ label: filterVoltage === '220V' ? '220V' : '380V', onRemove: () => setFilterVoltage('ALL') });
              }
              if (sliderHead < 150) {
                activeChips.push({ label: `Cột áp ≤ ${sliderHead}m`, onRemove: () => setSliderHead(150) });
              }
              if (sliderFlow < 200) {
                activeChips.push({ label: `Lưu lượng ≤ ${sliderFlow}m³/h`, onRemove: () => setSliderFlow(200) });
              }
              
              return (
                <>
                  <div className="mobile-control-bar" style={{
                    display: 'none',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 12,
                    alignItems: 'center'
                  }}>
                    <button
                      onClick={() => setShowMobileFilters(true)}
                      style={{
                        height: 46,
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#102A43',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      BỘ LỌC
                    </button>
                    
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <select
                        value={sortType}
                        onChange={e => setSortType(e.target.value)}
                        style={{
                          width: '100%',
                          height: 46,
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 14,
                          color: '#102A43',
                          cursor: 'pointer',
                          textAlign: 'center',
                          paddingLeft: 12,
                          paddingRight: 12,
                          appearance: 'none',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="bestseller">BÁN CHẠY</option>
                        <option value="newest">MỚI NHẤT</option>
                      </select>
                    </div>
                  </div>
                  
                  {activeChips.length > 0 && (
                    <div style={{ display: 'none', flexWrap: 'wrap', gap: 8, padding: '10px 0 16px 0', borderBottom: '1px solid #E2E8F0', marginBottom: 16 }} className="mobile-only-flex active-chips-scroll">
                      {activeChips.map((chip, idx) => (
                        <span key={idx} style={{
                          background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 16,
                          padding: '4px 12px', fontSize: 11.5, fontWeight: 700, color: '#0F172A',
                          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                        }} onClick={chip.onRemove}>
                          {chip.label} <span style={{ color: '#94A3B8', fontWeight: 'bold' }}>×</span>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 16 }} className="mobile-only">
                    Có <strong>{processedProducts.length}</strong> sản phẩm được tìm thấy
                  </div>

                  {/* 4. MAIN LAYOUT (Sidebar + Main panel) */}
                  <div style={{ display: 'flex', gap: 28 }} className="catalog-layout-container">
                    <aside style={{ width: 260, minWidth: 260, flexShrink: 0, position: 'sticky', top: 96, height: 'calc(100vh - 120px)' }} className="desktop-filters filter-panel">
                <div style={{
                  background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}>
                  
                  {/* BỘ LỌC HEADER */}
                  <div className="filter-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #EEF1F4', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#071A2F', letterSpacing: '0.5px' }}>BỘ LỌC SẢN PHẨM</span>
                    {searchTerm || selectedCategory !== 'TẤT CẢ' ? (
                      <button
                        onClick={() => {
                          setSelectedCategory('TẤT CẢ');
                          setSearchTerm('');
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#0878D9', fontSize: 11, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' }}
                      >
                        Xóa
                      </button>
                    ) : null}
                  </div>
                  
                  {/* BỘ LỌC CONTENT (SCROLLABLE) */}
                  <div className="filter-panel-content custom-thin-scrollbar" style={{
                    padding: '16px 18px',
                    overflowY: 'auto',
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20
                  }}>
                    {/* SEARCH INPUT */}
                    <div>
                      <h3 style={{ fontSize: 11, fontWeight: 850, color: '#071A2F', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Tìm kiếm
                      </h3>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Nhập tên sản phẩm, mã..."
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: '#F5F7FA',
                            border: '1px solid #EEF1F4',
                            borderRadius: 6,
                            fontSize: 12.5,
                            color: '#101828',
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontWeight: 600
                          }}
                        />
                      </div>
                    </div>

                    {/* LOẠI BƠM (DANH MỤC) */}
                    <div>
                      <h3 style={{ fontSize: 11, fontWeight: 850, color: '#071A2F', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Loại máy bơm
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {categories.map((cat, idx) => {
                          const isActive = selectedCategory === cat;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedCategory(cat);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              style={{
                                width: '100%', padding: '8px 10px',
                                background: isActive ? '#EAF3FF' : 'transparent',
                                color: isActive ? '#0878D9' : '#667085',
                                border: 'none', borderRadius: 6, textAlign: 'left',
                                fontWeight: isActive ? 800 : 600, fontSize: 12,
                                cursor: 'pointer', transition: 'all 0.2s',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                              }}
                            >
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>{cat}</span>
                              <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.5 }}>{isActive ? '●' : '›'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* BỘ LỌC FOOTER (PINNED) */}
                  <div className="filter-panel-footer" style={{
                    padding: '16px 18px',
                    borderTop: '1px solid #EEF1F4',
                    background: '#FFFFFF',
                    flexShrink: 0
                  }}>
                    <button
                      onClick={() => {
                        setSelectedCategory('TẤT CẢ');
                        setSearchTerm('');
                      }}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: '1px solid #EEF1F4',
                        color: '#667085',
                        borderRadius: 6,
                        padding: '10px 0',
                        fontWeight: 800,
                        fontSize: 11.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.borderColor = '#EF4444';
                        e.currentTarget.style.color = '#EF4444';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.03)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.borderColor = '#EEF1F4';
                        e.currentTarget.style.color = '#667085';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      XÓA BỘ LỌC
                    </button>
                  </div>

                </div>
              </aside>

              {/* Main Panel Content */}
              <div style={{ flexGrow: 1 }}>
                
                {/* Active Filters Chips Bar */}
                {(() => {
                  const hasActiveFilters =
                    activeBrand !== 'ALL' ||
                    selectedCategory !== 'TẤT CẢ' ||
                    filterPower !== 'ALL' ||
                    filterVoltage !== 'ALL' ||
                    sliderHead !== 150 ||
                    sliderFlow !== 200;

                  if (!hasActiveFilters) return null;

                  return (
                    <div className="desktop-only" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 20 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginRight: 4 }}>Bộ lọc đang chọn:</span>
                      
                      {selectedCategory !== 'TẤT CẢ' && (
                        <span style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#082B4C', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          Danh mục: {selectedCategory}
                          <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => setSelectedCategory('TẤT CẢ')}>✕</span>
                        </span>
                      )}

                      {activeBrand !== 'ALL' && (
                        <span style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#082B4C', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          Hãng: {activeBrand}
                          <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => setActiveBrand('ALL')}>✕</span>
                        </span>
                      )}

                      {filterPower !== 'ALL' && (
                        <span style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#082B4C', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          C.Suất: {filterPower}
                          <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => setFilterPower('ALL')}>✕</span>
                        </span>
                      )}

                      {filterVoltage !== 'ALL' && (
                        <span style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#082B4C', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          Điện áp: {filterVoltage === '220V' ? '1 Pha (220V)' : '3 Pha (380V)'}
                          <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => setFilterVoltage('ALL')}>✕</span>
                        </span>
                      )}

                      {sliderHead !== 150 && (
                        <span style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#082B4C', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          Cột áp ≤ {sliderHead}m
                          <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => setSliderHead(150)}>✕</span>
                        </span>
                      )}

                      {sliderFlow !== 200 && (
                        <span style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#082B4C', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          Lưu lượng ≤ {sliderFlow}m³/h
                          <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => setSliderFlow(200)}>✕</span>
                        </span>
                      )}

                      <button
                        onClick={() => {
                          setSelectedCategory('TẤT CẢ');
                          setActiveBrand('ALL');
                          setFilterPower('ALL');
                          setFilterVoltage('ALL');
                          setSliderHead(150);
                          setSliderFlow(200);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Xóa tất cả bộ lọc
                      </button>
                    </div>
                  );
                })()}

                {/* Minimal sorting bar */}
                <div className="desktop-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontSize: 13, color: '#64748B', fontWeight: 500 }}>
                  <div>
                    Có <strong>{processedProducts.length}</strong> sản phẩm được tìm thấy
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Sắp xếp:</span>
                    <select
                      value={sortType}
                      onChange={e => setSortType(e.target.value)}
                      style={{
                        border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px 12px',
                        fontSize: 12.5, outline: 'none', background: '#FFFFFF', color: '#102A43', fontWeight: 600
                      }}
                    >
                      <option value="bestseller">Bán chạy nhất</option>
                      <option value="newest">Mới nhất</option>
                      <option value="price-asc">Giá tăng dần</option>
                      <option value="price-desc">Giá giảm dần</option>
                    </select>
                  </div>
                </div>

                {/* Products Grid rendering */}
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <span className="spinner" style={{ width: 32, height: 32 }} />
                    <div style={{ marginTop: 10, fontSize: 13, color: '#64748B' }}>Đang tải dữ liệu sản phẩm...</div>
                  </div>
                ) : processedProducts.length === 0 ? (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 32, margin: '0 0 10px' }}>📋</p>
                    <p style={{ color: '#64748B', fontSize: 13, margin: 0, fontWeight: 600 }}>Không tìm thấy máy bơm nào khớp với điều kiện lọc.</p>
                  </div>
                ) : selectedCategory === 'TẤT CẢ' ? (
                  
                  // Category grouped lists
                  <div>
                    {(() => {
                      const catSource = dbCategories.length > 0
                        ? dbCategories
                        : [...new Set(processedProducts.filter(p => p.showOnWeb && p.group).map(p => p.group))].map(g => g);
                      return catSource;
                    })().map((catObj, idx) => {
                      const catName = typeof catObj === 'string' ? catObj : catObj?.name || '';
                      const catProducts = processedProducts.filter(p =>
                        p.showOnWeb && (p.group || '').trim().toLowerCase() === catName.trim().toLowerCase()
                      );
                      if (catProducts.length === 0) return null;

                      return (
                        <section key={idx} className="category-section">
                          <div className="category-header">
                            <div className="category-header-left">
                              <h3 className="category-title">{catName}</h3>
                              <span className="category-subtitle">
                                Nhập khẩu chính hãng &middot; {catProducts.length} sản phẩm
                              </span>
                            </div>
                            <span
                              onClick={() => { setSelectedCategory(catName); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="category-view-all"
                            >
                              Xem tất cả <ChevronRight size={12} />
                            </span>
                          </div>
 
                          <div className="catalog-grid">
                            {catProducts.slice(0, 4).map(p => renderProductCard(p))}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                ) : (

                  // Single selected category direct layout
                  <div>
                    {/* Desktop Single Category Header */}
                    <div className="desktop-only" style={{
                      background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '24px 28px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28
                    }}>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 900, color: '#082B4C', textTransform: 'uppercase', margin: 0 }}>
                          {selectedCategory}
                        </h2>
                        <p style={{ fontSize: 12.5, color: '#64748B', margin: '4px 0 0', fontWeight: 500 }}>Nhập khẩu chính hãng &middot; Phân phối chính thức tại Việt Nam</p>
                      </div>
                      <span style={{ fontSize: 12, color: '#0878D9', background: '#EAF3FF', padding: '6px 14px', borderRadius: 4, fontWeight: 800 }}>
                        {processedProducts.length} sản phẩm
                      </span>
                    </div>

                    {/* Mobile Single Category Header */}
                    <div className="mobile-only-flex category-header-single" style={{
                      display: 'none',
                      flexDirection: 'column',
                      padding: '16px 0',
                      marginBottom: 10,
                      borderBottom: '1px solid #E2E8F0',
                      boxSizing: 'border-box',
                      gap: 4
                    }}>
                      <h2 style={{ fontSize: 18, fontWeight: 900, color: '#082B4C', textTransform: 'uppercase', margin: 0, lineHeight: 1.3 }}>
                        {selectedCategory}
                      </h2>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 550 }}>
                        Nhập khẩu chính hãng &middot; {processedProducts.length} sản phẩm
                      </span>
                    </div>
 
                    <div className="catalog-grid">
                      {processedProducts.map(p => renderProductCard(p))}
                    </div>
                  </div>

                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>

          {/* QUICK VIEW SPECS MODAL OVERLAY */}
          {quickViewProduct && (
            <div style={{
              position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
              background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 11000,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} onClick={() => setQuickViewProduct(null)}>
              <div style={{
                background: '#FFFFFF', padding: 28, borderRadius: 16, maxWidth: 540, width: '90%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.15)', position: 'relative', display: 'flex', gap: 24
              }} onClick={e => e.stopPropagation()} className="project-row">
                
                <button
                  onClick={() => setQuickViewProduct(null)}
                  style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#64748B', fontWeight: 'bold' }}
                >
                  ✕
                </button>

                <div style={{ flex: '1 1 40%', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <img
                    src={quickViewProduct.webImages?.[0] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=400&q=80'}
                    alt={quickViewProduct.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {quickViewProduct.webBrand || 'UPTI PUMP'}
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 850, color: '#10233F', margin: 0 }}>{quickViewProduct.name}</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#475569', marginTop: 8 }}>
                    {quickViewProduct.webSpecs?.power && <div>⚡ Công suất: <strong>{formatPower(quickViewProduct.webSpecs.power)}</strong></div>}
                    {quickViewProduct.webSpecs?.voltage && <div>🔌 Điện áp: <strong>{formatVoltage(quickViewProduct.webSpecs.voltage)}</strong></div>}
                    {quickViewProduct.webSpecs?.specs && <div>📋 Thông số: {quickViewProduct.webSpecs.specs}</div>}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginTop: 12 }}>
                    Giá: Liên hệ tư vấn
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button
                      onClick={() => { navigateToProduct(quickViewProduct.id); setQuickViewProduct(null); }}
                      style={{
                        flex: 1, background: '#F1F5F9', color: '#475569', border: 'none', padding: '10px 0',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      CHI TIẾT
                    </button>
                    <button
                      onClick={() => { window.open(`https://zalo.me/0984273806?text=${encodeURIComponent('Chào bạn, tôi cần báo giá máy bơm: ' + quickViewProduct.name)}`, '_blank'); setQuickViewProduct(null); }}
                      style={{
                        flex: 1, background: '#1d4ed8', color: '#FFFFFF', border: 'none', padding: '10px 0',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29,78,216,0.2)'
                      }}
                    >
                      NHẬN BÁO GIÁ
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* MOBILE FILTER MODAL DRAWER OVERLAY */}
          {showMobileFilters && (
            <div className="mobile-filters-drawer-overlay" style={{
              position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
              background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 11000,
              display: 'flex', justifyContent: 'flex-start'
            }} onClick={() => setShowMobileFilters(false)}>
              <div className="mobile-filters-drawer-panel" style={{
                background: '#FFFFFF', width: '320px', height: '100%', padding: '24px 20px',
                display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '8px 0 24px rgba(0,0,0,0.15)'
              }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: '#082B4C', margin: 0, letterSpacing: '0.5px' }}>BỘ LỌC TÌM KIẾM</h3>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', fontWeight: 'bold', padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>
                
                {/* Fields */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, paddingRight: 4 }}>
                  
                  {/* Category */}
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>LOẠI MÁY BƠM</h4>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', background: '#FFFFFF', fontSize: 13.5, fontWeight: 600, color: '#102A43' }}
                    >
                      {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Brand */}
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>THƯƠNG HIỆU</h4>
                    <select
                      value={activeBrand}
                      onChange={e => setActiveBrand(e.target.value)}
                      style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', background: '#FFFFFF', fontSize: 13.5, fontWeight: 600, color: '#102A43' }}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="UPTI PUMP">UPTI PUMP</option>
                      <option value="SELANNI">SELANNI</option>
                      <option value="BERATI">BERATI</option>
                      <option value="MASTRA">MASTRA</option>
                    </select>
                  </div>

                  {/* Power */}
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>CÔNG SUẤT</h4>
                    <select
                      value={filterPower}
                      onChange={e => setFilterPower(e.target.value)}
                      style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', background: '#FFFFFF', fontSize: 13.5, fontWeight: 600, color: '#102A43' }}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="0.25kW">0.25 kW (0.33 HP)</option>
                      <option value="0.37kW">0.37 kW (0.5 HP)</option>
                      <option value="0.55kW">0.55 kW (0.75 HP)</option>
                      <option value="0.75kW">0.75 kW (1.0 HP)</option>
                      <option value="1.1kW">1.1 kW (1.5 HP)</option>
                      <option value="1.5kW">1.5 kW (2.0 HP)</option>
                      <option value="2.2kW">2.2 kW (3.0 HP)</option>
                      <option value="3kW">3.0 kW (4.0 HP)</option>
                      <option value="4kW">4.0 kW (5.5 HP)</option>
                      <option value="5.5kW">5.5 kW (7.5 HP)</option>
                      <option value="7.5kW">7.5 kW (10 HP)</option>
                    </select>
                  </div>

                  {/* Voltage */}
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>ĐIỆN ÁP</h4>
                    <select
                      value={filterVoltage}
                      onChange={e => setFilterVoltage(e.target.value)}
                      style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', background: '#FFFFFF', fontSize: 13.5, fontWeight: 600, color: '#102A43' }}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="220V">1 Pha (220V)</option>
                      <option value="380V">3 Pha (380V)</option>
                    </select>
                  </div>

                  {/* Head (Cột áp) */}
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>CỘT ÁP</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>
                      <span>0m</span>
                      <span style={{ color: '#0878D9' }}>Tối đa {sliderHead}m</span>
                      <span>150m</span>
                    </div>
                    <input
                      type="range" min="0" max="150" value={sliderHead} onChange={e => setSliderHead(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#0878D9', height: 24, cursor: 'pointer' }}
                    />
                  </div>

                  {/* Flow (Lưu lượng) */}
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#082B4C', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>LƯU LƯỢNG</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>
                      <span>0 m³/h</span>
                      <span style={{ color: '#0878D9' }}>Tối đa {sliderFlow} m³/h</span>
                      <span>200 m³/h</span>
                    </div>
                    <input
                      type="range" min="0" max="200" value={sliderFlow} onChange={e => setSliderFlow(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#0878D9', height: 24, cursor: 'pointer' }}
                    />
                  </div>

                </div>

                {/* Buttons block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                  <button
                    onClick={() => {
                      setFilterPower('ALL');
                      setFilterVoltage('ALL');
                      setSelectedCategory('TẤT CẢ');
                      setActiveBrand('ALL');
                      setSliderHead(150);
                      setSliderFlow(200);
                      setShowMobileFilters(false);
                    }}
                    style={{ width: '100%', height: 44, background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    XÓA BỘ LỌC
                  </button>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    style={{ width: '100%', height: 44, background: '#0878D9', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
                  >
                    HIỂN THỊ {processedProducts.length} SẢN PHẨM
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── 1. TRANG ỨNG DỤNG (APPLICATIONS PAGE) ────────────────────── */}
      {viewMode === 'applications' && (
        <div style={{ background: '#F5F7FA', minHeight: '80vh', paddingBottom: 80 }}>
          {/* Hero Banner */}
          <section style={{ background: '#071A2F', color: '#FFFFFF', padding: '54px 24px', textAlign: 'center' }}>
            <div style={{ maxWidth: 840, margin: '0 auto' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                GIẢI PHÁP MÁY BƠM CHUYÊN BIỆT
              </span>
              <h1 style={{ fontSize: 'clamp(26px, 3.2vw, 38px)', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                GIẢI PHÁP MÁY BƠM CHO TỪNG NHU CẦU
              </h1>
              <p style={{ fontSize: 15, color: '#94A3B8', marginTop: 12, lineHeight: 1.6, fontWeight: 500 }}>
                T&amp;T cung cấp giải pháp máy bơm đồng bộ, tối ưu công năng và tiết kiệm chi phí cho từng hạng mục công trình từ dân dụng đến công nghiệp nặng.
              </p>
            </div>
          </section>

          {/* Applications Grid */}
          <div style={{ maxWidth: 1200, margin: '48px auto 0', padding: '0 24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 28 }}>
              {[
                {
                  id: '01',
                  tag: 'DÂN DỤNG & GIA ĐÌNH',
                  title: 'NHÀ Ở DÂN DỤNG & BIỆT THỰ',
                  desc: 'Tăng áp lực nước sinh hoạt đầu ra, cấp nước tự động ổn định cho hệ thống vòi sen, bình nóng lạnh, máy giặt và lọc nước.',
                  img: 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Bơm tăng áp biến tần thông minh', 'Bơm đẩy cao tầng êm ái', 'Bơm hút giếng tự động'],
                  searchKey: 'tăng áp'
                },
                {
                  id: '02',
                  tag: 'TÒA NHÀ & LƯU TRÚ',
                  title: 'NHÀ TRỌ, CHUNG CƯ MINI & HOMESTAY',
                  desc: 'Hệ thống cụm bơm đẩy cao và tăng áp điều khiển điện tử, duy trì áp lực nước đồng đều giữa các tầng vào giờ cao điểm.',
                  img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Cụm bơm biến tần đa tầng cánh', 'Bơm trục đứng đẩy cao áp lực', 'Bơm chìm hút hầm tự hoại'],
                  searchKey: 'trục đứng'
                },
                {
                  id: '03',
                  tag: 'CÔNG NGHIỆP & SẢN XUẤT',
                  title: 'NHÀ XƯỞNG & KHU CÔNG NGHIỆP',
                  desc: 'Bơm tuần hoàn giải nhiệt máy móc xưởng đúc, xi mạ, dệt nhuộm, hệ thống rửa băng chuyền và xử lý nước thải sản xuất.',
                  img: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Bơm ly tâm trục ngang công suất lớn', 'Bơm hóa chất / dung dịch đặc biệt', 'Bơm chìm nước thải công nghiệp'],
                  searchKey: 'công nghiệp'
                },
                {
                  id: '04',
                  tag: 'XÂY DỰNG & HẠ TẦNG',
                  title: 'CÔNG TRÌNH XÂY DỰNG & HỐ MÓNG',
                  desc: 'Hút tháo khô hố móng cát bùn, chống ngập úng mùa mưa lũ cho tầng hầm công trình thi công, cấp nước trộn trạm bê tông.',
                  img: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Bơm chìm hút bùn cát có cánh khuấy', 'Bơm thoát nước ngầm tầng hầm', 'Bơm áp lực rửa xe công trường'],
                  searchKey: 'chìm'
                },
                {
                  id: '05',
                  tag: 'NÔNG NGHIỆP & THỦY SẢN',
                  title: 'NÔNG NGHIỆP, TƯỚI TIÊU & NUÔI TRỒNG',
                  desc: 'Bơm lưu lượng lớn phục vụ tưới béc xoay, tưới nhỏ giọt trang trại cây ăn trái, cấp và thay nước đầm tôm ao cá.',
                  img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Bơm ly tâm lưu lượng siêu lớn', 'Bơm chìm chống ăn mòn nước mặn', 'Bơm hút nước sông hồ đầu nguồn'],
                  searchKey: 'ly tâm'
                },
                {
                  id: '06',
                  tag: 'LỌC NƯỚC & XỬ LÝ',
                  title: 'HỆ THỐNG CẤP NƯỚC SẠCH & DÀN LỌC RO',
                  desc: 'Cung cấp cột áp cao đẩy qua màng lọc thẩm thấu ngược RO cho các nhà máy nước tinh khiết, trạm cấp nước sạch nông thôn.',
                  img: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Bơm trục đứng đa tầng cánh Inox 304/316', 'Bơm định lượng hóa chất xử lý', 'Bơm màng khí nén'],
                  searchKey: 'trục đứng'
                },
                {
                  id: '07',
                  tag: 'DỊCH VỤ & NGHỈ DƯỠNG',
                  title: 'KHÁCH SẠN, NHÀ HÀNG & RESORT',
                  desc: 'Hệ thống bơm tăng áp cấp nước nóng năng lượng mặt trời / heatpump, hệ thống tuần hoàn hồ bơi và tạo sóng cảnh quan.',
                  img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Bơm biến tần chịu nhiệt độ cao', 'Bơm lọc tuần hoàn bể bơi', 'Bơm đài phun nước cảnh quan'],
                  searchKey: 'biến tần'
                },
                {
                  id: '08',
                  tag: 'CAO ỐC & MEP',
                  title: 'TÒA NHÀ CAO TẦNG & TRUNG TÂM THƯƠNG MẠI',
                  desc: 'Cụm booster pump điều áp theo biến tần liên tục, hệ thống bơm bù áp và bơm chữa cháy PCCC chuẩn kiểm định.',
                  img: 'https://images.unsplash.com/photo-1470075801209-17f9ec0cada6?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Hệ thống Cụm bơm Booster 2-4 máy bơm', 'Bơm cứu hỏa PCCC động cơ điện/diesel', 'Bơm thoát sàn tầng hầm'],
                  searchKey: 'công nghiệp'
                },
                {
                  id: '09',
                  tag: 'NHÀ THẦU & DỰ ÁN',
                  title: 'NHÀ THẦU CƠ ĐIỆN & TỔNG THẦU MEP',
                  desc: 'Cung cấp trọn gói theo hồ sơ thiết kế kỹ thuật, chứng chỉ CO/CQ chuẩn gốc, chính sách công nợ và chiết khấu dự án tối ưu.',
                  img: 'https://images.unsplash.com/photo-1541888946425-d0fbb180c5f7?auto=format&fit=crop&w=600&q=80',
                  pumpTypes: ['Tư vấn tính chọn model theo bản vẽ', 'Bàn giao nghiệm thu có chứng nhận CO/CQ', 'Hỗ trợ kỹ thuật 24/7 tại công trình'],
                  searchKey: 'TẤT CẢ'
                }
              ].map(app => (
                <div
                  key={app.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #EEF1F4',
                    borderRadius: 10,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 10px rgba(7,26,47,0.04)',
                    transition: 'all 0.25s ease'
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(7,26,47,0.1)'; e.currentTarget.style.borderColor = '#0878D9'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(7,26,47,0.04)'; e.currentTarget.style.borderColor = '#EEF1F4'; }}
                >
                  <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                    <img src={app.img} alt={app.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(7,26,47,0.85)', color: '#FFFFFF', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 4, letterSpacing: '0.8px' }}>
                      {app.tag}
                    </span>
                  </div>
                  <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: '#071A2F', margin: 0, lineHeight: 1.3 }}>
                      {app.title}
                    </h3>
                    <p style={{ fontSize: 13.5, color: '#64748B', margin: 0, lineHeight: 1.55, fontWeight: 500 }}>
                      {app.desc}
                    </p>

                    <div style={{ borderTop: '1px dashed #EEF1F4', paddingTop: 12, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase' }}>DÒNG BƠM PHÙ HỢP:</span>
                      {app.pumpTypes.map((pt, pti) => (
                        <div key={pti} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#334155', fontWeight: 600 }}>
                          <span style={{ color: '#0878D9', fontSize: 10 }}>✔</span>
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        const matchedCat = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes(app.searchKey.toLowerCase()));
                        setSelectedCategory(matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : 'TẤT CẢ');
                        setViewMode('catalog'); setActiveTab('products');
                        window.location.hash = '#web/catalog';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        background: '#0878D9', color: '#FFFFFF', border: 'none',
                        padding: '11px 18px', borderRadius: 6, fontSize: 12.5, fontWeight: 800,
                        cursor: 'pointer', textAlign: 'center', marginTop: 10, transition: 'all 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#0660B8'}
                      onMouseOut={e => e.currentTarget.style.background = '#0878D9'}
                    >
                      XEM SẢN PHẨM PHÙ HỢP →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. TRANG THƯƠNG HIỆU (BRANDS PAGE) ───────────────────────── */}
      {viewMode === 'brands' && (
        <div style={{ background: '#F5F7FA', minHeight: '80vh', paddingBottom: 80 }}>
          {/* Hero Banner */}
          <section style={{ background: '#071A2F', color: '#FFFFFF', padding: '54px 24px', textAlign: 'center' }}>
            <div style={{ maxWidth: 840, margin: '0 auto' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                ĐỐI TÁC CHÍNH HÃNG
              </span>
              <h1 style={{ fontSize: 'clamp(26px, 3.2vw, 38px)', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                CÁC THƯƠNG HIỆU MÁY BƠM PHÂN PHỐI
              </h1>
              <p style={{ fontSize: 15, color: '#94A3B8', marginTop: 12, lineHeight: 1.6, fontWeight: 500 }}>
                T&amp;T là đơn vị nhập khẩu và phân phối trực tiếp các thương hiệu máy bơm uy tín hàng đầu, cam kết 100% chính hãng đầy đủ giấy tờ CO/CQ và bảo hành dài hạn.
              </p>
            </div>
          </section>

          {/* Brands List */}
          <div style={{ maxWidth: 1100, margin: '48px auto 0', padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 32 }}>
            {[
              {
                name: 'UPTI PUMP',
                logo: './logo_upti.png',
                origin: 'Công nghệ Đài Loan',
                badge: 'DÒNG CÔNG NGHIỆP & BIẾN TẦN CAO CẤP',
                desc: 'UPTI PUMP ứng dụng công nghệ kỹ thuật tiên tiến từ Đài Loan, chuyên về các dòng bơm ly tâm trục đứng, cụm bơm biến tần tăng áp và bơm công nghiệp hiệu suất cao. Động cơ quấn 100% dây đồng nguyên chất, khả năng vận hành bền bỉ 24/7 và tiết kiệm điện năng vượt trội.',
                categories: ['Bơm biến tần thông minh', 'Bơm trục đứng đa tầng cánh', 'Bơm ly tâm trục ngang', 'Bơm chìm nước thải gang/inox'],
                highlights: ['Đạt chứng nhận CE / ISO 9001', 'Tiết kiệm 30-40% điện năng', 'Bảo hành chính hãng 12-24 tháng']
              },
              {
                name: 'SELANNI',
                logo: './logo_selanni.png',
                origin: 'Công nghệ Ý',
                badge: 'DÒNG DÂN DỤNG & TĂNG ÁP CAO CẤP',
                desc: 'SELANNI sản xuất trên dây chuyền công nghệ Ý hiện đại, nổi tiếng với độ ồn cực thấp và độ bền ấn tượng trong môi trường dân dụng và tòa nhà. Các dòng máy bơm SELANNI được ứng dụng rộng rãi từ nhà ở, biệt thự đến các hệ thống lọc nước sạch sinh hoạt.',
                categories: ['Bơm tăng áp điện tử tự ngắt', 'Bơm đẩy cao đa tầng cánh', 'Bơm chìm hút nước sạch', 'Bơm tự mồi thông minh'],
                highlights: ['Hoạt động siêu êm dưới 50dB', 'Rơle điện tử chống cạn an toàn', 'Vỏ nhôm tản nhiệt nhanh']
              },
              {
                name: 'BERATI',
                logo: './logo_berati.png',
                origin: 'Công nghệ Ý',
                badge: 'CHUYÊN GIA NƯỚC THẢI & HỐ MÓNG',
                desc: 'BERATI sở hữu công nghệ kỹ thuật từ Ý, là giải pháp số 1 cho các ứng dụng xử lý nước thải, bùn cát công trình và thoát sàn hầm ngập nước. Cánh bơm được chế tạo từ gang cầu và hợp kim chống mài mòn cao, tích hợp phao điện tự động chống ngập.',
                categories: ['Bơm chìm nước thải cánh cắt rác', 'Bơm bùn đặc hố móng cát', 'Bơm thoát ngập tầng hầm', 'Bơm chìm Inox chịu ăn mòn'],
                highlights: ['Cánh cắt rác chống kẹt nghẽn', 'Phớt cơ khí kép Ceramic/Carbon', 'Tích hợp rơle nhiệt bảo vệ']
              },
              {
                name: 'MASTRA',
                logo: './logo_mastra.png',
                origin: 'Thương hiệu Trung Quốc uy tín',
                badge: 'CHUYÊN GIA BƠM HỎA TIỄN GIẾNG KHOAN',
                desc: 'MASTRA là thương hiệu hàng đầu từ Trung Quốc nổi tiếng toàn cầu về máy bơm hỏa tiễn thả chìm giếng khoan sâu, cấp nước sạch cho vùng cao, trang trại nông nghiệp quy mô lớn và các nhà máy khai thác nguồn nước ngầm.',
                categories: ['Bơm hỏa tiễn 3 inch, 4 inch, 6 inch', 'Bơm chìm giếng khoan sâu Inox', 'Bơm hút nước đồi dốc', 'Động cơ thả chìm giải nhiệt dầu'],
                highlights: ['Cột áp đẩy cao lên tới 300m', 'Guồng bơm Inox chống gỉ sét', 'Hiệu suất đẩy xa vượt bậc']
              }
            ].map((brand, bIdx) => (
              <div
                key={bIdx}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #EEF1F4',
                  borderRadius: 12,
                  padding: '36px 32px',
                  display: 'grid',
                  gridTemplateColumns: '260px 1fr',
                  gap: 36,
                  alignItems: 'center',
                  boxShadow: '0 2px 12px rgba(7,26,47,0.03)',
                  boxSizing: 'border-box'
                }}
                className="brand-editorial-row"
              >
                {/* Brand Logo & Origin */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, borderRight: '1px solid #F1F5F9', paddingRight: 24 }}>
                  <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={brand.logo} alt={brand.name} style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }} loading="lazy" />
                  </div>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{brand.origin}</span>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#0878D9', background: '#EFF6FF', padding: '4px 8px', borderRadius: 4 }}>
                    {brand.badge}
                  </span>
                </div>

                {/* Brand Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: '#071A2F', margin: 0, textTransform: 'uppercase' }}>
                    THƯƠNG HIỆU {brand.name}
                  </h2>
                  <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
                    {brand.desc}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {brand.categories.map((c, ci) => (
                      <span key={ci} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6 }}>
                        💧 {c}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, borderTop: '1px dashed #EEF1F4', paddingTop: 14, fontSize: 12.5, color: '#10B981', fontWeight: 700 }}>
                    {brand.highlights.map((hl, hli) => (
                      <span key={hli} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✓ {hl}
                      </span>
                    ))}
                  </div>

                  <div>
                    <button
                      onClick={() => {
                        setActiveBrand(brand.name);
                        setViewMode('catalog'); setActiveTab('products');
                        window.location.hash = '#web/catalog';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        background: '#0878D9', color: '#FFFFFF', border: 'none',
                        padding: '10px 22px', borderRadius: 6, fontSize: 12.5, fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s', marginTop: 6
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#0660B8'}
                      onMouseOut={e => e.currentTarget.style.background = '#0878D9'}
                    >
                      XEM TẤT CẢ SẢN PHẨM {brand.name} →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. TRANG GIỚI THIỆU (ABOUT / VỀ T&T PAGE) ────────────────── */}
      {viewMode === 'intro' && (
        <div style={{ background: '#F5F7FA', minHeight: '80vh', paddingBottom: 80 }}>
          {/* Hero Banner */}
          {/* Hero Banner */}
          <section style={{ background: '#071A2F', color: '#FFFFFF', padding: '56px 24px 64px', textAlign: 'center', position: 'relative', borderBottom: '1px solid rgba(8, 120, 217, 0.2)' }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              <span style={{ fontSize: 11.5, fontWeight: 900, color: '#38BDF8', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
                [ HỒ SƠ NĂNG LỰC DOANH NGHIỆP ]
              </span>
              <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '-0.6px', lineHeight: 1.2 }}>
                CÔNG TY TNHH MÁY BƠM T&amp;T
              </h1>
              <p style={{ fontSize: 15.5, color: '#CBD5E1', marginTop: 14, lineHeight: 1.7, fontWeight: 500, maxWidth: 820, margin: '14px auto 0' }}>
                Hơn 11 năm kinh nghiệm nhập khẩu trực tiếp, phân phối độc quyền và tư vấn giải pháp máy bơm nước đồng bộ cho hàng ngàn công trình dân dụng, tòa nhà cao tầng, khu công nghiệp và dự án hạ tầng trên toàn quốc.
              </p>
            </div>
          </section>

          {/* Main Profile Container */}
          <div style={{ maxWidth: 1240, margin: '40px auto 0', padding: '0 24px', boxSizing: 'border-box' }}>
            
            {/* Khối 1: Giới thiệu toàn diện & Thông tin pháp lý (Tối ưu chữ & ảnh cân đối) */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #EEF1F4',
              borderRadius: 12,
              padding: '36px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 0.85fr)',
              gap: 32,
              boxShadow: '0 2px 14px rgba(7,26,47,0.04)',
              boxSizing: 'border-box',
              alignItems: 'start',
            }} className="hero-editorial-grid">
              
              {/* Cột Trái: Nội dung chi tiết & Thông tin năng lực */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 6 }}>
                    UY TÍN TẠO DỰNG THƯƠNG HIỆU
                  </span>
                  <h2 style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#071A2F' }}>
                    VỀ CHÚNG TÔI
                  </h2>
                </div>

                <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.75, margin: 0, fontWeight: 500 }}>
                  <strong>Công ty TNHH Máy Bơm T&amp;T</strong> là doanh nghiệp chuyên nghiệp và uy tín hàng đầu tại Việt Nam trong lĩnh vực cung cấp thiết bị cơ điện, chuyên nhập khẩu nguyên chiếc và phân phối các dòng máy bơm nước tiêu chuẩn quốc tế (Châu Âu, Đài Loan, Ý, Trung Quốc).
                </p>

                <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.75, margin: 0, fontWeight: 500 }}>
                  Với triết lý hoạt động <em>"Chất lượng tạo niềm tin — Kỹ thuật tạo giá trị"</em>, T&amp;T không chỉ bán thiết bị đơn thuần mà cung cấp <strong>giải pháp thủy lực trọn gói</strong>: Khảo sát thực địa, tính chọn công suất motor theo biểu đồ cột áp Q-H, cung cấp bản vẽ CAD, lập hồ sơ thầu CO/CQ và bàn giao hướng dẫn kỹ thuật vận hành 24/7.
                </p>

                {/* Tầm nhìn & Sứ mệnh 2-Card Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#0369A1', textTransform: 'uppercase', marginBottom: 4 }}>
                      🎯 SỨ MỆNH
                    </div>
                    <div style={{ fontSize: 13, color: '#0C4A6E', lineHeight: 1.5, fontWeight: 500 }}>
                      Mang lại nguồn nước ổn định, liên tục và tiết kiệm tối đa điện năng cho mọi công trình và đời sống người dân Việt Nam.
                    </div>
                  </div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#0878D9', textTransform: 'uppercase', marginBottom: 4 }}>
                      🌟 TẦM NHÌN
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>
                      Trở thành nhà cung cấp &amp; đối tác phân phối thiết bị máy bơm công nghiệp - dân dụng số 1 về chất lượng dịch vụ và kỹ thuật.
                    </div>
                  </div>
                </div>

                {/* Bảng Thông Tin Pháp Lý & Hành Chính */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 13.5,
                  color: '#1E293B',
                  lineHeight: 1.6,
                  marginTop: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #E2E8F0', paddingBottom: 6, marginBottom: 4 }}>
                    🏛️ THÔNG TIN PHÁP LÝ DOANH NGHIỆP
                  </div>
                  <div><strong>Tên đầy đủ:</strong> CÔNG TY TNHH MÁY BƠM T&amp;T</div>
                  <div><strong>Mã số doanh nghiệp (MST):</strong> 0106888466 (Sở Kế hoạch &amp; Đầu tư TP. Hà Nội cấp)</div>
                  <div><strong>Địa chỉ đăng ký kinh doanh:</strong> Tổ dân phố Thống Nhất, P. Dương Nội, Q. Hà Đông, TP. Hà Nội</div>
                  <div><strong>Địa chỉ văn phòng &amp; kho:</strong> LK 180 – NO04 Khu 27–28 Dương Nội, Q. Hà Đông, TP. Hà Nội</div>
                  <div><strong>Đại diện pháp luật:</strong> Bà Nguyễn Thị Tuyết (Giám đốc)</div>
                  <div><strong>Ngày thành lập:</strong> 24/06/2015 <span style={{ color: '#0878D9', fontWeight: 800 }}>(Hơn 11 năm hoạt động liên tục)</span></div>
                </div>

                {/* Hotline Kỹ Thuật & Zalo */}
                <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', display: 'block' }}>Hotline Liên Hệ Trực 24/7</span>
                    <a href="tel:0984273806" style={{ fontSize: 18, fontWeight: 900, color: '#071A2F', textDecoration: 'none' }}>0984 273 806 (Mr. Tuấn)</a>
                  </div>
                  <a href="https://zalo.me/0984273806" target="_blank" rel="noreferrer" style={{ background: '#0878D9', color: '#FFF', padding: '10px 20px', borderRadius: 6, fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}>
                    CHAT ZALO TƯ VẤN →
                  </a>
                </div>
              </div>

              {/* Cột Phải: Hình ảnh kho bãi tinh gọn & Năng lực lưu kho */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(7,26,47,0.06)' }}>
                  <img
                    src="./pump_showroom.jpg"
                    alt="Kho hàng Máy Bơm T&T"
                    style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(7,26,47,0.92) 0%, transparent 100%)',
                    padding: '16px 14px 10px',
                    color: '#FFFFFF',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.8px' }}>KHO HÀNG TẬP TRUNG HÀ NỘI</div>
                    <div style={{ fontSize: 11, color: '#CBD5E1' }}>Sẵn kho hơn 5.000+ máy bơm và linh phụ kiện</div>
                  </div>
                </div>

                {/* 3 Cam kết năng lực kho & giao hàng */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🏭</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F' }}>Kho Bãi 1.500m²</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>Dự trữ đầy đủ mọi phân khúc công suất</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🚚</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F' }}>Giao Nhanh 24-48h</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>Vận chuyển an toàn tận chân công trình</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📑</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F' }}>100% Hồ Sơ CO/CQ</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>Chứng từ gốc phục vụ nghiệm thu quyết toán</div>
                    </div>
                  </div>
                </div>

                {/* Giờ Làm Việc */}
                <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 8, padding: '14px 16px', fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: '#071A2F', marginBottom: 4 }}>🕒 THỜI GIAN LÀM VIỆC</div>
                  <div>• Thứ 2 – Thứ 7: <strong>07:30 – 18:00</strong></div>
                  <div>• Trực Hotline kỹ thuật: <strong>24/7 (Kể cả ngày lễ)</strong></div>
                </div>
              </div>

            </div>

            {/* Khối 2: 4-Metrics Trust Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
              margin: '36px 0',
              background: '#071A2F',
              borderRadius: 12,
              padding: '36px 32px',
              color: '#FFFFFF',
            }} className="tt-trust-grid">
              {[
                { number: '11+', label: 'NĂM KINH NGHIỆM', desc: 'Thành lập từ 24/06/2015' },
                { number: '100%', label: 'CHÍNH HÃNG CO/CQ', desc: 'Nhập khẩu nguyên chiếc' },
                { number: '63 TỈNH', label: 'PHỦ SÓNG TOÀN QUỐC', desc: 'Giao hàng tận chân công trình' },
                { number: '24/7', label: 'HỖ TRỢ KỸ THUẬT', desc: 'Tư vấn tính chọn cột áp chuẩn' }
              ].map((metric, mi) => (
                <div key={mi} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 'clamp(26px, 2.8vw, 34px)', fontWeight: 900, color: '#38BDF8', letterSpacing: '-0.5px' }}>
                    {metric.number}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {metric.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                    {metric.desc}
                  </span>
                </div>
              ))}
            </div>

            {/* Khối 3: Năng Lực Cung Cấp & Các Lĩnh Vực Trọng Điểm */}
            <div style={{ margin: '48px 0 36px' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '1.5px', textTransform: 'uppercase' }}>PHẠM VI ỨNG DỤNG</span>
                <h2 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', color: '#071A2F', margin: '4px 0 0' }}>
                  CÁC LĨNH VỰC DỰ ÁN TRỌNG ĐIỂM
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {[
                  {
                    icon: '🏢',
                    title: 'TÒA NHÀ & CAO TẦNG',
                    desc: 'Cung cấp cụm bơm biến tần song song điều áp tự động, bơm cứu hỏa PCCC, bơm bù áp và hệ thống bơm thoát nước ngập tầng hầm.'
                  },
                  {
                    icon: '🏭',
                    title: 'NHÀ MÁY & KHU CÔNG NGHIỆP',
                    desc: 'Hệ thống bơm ly tâm công suất lớn giải nhiệt tháp Cooling Tower, bơm tuần hoàn nước nóng, bơm hóa chất và xử lý nước thải sản xuất.'
                  },
                  {
                    icon: '🏗️',
                    title: 'CÔNG TRÌNH & HỐ MÓNG',
                    desc: 'Dòng bơm chìm bùn cát, bơm cánh cắt rác KTZ chuyên dụng thoát nước hố móng, thi công cầu đường và hạ tầng đô thị.'
                  },
                  {
                    icon: '🌾',
                    title: 'NÔNG NGHIỆP & CẤP NƯỚC',
                    desc: 'Bơm hỏa tiễn thả giếng khoan sâu khai thác nước ngầm Inox 304, bơm ly tâm tưới tiêu tự động cho trang trại diện tích lớn.'
                  }
                ].map((item, idx) => (
                  <div key={idx} style={{ background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 10, padding: 26, boxShadow: '0 2px 8px rgba(7,26,47,0.03)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 32 }}>{item.icon}</div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', color: '#071A2F', margin: 0 }}>{item.title}</h3>
                    <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Khối 4: Quy Trình Làm Việc Kỹ Thuật 4 Bước */}
            <div style={{ margin: '48px 0 36px', background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 12, padding: '36px 32px' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '1.5px', textTransform: 'uppercase' }}>TIÊU CHUẨN KỸ THUẬT</span>
                <h2 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', color: '#071A2F', margin: '4px 0 0' }}>
                  QUY TRÌNH TƯ VẤN &amp; BÀN GIAO 4 BƯỚC
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {[
                  {
                    step: '01',
                    title: 'TIẾP NHẬN THÔNG SỐ',
                    desc: 'Khảo sát nhu cầu thực tế: Lưu lượng Q (m³/h), Cột áp H (m), Nguồn điện (220V/380V) và tính chất môi chất bơm.'
                  },
                  {
                    step: '02',
                    title: 'TÍNH TOÁN & CHỌN MODEL',
                    desc: 'Kỹ sư thủy lực tra cứu biểu đồ đặc tính bơm, chọn đúng công suất motor giúp tiết kiệm điện năng và tối ưu chi phí.'
                  },
                  {
                    step: '03',
                    title: 'HỒ SƠ CO/CQ & BÁO GIÁ',
                    desc: 'Cung cấp đầy đủ chứng nhận xuất xứ CO, chứng nhận chất lượng CQ, bảng vẽ CAD chi tiết và báo giá chiết khấu dự án.'
                  },
                  {
                    step: '04',
                    title: 'GIAO HÀNG & HỖ TRỢ ĐẤU NỐI',
                    desc: 'Đóng gói kiện gỗ cẩn thận, vận chuyển hỏa tốc tận chân công trình và hỗ trợ kỹ thuật cài đặt biến tần, tủ điện 24/7.'
                  }
                ].map((st, sIdx) => (
                  <div key={sIdx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '22px 20px', position: 'relative' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#0878D9', fontFamily: 'monospace', marginBottom: 8 }}>
                      {st.step}
                    </div>
                    <h4 style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', color: '#071A2F', margin: '0 0 8px 0' }}>
                      {st.title}
                    </h4>
                    <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
                      {st.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Khối 5: Core Values 6-card grid */}
            <div style={{ marginTop: 40 }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '1.5px', textTransform: 'uppercase' }}>CAM KẾT DỊCH VỤ</span>
                <h2 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', color: '#071A2F', margin: '4px 0 0' }}>
                  GIÁ TRỊ CỐT LÕI TẠI MÁY BƠM T&amp;T
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {[
                  { icon: '📦', title: 'ĐA DẠNG MẪU MÃ', desc: 'Sẵn có hàng ngàn model máy bơm từ dân dụng 0.37kW đến công nghiệp lớn.' },
                  { icon: '🛡️', title: 'CAM KẾT CHẤT LƯỢNG', desc: '100% sản phẩm chính hãng, đầy đủ CO/CQ, xuất xứ minh bạch rõ ràng.' },
                  { icon: '🏷️', title: 'GIÁ CẠNH TRANH', desc: 'Chính sách chiết khấu tốt nhất cho đại lý, nhà thầu cơ điện và dự án lớn.' },
                  { icon: '🤝', title: 'TƯ VẤN CHUYÊN NGHIỆP', desc: 'Đội ngũ kỹ sư giàu kinh nghiệm tính chọn đúng model, cột áp và lưu lượng.' },
                  { icon: '🔧', title: 'BẢO HÀNH CHU ĐÁO', desc: 'Bảo hành chính hãng 12-24 tháng, phụ tùng thay thế luôn sẵn sàng đáp ứng.' },
                  { icon: '⚡', title: 'GIAO HÀNG HỎA TỐC', desc: 'Hệ thống vận chuyển nhanh toàn quốc, giao trực tiếp đến tận chân công trình.' }
                ].map((item, idx) => (
                  <div key={idx} style={{ background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(7,26,47,0.02)' }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#071A2F', margin: '0 0 8px 0' }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: 0, fontWeight: 500 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── 4. TRANG LIÊN HỆ (CONTACT PAGE) ──────────────────────────── */}
      {viewMode === 'contact' && (
        <div style={{ background: '#F5F7FA', minHeight: '80vh', paddingBottom: 80 }}>
          {/* Hero Banner */}
          <section style={{ background: '#071A2F', color: '#FFFFFF', padding: '54px 24px', textAlign: 'center' }}>
            <div style={{ maxWidth: 840, margin: '0 auto' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#0878D9', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                KẾT NỐI VỚI CHÚNG TÔI
              </span>
              <h1 style={{ fontSize: 'clamp(26px, 3.2vw, 38px)', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                LIÊN HỆ &amp; TƯ VẤN KỸ THUẬT
              </h1>
              <p style={{ fontSize: 15, color: '#94A3B8', marginTop: 12, lineHeight: 1.6, fontWeight: 500 }}>
                Đội ngũ kỹ sư máy bơm T&amp;T luôn sẵn sàng hỗ trợ tư vấn chọn model chuẩn, khảo sát công trình và báo giá dự án nhanh chóng 24/7.
              </p>
            </div>
          </section>

          {/* Contact Main 2-Column Section */}
          <div style={{ maxWidth: 1200, margin: '48px auto 0', padding: '0 24px', boxSizing: 'border-box' }}>
            <div style={{
              background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 12, padding: '48px 40px',
              display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, boxShadow: '0 2px 12px rgba(7,26,47,0.03)'
            }} className="hero-editorial-grid">
              
              {/* Left Column: Contact Information */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>
                  THÔNG TIN TRỰC TIẾP
                </span>
                <h2 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', marginBottom: 24, color: '#071A2F' }}>
                  CÔNG TY TNHH MÁY BƠM T&amp;T
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, background: '#EFF6FF', width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📍</span>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Địa chỉ văn phòng &amp; kho hàng:</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#071A2F', marginTop: 2 }}>LK 180 – NO04 Khu 27–28 Dương Nội, Q. Hà Đông, Hà Nội</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, background: '#EFF6FF', width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📞</span>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Hotline tư vấn kỹ thuật (24/7):</div>
                      <a href="tel:0984273806" style={{ fontWeight: 900, fontSize: 17, color: '#0878D9', textDecoration: 'none', display: 'block', marginTop: 2 }}>
                        0984 273 806
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, background: '#EFF6FF', width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>💬</span>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Zalo tư vấn &amp; Báo giá:</div>
                      <a href="https://zalo.me/0984273806" target="_blank" rel="noreferrer" style={{ fontWeight: 800, fontSize: 14, color: '#0068FF', textDecoration: 'none', display: 'block', marginTop: 2 }}>
                        0984 273 806 (Bấm để nhắn tin Zalo)
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, background: '#EFF6FF', width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🌐</span>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Website chính thức:</div>
                      <a href="https://maybomnuocnhapkhautt.com" target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14, color: '#071A2F', textDecoration: 'none', display: 'block', marginTop: 2 }}>
                        maybomnuocnhapkhautt.com
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, background: '#EFF6FF', width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📘</span>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Facebook Fanpage:</div>
                      <a href="https://www.facebook.com/profile.php?id=61578469481516" target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14, color: '#1877F2', textDecoration: 'none', display: 'block', marginTop: 2 }}>
                        facebook.com/profile.php?id=61578469481516
                      </a>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                  <a
                    href="tel:0984273806"
                    style={{
                      background: '#071A2F', color: '#FFFFFF', padding: '12px 20px', borderRadius: 6,
                      fontSize: 13, fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    📞 GỌI HOTLINE
                  </a>
                  <a
                    href="https://zalo.me/0984273806"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#0878D9', color: '#FFFFFF', padding: '12px 20px', borderRadius: 6,
                      fontSize: 13, fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    💬 NHẮN ZALO
                  </a>
                </div>
              </div>

              {/* Right Column: Contact Form */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', color: '#071A2F', margin: '0 0 6px 0' }}>
                  GỬI YÊU CẦU TƯ VẤN &amp; BÁO GIÁ
                </h3>
                <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px 0' }}>
                  Điền thông tin bên dưới, kỹ sư T&amp;T sẽ phản hồi báo giá trong vòng 10 phút.
                </p>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!contactPhone.trim()) {
                    alert('Vui lòng nhập số điện thoại để T&T hỗ trợ bạn nhanh nhất!');
                    return;
                  }
                  const textMsg = `Chào bạn, tôi là ${contactName || 'Khách hàng'}. Nhu cầu: ${contactType}. SĐT: ${contactPhone}. Ghi chú: ${contactNote || 'Cần tư vấn báo giá'}`;
                  window.open(`https://zalo.me/0984273806?text=${encodeURIComponent(textMsg)}`, '_blank');
                  alert('Cảm ơn quý khách! T&T sẽ liên hệ lại ngay trong ít phút.');
                  setContactName(''); setContactPhone(''); setContactNote('');
                }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Họ và tên của bạn:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '10px 12px', fontSize: 13.5, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Số điện thoại / Zalo: <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="Ví dụ: 0984 273 806"
                      required
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '10px 12px', fontSize: 13.5, outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Loại công trình / Nhu cầu sử dụng:
                    </label>
                    <select
                      value={contactType}
                      onChange={e => setContactType(e.target.value)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '10px 12px', fontSize: 13.5, outline: 'none' }}
                    >
                      <option value="Nhà ở dân dụng / Biệt thự">Nhà ở dân dụng / Biệt thự</option>
                      <option value="Nhà trọ / Chung cư mini">Nhà trọ / Chung cư mini</option>
                      <option value="Nhà xưởng / Khu sản xuất">Nhà xưởng / Khu sản xuất</option>
                      <option value="Công trình xây dựng / Hố móng">Công trình xây dựng / Hố móng</option>
                      <option value="Nông nghiệp / Tưới tiêu ao hồ">Nông nghiệp / Tưới tiêu ao hồ</option>
                      <option value="Dự án cơ điện MEP / Nhà thầu">Dự án cơ điện MEP / Nhà thầu</option>
                      <option value="Nhu cầu khác">Nhu cầu khác</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Nội dung cần tư vấn (lưu lượng, cột áp, mã máy bơm...):
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Mô tả nhu cầu kỹ thuật hoặc mã sản phẩm bạn cần..."
                      value={contactNote}
                      onChange={e => setContactNote(e.target.value)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '10px 12px', fontSize: 13.5, outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: '#0878D9', color: '#FFFFFF', border: 'none', padding: '14px',
                      borderRadius: 6, fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all 0.2s', marginTop: 4,
                      boxShadow: '0 4px 12px rgba(8,120,217,0.3)'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#0660B8'}
                    onMouseOut={e => e.currentTarget.style.background = '#0878D9'}
                  >
                    GỬI YÊU CẦU TƯ VẤN NGAY →
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TRANG TÍNH CHỌN BƠM THÔNG MINH */}
      {viewMode === 'calculator' && (
        <div style={{ maxWidth: 1200, margin: '40px auto 80px', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Công cụ kỹ thuật
            </span>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', marginTop: 8 }}>
              Tự Động Tính Toán & Chọn Máy Bơm Phù Hợp
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, maxWidth: 600, margin: '8px auto 0', lineHeight: 1.5 }}>
              Chỉ cần nhập nhu cầu sử dụng thực tế của bạn, hệ thống AI của T&T sẽ tự động tính toán tổn thất đường ống và đề xuất các dòng máy bơm tối ưu nhất trong kho.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'start' }} className="product-detail-grid">
            {/* CỘT TRÁI: Form nhập dữ liệu */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                1. Chọn Loại Máy Bơm & Nhập Nhu Cầu
              </h3>

              {/* Loại bơm */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>LOẠI MÁY BƠM MUỐN CHỌN *</label>
                <div className="calc-type-grid">
                  <div className={`calc-type-card ${calcPumpType === 'submersible' ? 'active' : ''}`} onClick={() => setCalcPumpType('submersible')}>
                    <div className="calc-icon-bg">💧</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Bơm Chìm</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Hút thải, giếng khoan</span>
                  </div>
                  <div className={`calc-type-card ${calcPumpType === 'surface' ? 'active' : ''}`} onClick={() => setCalcPumpType('surface')}>
                    <div className="calc-icon-bg">⚙️</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Bơm Cạn</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Ly tâm trục ngang</span>
                  </div>
                  <div className={`calc-type-card ${calcPumpType === 'booster' ? 'active' : ''}`} onClick={() => setCalcPumpType('booster')}>
                    <div className="calc-icon-bg">⚡</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Tăng Áp / Biến Tần</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Tăng áp lực vòi nước</span>
                  </div>
                </div>
              </div>

              {/* CÁC SLIDER & ĐIỀU CHỈNH TÙY THEO LOẠI BƠM */}
              {/* Chiều cao đẩy nước */}
              <div className="calc-slider-group" style={{ marginBottom: 24 }}>
                <div className="calc-slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>
                    {calcPumpType === 'submersible' ? 'ĐỘ SÂU THẢ BƠM + CHIỀU CAO ĐẨY LÊN BỂ (MET):' : 'CHIỀU CAO THẲNG ĐỨNG ĐẨY NƯỚC (MET):'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input 
                      type="number" 
                      min="1" 
                      max="700" 
                      value={calcHeight} 
                      onChange={e => setCalcHeight(Math.max(1, Math.min(700, parseInt(e.target.value) || 0)))}
                      style={{
                        width: 76,
                        padding: '6px 8px',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        textAlign: 'center',
                        color: '#2563eb',
                        outline: 'none',
                        background: '#f8fafc'
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>m</span>
                  </div>
                </div>
                <input 
                  type="range" min="1" max="700" 
                  value={calcHeight} 
                  onChange={e => setCalcHeight(parseInt(e.target.value))} 
                  className="calc-slider"
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                  <span>Min: 1m</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    {calcHeight <= 100 
                      ? `~ ${Math.ceil(calcHeight/4)} tầng` 
                      : `~ ${Math.ceil(calcHeight * 0.1)} bar`}
                  </span>
                  <span>Max: 700m</span>
                </div>
                {/* Presets for Height */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginRight: 4 }}>NHẬP NHANH:</span>
                  {[15, 35, 75, 150, 300, 500, 700].map(val => (
                    <button 
                      key={val}
                      onClick={() => setCalcHeight(val)}
                      style={{
                        background: calcHeight === val ? '#eff6ff' : '#fff',
                        color: calcHeight === val ? '#2563eb' : '#475569',
                        border: calcHeight === val ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {val}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Dành cho Bơm chìm và Bơm cạn */}
              {(calcPumpType === 'submersible' || calcPumpType === 'surface') && (
                <>
                  <div className="calc-slider-group" style={{ marginBottom: 24 }}>
                    <div className="calc-slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>
                        TỔNG CHIỀU DÀI ĐƯỜNG ỐNG DẪN NƯỚC (MET):
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input 
                          type="number" 
                          min="5" 
                          max="1500" 
                          value={calcLength} 
                          onChange={e => setCalcLength(Math.max(5, Math.min(1500, parseInt(e.target.value) || 0)))}
                          style={{
                            width: 76,
                            padding: '6px 8px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 800,
                            textAlign: 'center',
                            color: '#2563eb',
                            outline: 'none',
                            background: '#f8fafc'
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>m</span>
                      </div>
                    </div>
                    <input 
                      type="range" min="5" max="1500" 
                      value={calcLength} 
                      onChange={e => setCalcLength(parseInt(e.target.value))} 
                      className="calc-slider"
                      style={{ width: '100%', accentColor: '#2563eb' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                      <span>Min: 5m</span>
                      <span>Max: 1500m</span>
                    </div>
                    {/* Presets for Pipe Length */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginRight: 4 }}>NHẬP NHANH:</span>
                      {[30, 100, 250, 500, 1000, 1500].map(val => (
                        <button 
                          key={val}
                          onClick={() => setCalcLength(val)}
                          style={{
                            background: calcLength === val ? '#eff6ff' : '#fff',
                            color: calcLength === val ? '#2563eb' : '#475569',
                            border: calcLength === val ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {val}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>SỐ GÓC CO CÚT 90° (CÁI):</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button className="calc-btn-counter" onClick={() => setCalcElbows(p => Math.max(0, p - 1))}>-</button>
                        <span className="calc-counter-val">{calcElbows}</span>
                        <button className="calc-btn-counter" onClick={() => setCalcElbows(p => p + 1)}>+</button>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>THỂ TÍCH BỂ CẦN BƠM (M³):</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button className="calc-btn-counter" onClick={() => setCalcVolume(p => Math.max(1, p - 1))}>-</button>
                        <span className="calc-counter-val">{calcVolume} m³</span>
                        <button className="calc-btn-counter" onClick={() => setCalcVolume(p => p + 1)}>+</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>THỜI GIAN MUỐN BƠM ĐẦY BỂ (GIỜ):</label>
                    <select 
                      value={calcTime} 
                      onChange={e => setCalcTime(parseFloat(e.target.value))}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }}
                    >
                      <option value="0.5">30 Phút (0.5 giờ)</option>
                      <option value="1">1 Giờ</option>
                      <option value="2">2 Giờ</option>
                      <option value="3">3 Giờ</option>
                      <option value="5">5 Giờ</option>
                    </select>
                  </div>
                </>
              )}

              {/* Dành cho Bơm tăng áp và Biến tần */}
              {(calcPumpType === 'booster' || calcPumpType === 'inverter') && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>SỐ THIẾT BỊ XẢ NƯỚC SỬ DỤNG ĐỒNG THỜI (VÒI SEN, VÒI RỬA, TOILET):</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="calc-btn-counter" onClick={() => setCalcTaps(p => Math.max(1, p - 1))}>-</button>
                    <span className="calc-counter-val" style={{ fontSize: 15 }}>{calcTaps} thiết bị</span>
                    <button className="calc-btn-counter" onClick={() => setCalcTaps(p => p + 1)}>+</button>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 6, fontStyle: 'italic' }}>
                    * Ước tính trung bình mỗi vòi sen tiêu thụ khoảng 0.5 m³/giờ ở mức xả thoải mái.
                  </span>
                </div>
              )}
            </div>

            {/* CỘT PHẢI: Kết quả tính toán & Gợi ý sản phẩm phù hợp */}
            <div>
              {/* Dashboard hiển thị kết quả */}
              {calcResults && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.01)', marginBottom: 30 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                    2. Kết Quả Tính Chọn Bơm Yêu Cầu
                  </h3>
                  
                  <div className="calc-gauge-container">
                    <div>
                      <div className="calc-gauge-val">{calcResults.head}m</div>
                      <div className="calc-gauge-lbl">Cột Áp Tối Thiểu (H)</div>
                    </div>
                    <div>
                      <div className="calc-gauge-val">{calcResults.flow} m³/h</div>
                      <div className="calc-gauge-lbl">Lưu Lượng Yêu Cầu (Q)</div>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, borderLeft: '3.5px solid #0ea5e9', fontSize: 12.5, lineHeight: 1.5, color: '#334155' }}>
                    <strong>💡 Lời khuyên kỹ sư T&T:</strong> Để đảm bảo đường ống hoạt động bền bỉ, bạn nên chọn dòng máy bơm có thông số danh định cao hơn mức tính toán tối thiểu từ 10% đến 15% (đã được AI của chúng tôi tích hợp sẵn vào dải lọc bên dưới).
                  </div>
                </div>
              )}

              {/* Bơm đề xuất */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>3. Bơm Đề Xuất Phù Hợp</span>
                  <span style={{ fontSize: 11, background: '#eff6ff', color: '#3b82f6', padding: '3px 8px', borderRadius: 99, fontWeight: 700 }}>
                    {calculatedProducts.length} Mã Bơm Thỏa Mãn
                  </span>
                </h3>

                {calculatedProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Không tìm thấy bơm trùng khớp dải này!</div>
                    <p style={{ fontSize: 12, margin: '0 auto', maxWidth: 300, lineHeight: 1.5 }}>
                      Nhu cầu cột áp hoặc lưu lượng vượt ngoài dải tiêu chuẩn. Vui lòng bấm bên dưới để gửi thông số kỹ thuật, kỹ sư T&T sẽ tính chọn trực tiếp giúp bạn.
                    </p>
                    <button 
                      onClick={() => window.open(`https://zalo.me/0984273806?text=${encodeURIComponent(`Chào bạn, tôi cần tư vấn máy bơm có thông số tự tính trên web: Cột áp ${calcResults?.head || calcHeight}m, Lưu lượng ${calcResults?.flow || calcVolume} m3/h. Nhờ kỹ sư T&T hỗ trợ chọn giúp!`)}`, '_blank')}
                      style={{ marginTop: 16, border: 'none', background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      💬 Gửi Yêu Cầu Trực Tiếp Qua Zalo
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {calculatedProducts.slice(0, 4).map((p, idx) => {
                      const brandMeta = BRAND_METADATA[p.webBrand] || BRAND_METADATA['UPTI PUMP']
                      const exactFit = idx === 0 ? 'Phù hợp nhất' : 'Khuyên dùng'
                      return (
                        <div 
                          key={p.id} 
                          style={{
                            border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', gap: 12, 
                            position: 'relative', overflow: 'hidden', background: idx === 0 ? '#f0fdf4' : '#fff',
                            borderColor: idx === 0 ? '#bbf7d0' : '#e2e8f0'
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 0, right: 0, background: idx === 0 ? '#10b981' : '#3b82f6',
                            color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: '0 0 0 8px', textTransform: 'uppercase'
                          }}>
                            {exactFit}
                          </div>

                          {/* Image */}
                          <div style={{ width: 70, height: 70, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#fff' }}>
                            <img 
                              src={p.webImages?.[0] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=100&q=80'} 
                              alt={p.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                            />
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', margin: '0 0 4px 0', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name}
                            </h4>
                            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                              Thông số dải làm việc: <span style={{ color: '#0284c7' }}>{p.webSpecs?.specs || 'Dải tiêu chuẩn'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Giá: <span style={{ color: '#2563eb' }}>Liên hệ 0984 273 806</span></span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                            <button 
                              onClick={() => navigateToProduct(p.id)}
                              style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Chi tiết
                            </button>
                            <button 
                              onClick={() => {
                                const textMsg = `Chào bạn, tôi đã tính chọn bơm trên web cần cột áp ${calcResults?.head}m, lưu lượng ${calcResults?.flow} m3/h. Hệ thống đề xuất mã bơm này cho tôi: ${p.name}. Hãy tư vấn thêm và báo giá cho tôi nhé!`;
                                window.open(`https://zalo.me/0984273806?text=${encodeURIComponent(textMsg)}`, '_blank');
                              }}
                              style={{ border: 'none', background: '#10b981', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Đặt Zalo
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

            {/* TRANG CHI TIẾT SẢN PHẨM */}
      {viewMode === 'product-detail' && currentProduct && (() => {
        const brandInfo = BRAND_METADATA[currentProduct.webBrand] || BRAND_METADATA['UPTI PUMP'];
        const pow = currentProduct.webSpecs?.power ? formatPower(currentProduct.webSpecs.power) : '';
        const volt = currentProduct.webSpecs?.voltage ? formatVoltage(currentProduct.webSpecs.voltage) : '';
        const parsedSpecs = parsePumpSpecs(currentProduct.webSpecs?.specs);
        
        const formatSpecNumber = (val) => {
          if (val === undefined || val === null) return '';
          const num = parseFloat(val);
          if (isNaN(num)) return val;
          return Number(num.toFixed(1)).toString();
        };
        const qMin = parsedSpecs ? formatSpecNumber(parsedSpecs.qMin) : '';
        const qMax = parsedSpecs ? formatSpecNumber(parsedSpecs.qMax) : '';
        const hMin = parsedSpecs ? formatSpecNumber(parsedSpecs.hMin) : '';
        const hMax = parsedSpecs ? formatSpecNumber(parsedSpecs.hMax) : '';
        const qRange = qMax ? `${qMax} m³/h` : 'Liên hệ';
        const hRange = hMax ? `${hMax} m` : 'Liên hệ';

        return (
          <div style={{ maxWidth: 1200, margin: '30px auto 80px', padding: '0 24px', boxSizing: 'border-box' }}>
            {/* Breadcrumb for Desktop */}
            <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 16, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }} className="desktop-only">
              <span style={{ color: '#64748B', cursor: 'pointer', transition: 'color 0.2s' }} onClick={goBackToCatalog} onMouseOver={e => e.currentTarget.style.color = '#0878D9'} onMouseOut={e => e.currentTarget.style.color = '#64748B'}>TRANG CHỦ</span>
              <span style={{ color: '#CBD5E1' }}>/</span>
              {currentProduct.group && (
                <>
                  <span style={{ color: '#0878D9', textTransform: 'uppercase', cursor: 'pointer' }} onClick={() => { setSelectedCategory(currentProduct.group); setViewMode('catalog'); setActiveTab('products'); }}>{currentProduct.group}</span>
                  <span style={{ color: '#CBD5E1' }}>/</span>
                </>
              )}
              <span style={{ color: '#082B4C', textTransform: 'uppercase' }}>{currentProduct.name}</span>
            </div>

            {/* Breadcrumb for Mobile */}
            <div style={{ display: 'none', borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 20, alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }} className="mobile-only-flex">
              <span style={{ color: '#64748B', cursor: 'pointer' }} onClick={goBackToCatalog}>← DANH SÁCH SẢN PHẨM</span>
            </div>

            {/* PRODUCT HERO (Two Columns: 50% / 50%) */}
            <div className="product-hero-container" style={{ marginBottom: 48 }}>
              
              {/* LEFT COLUMN: Large Product Image Gallery */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                  onClick={() => setShowLightbox(true)}
                  className="product-detail-img-wrap"
                  style={{ 
                    border: 'none', borderRadius: 16, background: '#F7F9FC', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', 
                    position: 'relative', cursor: 'zoom-in'
                  }}
                >
                  <img 
                    src={currentProduct.webImages?.[activeImageIndex] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=500&q=80'} 
                    alt={currentProduct.name} 
                    style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} 
                  />
                  <div style={{
                    position: 'absolute', bottom: 16, right: 16, background: 'rgba(11, 31, 58, 0.85)', color: '#FFFFFF',
                    padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                    backdropFilter: 'blur(4px)'
                  }}>
                    🔍 Xem rõ ảnh
                  </div>
                </div>
                
                {/* Thumbnails list */}
                {currentProduct.webImages && currentProduct.webImages.length > 1 && (
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
                    {currentProduct.webImages.map((url, idx) => (
                      <img 
                        key={idx} src={url} alt={`thumb-${idx}`} 
                        onClick={() => setActiveImageIndex(idx)}
                        style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, border: idx === activeImageIndex ? '2px solid #0878D9' : '1px solid #E2E8F0', background: '#FFFFFF', padding: 4, cursor: 'pointer', transition: 'all 0.2s' }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Product Information */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {currentProduct.group || 'MÁY BƠM NƯỚC'} / {currentProduct.webBrand || 'UPTI PUMP'}
                  </span>
                  {brandInfo.logo && <img src={brandInfo.logo} alt={brandInfo.name} style={{ height: 32, objectFit: 'contain' }} />}
                </div>

                <h1 style={{ fontSize: 'clamp(22px, 2.8vw, 30px)', fontWeight: 900, color: '#082B4C', textTransform: 'uppercase', margin: '0 0 8px 0', lineHeight: 1.2 }}>
                  {currentProduct.name}
                </h1>

                {currentProduct.code && (
                  <div style={{ fontSize: 13, color: '#475569', fontWeight: 750, fontFamily: 'monospace', marginBottom: 20 }}>
                    MODEL / PRODUCT CODE: <span style={{ color: '#0878D9' }}>{currentProduct.code}</span>
                  </div>
                )}

                {/* Short Value Proposition */}
                <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, marginBottom: 28, fontWeight: 500 }}>
                  {currentProduct.webDesc?.split('\n')?.[0] || 'Dòng sản phẩm máy bơm nước chất lượng cao, hoạt động bền bỉ, tiết kiệm năng lượng, phù hợp cho mọi công trình cấp thoát nước.'}
                </p>

                {/* KEY TECHNICAL DATA GRID (datasheet-style) */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12, padding: '20px 0',
                  borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', marginBottom: 28
                }}>
                  {pow && (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center' }}>CÔNG SUẤT</span>
                      <span style={{ fontSize: 14, color: '#1E293B', fontWeight: 800 }}>{pow}</span>
                    </>
                  )}
                  {volt && (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center' }}>ĐIỆN ÁP</span>
                      <span style={{ fontSize: 14, color: '#1E293B', fontWeight: 800 }}>{volt}</span>
                    </>
                  )}
                  {hRange && (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center' }}>CỘT ÁP MAX (HMAX)</span>
                      <span style={{ fontSize: 14, color: '#0878D9', fontWeight: 800 }}>{hRange}</span>
                    </>
                  )}
                  {qRange && (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center' }}>LƯU LƯỢNG MAX (QMAX)</span>
                      <span style={{ fontSize: 14, color: '#0878D9', fontWeight: 800 }}>{qRange}</span>
                    </>
                  )}
                  {(() => {
                    const isSubmersible = (currentProduct.group || '').toLowerCase().includes('chìm') || 
                                          (currentProduct.name || '').toLowerCase().includes('chìm') ||
                                          (currentProduct.group || '').toLowerCase().includes('giếng') ||
                                          (currentProduct.name || '').toLowerCase().includes('hỏa tiễn');
                    if (!isSubmersible) {
                      return (
                        <>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', letterSpacing: '0.8px', display: 'flex', alignItems: 'center' }}>HÚT SÂU TỐI ĐA</span>
                          <span style={{ fontSize: 14, color: '#10B981', fontWeight: 800 }}>Tối đa 8 m</span>
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* CONTACT / CTA BLOCK */}
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px',
                  boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16
                }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: '0.8px', textTransform: 'uppercase' }}>TƯ VẤN KỸ THUẬT & BÁO GIÁ</span>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#082B4C', marginTop: 4 }}>0984 273 806</div>
                  </div>

                  {/* Bullet points */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', fontSize: 13, fontWeight: 700, color: '#475569' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#0878D9' }}>✓</span> Hàng chính hãng</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#0878D9' }}>✓</span> CO/CQ đầy đủ</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#0878D9' }}>✓</span> Bảo hành 12 tháng</span>
                  </div>

                  {/* Add to Cart Primary Button */}
                  <button
                    onClick={() => handleAddToCart(currentProduct, 1)}
                    className="cta-btn"
                    style={{
                      background: '#10B981',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '14px 12px',
                      fontSize: 13,
                      fontWeight: 800,
                      borderRadius: 4,
                      cursor: 'pointer',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.15)'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#0d9488'}
                    onMouseOut={e => e.currentTarget.style.background = '#10B981'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    THÊM VÀO GIỎ HÀNG
                  </button>

                  {/* Zalo / Hotline CTA buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                    <button 
                      onClick={() => window.open(`https://zalo.me/0984273806?text=${encodeURIComponent('Chào bạn, tôi cần báo giá máy bơm: ' + currentProduct.name)}`, '_blank')}
                      className="cta-btn"
                      style={{ background: '#0878D9', color: '#FFFFFF', border: 'none', padding: '14px 12px', fontSize: 12.5, fontWeight: 800, borderRadius: 4, cursor: 'pointer', letterSpacing: '0.5px' }}
                    >
                      CHAT ZALO BÁO GIÁ
                    </button>
                    <a 
                      href="tel:0984273806"
                      className="cta-btn"
                      style={{ background: '#082B4C', color: '#FFFFFF', border: 'none', padding: '14px 12px', fontSize: 12.5, fontWeight: 800, borderRadius: 4, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.5px' }}
                    >
                      📞 GỌI NGAY HỖ TRỢ
                    </a>
                  </div>
                </div>

              </div>

            </div>

            {/* DESCRIPTION & TABS */}
            <div style={{ marginBottom: 48 }}>
              {/* Tab Header */}
              <div style={{ display: 'flex', borderBottom: '1px solid #EEF1F4', gap: 24, marginBottom: 24 }}>
                {[
                  { key: 'desc', label: 'MÔ TẢ SẢN PHẨM' },
                  { key: 'specs', label: 'THÔNG SỐ KỸ THUẬT' },
                  { key: 'doc', label: 'TÀI LIỆU & CHỨNG CHỈ (CO/CQ)' }
                ].map(tab => (
                  <span
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: detailTab === tab.key ? '#0878D9' : '#667085',
                      paddingBottom: 12,
                      borderBottom: detailTab === tab.key ? '2px solid #0878D9' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {tab.label}
                  </span>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F4', borderRadius: 6, padding: '32px', boxSizing: 'border-box' }}>
                {detailTab === 'desc' && (
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: '#667085' }}>
                    <p style={{ whiteSpace: 'pre-wrap', marginBottom: 28, fontWeight: 500 }}>
                      {currentProduct.webDesc || `Là dòng sản phẩm mũi nhọn nhập khẩu, các sản phẩm máy bơm của thương hiệu ${currentProduct.webBrand || 'T&T'} được chế tạo với độ chính xác cơ khí cực cao, đảm bảo hiệu suất làm việc bền bỉ trong môi trường khắc nghiệt.\n\nSản phẩm sở hữu ưu điểm vượt trội về hiệu năng thủy lực, tiết kiệm điện năng tiêu thụ, giảm thiểu tiếng ồn và đặc biệt dễ dàng lắp đặt, bảo dưỡng định kỳ.`}
                    </p>
                    
                    <h4 style={{ color: '#071A2F', fontWeight: 800, fontSize: 14, marginBottom: 12, borderBottom: '1px solid #EEF1F4', paddingBottom: 8, textTransform: 'uppercase' }}>⚙️ ƯU ĐIỂM CẤU TẠO NỔI BẬT</h4>
                    <ul style={{ paddingLeft: 20, marginBottom: 28, fontWeight: 500 }}>
                      <li style={{ marginBottom: 8 }}>Chất liệu thân bơm và cánh bơm chế tạo từ vật liệu chống ăn mòn (Inox/Gang đúc chất lượng cao).</li>
                      <li style={{ marginBottom: 8 }}>Động cơ quấn dây đồng 100%, tích hợp cảm biến nhiệt tự ngắt bảo vệ khi quá tải.</li>
                      <li style={{ marginBottom: 8 }}>Trục bơm bằng thép không gỉ cường độ cao, phớt cơ khí chống thấm nước tuyệt đối.</li>
                      <li style={{ marginBottom: 8 }}>Đạt tiêu chuẩn lớp cách điện F và tiêu chuẩn chống bụi/nước IP68/IP55 quốc tế.</li>
                    </ul>

                    <h4 style={{ color: '#071A2F', fontWeight: 800, fontSize: 14, marginBottom: 12, borderBottom: '1px solid #EEF1F4', paddingBottom: 8, textTransform: 'uppercase' }}>💧 ỨNG DỤNG THỰC TẾ TIÊU BIỂU</h4>
                    <ul style={{ paddingLeft: 20, margin: 0, fontWeight: 500 }}>
                      <li style={{ marginBottom: 8 }}>Bơm cấp nước sạch sinh hoạt gia đình, tòa nhà chung cư cao tầng, khách sạn.</li>
                      <li style={{ marginBottom: 8 }}>Sử dụng trong nông nghiệp: tưới tiêu tự động vườn cây, cấp thoát nước ao hồ thủy sản.</li>
                      <li style={{ marginBottom: 8 }}>Sử dụng trong công nghiệp: hệ thống làm mát tuần hoàn, trạm cứu hỏa PCCC, xử lý nước thải công nghiệp.</li>
                    </ul>
                  </div>
                )}

                {detailTab === 'specs' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', color: '#101828' }}>
                      <tbody>
                        {[
                          { label: 'Thương hiệu', val: currentProduct.webBrand || 'T&T' },
                          { label: 'Model', val: currentProduct.code || 'Liên hệ' },
                          { label: 'Loại sản phẩm', val: currentProduct.group || 'Máy bơm nước' },
                          { label: 'Công suất', val: pow || 'Liên hệ' },
                          { label: 'Điện áp', val: volt || 'Liên hệ' },
                          { label: 'Cột áp tối đa (Hmax)', val: hRange || 'Liên hệ' },
                          { label: 'Lưu lượng tối đa (Qmax)', val: qRange || 'Liên hệ' },
                          ...((() => {
                            const isSub = (currentProduct.group || '').toLowerCase().includes('chìm') || 
                                          (currentProduct.name || '').toLowerCase().includes('chìm') ||
                                          (currentProduct.group || '').toLowerCase().includes('giếng') ||
                                          (currentProduct.name || '').toLowerCase().includes('hỏa tiễn');
                            return !isSub ? [{ label: 'Khả năng hút sâu', val: 'Tối đa 8 mét (Bơm đặt cạn)' }] : [];
                          })()),
                          { label: 'Chứng chỉ đi kèm', val: 'CO/CQ đầy đủ' },
                          { label: 'Xuất xứ', val: 'Chính hãng 100%' }
                        ].map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #EEF1F4' }}>
                            <td style={{ padding: '12px 16px', background: '#F5F7FA', width: '220px', fontWeight: 700, color: '#667085' }}>{row.label}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {detailTab === 'doc' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#F5F7FA', borderLeft: '4px solid #0878D9', padding: '16px', borderRadius: 4 }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 800, color: '#071A2F' }}>HỒ SƠ THẦU &amp; CHỨNG CHỈ CO/CQ</h4>
                      <p style={{ margin: 0, fontSize: 13, color: '#667085', lineHeight: 1.5, fontWeight: 500 }}>
                        Tất cả sản phẩm thương hiệu UPTI PUMP, SELANNI, BERATI, MASTRA cung cấp bởi T&amp;T đều có đầy đủ chứng chỉ nhập khẩu chính hãng (CO/CQ), giấy bảo hành và bản vẽ kỹ thuật chi tiết phục vụ thiết kế cơ điện.
                      </p>
                    </div>
                    <p style={{ fontSize: 13, color: '#667085', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                      Liên hệ phòng dự án để nhận tài liệu file mềm (Bản vẽ CAD, Datasheet chi tiết và Hướng dẫn lắp đặt vận hành).
                    </p>
                    <div style={{ marginTop: 8 }}>
                      <a href="tel:0984273806" style={{ textDecoration: 'none', background: '#0878D9', color: '#FFFFFF', padding: '10px 20px', fontSize: 12.5, fontWeight: 800, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        📞 Yêu cầu hồ sơ kỹ thuật
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RELATED PRODUCTS */}
            <div style={{ marginTop: 60 }}>
              <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 28 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0878D9', textTransform: 'uppercase', letterSpacing: '1px' }}>Sản phẩm cùng loại</span>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#082B4C', margin: '4px 0 0' }}>SẢN PHẨM LIÊN QUAN</h3>
              </div>
              
                            <div className="catalog-grid">
                {products
                  .filter(p => p.showOnWeb && p.id !== currentProduct.id && (p.group === currentProduct.group || p.webBrand === currentProduct.webBrand))
                  .slice(0, 4)
                  .map(p => renderProductCard(p))}
              </div>
            </div>
          </div>
        );
      })()}

{/* TRANG CHÌNH SÁCH ĐỔI TRẢ BẢO HÀNH */}
      {viewMode === 'policy' && (
        <div style={{ maxWidth: 1200, margin: '40px auto 80px', padding: '0 24px' }}>
          {/* Breadcrumb */}
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 30, fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => window.location.hash = '#web'}>TRANG CHỦ</span>
            <span style={{ color: '#cbd5e1', margin: '0 8px' }}>/</span>
            <span style={{ color: '#1e293b' }}>CHÍNH SÁCH ĐỔI TRẢ & BẢO HÀNH</span>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '48px 40px', boxShadow: '0 10px 25px rgba(0,0,0,0.01)' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1e293b', borderBottom: '3px solid #3b82f6', paddingBottom: 16, marginBottom: 32, textTransform: 'uppercase', textAlign: 'center' }}>
              Chính sách đổi trả & bảo hành
            </h1>

            <p style={{ fontSize: 15, fontWeight: 600, color: '#334155', lineHeight: 1.6, marginBottom: 32, textAlign: 'center', background: '#f8fafc', padding: '16px 24px', borderRadius: 12 }}>
              Công Ty TNHH TM Máy Công Nghiệp T&T cam kết mang tới cho quý khách hàng các sản phẩm chính hãng chất lượng cao cùng chính sách bảo hành, đổi trả minh bạch và chu đáo nhất.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
              {/* Cột trái: Đổi trả */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6', borderBottom: '2px solid #e2e8f0', paddingBottom: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🔄</span> CHÍNH SÁCH ĐỔI TRẢ
                </h3>
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 12 }}>
                  Chúng tôi chấp nhận đổi trả hàng hóa trong những trường hợp sau đây:
                </p>
                <ul style={{ paddingLeft: 20, fontSize: 14, color: '#1e293b', lineHeight: 1.8, marginBottom: 20 }}>
                  <li style={{ marginBottom: 8 }}><strong>Hàng giả, hàng nhái:</strong> Đền bù và đổi trả ngay lập tức.</li>
                  <li style={{ marginBottom: 8 }}><strong>Hàng hư hỏng:</strong> Phát sinh trong quá trình vận chuyển đến tay khách hàng.</li>
                  <li style={{ marginBottom: 8 }}><strong>Hàng sai yêu cầu:</strong> Gửi sai model, sai thông số hoặc gửi nhầm sản phẩm.</li>
                </ul>

                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 10, marginBottom: 16, marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📦</span> LÀM SAO ĐỂ ĐỔI TRẢ HÀNG HÓA?
                </h3>
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
                  <p style={{ marginBottom: 12 }}>
                    <strong>Bước 1:</strong> Gọi ngay số điện thoại hỗ trợ: <a href="tel:0963758034" style={{ color: '#ef4444', fontWeight: 700, textDecoration: 'none' }}>0963.758.034</a> và cho chúng tôi biết lý do cần đổi/trả sản phẩm.
                  </p>
                  <p style={{ marginBottom: 12 }}>
                    <strong>Bước 2:</strong> Sau khi công ty xác nhận phù hợp với quy định, quý vị gửi hàng về địa chỉ văn phòng:
                  </p>
                  <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: 12, borderRadius: 8, fontSize: 13, color: '#1e293b', fontWeight: 600, marginBottom: 12 }}>
                    📍 LK 27,28 KĐT Dương Nội, (Cạnh nhà máy SYM) Hà Đông, Hà Nội<br />
                    📞 SĐT: 0984.273.806 – Mr Tuấn
                  </div>
                  <p style={{ margin: 0 }}>
                    <strong>Bước 3:</strong> Ngay sau khi nhận và kiểm tra hàng cần đổi, chúng tôi sẽ liên hệ khách hàng để gửi lại sản phẩm mới hoả tốc.
                  </p>
                </div>
              </div>

              {/* Cột phải: Bảo hành */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6', borderBottom: '2px solid #e2e8f0', paddingBottom: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🛡️</span> QUY ĐỊNH BẢO HÀNH
                </h3>
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 12 }}>
                  Tất cả các sản phẩm do công ty cung cấp đều được bảo hành chính hãng theo quy định của nhà sản xuất (Thời gian bảo hành chi tiết ghi tại từng sản phẩm).
                </p>
                <ul style={{ paddingLeft: 20, fontSize: 14, color: '#1e293b', lineHeight: 1.8, marginBottom: 20 }}>
                  <li style={{ marginBottom: 8 }}>Máy móc thiết bị phải còn trong thời hạn bảo hành (Căn cứ vào thẻ bảo hành hoặc phiếu mua hàng).</li>
                  <li style={{ marginBottom: 8 }}>Sản phẩm phát sinh hư hỏng về kỹ thuật do lỗi trực tiếp từ nhà sản xuất.</li>
                  <li style={{ marginBottom: 8 }}>Hỗ trợ sửa chữa và thay thế phụ tùng hoàn toàn miễn phí trong suốt thời gian bảo hành.</li>
                </ul>

                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#ef4444', borderBottom: '2px solid #e2e8f0', paddingBottom: 10, marginBottom: 16, marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚠️</span> TRƯỜNG HỢP KHÔNG ĐƯỢC BẢO HÀNH
                </h3>
                <ul style={{ paddingLeft: 20, fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0 }}>
                  <li style={{ marginBottom: 6 }}>Hư hỏng do sử dụng sai mục đích thiết kế, sử dụng sai quy cách kỹ thuật.</li>
                  <li style={{ marginBottom: 6 }}>Sử dụng hoặc thực hiện lắp đặt không đúng theo tài liệu hướng dẫn kèm theo máy.</li>
                  <li style={{ marginBottom: 6 }}>Tự ý can thiệp cấu trúc, tháo dỡ hoặc tự thay đổi cơ cấu hoạt động của máy bơm.</li>
                  <li style={{ marginBottom: 6 }}>Hao mòn tự nhiên trong quá trình vận hành lâu ngày.</li>
                  <li style={{ marginBottom: 6 }}>Hư hỏng do sự cố chập cháy điện, quá tải điện áp nguồn.</li>
                  <li style={{ marginBottom: 6 }}>Hư hỏng do thiên tai, sập lún, lụt lội, sấm sét đánh trúng, ẩm ướt hoặc hóa chất ăn mòn,...</li>
                </ul>
              </div>
            </div>

            {/* Social connection area / Facebook Fanpage Link */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: 16,
              padding: '24px 30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
              marginTop: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 32 }}>👥</span>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', margin: '0 0 4px 0' }}>Kết nối với chúng tôi qua Facebook</h4>
                  <p style={{ fontSize: 13, color: '#60a5fa', fontWeight: 600, margin: 0 }}>Theo dõi Fanpage để cập nhật mẫu bơm mới và báo giá ưu đãi nhanh nhất</p>
                </div>
              </div>
              <a 
                href="https://www.facebook.com/profile.php?id=61578469481516" 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1877f2', color: '#fff',
                  textDecoration: 'none', padding: '12px 24px', borderRadius: 99, fontSize: 13, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(24,119,242,0.3)', transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}
              >
                <span>👍</span> Fanpage Facebook T&T
              </a>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ background: '#071A2F', color: '#94A3B8', padding: '60px 24px 30px', borderTop: '1px solid #0B2742' }} id="footer-section">
        <div style={{ maxWidth: 1200, margin: '0 auto 40px', display: 'grid', gridTemplateColumns: '1.2fr repeat(3, 1fr)', gap: 40 }} className="intro-grid">
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', marginBottom: 20 }}>CÔNG TY</h4>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', margin: '0 0 10px 0' }}>Công ty TNHH Máy Bơm T&T</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
              Địa chỉ: LK 180 – NO04 Khu 27 – 28 Dương Nội – Hà Đông – Hà Nội
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', marginBottom: 20 }}>SẢN PHẨM</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['Bơm ly tâm', 'Bơm chìm', 'Bơm hỏa tiễn', 'Bơm trục đứng', 'Bơm công nghiệp'].map((item, idx) => (
                <li key={idx} style={{ marginBottom: 10 }}>
                  <span
                    onClick={() => {
                      const matched = dbCategories.find(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes(item.toLowerCase()));
                      setSelectedCategory(matched ? (typeof matched === 'string' ? matched : matched.name) : 'TẤT CẢ');
                      setViewMode('catalog');
                      setActiveTab('products');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ fontSize: 12.5, cursor: 'pointer', color: '#94A3B8' }}
                    onMouseOver={e => e.currentTarget.style.color = '#FFFFFF'}
                    onMouseOut={e => e.currentTarget.style.color = '#94A3B8'}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', marginBottom: 20 }}>HỖ TRỢ</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['Tư vấn AI', 'Báo giá', 'Bảo hành', 'Đổi trả'].map((item, idx) => (
                <li key={idx} style={{ marginBottom: 10 }}>
                  <span
                    onClick={() => {
                      if (item === 'Tư vấn AI') {
                        setShowFloatingChat(true);
                      } else if (item === 'Bảo hành' || item === 'Đổi trả') {
                        setViewMode('policy');
                        setActiveTab('policy');
                      } else {
                        setShowCartDrawer(true);
                      }
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ fontSize: 12.5, cursor: 'pointer', color: '#94A3B8' }}
                    onMouseOver={e => e.currentTarget.style.color = '#FFFFFF'}
                    onMouseOut={e => e.currentTarget.style.color = '#94A3B8'}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', marginBottom: 20 }}>LIÊN HỆ</h4>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
              Hotline: <strong style={{ color: '#FFFFFF' }}>0984 273 806</strong><br />
              Website: <a href="https://maybomnuocnhapkhautt.com" target="_blank" rel="noreferrer" style={{ color: '#94A3B8', textDecoration: 'none' }} onMouseOver={e => e.currentTarget.style.color = '#FFFFFF'} onMouseOut={e => e.currentTarget.style.color = '#94A3B8'}>maybomnuocnhapkhautt.com</a>
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: '#667085', borderTop: '1px solid #1A2E44', paddingTop: 24 }}>
          Copyright © 2026 maybomnuocnhapkhautt.com. All rights reserved.
        </div>
      </footer>

      {/* FLOATING ACTION BUTTONS (Desktop side list, Mobile sticky bottom bar) */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-thin-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-thin-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-thin-scrollbar::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
          border-radius: 3px;
        }
        .custom-thin-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94A3B8;
        }
        .desktop-floating-actions {
          position: fixed;
          bottom: 90px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 9999;
        }
        .desktop-floating-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.25s ease;
          position: relative;
        }
        .desktop-floating-btn:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }
        .mobile-bottom-bar {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #FFFFFF;
          border-top: 1px solid #E2E8F0;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
          z-index: 9999;
          padding: 8px 16px;
          box-sizing: border-box;
          gap: 12px;
        }
        .menu-option-item:hover {
          background: #F1F5F9;
        }
        .menu-option-item:active {
          background: #E2E8F0;
        }
        @keyframes slideUpContact {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .tt-trust-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 16px !important;
        }
        .tt-trust-col {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .tt-trust-col:not(:first-child) {
          border-left: 1px solid #E2E8F0;
          padding-left: 20px;
        }
        .category-cover-card {
          transition: all 0.2s ease-in-out;
        }
        .category-cover-card:hover {
          transform: translateY(-2px) !important;
          border-color: #0878D9 !important;
          box-shadow: 0 6px 18px rgba(8, 120, 217, 0.08) !important;
        }
        @media (max-width: 992px) {
          .hero-editorial-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
            padding: 20px 16px !important;
          }
        }
        .hero-trust-strip {
          display: flex !important;
          justify-content: space-between !important;
          flex-wrap: wrap !important;
          gap: 20px !important;
          align-items: center !important;
        }
        @media (max-width: 768px) {
          .hero-trust-strip {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .trust-divider {
            display: none !important;
          }
        }

        .usp-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 16px !important;
        }

        /* Responsive Product Catalog grid layout rules */
        .catalog-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 18px !important;
          margin-bottom: 32px !important;
        }
        
        @media (max-width: 1199px) {
          .catalog-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 14px !important;
          }
        }
        @media (max-width: 768px) {
          .catalog-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
        }

        /* Unified Product Card Style */
        .product-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 14px 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
          height: 100%;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 3px rgba(15,23,42,0.015), 0 2px 8px rgba(15,23,42,0.01);
        }
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.02);
          border-color: #0878D9;
        }
        
        .product-card-image {
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #F8FAFC;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          cursor: pointer;
        }
        .product-card-image img {
          max-height: 190px;
          max-width: 100%;
          object-fit: contain;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .product-card:hover .bg-image-zoom {
          transform: scale(1.05);
        }
        
        .product-card-content {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          padding-top: 12px;
        }
        
        .product-card-brand {
          font-size: 11px;
          font-weight: 700;
          color: #0878D9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
          display: block;
        }
        
        .product-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.35;
          margin: 4px 0 2px 0;
          cursor: pointer;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 38px;
          transition: color 0.2s;
        }
        .product-card-title:hover {
          color: #0878D9;
        }
        
        .product-card-model {
          font-size: 12px;
          font-weight: 500;
          color: #64748B;
          margin: 0 0 10px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .product-card-specs {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: 8px 0 14px 0;
          border-top: 1px dashed #E2E8F0;
          padding-top: 10px;
        }
        .product-card-specs .spec-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }
        .product-card-specs .spec-label {
          color: #475569;
          font-weight: 500;
        }
        .product-card-specs .spec-value {
          font-weight: 700;
          color: #0F172A;
          white-space: nowrap;
        }
        
        .product-card-actions {
          display: flex;
          gap: 6px;
          margin-top: auto;
          border-top: 1px solid #F1F5F9;
          padding-top: 10px;
        }
        .product-card-actions .product-card-btn {
          flex: 1;
          height: 36px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .product-card-actions .brand-btn {
          background: #FFFFFF;
          border: 1px solid #0878D9;
          color: #0878D9;
        }
        .product-card-actions .brand-btn:hover {
          background: #EAF3FF;
        }
        .product-card-actions .cta-btn {
          background: #0878D9;
          border: none;
          color: #FFFFFF;
        }
        .product-card-actions .cta-btn:hover {
          background: #0766B8;
        }
        
        .quick-view-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 35, 63, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.25s;
          z-index: 3;
        }
        .product-card-image:hover .quick-view-overlay {
          opacity: 1;
        }
        .quick-view-overlay span {
          background: #FFFFFF;
          color: #082B4C;
          padding: 6px 14px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        /* Brand logo card grayscale overrides */
        .brand-logo-card img {
          filter: grayscale(100%);
          opacity: 0.85;
          transition: all 0.25s ease;
        }
        .brand-logo-card:hover img, .brand-logo-card:active img {
          filter: grayscale(0%);
          opacity: 1;
        }

        /* Category Header Styles */
        .category-section {
          margin-bottom: 36px;
        }
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 8px;
          margin-bottom: 16px;
        }
        .category-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .category-title {
          font-size: 15px;
          font-weight: 800;
          color: #082B4C;
          text-transform: uppercase;
          margin: 0;
          line-height: 1.2;
        }
        .category-subtitle {
          font-size: 12px;
          color: #64748B;
          font-weight: 500;
        }
        .category-view-all {
          font-size: 12.5px;
          font-weight: 800;
          color: #0878D9;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: color 0.2s;
        }
        .category-view-all:hover {
          color: #0766B8;
        }

        /* Utility visibility classes */
        @media (min-width: 769px) {
          .mobile-only, .mobile-only-flex {
            display: none !important;
          }
        }

        /* ── MOBILE SPECIFIC STYLES (<= 768px ONLY) ── */
        @media (max-width: 768px) {
          .desktop-only, .desktop-only-flex {
            display: none !important;
          }
          .mobile-only {
            display: block !important;
          }
          .mobile-only-flex {
            display: flex !important;
          }
          
          .catalog-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
            padding: 0 12px !important;
            box-sizing: border-box !important;
          }
          .product-card {
            display: flex !important;
            flex-direction: column !important;
            padding: 10px !important;
            border-radius: 14px !important;
            background: #FFFFFF !important;
            border: 1px solid #EEF1F4 !important;
            box-shadow: 0 2px 8px rgba(15,23,42,0.03) !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
          .product-card-image {
            width: 100% !important;
            aspect-ratio: 1 / 1 !important;
            max-height: 140px !important;
            padding: 8px !important;
            background: #F8FAFC !important;
            border-radius: 10px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .product-card-image img {
            width: 100% !important;
            height: 100% !important;
            max-height: 130px !important;
            object-fit: contain !important;
          }
          .product-card-content {
            padding-top: 8px !important;
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
          }
          .product-card-title {
            font-size: 13px !important;
            min-height: 34px !important;
            line-height: 1.3 !important;
            line-clamp: 2 !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            margin: 2px 0 4px !important;
            font-weight: 800 !important;
            color: #0F172A !important;
          }
          .product-card-model {
            font-size: 11px !important;
            color: #64748B !important;
            margin-bottom: 4px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .product-card-specs {
            margin: 4px 0 8px 0 !important;
            padding-top: 4px !important;
            gap: 2px !important;
            border-top: 1px dashed #E2E8F0 !important;
          }
          .product-card-specs .spec-row {
            font-size: 11px !important;
          }
          .product-card-actions {
            padding-top: 6px !important;
            gap: 6px !important;
            margin-top: auto !important;
          }
          .product-card-actions .product-card-btn {
            height: 36px !important;
            font-size: 11.5px !important;
            border-radius: 8px !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            min-width: 0 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          
          /* Enforce mobile header layout grid override to flex */
          header {
            height: 64px !important;
          }
          header > div {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 0 16px !important;
          }
          header img {
            width: 52px !important;
            height: auto !important;
          }
          .header-menu-btn {
            width: 44px !important;
            height: 44px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            font-size: 24px !important;
            order: 2 !important;
          }

          /* Hide stats on mobile hero homepage */
          .hero-stats {
            display: none !important;
          }

          /* Footer stack columns on mobile to avoid word wrapping */
          .intro-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          
          /* Enforce mobile inner paddings and section spacing */
          section > div {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
          section:not(.mobile-only-flex) {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding-top: 40px !important;
            padding-bottom: 40px !important;
          }
          
          /* Pump Categories Grid homepage override to 2-columns on mobile */
          .pump-categories-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
          .pump-categories-grid > div {
            padding: 12px 10px !important;
            min-height: 140px !important;
            height: 140px !important;
          }
          .pump-categories-grid h3 {
            font-size: 11.5px !important;
          }
          
          /* Brand logo grid homepage override to 2-columns on mobile */
          .brand-logos-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
          .brand-logo-card {
            height: 90px !important;
          }
          .brand-logo-card img:not(.logo-selanni) {
            height: 30px !important;
          }
          .brand-logo-card img.logo-selanni {
            height: 48px !important;
          }

          /* Compact 2 columns for USP grid on mobile */
          .usp-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
          .usp-grid > div {
            height: 120px !important;
            padding: 12px 8px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            box-sizing: border-box !important;
          }

          /* Hide desktop sidebar filters and format catalog layout container */
          .desktop-filters {
            display: none !important;
          }
          .catalog-layout-container {
            display: block !important;
          }
          .catalog-layout-container > div {
            width: 100% !important;
          }

          /* Mobile Sticky Filters Bar below header */
          .mobile-control-bar {
            display: grid !important;
            position: sticky !important;
            top: 64px !important;
            z-index: 100 !important;
            background: #FFFFFF !important;
            padding: 6px 12px !important;
            margin: 0 -12px 8px -12px !important;
            border-bottom: 1px solid #E2E8F0 !important;
            box-sizing: border-box !important;
          }

          /* Catalog container mobile rules */
          .catalog-container {
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-top: 12px !important;
          }
          
          /* active chips scroll container */
          .mobile-only-flex.active-chips-scroll {
            display: flex !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            padding: 8px 0 !important;
            margin-bottom: 12px !important;
            gap: 8px !important;
          }
          .mobile-only-flex.active-chips-scroll::-webkit-scrollbar {
            display: none !important;
          }
          
          /* Mobile typography overrides */
          h1 {
            font-size: 26px !important;
          }
          h2 {
            font-size: 20px !important;
          }
          .cat-section-container h3 {
            font-size: 18px !important;
          }

          /* Mobile Category Headers & Spacing */
          .category-section {
            margin-bottom: 32px !important;
          }
          .category-header {
            align-items: center !important;
            padding-bottom: 8px !important;
            margin-top: 24px !important;
            margin-bottom: 12px !important;
            margin-left: 12px !important;
            margin-right: 12px !important;
            border-bottom: 1px solid #E2E8F0 !important;
          }
          .category-header-single {
            margin-left: 12px !important;
            margin-right: 12px !important;
            margin-top: 12px !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
            border-bottom: 1px solid #E2E8F0 !important;
          }
          .category-title {
            font-size: 22px !important;
            font-weight: 850 !important;
            line-height: 1.25 !important;
            max-width: 210px !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
          }
          .category-subtitle {
            font-size: 13px !important;
            color: #64748B !important;
            font-weight: 550 !important;
            margin-top: 4px !important;
            display: block !important;
          }
          .category-view-all {
            font-size: 14px !important;
            font-weight: 800 !important;
            color: #0878D9 !important;
            white-space: nowrap !important;
          }
          .category-view-all svg {
            display: none !important;
          }
          .category-view-all::after {
            content: " →" !important;
            display: inline !important;
          }

          /* Hide scrollbars on horizontal carousels */
          .mobile-only-flex::-webkit-scrollbar {
            display: none !important;
          }
          
          /* Floating actions position adjustment near bottom on mobile (no bottom bar) */
          .desktop-floating-actions {
            bottom: 24px !important;
            right: 16px !important;
            gap: 8px !important;
            display: flex !important;
          }
          .desktop-floating-btn {
            width: 44px !important;
            height: 44px !important;
          }
          .ai-invite-bubble {
            right: 16px !important;
            bottom: 230px !important;
            max-width: calc(100vw - 32px) !important;
          }
          
          /* Hide Mobile Bottom Sticky Bar Completely */
          .mobile-bottom-bar {
            display: none !important;
          }
          body {
            padding-bottom: 0 !important;
          }

          /* Homepage hero mobile: stack panels elegantly */
          .homepage-hero-section {
            padding: 0 !important;
            min-height: auto !important;
          }
          .hero-split-row {
            flex-direction: column !important;
            padding: 32px 18px 28px !important;
            gap: 20px !important;
            min-height: unset !important;
          }
          .hero-split-row > div:first-child {
            padding: 0 !important;
            flex: unset !important;
            width: 100% !important;
          }
          .hero-split-row > div:last-child {
            min-height: 280px !important;
            width: 100% !important;
            flex: unset !important;
          }
          .hero-split-row > div:last-child img {
            max-height: 270px !important;
          }

          /* Product detail mobile page layout improvements */
          .product-detail-img-wrap {
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            aspect-ratio: 1 / 1 !important;
            padding: 12px !important;
          }
          .product-detail-img-wrap img {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
          }

          /* Bottom Sheet Mobile Filters Panel */
          .mobile-filters-drawer-overlay {
            justify-content: center !important;
            align-items: flex-end !important;
          }
          .mobile-filters-drawer-panel {
            width: 100% !important;
            height: 85vh !important;
            margin-top: auto !important;
            border-radius: 20px 20px 0 0 !important;
            box-shadow: 0 -8px 32px rgba(15,23,42,0.12) !important;
          }

          .category-strip-wrapper {
            justify-content: flex-start !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          /* Brands Showcase mobile styling (1-column clean card) */
          .brand-editorial-row {
            display: flex !important;
            flex-direction: column !important;
            padding: 24px 18px !important;
            gap: 18px !important;
            border-radius: 12px !important;
          }
          .brand-editorial-row > div:first-child {
            border-right: none !important;
            border-bottom: 1px solid #F1F5F9 !important;
            padding-right: 0 !important;
            padding-bottom: 18px !important;
            width: 100% !important;
            align-items: center !important;
            text-align: center !important;
          }
          .brand-editorial-row > div:last-child {
            width: 100% !important;
          }
          .brand-editorial-row h2 {
            font-size: 19px !important;
            line-height: 1.3 !important;
          }
          .brand-editorial-row p {
            font-size: 13.5px !important;
            line-height: 1.6 !important;
          }
          .brand-editorial-row button {
            width: 100% !important;
            text-align: center !important;
            padding: 12px 16px !important;
            font-size: 12.5px !important;
          }

          /* About Page mobile layout */
          .hero-editorial-grid {
            grid-template-columns: 1fr !important;
            padding: 20px 16px !important;
            gap: 24px !important;
          }
          .tt-trust-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 24px 16px !important;
            gap: 20px !important;
          }
        }

        /* Tablet responsive hero */
        @media (min-width: 769px) and (max-width: 1024px) {
          .hero-split-row {
            padding: 36px 24px !important;
            gap: 20px !important;
          }
          .hero-split-row > div:first-child h1 {
            font-size: 34px !important;
          }
          .hero-split-row > div:last-child img {
            max-height: 380px !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-only, .mobile-only-flex {
            display: none !important;
          }
        }
        
        .product-hero-container {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 48px !important;
        }
        @media (max-width: 900px) {
          .product-hero-container {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }

        .product-detail-img-wrap {
          min-height: 480px !important;
          height: 480px !important;
        }
        @media (max-width: 768px) {
          .product-detail-img-wrap {
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            aspect-ratio: 1 / 1 !important;
            padding: 12px !important;
          }
          .product-detail-img-wrap img {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
          }
        }
        
        /* Responsive Header Adjustments */
        @media (min-width: 769px) and (max-width: 1024px) {
          .header-nav {
            gap: 16px !important;
          }
        }
        @media (max-width: 768px) {
          .header-nav {
            display: none !important;
          }
          .header-actions {
            display: none !important;
          }
          .header-menu-btn {
            display: flex !important;
          }
        }
        
        @keyframes slideDownNav {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .category-strip-wrapper {
          display: flex !important;
          flex-direction: row !important;
          justify-content: center !important;
        }
        @media (max-width: 768px) {
          .category-strip-wrapper {
            justify-content: flex-start !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
        }
`}} />

      {/* AI Invite Popup Bubble (Shown ~10s after visit, once per session) */}
      {showAiInvite && !showFloatingChat && (
        <div className="ai-invite-bubble" style={{
          position: 'fixed',
          bottom: 100,
          right: 76,
          maxWidth: 320,
          background: '#FFFFFF',
          borderRadius: 12,
          padding: '14px 16px',
          boxShadow: '0 10px 30px rgba(7,26,47,0.18)',
          border: '1px solid #E2E8F0',
          zIndex: 9998,
          animation: 'slideUpContact 0.35s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
              border: '1px solid #DBEAFE'
            }}>
              🤖
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#071A2F', marginBottom: 3 }}>
                Trợ lý AI T&amp;T Pump
              </div>
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                👋 Chào bạn! Bạn cần tư vấn chọn máy bơm phù hợp cho công trình hay gia đình?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowAiInvite(false);
                    setShowFloatingChat(true);
                  }}
                  style={{
                    background: '#0878D9', color: '#FFFFFF', border: 'none',
                    padding: '6px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 800,
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(8,120,217,0.25)'
                  }}
                >
                  TƯ VẤN NGAY
                </button>
                <button
                  onClick={() => {
                    setShowAiInvite(false);
                    localStorage.setItem('tt_ai_chat_closed', 'true');
                  }}
                  style={{
                    background: '#F1F5F9', color: '#64748B', border: 'none',
                    padding: '6px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Để sau
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAiInvite(false);
                localStorage.setItem('tt_ai_chat_closed', 'true');
              }}
              style={{
                background: 'transparent', border: 'none', color: '#94A3B8',
                fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1,
              }}
              aria-label="Đóng lời mời tư vấn"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Fixed Floating Circular Actions (GIỎ HÀNG, ZALO, FACEBOOK, HOTLINE) */}
      <div className="desktop-floating-actions">
        
        {/* 1. GIỎ HÀNG / BÁO GIÁ */}
        <div 
          onClick={() => setShowCartDrawer(true)}
          className="desktop-floating-btn"
          style={{ background: '#0878D9', border: '1px solid rgba(255,255,255,0.15)', position: 'relative' }}
          title="Giỏ hàng / Yêu cầu báo giá"
          aria-label="Giỏ hàng"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          {cart && cart.length > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4, background: '#E11D48', color: '#FFF',
              borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}>
              {cart.length}
            </span>
          )}
        </div>

        {/* 2. ZALO */}
        <div 
          onClick={() => window.open('https://zalo.me/0984273806', '_blank')}
          className="desktop-floating-btn"
          style={{ background: '#0068FF', border: '1px solid rgba(255,255,255,0.15)' }}
          title="Nhắn Zalo Báo Giá (0984 273 806)"
          aria-label="Nhắn Zalo"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 5.58 2 10C2 12.3 3.16 14.36 5 15.78V19.5C5 19.78 5.22 20 5.5 20C5.62 20 5.74 19.96 5.84 19.88L9.2 17.64C10.1 17.88 11.04 18 12 18C17.52 18 22 14.42 22 10C22 5.58 17.52 2 12 2Z" fill="#FFFFFF"/>
            <text x="12" y="13.5" fontSize="8" fontWeight="900" fill="#0068FF" textAnchor="middle" fontFamily="'Inter', sans-serif">Zalo</text>
          </svg>
        </div>

        {/* 3. FACEBOOK FANPAGE */}
        <div 
          onClick={() => window.open('https://www.facebook.com/profile.php?id=61578469481516', '_blank')}
          className="desktop-floating-btn"
          style={{ background: '#1877F2', border: '1px solid rgba(255,255,255,0.15)' }}
          title="Facebook Fanpage T&T Pump"
          aria-label="Facebook Fanpage"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>

        {/* 4. GỌI HOTLINE */}
        <div 
          onClick={() => window.open('tel:0984273806')}
          className="desktop-floating-btn"
          style={{ background: '#071A2F', border: '1px solid rgba(255,255,255,0.15)' }}
          title="Gọi Hotline 0984 273 806"
          aria-label="Gọi Hotline"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>

      </div>

      {/* Floating AI Chat Assistant */}
      {showFloatingChat && (
        <div className="ai-chat-widget">
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #3b82f6 100%)',
            color: '#fff', padding: '16px 20px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trợ lý chọn bơm AI</h4>
                <div style={{ fontSize: 9, opacity: 0.9, fontWeight: 600 }}>Tự động tư vấn thông số 24/7</div>
              </div>
            </div>
            <button 
              onClick={() => {
                setShowFloatingChat(false);
                localStorage.setItem('tt_ai_chat_closed', 'true');
              }}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
            >
              &times;
            </button>
          </div>

          {/* Messages body */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.map((msg, index) => {
              const isAi = msg.sender === 'ai';
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: isAi ? 'flex-start' : 'flex-end' }}>
                  {msg.isLoading ? (
                    <div style={{
                      background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px',
                      padding: '12px 16px', maxWidth: '80%'
                    }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%' }} />
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%' }} />
                        <span style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: isAi ? '#fff' : '#3b82f6',
                      color: isAi ? '#1e293b' : '#fff',
                      border: isAi ? '1px solid #e2e8f0' : 'none',
                      borderRadius: isAi ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                      padding: '12px 16px',
                      maxWidth: '80%',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      boxShadow: isAi ? '0 2px 6px rgba(0,0,0,0.015)' : 'none',
                      whiteSpace: 'pre-line'
                    }}>
                      {msg.text}
                    </div>
                  )}

                  {/* Render Quick Action buttons under the first AI message */}
                  {isAi && index === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, width: '100%', maxWidth: '85%' }}>
                      {[
                        { text: '🏠 Cần tư vấn bơm đẩy cao tầng', query: 'Bơm đẩy cao cấp nước cho gia đình' },
                        { text: '🌀 Cần tư vấn bơm chìm hố ga, ngập hầm', query: 'Bơm chìm hút hố ga, ngập hầm, nước thải' },
                        { text: '🌾 Cần tư vấn bơm tưới tiêu', query: 'Bơm tưới tiêu nông nghiệp, sân vườn' }
                      ].map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          onClick={() => handleSendChatMessage(btn.query)}
                          style={{
                            width: '100%', padding: '10px 14px', background: '#fff', border: '1px solid #3b82f6',
                            color: '#3b82f6', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'left',
                            cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#eff6ff'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Suggestions cards */}
            {chatSuggestions.length > 0 && !chatLoading && (
              <div style={{ marginTop: 8, borderTop: '1px dashed #cbd5e1', paddingTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', margin: '0 0 8px 0' }}>MÃ MÁY BƠM GỢI Ý PHÙ HỢP:</p>
                {chatSuggestions.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      navigateToProduct(item.id);
                      setShowFloatingChat(false);
                    }}
                    style={{
                      background: '#fff', padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                      border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: '1px solid #f1f5f9', background: '#fff' }}>
                      <img src={item.webImages?.[0] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=100&q=80'} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', margin: '0 0 2px 0', textTransform: 'uppercase' }}>{item.name}</h5>
                      <p style={{ fontSize: 9, color: '#64748b', margin: 0 }}>
                        {item.webSpecs?.specs || 'Hãng UPTI'}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: '#3b82f6' }}>➔</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage(chatInput);
            }}
            style={{ padding: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, background: '#fff', alignItems: 'center' }}
          >
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập yêu cầu tư vấn cụ thể..." 
              style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12, outline: 'none' }} 
            />
            <button 
              type="submit"
              style={{
                background: '#3b82f6', color: '#fff', border: 'none', width: 36, height: 36,
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              ➔
            </button>
          </form>
        </div>
      )}

      {/* Removed redundant floating buttons to prevent overlap with product images */}

      {/* Cart Drawer Backdrop Overlay */}
      {showCartDrawer && (
        <div 
          onClick={() => setShowCartDrawer(false)}
          style={{
            position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
            background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', zIndex: 10000,
            transition: 'all 0.3s ease'
          }}
        />
      )}

      {/* Cart Slide-over Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: showCartDrawer ? 0 : -440, width: '100%', maxWidth: 440, height: '100vh',
        background: '#fff', boxShadow: '-8px 0 32px rgba(15,23,42,0.12)', zIndex: 10001,
        display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease-in-out'
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            🛒 GIỎ HÀNG CỦA BẠN ({cart.reduce((sum, item) => sum + item.quantity, 0)})
          </h3>
          <button 
            onClick={() => setShowCartDrawer(false)}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#94a3b8', fontWeight: 'bold' }}
          >
            &times;
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Giỏ hàng đang trống.</p>
              <p style={{ fontSize: 12, margin: '8px 0 0 0' }}>Hãy thêm các sản phẩm máy bơm cần mua vào giỏ hàng nhé!</p>
            </div>
          ) : (
            <div>
              {/* Product items list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 14, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img src={item.product.webImages?.[0] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=100&q=80'} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0', textTransform: 'uppercase', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                        {item.product.name}
                      </h4>
                      <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 8px 0' }}>Thương hiệu: {item.product.webBrand || 'UPTI PUMP'}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* Qty controls */}
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
                          <button 
                            onClick={() => handleUpdateCartQty(item.product.id, -1)}
                            style={{ border: 'none', background: '#f8fafc', padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <span style={{ padding: '0 10px', fontSize: 12, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                          <button 
                            onClick={() => handleUpdateCartQty(item.product.id, 1)}
                            style={{ border: 'none', background: '#f8fafc', padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>
                        {/* Unit price */}
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                          Liên hệ sỉ lẻ
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveFromCart(item.product.id)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer', alignSelf: 'flex-start', padding: 4 }}
                      onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                  <span>BÁO GIÁ DỰ KIẾN:</span>
                  <span style={{ color: '#2563eb', fontSize: 16 }}>
                    Liên hệ 0984 273 806
                  </span>
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', fontStyle: 'italic', marginTop: 6, textAlign: 'right' }}>
                  * Kỹ thuật viên của chúng tôi sẽ gọi lại báo giá chiết khấu đại lý tốt nhất.
                </div>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handleCheckoutSubmit} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>
                  📋 THÔNG TIN YÊU CẦU BÁO GIÁ
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>HỌ VÀ TÊN KHÁCH HÀNG *</label>
                    <input 
                      type="text" required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn A"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>SỐ ĐIỆN THOẠI NHẬN HÀNG *</label>
                    <input 
                      type="tel" required
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="Ví dụ: 0963xxxxxx"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>ĐỊA CHỈ NHẬN HÀNG CHI TIẾT *</label>
                    <textarea 
                      required rows={2}
                      value={customerAddress}
                      onChange={e => setCustomerAddress(e.target.value)}
                      placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12.5, outline: 'none', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>GHI CHÚ ĐƠN HÀNG</label>
                    <input 
                      type="text"
                      value={orderNote}
                      onChange={e => setOrderNote(e.target.value)}
                      placeholder="Ví dụ: Giao giờ hành chính, cần xuất VAT,..."
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmittingOrder}
                    style={{
                      width: '100%', padding: 14, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      marginTop: 10, cursor: isSubmittingOrder ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(37,99,235,0.2)', transition: 'all 0.2s',
                      textTransform: 'uppercase'
                    }}
                  >
                    {isSubmittingOrder ? 'ĐANG GỬI YÊU CẦU...' : (
                       <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> GỬI YÊU CẦU BÁO GIÁ
                       </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Order Success Modal Dialog */}
      {showOrderSuccess && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 11000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', padding: 36, borderRadius: 20, maxWidth: 460, width: '90%',
            textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', position: 'relative'
          }}>
            <CheckCircleIcon />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: 12 }}>
              Gửi yêu cầu thành công!
            </h3>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 24, fontWeight: 500 }}>
              Cảm ơn bạn! Yêu cầu báo giá đã được ghi nhận và gửi thông báo trực tiếp tới quản lý của Công Ty Máy Bơm T&T. Kỹ thuật viên của chúng tôi sẽ liên hệ lại ngay với bạn qua Zalo/SĐT để gửi báo giá chiết khấu.
            </p>
            <button 
              onClick={() => setShowOrderSuccess(false)}
              style={{
                width: '100%', padding: '12px 24px', background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(59,130,246,0.2)'
              }}
            >
              OK, ĐÃ HIỂU
            </button>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Product Image Modal Overlay */}
      {showLightbox && currentProduct && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
          background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', zIndex: 12000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Close button */}
          <button 
            onClick={() => setShowLightbox(false)}
            style={{
              position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontSize: 20,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', outline: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            ✕
          </button>

          {/* Large image area with Hover Magnifier */}
          <div style={{ 
            position: 'relative', 
            width: '90%', 
            maxWidth: 550, 
            height: '60vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            overflow: 'hidden',
            borderRadius: 16,
            background: 'rgba(0,0,0,0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <img 
              src={currentProduct.webImages?.[activeImageIndex] || 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=500&q=80'} 
              alt={currentProduct.name} 
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={(e) => {
                const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - left) / width) * 100
                const y = ((e.clientY - top) / height) * 100
                setZoomPos({ x, y })
              }}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain', 
                cursor: 'zoom-in',
                transform: isZoomed ? 'scale(2.2)' : 'none',
                transformOrigin: isZoomed ? `${zoomPos.x}% ${zoomPos.y}%` : 'center',
                transition: isZoomed ? 'transform 0.05s ease-out' : 'transform 0.2s ease-out'
              }} 
            />
          </div>

          {/* Thumbnails below in lightbox */}
          {currentProduct.webImages && currentProduct.webImages.length > 1 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 24, padding: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
              {currentProduct.webImages.map((url, idx) => (
                <img 
                  key={idx} src={url} alt={`thumb-light-${idx}`} 
                  onClick={() => setActiveImageIndex(idx)}
                  style={{ 
                    width: 50, height: 50, objectFit: 'contain', borderRadius: 8, 
                    border: idx === activeImageIndex ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)', 
                    background: '#fff', padding: 2, cursor: 'pointer', transition: 'all 0.2s' 
                  }}
                />
              ))}
            </div>
          )}
          
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 16, fontWeight: 500 }}>
            {activeImageIndex + 1} / {currentProduct.webImages?.length || 1} - Chạm hoặc bấm ✕ để đóng
          </div>
        </div>
      )}
      
      <PwaUpdateBanner />
    </div>
  )
}
