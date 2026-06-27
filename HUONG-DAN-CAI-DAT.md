# Bảng Giá T&T — Cài đặt và sử dụng

## A. Dùng app trên máy (không cần Node.js)

1. Lấy file **`BangGia-TT-Setup-1.0.0.exe`** trong thư mục `dist-electron\`
2. Copy file sang máy cần dùng (USB, Zalo, Google Drive…)
3. Double-click file `.exe` → Next → chọn thư mục cài → Install
4. Mở app từ **Desktop** hoặc **Start Menu** → **Bảng Giá T&T**
5. Đăng nhập bằng tài khoản đã được tạo trên Firebase

> Máy cần **kết nối Internet** để đăng nhập và đồng bộ dữ liệu (Firebase).

### Chạy thử không cài đặt

Mở thư mục `dist-electron\win-unpacked\` → chạy **`Bảng Giá T&T.exe`**

> **Nếu file .exe biến mất sau khi build:** Windows Defender có thể tự xóa. Vào **Bảo mật Windows → Lịch sử bảo vệ → Quarantined items** → khôi phục, hoặc thêm thư mục `dist-electron` vào **Exclusion**.

---

## B. Tạo file .exe (chỉ làm trên máy dev)

### Cách 1 — Double-click (dễ nhất)

1. Cài [Node.js 18+](https://nodejs.org)
2. Double-click **`build-exe.bat`**
3. Đợi build xong → cửa sổ Explorer mở thư mục `dist-electron\`
4. Gửi file **`BangGia-TT-Setup-1.0.0.exe`** cho user

### Cách 2 — Lệnh thủ công

```bash
npm install
npm run dist
```

File output: `dist-electron/BangGia-TT-Setup-1.0.0.exe`

---

## C. Firebase (cấu hình 1 lần trước khi phát app)

App kết nối Firebase project **`bang-gia-tandt`**. Cần:

1. **Authentication** → Email/Password: bật
2. **Firestore** → Rules có block `inventory`, `orders` (xem `firestore.rules`)
3. Tạo user admin trong Firebase Console + document `users/{uid}` với `role: admin`

Chi tiết xem `README.md` phần Firebase.

---

## D. Phân quyền

| Tính năng | Admin | User |
|-----------|-------|------|
| Xem bảng giá | ✅ | ✅ |
| Import / sửa sản phẩm | ✅ | ❌ |
| Tồn kho | ✅ (sửa) | ✅ (xem) |
| Bảng giá của tôi | ✅ | ✅ |
| Quản lý user | ✅ | ❌ |
