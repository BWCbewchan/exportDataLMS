# Fetch Classes This Week - Google Apps Script

## 📋 Mô tả
Script Google Apps Script lấy dữ liệu các lớp học có **end_date** từ **Thứ 5 tuần này** đến **Thứ 4 tuần sau**.

✅ **Script này HOẠT ĐỘNG được** - Sử dụng cùng cách thức như allClassesSession4And8.gs

**✨ Tính năng:**
- ✅ Tự động tính T5 tuần này → T4 tuần sau (7 ngày)
- ✅ Lấy Firebase token tự động (từ sheet hoặc getFirebaseIdToken())
- ✅ Retry mechanism khi lỗi 401/5xx
- ✅ Pagination tự động
- ✅ Ghi kết quả vào Google Sheet

**📦 Phụ thuộc:**
- Cần file `getFirebaseToken.gs` trong cùng project Apps Script

## 🎯 Logic tính ngày

### Công thức:
**Tuần = CN → T7** (7 ngày)
- **T5 tuần này** = T5 của tuần hiện tại (dù đã qua hay chưa)
- **T4 tuần sau** = T5 tuần này + 6 ngày
- **Range** = 7 ngày liên tiếp (T5 → T4)

### Ví dụ cụ thể:
| Hôm nay | T5 tuần này | T4 tuần sau | Range |
|---------|-------------|-------------|-------|
| CN 01/02 | **T5 05/02** | T4 11/02 | 05→11 (7 ngày) |
| T3 03/02 | **T5 05/02** | T4 11/02 | 05→11 (7 ngày) |
| T5 05/02 | **T5 05/02** | T4 11/02 | 05→11 (7 ngày) |
| T6 06/02 | **T5 05/02** | T4 11/02 | 05→11 (7 ngày) |
| **T7 07/02** | **T5 05/02** | **T4 11/02** | **05→11 (7 ngày)** ← Hôm nay |
| CN 08/02 | **T5 12/02** | T4 18/02 | 12→18 (7 ngày) |

## 🚀 Cài đặt

### Bước 1: Đảm bảo có script Firebase Token

Script này sử dụng `getFirebaseIdToken()` từ [getFirebaseToken.gs](getFirebaseToken.gs) để lấy token.

**Yêu cầu:**
- File `getFirebaseToken.gs` phải có trong cùng project Apps Script

### Bước 2: Copy script

1. Mở Google Sheets
2. Vào **Extensions** > **Apps Script**
3. Paste code từ `fetchClassesThisWeek.gs` vào file mới
4. **Lưu** (Ctrl + S)

### Bước 3: Cấp quyền

1. Click **Run** > chọn function `onOpenFetchClassesThisWeekMenu`
2. Click **Review permissions**
3. Chọn tài khoản Google
4. Click **Advanced** > **Go to [project name] (unsafe)**
5. Click **Allow**

### Bước 4: Reload Sheet

Đóng và mở lại Google Sheets. Menu **"📅 Lớp Tuần Này"** sẽ xuất hiện.

## 📖 Cách sử dụng

### Lấy dữ liệu:
1. Vào menu **📅 Lớp Tuần Này** > **🚀 Lấy dữ liệu (T5→T4)**
2. Script tự động:
   - Tính T5 tuần này và T4 tuần sau
   - Lấy Firebase token
   - Fetch dữ liệu từ API
   - Ghi vào sheet **"Classes_ThisWeek"**
3. Đợi hoàn thành (toast notification)

### Test tính ngày:
1. Vào menu **📅 Lớp Tuần Này** > **🧪 Test tính ngày**
2. Xem kết quả tính toán T5 và T4

## 📊 Dữ liệu trả về

### Sheet: `Classes_ThisWeek`

**Header:**
- Tên lớp
- Khóa học
- Cơ sở
- Ngày bắt đầu
- Ngày kết thúc
- Status (có màu: xanh = RUNNING, xám = FINISHED/CLOSED)
- LEC (giáo viên Lecturer)
- Số HS
- Số buổi

