# 📚 Hướng dẫn Deploy Google Apps Script

## ✅ Đã sửa lỗi conflict + Tạo App Orchestrator

**Vấn đề đã fix:**
- ❌ Lỗi: `SyntaxError: Identifier 'FIREBASE_CONFIG' has already been declared`
- ✅ Đã đổi tên các biến/functions để tránh conflict
- ✨ **MỚI:** Tạo file `app.gs` để quản lý tập trung cả 2 scripts

**Cấu trúc dự án:**

```
📁 appscript/
  ├── 📄 app.gs                    ⭐ MAIN - File chính (orchestrator)
  ├── 📄 getFirebaseToken.gs       🔐 Quản lý Firebase token
  ├── 📄 teacherCompliance.gs      📊 Fetch Teacher Compliance data
  └── 📄 README.md                 📖 Hướng dẫn
```

**Thay đổi:**

### File `getFirebaseToken.gs`:
- `FIREBASE_CONFIG` → `TOKEN_FIREBASE_CONFIG`
- `fetchFirebaseToken()` → `fetchTokenForSheet()`
- `writeTokenToSheet()` → `writeTokenDataToSheet()`
- `onOpen()` → `onOpenTokenMenu()`

### File `teacherCompliance.gs`:
- `FIREBASE_CONFIG` → `COMPLIANCE_FIREBASE_CONFIG`
- Các functions khác giữ nguyên

---

## 📋 Cách Deploy vào Google Apps Script

### Bước 1: Mở Google Sheets
1. Truy cập Google Sheets: https://sheets.google.com
2. Tạo sheet mới hoặc mở sheet hiện có
3. Chọn **Extensions** > **Apps Script**

### Bước 2: Tạo 3 files trong Apps Script

#### ⭐ Tạo file 1: `app` (MAIN - BẮT ĐẦU TỪ ĐÂY)
1. Xóa file `Code.gs` mặc định (nếu có)
2. Click **+** bên cạnh "Files" → Chọn "Script"
3. Đặt tên: `app` (KHÔNG cần .gs)
4. Copy toàn bộ nội dung từ `app.gs`
5. Paste vào editor
6. Ctrl+S để Save

#### Tạo file 2: `getFirebaseToken`
1. Click **+** bên cạnh "Files" → Chọn "Script"
2. Đặt tên: `getFirebaseToken` (KHÔNG cần .gs)
3. Copy toàn bộ nội dung từ `getFirebaseToken.gs`
4. Paste vào editor
5. Ctrl+S để Save

#### Tạo file 3: `teacherCompliance`
1. Click **+** bên cạnh "Files" → Chọn "Script"
2. Đặt tên: `teacherCompliance` (KHÔNG cần .gs)
3. Copy toàn bộ nội dung từ `teacherCompliance.gs`
4. Paste vào editor
5. Ctrl+S để Save

### Bước 3: Reload Google Sheets
1. Quay lại Google Sheets
2. Nhấn F5 hoặc reload page
3. Sẽ thấy menu **"🎯 MindX App"** xuất hiện

---

## 🚀 Cách sử dụng (với app.gs)

### ⚡ CÁCH NHANH NHẤT (Chỉ 1 click!)

**Menu:** **🎯 MindX App** → **🚀 Quick Actions** → **⚡ Fetch Data Nhanh**

✨ **Chỉ cần 1 click!** Script sẽ tự động:
1. Kiểm tra token có trong cache không
2. Nếu không có/hết hạn → Tự động lấy token mới
3. Fetch dữ liệu Teacher Compliance 2026
4. Ghi vào sheet "Teacher Compliance"

---

### 📊 Dashboard - Xem tổng quan

**Menu:** **🎯 MindX App** → **🚀 Quick Actions** → **📊 Dashboard**

Hiển thị:
- ✅ Token status (còn bao nhiêu phút)
- 📊 Data status (có bao nhiêu records)
- 🔍 Tổng quan hệ thống

---

### 🔐 Quản lý Token (Nâng cao)

**Menu:** **🎯 MindX App** → **🔐 Token Management**

- **🔑 Lấy Token Mới**: Force lấy token mới từ Firebase
- **👁️ Xem Token Hiện Tại**: Check token status, thời gian còn lại
- **🗑️ Xóa Token Cache**: Xóa token cache (lần fetch tiếp sẽ lấy mới)

---

### 📊 Functions khác

**Menu:** **🎯 MindX App** → **📊 Data Fetching**

