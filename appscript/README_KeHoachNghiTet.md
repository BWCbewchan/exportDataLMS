# Script Gửi Email Khảo Sát Kế Hoạch Nghỉ Tết 2026

## 📋 Mô tả
Script gửi email khảo sát kế hoạch nghỉ Tết Nguyên Đán 2026 cho giáo viên HCM 1&4 active.

## 📊 Yêu cầu Sheet
- **Tên sheet**: `Full-gv-hcm14-active`
- **Cấu trúc dữ liệu**:
  ```
  Full name         | Work email
  Bùi Anh Đài       | buianhdai1412@mindx.net.vn
  Bùi Đặng Diễm Quỳnh | quynhbdd@mindx.net.vn
  ...
  ```

##  Thông tin gửi email

### Người nhận
- **To**: anhpnh@mindx.com.vn
- **CC**: 
  - tuannh@mindx.com.vn
  - nguyennhk@mindx.com.vn
  - mydtt01@mindx.com.vn
  - baotc@mindx.com.vn
- **BCC**: Tất cả giáo viên trong sheet

### Thông tin email
- **Tên người gửi**: Teaching HCM01&04 - no reply
- **Subject**: KHẢO SÁT KẾ HOẠCH NGHỈ TẾT 2026 - Teaching HCM 1&4
- **Template**: HTML với style MindX chuẩn

## 🚀 Cách sử dụng

### Cách 1: Sử dụng Menu
1. Mở Google Sheets
2. Vào menu **📧 Gửi Email** > **📋 Khảo sát kế hoạch nghỉ Tết**
3. Xác nhận và chờ gửi

### Cách 2: Chạy từ Apps Script Editor
1. Mở **Extensions** > **Apps Script**
2. Chọn function `sendKeHoachNghiTetEmail`
3. Click **Run**

## ⚙️ Cài đặt

### Bước 1: Copy code
Copy toàn bộ nội dung file `sendKeHoachNghiTet.gs` vào Google Apps Script Editor.

### Bước 2: Cấp quyền
Lần chạy đầu tiên, hệ thống sẽ yêu cầu cấp quyền:
- ✅ Đọc dữ liệu từ Google Sheets
- ✅ Gửi email qua Gmail

### Bước 3: Kiểm tra
- Đảm bảo sheet `Full-gv-hcm14-active` tồn tại
- Kiểm tra cột `Full name` và `Work email`
- Email phải hợp lệ

## 📝 Lưu ý

### Giới hạn Gmail API
- **Gmail giới hạn**: 100 recipients/email (To + CC + BCC)
- **Script tự động chia batch**:
  - Batch 1: To (1) + CC (4) + BCC (90) = 95 ✅
  - Batch 2+: To (1) + BCC (94) = 95 ✅ (không CC tránh duplicate)
- **Delay**: 2 giây giữa các batch tránh spam

### Tracking Status
- ✅ Cột E tự động tạo header "Status" nếu chưa có
- ✅ Format: "Đã gửi 07/02/2026 14:30"
- ✅ Chỉ gửi cho rows **không có** hoặc **khác** "Đã gửi"
- ✅ An toàn chạy nhiều lần không lo gửi trùng

### Kiểm tra trước khi gửi
- ✅ Kiểm tra link khảo sát hoạt động
- ✅ Xác nhận danh sách email chính xác
- ✅ Kiểm tra deadline: 16h00 – 13/02/2026
- ✅ Test với 1-2 người trước khi gửi hàng loạt

## 🔍 Debug

### Xem logs
```javascript
// Trong Apps Script Editor
View > Logs (Ctrl + Enter)
```

### Các lỗi thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|------------|-----------|
| Sheet không tồn tại | Tên sheet sai | Kiểm tra tên sheet |
| Không tìm thấy cột | Header sai | Đảm bảo có cột "Full name" và "Work email" |
| Quota exceeded | Vượt giới hạn gửi email | Đợi 24h hoặc dùng tài khoản Workspace |

## 📄 Template Email

Template sử dụng style chuẩn MindX:
- Logo MindX
- Màu đỏ brand #d0021b
- Button CTA nổi bật
- Thông tin liên hệ đầy đủ
- Responsive design

## 👨‍💻 Tác giả
Teaching HCM 1&4 Team

## 📅 Cập nhật
Lần cuối: 07/02/2026