**Ví dụ:**
```
Tên lớp          | Khóa học | Cơ sở  | Ngày BĐ    | Ngày KT    | Status  | LEC            | Số HS | Số buổi
LBB-JSB14 (1:1)  | JSB      | HCM01  | 05/01/2026 | 09/02/2026 | RUNNING | Nguyễn Văn A   | 15    | 12
```

## ⚙️ Cấu hình

### Thay đổi số record per page:
```javascript
RECORDS_PER_PAGE: 50 // Giảm nếu bị timeout, tăng nếu muốn nhanh hơn
```

### Thay đổi retry logic:
```javascript
MAX_RETRIES: 3    // Số lần thử lại khi lỗi
SLEEP_TIME: 1000  // Thời gian nghỉ giữa các page (ms)
```

## 🔍 Troubleshooting

### Lỗi: "Cannot find function getFirebaseIdToken"
→ Thiếu file `getFirebaseToken.gs`. Copy file này vào cùng project Apps Script.

### Lỗi: "API trả về lỗi: 401"
→ Token hết hạn. Script tự động refresh, nhưng nếu vẫn lỗi:
- Kiểm tra `getFirebaseToken.gs` hoạt động đúng
- Chạy thủ công `getFirebaseIdToken()` để test

### Lỗi: "Server Error 502/503/504"
→ Server LMS đang quá tải. Script tự động retry 3 lần.
- Nếu vẫn lỗi, đợi vài phút rồi chạy lại

### Fetch chậm
→ Tăng `SLEEP_TIME` để giảm tải server:
```javascript
SLEEP_TIME: 2000  // 2 giây thay vì 1 giây
```

### Timeout
→ Giảm `RECORDS_PER_PAGE`:
```javascript
RECORDS_PER_PAGE: 30  // Giảm từ 50 xuống 30
```

## 📝 Lưu ý

### Token management:
- Script ưu tiên đọc token từ sheet "Firebase Token" (nếu có)
- Nếu token hết hạn hoặc không có → gọi `getFirebaseIdToken()`
- Token tự động refresh khi gặp 401

### Retry mechanism:
- Lỗi 401: Refresh token và retry ngay
- Lỗi 5xx: Retry với exponential backoff (1s, 2s, 4s)
- Retry tối đa 3 lần

### Performance:
- Pagination: 50 records/page
- Sleep giữa pages: 1 giây
- Thời gian ước tính: ~2-5 phút cho 100-200 lớp

## 🔧 Debug

### Xem logs:
```
Extensions > Apps Script > Executions
```

### Test từng function:
1. `testDateCalculation()` - Test tính ngày
2. `getClassesThisWeekFirebaseToken()` - Test lấy token
3. `fetchClassesThisWeek()` - Chạy toàn bộ flow

## 🆚 So sánh với Node.js version

| Feature | Google Apps Script | Node.js |
|---------|-------------------|---------|
| 🌐 Chạy | ✅ Trực tiếp từ Google Sheets | ⚡ Terminal local |
| 🔐 Token | ✅ Tự động (Firebase) | ⚠️ Manual (.env) |
| 📊 Output | ✅ Google Sheets | 📁 CSV + JSON |
| ⚡ Tốc độ | ⚠️ Chậm hơn (GAS limits) | ✅ Nhanh hơn |
| 🔄 Automation | ⏰ Triggers | 🤖 Cron jobs |
| 💰 Chi phí | 💚 Free (GAS quota) | 💚 Free (local) |

**Khuyến nghị:**
- Dùng **Apps Script** nếu: Cần ghi trực tiếp vào Sheets, không muốn cài Node.js
- Dùng **Node.js** nếu: Cần xử lý bulk data lớn, có kỹ năng command line

## 📅 Cập nhật

**Lần cuối**: 07/02/2026  
**Phiên bản**: 2.0 - Đã sửa để hoạt động theo cách allClassesSession4And8.gs  
**Tác giả**: MindX Data Team
