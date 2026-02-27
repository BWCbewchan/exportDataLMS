# 🚀 QUICK START - Hướng dẫn nhanh

## 📦 Bước 1: Copy 3 files vào Google Apps Script

1. Mở Google Sheets → **Extensions** → **Apps Script**

2. **Xóa file `Code.gs` mặc định**

3. **Tạo 3 files mới:**

   ```
   File 1: app               (copy từ app.gs)              ⭐ MAIN
   File 2: getFirebaseToken  (copy từ getFirebaseToken.gs)
   File 3: teacherCompliance (copy từ teacherCompliance.gs)
   ```

4. **Save tất cả** (Ctrl+S)

---

## 🎯 Bước 2: Reload Google Sheets

- Quay lại Google Sheets
- Nhấn **F5** hoặc reload page
- Đợi vài giây
- Sẽ thấy menu **"🎯 MindX App"** xuất hiện

---

## ⚡ Bước 3: Fetch data (CHỈ 1 CLICK!)

**Menu:** **🎯 MindX App** → **🚀 Quick Actions** → **⚡ Fetch Data Nhanh**

**Chỉ cần click 1 lần!** Script sẽ tự động:
✅ Lấy token (từ cache hoặc fetch mới)
✅ Fetch dữ liệu Teacher Compliance 2026
✅ Ghi vào sheet "Teacher Compliance"

---

## 📊 Bước 4: Xem kết quả

1. Tab **"Teacher Compliance"** sẽ xuất hiện
2. Data được ghi realtime (load tới đâu ghi tới đó)
3. Chờ đến khi toast hiển thị "✅ Hoàn thành"

---

## 🎉 XONG!

Đơn giản vậy thôi! Bạn đã có dữ liệu Teacher Compliance năm 2026.

---

## 💡 Tips thêm:

### Xem tổng quan hệ thống:
**Menu:** **Quick Actions** → **📊 Dashboard**

### Xem token còn bao lâu hết hạn:
**Menu:** **Token Management** → **👁️ Xem Token Hiện Tại**

### Fetch lại data (trong vòng 55 phút):
**Menu:** **Quick Actions** → **⚡ Fetch Data Nhanh**
→ Dùng lại token cũ, không cần fetch mới

---

## 🐛 Nếu gặp lỗi:

### Lỗi "Authorization required"
1. Click **"Review permissions"**
2. Chọn tài khoản Google
3. Click **"Advanced"** → **"Go to ... (unsafe)"** → **"Allow"**

### Lỗi "Token expired"
**Menu:** **Token Management** → **🔑 Lấy Token Mới**

### Lỗi "API 401/403"
- Kiểm tra email/password trong:
  - `TOKEN_FIREBASE_CONFIG` (getFirebaseToken.gs)
  - `COMPLIANCE_FIREBASE_CONFIG` (teacherCompliance.gs)

---

## 📚 Đọc thêm:

- **Hướng dẫn chi tiết:** Xem [README.md](README.md)
- **Help trong app:** Menu → **Settings & Help** → **📖 Hướng Dẫn Tổng Quan**
- **About:** Menu → **Settings & Help** → **ℹ️ About**
