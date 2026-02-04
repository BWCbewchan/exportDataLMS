# 📚 MindX LMS Data Fetcher & Calendar Generator

Bộ công cụ để kéo dữ liệu lớp học từ MindX LMS API và tạo lịch học tương tác.

## 🚀 Cài đặt

```bash
npm install
```

Tạo file `.env` để lưu token xác thực:
```bash
AUTH_TOKEN=your_token_here
```

## 📖 Hướng dẫn sử dụng

### 1️⃣ Kéo dữ liệu từ LMS API

**File:** `fetchData.js`

Lấy dữ liệu tất cả lớp học Robotics từ MindX LMS API.

```bash
npm start
# hoặc
node fetchData.js
```

**Dữ liệu xuất ra:**
- ✅ `robotics_classes_full.json` - Dữ liệu JSON đầy đủ của 169 lớp học
- ✅ `robotics_classes.csv` - Dữ liệu CSV (tên lớp, cơ sở, giáo viên, số học sinh)

**Cấu trúc dữ liệu JSON:**
```json
[
  {
    "_id": "...",
    "name": "MX-HBT-ROB02-01",
    "centre": {
      "name": "Hai Bà Trưng"
    },
    "teachers": [
      {
        "teacher": {
          "fullName": "Nguyễn Văn A"
        }
      }
    ],
    "students": [...],
    "numberOfSessions": 24,
    "slots": [
      {
        "date": "2026-01-27T00:00:00.000Z",
        "startTime": "2026-01-27T10:00:00.000Z",
        "endTime": "2026-01-27T12:00:00.000Z",
        "summary": "Nội dung buổi học",
        "homework": "Bài tập về nhà"
      }
    ]
  }
]
```

**Tùy chỉnh tham số trong `variables`:**
- `itemsPerPage`: Số lượng bản ghi mỗi trang (mặc định: 100)
- `pageIndex`: Trang hiện tại (mặc định: 0)
- `courseLines`: ID khóa học Robotics
- `statusIn`: Lọc theo trạng thái (mặc định: ["RUNNING"])

---

### 2️⃣ Tạo lịch học tương tác

**File:** `generateWeekCalendar.js`

Tạo lịch học HTML tương tác cho cả tháng với khả năng lọc và tìm kiếm.

```bash
node generateWeekCalendar.js
```

**Dữ liệu xuất ra:**
- ✅ `robotics_week_calendar.html` - Lịch học tương tác HTML

**Tính năng của lịch HTML:**

🎯 **Điều hướng tuần:**
- Nút "Tuần trước" / "Tuần sau" để xem các tuần trong tháng
- Hiển thị tự động tuần hiện tại khi mở

🔍 **Tìm kiếm và lọc:**
- **Lọc theo cơ sở:** Dropdown chọn cơ sở (Hai Bà Trưng, Đống Đa, Hoàng Mai, v.v.)
- **Lọc theo loại lớp:** 
  - 🟣 Robotics (-rob-)
  - 🔴 Kindergarten (-kind-)  
  - 🔵 Khác
- **Tìm kiếm giáo viên:** Gõ tên giáo viên → lọc realtime

📊 **Thống kê:**
- Tổng số buổi học trong tuần
- Số buổi học đang hiển thị (sau khi lọc)

🎨 **Giao diện:**
- Hiển thị lịch theo 7 ngày trong tuần (Thứ 2 → Chủ nhật)
- Mỗi lớp hiển thị:
  - Loại lớp (badge ROB/KIND/Khác)
  - Tên lớp
  - Thời gian (giờ bắt đầu - giờ kết thúc)
  - Số buổi (ví dụ: Buổi 5/24)
  - Số học sinh
  - Tên giáo viên
  - Cơ sở
