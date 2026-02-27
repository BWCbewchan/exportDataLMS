# HƯỚNG DẪN SỬ DỤNG GOOGLE APPS SCRIPT - TEACHER COMPLIANCE

## 📋 Tổng quan
Script này giúp bạn fetch dữ liệu Teacher Compliance từ MindX LMS API trực tiếp vào Google Sheets.

## 🚀 Cách sử dụng

### Bước 1: Tạo Google Sheets mới
1. Truy cập [Google Sheets](https://sheets.google.com)
2. Tạo một spreadsheet mới
3. Đặt tên (ví dụ: "Teacher Compliance Data")

### Bước 2: Mở Apps Script Editor
1. Trong Google Sheets, click menu **Extensions** > **Apps Script**
2. Xóa code mặc định (function myFunction)
3. Copy **TOÀN BỘ** nội dung file `teacherCompliance.gs` và paste vào

### Bước 3: Cập nhật Authorization Token
1. Mở [LMS MindX](https://lms.mindx.edu.vn) và đăng nhập
2. Nhấn **F12** để mở Chrome DevTools
3. Vào tab **Network**
4. Tìm một request đến `lms-api.mindx.vn` (có thể refresh trang)
5. Click vào request đó > tab **Headers**
6. Tìm và copy giá trị của `authorization` (bắt đầu bằng `eyJ...`)
7. Trong Apps Script, tìm dòng:
   ```javascript
   AUTH_TOKEN: 'eyJ...',
   ```
8. Thay thế giá trị cũ bằng token vừa copy

### Bước 4: Save và chạy
1. Click nút **💾 Save** (Ctrl+S)
2. Đặt tên project (ví dụ: "Teacher Compliance Fetcher")
3. Click nút **▶️ Run** > chọn function `fetchTeacherComplianceData`
4. Lần đầu sẽ yêu cầu authorization:
   - Click **Review permissions**
   - Chọn tài khoản Google của bạn
   - Click **Advanced** > **Go to [project name] (unsafe)**
   - Click **Allow**
5. Chờ script chạy (xem progress trong **Execution log**)

### Bước 5: Xem kết quả
- Quay lại Google Sheets
- Sẽ có sheet mới tên **"Teacher Compliance"** chứa dữ liệu
- Dữ liệu được format đẹp với màu sắc:
  - 🟢 Xanh = NOT_VIOLATED
  - 🔴 Đỏ = VIOLATED

## 🎛️ Cấu hình

Trong code, bạn có thể thay đổi các settings này:

```javascript
const CONFIG = {
  SHEET_NAME: 'Teacher Compliance',     // Tên sheet đích
  RECORDS_PER_PAGE: 100,                // Số bản ghi mỗi trang (max 100)
  FETCH_ALL: true                       // true = lấy tất cả, false = chỉ 1 trang
};
```

### Các tùy chọn:

- **FETCH_ALL: true** → Lấy tất cả ~14,725 bản ghi (mất 2-5 phút)
- **FETCH_ALL: false** → Chỉ lấy 100 bản ghi đầu tiên (nhanh)
- **RECORDS_PER_PAGE** → Số lượng mỗi lần fetch (1-100)

## 📊 Menu tùy chỉnh

Sau khi setup xong, mỗi lần mở Google Sheets sẽ có menu **"📊 MindX Data"**:

- **🔄 Lấy Teacher Compliance Data** → Chạy fetch dữ liệu
- **⚙️ Cập nhật Token** → Hướng dẫn update token
- **ℹ️ Hướng dẫn** → Xem hướng dẫn

## 🔧 Các function hữu ích

### 1. `fetchTeacherComplianceData()`
Hàm chính để lấy dữ liệu và ghi vào sheet

### 2. `testAPIConnection()`
Test xem API có hoạt động không:
```javascript
// Chạy trong Apps Script để test
testAPIConnection();
// Xem kết quả trong Execution log
```

### 3. `exportDetailedViolations()`
Export chi tiết từng violation sang sheet riêng:
- Tạo sheet mới "Violation Details"
- Mỗi violation là 1 row riêng
- Chi tiết: Category, Criteria, Description, Note

### 4. `onOpen()`
Tự động tạo menu khi mở spreadsheet

## 📁 Cấu trúc dữ liệu

### Sheet chính "Teacher Compliance":
| Column | Nội dung |
|--------|----------|
| ID | ID của record |
| Teacher ID | ID giáo viên |
| Teacher Name | Tên giáo viên |
| Class Name | Tên lớp |
| Violation Status | Trạng thái (VIOLATED/NOT_VIOLATED) |
| Total Criterias | Tổng số tiêu chí |
| Violated Criterias | Số tiêu chí vi phạm |
| Score | Điểm |
| Created By | Người tạo |
| Created At | Thời gian tạo |
| Last Modified At | Thời gian sửa cuối |
| Last Modified By | Người sửa cuối |
| Categories | Các danh mục |
| Violated Items | Chi tiết vi phạm |

## ⚠️ Lưu ý quan trọng

### 1. Token hết hạn
- Token thường hết hạn sau **1 giờ**
- Nếu lỗi **401 Unauthorized**, cần lấy token mới
- Follow Bước 3 để cập nhật

### 2. Giới hạn Apps Script
- Max execution time: **6 phút**
- Nếu fetch tất cả bị timeout, chia nhỏ:
  - Set `FETCH_ALL: false`
  - Run nhiều lần với pagination manual

### 3. Sheet sẽ bị xóa
- Mỗi lần chạy, sheet cũ sẽ bị **clear** và ghi lại
- Backup trước nếu cần giữ dữ liệu cũ

### 4. Rate Limiting
- Script có delay 500ms giữa các request
- Tránh chạy quá nhiều lần trong thời gian ngắn

## 🐛 Troubleshooting

### Lỗi: "Exception: Request failed for https://lms-api.mindx.vn returned code 401"
**Nguyên nhân:** Token hết hạn  
**Giải pháp:** Lấy token mới (Bước 3)

### Lỗi: "Script timeout"
**Nguyên nhân:** Fetch quá nhiều dữ liệu  
**Giải pháp:** 
- Set `FETCH_ALL: false`
- Hoặc giảm `RECORDS_PER_PAGE`

### Không thấy menu "MindX Data"
**Giải pháp:**
- Đóng và mở lại Google Sheets
- Hoặc chạy function `onOpen()` manually

### Dữ liệu không hiển thị đúng
**Giải pháp:**
- Check Execution log (View > Logs trong Apps Script)
- Kiểm tra format của API response

## 💡 Tips

1. **Lưu token vào Script Properties** (an toàn hơn):
```javascript
// Set token (chạy 1 lần)
PropertiesService.getScriptProperties().setProperty('AUTH_TOKEN', 'eyJ...');

// Đọc token trong code
AUTH_TOKEN: PropertiesService.getScriptProperties().getProperty('AUTH_TOKEN')
```

2. **Schedule tự động** (fetch định kỳ):
   - Apps Script Editor > Triggers (⏰ icon)
   - Add trigger: `fetchTeacherComplianceData`
   - Time-driven, chọn tần suất (daily, weekly...)

3. **Export to CSV**:
   - File > Download > Comma-separated values (.csv)

## 📞 Support

Nếu có vấn đề:
1. Check Execution log trong Apps Script
2. Verify token còn hạn
3. Test với `testAPIConnection()`

## 🎯 Tính năng nâng cao

### Filter dữ liệu
Modify biến `variables` trong function `fetchDataFromAPI()`:

```javascript
const variables = {
  payload: {
    filters: {
      // Ví dụ: chỉ lấy VIOLATED
      violationStatus: 'VIOLATED'
    },
    pagination: {
      page: page,
      limit: CONFIG.RECORDS_PER_PAGE
    }
  }
};
```

### Export nhiều sheets
Tạo thêm functions để export:
- Teachers summary
- Classes summary  
- Violation statistics

---

**Version:** 1.0  
**Last updated:** February 6, 2026  
**Author:** AI Assistant
