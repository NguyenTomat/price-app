import ModalPortal from './ModalPortal'
import ImageGallery from './ImageGallery'

/** Xem ảnh sản phẩm từ bảng giá gốc (chỉ đọc) */
export default function ProductImagesModal({ productName, images = [], onClose }) {
  return (
    <ModalPortal>
      <div
        className="overlay overlay-modal"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="modal modal-product-images" style={{ maxWidth: 560 }}>
          <div className="modal-header">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>{productName || 'Sản phẩm'}</h2>
              <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                Ảnh từ bảng giá gốc
              </div>
            </div>
            <button type="button" className="btn ghost sm" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {images.length > 0 ? (
              <ImageGallery images={images} readOnly />
            ) : (
              <div className="empty" style={{ padding: '32px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div>Chưa có ảnh cho sản phẩm này</div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
