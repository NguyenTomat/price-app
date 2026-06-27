# Bảng Giá T&T — Hướng dẫn cài đặt

## Yêu cầu hệ thống
- Node.js 18+ (tải tại https://nodejs.org)
- Windows 10/11

---

## Bước 1: Tạo Firebase Project

1. Vào https://console.firebase.google.com → **Add project**
2. Đặt tên project (VD: `bang-gia-tandt`)
3. Bật **Google Analytics** hoặc tắt tùy ý → Create project

### 1.1 Bật Authentication
- Vào **Authentication → Sign-in method → Email/Password → Enable → Save**

### 1.2 Tạo Firestore Database
- Vào **Firestore Database → Create database → Start in production mode**
- Chọn region gần nhất (VD: `asia-southeast1` - Singapore)

### 1.3 Bật Storage
- Vào **Storage → Get started → Production mode**

### 1.4 Cài Firestore Security Rules
Vào Firestore → Rules, dán vào:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{uid} {
      allow read: if request.auth.uid == uid;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // User's saved price lists
      match /myPriceLists/{id} {
        allow read, write: if request.auth.uid == uid;
      }
    }
    
    // Price lists: all auth users can read, only admin can write
    match /priceLists/{listId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      match /products/{productId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
    }

    // Inventory: all auth users can read, only admin can write
    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Orders: users manage own orders, admin manages all
    match /orders/{orderId} {
      allow read: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }
  }
}
```

### 1.5 Lấy Firebase Config
- Vào **Project Settings (⚙) → Your apps → Add app → Web (</>)**
- Đặt nickname rồi copy **firebaseConfig**

---

## Bước 2: Điền Config vào code

Mở file `src/firebase/firebase.js`, thay phần `firebaseConfig`:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "bang-gia-tandt.firebaseapp.com",
  projectId: "bang-gia-tandt",
  storageBucket: "bang-gia-tandt.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
}
```

---

## Bước 3: Tạo tài khoản Admin đầu tiên

1. Vào Firebase Console → **Authentication → Add user**
   - Email: `admin@congty.com`
   - Password: `matkhau123`
2. Copy **UID** của user vừa tạo
3. Vào **Firestore → users → Add document**
   - Document ID = UID vừa copy
   - Fields:
     - `email` (string): `admin@congty.com`
     - `displayName` (string): `Admin`
     - `role` (string): `admin`

---

## Bước 4: Cài đặt và chạy

```bash
# Cài dependencies
npm install

# Chạy thử (development)
npm run dev

# Build file .exe
npm run dist
```

File `.exe` sẽ nằm trong thư mục `dist-electron/`.

---

## Tính năng

| Tính năng | Admin | User |
|-----------|-------|------|
| Xem tất cả bảng giá | ✅ | ✅ |
| Import bảng giá Excel | ✅ | ❌ |
| Chỉnh sửa sản phẩm | ✅ | ❌ |
| Thêm ảnh sản phẩm | ✅ | ❌ |
| Tính giá cá nhân | ✅ | ✅ |
| Lưu bảng giá cá nhân | ✅ | ✅ |
| Xuất CSV bảng giá | ✅ | ✅ |
| Quản lý user | ✅ | ❌ |

---

## Định dạng Excel khi import

| Cột | Nội dung |
|-----|----------|
| A | STT (bỏ qua) |
| B | Tên / Mã sản phẩm |
| C | Họng đẩy (mm) |
| D | Lưu lượng / Thông số kỹ thuật |
| E | Đơn giá (số, không cần ký hiệu ₫) |
| F | Phi họng |

Dòng tiêu đề nhóm (cột B có chữ, cột E trống) được **tự động nhận diện** làm nhóm hàng.

### Định dạng Excel tồn kho (TONG_HOP)

| Cột | Nội dung |
|-----|----------|
| A | STT |
| B | Mã hàng |
| C | Tên hàng |
| D | Lô SX / Kho |
| E | Tồn kho cuối kỳ |

Dòng `KHO 1`, `KHO 4`… (cột B = C) là tiêu đề kho, tự nhận diện.
