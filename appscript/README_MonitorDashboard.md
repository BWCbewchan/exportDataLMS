# Monitor Dashboard 2026 - Theo dõi thay đổi dữ liệu

## 📋 Mô tả
Script tự động gửi email thông báo khi có thay đổi dữ liệu tại:
- **Sheet**: Dashboard 2026
- **Hàng**: 9
- **Cột**: T đến AG (cột 20-33)
- **Email nhận**: baotran.060103@gmail.com

## 🚀 Cài đặt

### Bước 1: Copy script vào Google Apps Script
1. Mở Google Sheets chứa sheet **Dashboard 2026**
2. Vào **Extensions** > **Apps Script**
3. Tạo file mới hoặc paste code từ `monitorDashboard2026.gs`
4. **Lưu** (Ctrl + S)

### Bước 2: Cấp quyền
1. Lần đầu chạy, click **Run** > chọn function `testEmailNotification`
2. Click **Review permissions**
3. Chọn tài khoản Google
4. Click **Advanced** > **Go to [project name] (unsafe)**
5. Click **Allow**

### Bước 3: Test email
1. Chạy function `testEmailNotification`
2. Kiểm tra email `baotran.060103@gmail.com`
3. Nếu nhận được email → thành công!

### Bước 4: Kích hoạt tự động
Script sử dụng **trigger onEdit** - tự động chạy khi có edit trong sheet.

**Không cần setup trigger thủ công!** Script sẽ tự động hoạt động khi:
- Bạn edit bất kỳ ô nào trong sheet "Dashboard 2026"
- Nếu edit ở row 9, cột T-AG → gửi email

## 📧 Email thông báo

### Nội dung email bao gồm:
- ✅ Vị trí thay đổi (Row, Column)
- ✅ Giá trị cũ
- ✅ Giá trị mới
- ✅ Người sửa
- ✅ Thời gian sửa
- ✅ Link trực tiếp đến Sheet

### Ví dụ:
```
🔔 THÔNG BÁO THAY ĐỔI DỮ LIỆU
Dashboard 2026

Vị trí: Row 9, Cột T
Giá trị cũ: 1000
Giá trị mới: 1500
Người sửa: user@mindx.net.vn
Thời gian: 07/02/2026 14:30:25
```

## 🎯 Phạm vi theo dõi

### Row 9 - Các cột từ T đến AG:
| Cột | Index | Mô tả |
|-----|-------|-------|
| T   | 20    | Được theo dõi |
| U   | 21    | Được theo dõi |
| V   | 22    | Được theo dõi |
| ... | ...   | ... |
| AG  | 33    | Được theo dõi |

### Không theo dõi:
- ❌ Row khác 9
- ❌ Cột khác T-AG
- ❌ Sheet khác "Dashboard 2026"

## 🔍 Troubleshooting

### Không nhận được email?

**1. Kiểm tra Spam/Junk folder**
- Email có thể bị đánh dấu spam lần đầu

**2. Kiểm tra quyền script**
```
Extensions > Apps Script > Run > testEmailNotification
```
Nếu lỗi quyền → làm lại Bước 2

**3. Kiểm tra trigger**
```
Extensions > Apps Script > Triggers (⏰ icon bên trái)
```
Không cần thấy trigger nào cả (onEdit tự động)

**4. Kiểm tra logs**
```
Extensions > Apps Script > Executions
```
Xem script có chạy không

### Email gửi quá nhiều?

**Giới hạn Gmail API:**
- 100 emails/ngày (Gmail cá nhân)
- 1,500 emails/ngày (Google Workspace)

**Nếu edit nhiều lần:**
- Mỗi lần edit → 1 email
- Consider: thêm delay/throttle nếu cần

## 🛠️ Tùy chỉnh

### Đổi email nhận
Sửa dòng 49 trong script:
```javascript
const recipient = 'baotran.060103@gmail.com';
// Thay thành email khác
```

### Đổi phạm vi theo dõi
Sửa dòng 22-23:
```javascript
// Row 9, cột T(20) đến AG(33)
if (row === 9 && col >= 20 && col <= 33) {
```

### Thêm nhiều người nhận
```javascript
const recipients = 'baotran.060103@gmail.com,user2@gmail.com';
```

## 📝 Lưu ý

### ✅ Ưu điểm:
- Tự động 100%, không cần thao tác
- Theo dõi real-time
- Email đẹp, đầy đủ thông tin
- Có link trực tiếp đến sheet

### ⚠️ Hạn chế:
- Chỉ hoạt động khi edit thủ công (không hoạt động với script tự động sửa)
- Mỗi lần edit → 1 email (có thể spam nếu edit liên tục)
- Cần quyền gửi email

### 🔒 Bảo mật:
- Script chỉ chạy với quyền của người cài đặt
- Không ai khác có thể sửa code (trừ owner)
- Email chỉ gửi đến địa chỉ cố định trong code

## 👨‍💻 Test & Debug

### Test thủ công:
1. Vào **Dashboard 2026**
2. Edit 1 ô bất kỳ ở **row 9, cột T-AG**
3. Kiểm tra email sau vài giây

### Test bằng script:
```
Extensions > Apps Script > Run > testEmailNotification
```

### Xem logs:
```
View > Logs (Ctrl + Enter)
hoặc
Extensions > Apps Script > Executions
```

## 📅 Cập nhật
Lần cuối: 07/02/2026

## 📞 Hỗ trợ
Nếu có lỗi, check:
1. Sheet name chính xác: "Dashboard 2026"
2. Quyền script đã cấp
3. Email không bị block/spam
4. Logs trong Apps Script
