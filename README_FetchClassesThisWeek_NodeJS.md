# Fetch Classes This Week - Node.js Version

## 📋 Mô tả
Script Node.js kéo dữ liệu các lớp học có **end_date** từ **Thứ 5 tuần này** đến **Thứ 4 tuần sau** từ LMS API.

**✨ Tính năng:**
- ✅ Chạy trên local machine (không bị chặn IP như Google Apps Script)
- ✅ Tính toán ngày thông minh (Thứ 5 → Thứ 4)
- ✅ Phân trang tự động
- ✅ Xuất kết quả ra **CSV** và **JSON**

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

## 📦 Cài đặt

### Bước 1: Kiểm tra Node.js
```bash
node --version
# Cần Node.js >= 14
```

### Bước 2: Cài packages (nếu chưa có)
```bash
npm install
```

Hoặc cài riêng:
```bash
npm install dotenv
```

### Bước 3: Cấu hình token

**Tạo file `.env`** (nếu chưa có):
```env
AUTH_TOKEN=your_token_here
```

**Lấy token:**
1. Mở Chrome DevTools (F12)
2. Vào tab **Network**
3. Truy cập https://lms.mindx.vn/
4. Tìm request đến `lms-api.mindx.vn`
5. Copy giá trị `authorization` từ Request Headers
6. Paste vào file `.env`

## 🚀 Sử dụng

### Chạy script:
```bash
node fetchClassesThisWeek.js
```

### Output:
```
🚀 Bắt đầu kéo dữ liệu...

📅 Kéo dữ liệu từ 05/02/2026 đến 11/02/2026
✅ Đã kéo trang 1/3: 100 lớp
✅ Đã kéu trang 2/3: 100 lớp
✅ Đã kéu trang 3/3: 45 lớp
🎉 Tổng cộng: 245 lớp
✅ Đã xuất file: classes_thisweek_2026-02-07T10-30-00.csv
✅ Đã xuất file: classes_thisweek_2026-02-07T10-30-00.json

✅ Hoàn thành!
```

## 📊 Dữ liệu trả về

### File CSV: `classes_thisweek_YYYY-MM-DDTHH-MM-SS.csv`
```
class_id,class_name,centre,start_date,end_date,status,course,teachers,student_count
123,LBB-JSB14 (1:1),HCM01,2026-01-05,2026-02-10,RUNNING,JavaScript Basic,John Doe - johndoe (Lecturer),15
```

### File JSON: `classes_thisweek_YYYY-MM-DDTHH-MM-SS.json`
```json
[
  {
    "id": "123",
    "name": "LBB-JSB14 (1:1)",
    "centre": {
      "id": "hcm01",
      "name": "HCM01",
      "shortName": "HCM01"
    },
    "startDate": "2026-01-05",
    "endDate": "2026-02-10",
    "status": "RUNNING",
    "course": {
      "id": "jsb",
      "name": "JavaScript Basic",
      "shortName": "JSB"
    },
    "teachers": [
      {
        "user": {
          "id": "456",
          "fullName": "John Doe",
          "username": "johndoe"
        },
        "type": "LECTURER"
      }
    ],
    "studentCount": 15
  }
]
```

## 🔧 Troubleshooting

### ❌ `Cannot find module 'dotenv'`
```bash
npm install dotenv
```

### ❌ `Không tìm thấy AUTH_TOKEN trong file .env`
- Kiểm tra file `.env` có tồn tại không
- Kiểm tra format: `AUTH_TOKEN=Bearer eyJ...`
- Đảm bảo không có khoảng trắng thừa

### ❌ `API trả về lỗi: 401 - Unauthorized`
- Token đã hết hạn, cần lấy token mới
- Làm lại Bước 3

### ❌ `API trả về lỗi: 403 - Forbidden`
- IP của bạn chưa được whitelist
- Liên hệ admin để thêm IP vào whitelist

## 🔄 So sánh với Google Apps Script

| Feature | Google Apps Script | Node.js |
|---------|-------------------|---------|
| 🌐 IP | Google servers (bị chặn) | **Local machine (OK)** ✅ |
| 🔐 Token | Tự động (Firebase) | Manual (.env) |
| 📊 Output | Google Sheets | **CSV + JSON** ✅ |
| ⚡ Tốc độ | Chậm hơn | **Nhanh hơn** ✅ |
| 🔄 Automation | Triggers/Menu | **Cron jobs** ✅ |

## 💡 Tips

### Import vào Google Sheets:
1. Mở Google Sheets
2. **File** → **Import** → **Upload**
3. Chọn file CSV vừa export
4. Chọn **Replace current sheet** hoặc **Insert new sheet**

### Lên lịch tự động (cron):
**Windows Task Scheduler:**
```
Trigger: Weekly, Thursday 8:00 AM
Action: node D:\mindXLeader\getDataLms\fetchClassesThisWeek.js
```

**Linux/Mac crontab:**
```bash
# Chạy mỗi thứ 5 lúc 8:00 AM
0 8 * * 4 cd /path/to/getDataLms && node fetchClassesThisWeek.js
```

## 📝 Notes

- Token có thời hạn ~1 giờ, nếu script chạy lâu có thể cần refresh
- File output có timestamp để tránh ghi đè
- CSV có UTF-8 BOM để Excel đọc được tiếng Việt
- Delay 500ms giữa các request để tránh rate limit