- Màu sắc phân biệt:
  - Robotics: Gradient tím (#667eea → #764ba2)
  - Kindergarten: Gradient hồng (#f093fb → #f5576c)
  - Khác: Gradient xanh (#4facfe → #00f2fe)

**Ví dụ dữ liệu calendar:**
```javascript
{
  "weekStart": "02/02/2026",
  "weekEnd": "08/02/2026",
  "centres": ["Hai Bà Trưng", "Đống Đa", ...],
  "teachers": ["Nguyễn Văn A", "Trần Thị B", ...],
  "days": [
    {
      "dayName": "Thứ 2",
      "date": "02/02/2026",
      "classes": [
        {
          "className": "MX-HBT-ROB02-01",
          "centre": "Hai Bà Trưng",
          "session": 5,
          "totalSessions": 24,
          "startTime": "10:00",
          "endTime": "12:00",
          "teachers": "Nguyễn Văn A",
          "studentCount": 15,
          "classType": "robotics"
        }
      ]
    }
  ]
}
```

---

## 📂 Cấu trúc file đầu ra

```
getDataLms/
├── robotics_classes_full.json    # 169 lớp học (dữ liệu đầy đủ)
├── robotics_classes.csv          # Dữ liệu CSV đơn giản
└── robotics_week_calendar.html   # Lịch học tương tác
```

### File mẫu đầu ra

**1. robotics_classes_full.json**
- Dung lượng: ~500KB
- Số lượng: 169 lớp học Robotics
- Chứa: Thông tin chi tiết lớp, giáo viên, học sinh, lịch học từng buổi

**2. robotics_classes.csv**
```csv
Tên lớp,Cơ sở,Giáo viên,Số học sinh
MX-HBT-ROB02-01,Hai Bà Trưng,"Nguyễn Văn A",15
MX-DD-ROB01-03,Đống Đa,"Trần Thị B, Lê Văn C",12
...
```

**3. robotics_week_calendar.html**
- File HTML độc lập, mở trực tiếp bằng trình duyệt
- Responsive design (tương thích mobile)
- Không cần server, chạy hoàn toàn offline
- Chứa tất cả CSS/JavaScript inline

---

## 🔧 Cấu hình nâng cao

### Thay đổi token trong `.env`

Token xác thực thường hết hạn sau ~1 giờ. Để lấy token mới:

1. Đăng nhập vào LMS MindX
2. Mở DevTools (F12) → Tab Network
3. Thực hiện một action bất kỳ
4. Tìm request có header `authorization`
5. Copy token và cập nhật vào `.env`

### Lọc theo khóa học khác

Trong `fetchData.js`, thay đổi `courseLines`:

```javascript
const variables = {
  // Thêm ID khóa học khác
  courseLines: ["63f9bf1389ef5647c31978dd", "66aa05fff072e5001cb61320"],
  // ...
};
```

---

## 💡 Lưu ý

- ✅ Cần Node.js 18+ (hỗ trợ Fetch API)
- ✅ Token authorization trong `.env` sẽ hết hạn, cần cập nhật định kỳ
- ✅ Script tự động phân trang để lấy hết dữ liệu
- ✅ Calendar hiển thị tháng hiện tại và tự động chọn tuần hiện tại
- ⚠️ Dữ liệu lớn có thể làm chậm trình duyệt (741 buổi học/tháng)

---

## 🎯 Workflow sử dụng

```bash
# Bước 1: Kéo dữ liệu từ API
node fetchData.js
# → Tạo robotics_classes_full.json và robotics_classes.csv

# Bước 2: Tạo lịch học
node generateWeekCalendar.js
# → Tạo robotics_week_calendar.html

# Bước 3: Mở lịch trong trình duyệt
# Double click vào robotics_week_calendar.html
```

---

## 📊 Thống kê dữ liệu mẫu (Tháng 2/2026)

- **Tổng số lớp:** 169 lớp Robotics
- **Tổng số buổi học trong tháng:** 741 buổi
- **Số tuần:** 5 tuần
- **Phân bố:**
  - Tuần 1: 167 buổi
  - Tuần 2: 167 buổi (tuần hiện tại)
  - Tuần 3: 153 buổi
  - Tuần 4: 136 buổi
  - Tuần 5: 118 buổi

- **Số cơ sở:** 7 cơ sở (Hai Bà Trưng, Đống Đa, Hoàng Mai, v.v.)
- **Loại lớp:** Robotics, Kindergarten, và các khóa khác

---

## 🐛 Xử lý lỗi thường gặp

**Lỗi:** `❌ Lỗi khi đọc file robotics_classes_full.json`
- **Giải pháp:** Chạy `node fetchData.js` trước khi chạy `generateWeekCalendar.js`

**Lỗi:** `401 Unauthorized`
- **Giải pháp:** Cập nhật `AUTH_TOKEN` mới trong file `.env`

**Lỗi:** Calendar không hiển thị lớp
- **Giải pháp:** Kiểm tra filter (reset về "Tất cả"), xóa trắng ô tìm kiếm