- **🚀 Lấy Teacher Compliance 2026**: Fetch data (tự động lấy token)
- **📋 Export Chi Tiết Violations**: Export violations chi tiết
- **🧪 Test API Connection**: Test kết nối API

---

## 🎯 Workflows Khuyến Nghị

### Workflow 1: Siêu Nhanh (1-click) ⚡
```
Menu: MindX App → Quick Actions → ⚡ Fetch Data Nhanh
→ XONG! (tất cả tự động)
```

### Workflow 2: Tối ưu (Tiết kiệm API) 💡
```
Lần 1: Menu → Token Management → 🔑 Lấy Token Mới
Lần 2-N (trong 55 phút): Menu → Quick Actions → ⚡ Fetch Data Nhanh
→ Token được cache, không cần fetch lại
```

### Workflow 3: Dashboard Monitoring 📊
```
Menu → Quick Actions → 📊 Dashboard
→ Xem tổng quan token & data status
```

---

## ⚠️ Lưu ý quan trọng

1. **File app.gs là MAIN:**
   - Deploy cả 3 files: `app.gs`, `getFirebaseToken.gs`, `teacherCompliance.gs`
   - File `app.gs` chứa function `onOpen()` → Tạo menu chính
   - 2 files còn lại chứa logic xử lý
   
2. **Menu duy nhất:**
   - Sau khi deploy, chỉ có 1 menu: **"🎯 MindX App"**
   - Menu này gộp tất cả functions từ 3 files
   - Không còn menu riêng lẻ "Firebase Token" hay "MindX Data"
   
3. **Không có lỗi conflict:**
   - Đã đổi tên biến/functions → cả 3 file có thể cùng tồn tại
   - `TOKEN_FIREBASE_CONFIG` (getFirebaseToken.gs)
   - `COMPLIANCE_FIREBASE_CONFIG` (teacherCompliance.gs)
   
4. **Token expires:**
   - Token Firebase hết hạn sau 1 giờ (3600s)
   - Script tự động kiểm tra và refresh khi cần
   
5. **Filter năm 2026:**
   - Script CHỈ lấy dữ liệu năm 2026 (01/01/2026 - 31/12/2026)
   
6. **Realtime writing:**
   - Dữ liệu được ghi ngay vào sheet sau mỗi trang
   - Không lo mất dữ liệu nếu timeout

---

## 📊 Menu Tổng Quan

Sau deploy, menu **"🎯 MindX App"** có các submenu:

### 🚀 Quick Actions (1-CLICK!)
- **⚡ Fetch Data Nhanh** - Siêu nhanh! Tự động lấy token + fetch data
- **🔄 Refresh Token & Fetch** - Force lấy token mới, sau đó fetch
- **📊 Dashboard** - Xem tổng quan hệ thống

### 🔐 Token Management
- **🔑 Lấy Token Mới** - Fetch token từ Firebase
- **👁️ Xem Token Hiện Tại** - Check status, còn bao lâu hết hạn
- **📋 Hiển thị Token Dialog** - Hiển thị token đầy đủ
- **💾 Lưu Token vào File** - Save token ra Google Drive
- **🗑️ Xóa Token Cache** - Clear cache, lần fetch tiếp sẽ lấy mới

### 📊 Data Fetching
- **🚀 Lấy Teacher Compliance 2026** - Fetch data (auto token)
- **📋 Export Chi Tiết Violations** - Export violations sang sheet riêng
- **🧪 Test API Connection** - Test kết nối với LMS API

### ⚙️ Settings & Help
- **📖 Hướng Dẫn Tổng Quan** - Hướng dẫn chi tiết cách dùng
- **🔐 Về Auto Token** - Giải thích cơ chế auto token
- **ℹ️ About** - Thông tin về app

---

## 🐛 Troubleshooting

### Nếu vẫn gặp lỗi "has already been declared"
1. Xóa toàn bộ code trong Apps Script
2. Copy lại code từ file trong thư mục `appscript/`
3. Đảm bảo không copy duplicate

### Nếu lỗi "Authorization required"
1. Chạy function lần đầu
2. Click "Review permissions"
3. Chọn tài khoản Google
4. Click "Advanced" > "Go to ... (unsafe)" > "Allow"

### Nếu lỗi API 401/403
- Kiểm tra email/password trong config
- Đảm bảo tài khoản có quyền truy cập LMS

---

## 📞 Liên hệ
- Email: anhpnh@mindx.com.vn
- Workspace: d:\mindXLeader\getDataLms\appscript\
