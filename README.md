# MindX LMS Data Fetcher

Script để kéo dữ liệu lớp học từ MindX LMS API và chuyển đổi sang CSV.

## Cài đặt

```bash
npm install
```

## Chạy chương trình

```bash
npm start
```

hoặc

```bash
node fetchData.js
```

## Kết quả

- `classes_data.json`: Dữ liệu JSON đầy đủ từ API
- `classes_data.csv`: Dữ liệu được chuyển đổi sang định dạng CSV

## Tùy chỉnh

Có thể thay đổi các tham số trong biến `variables`:
- `itemsPerPage`: Số lượng bản ghi mỗi trang (mặc định: 20)
- `pageIndex`: Trang hiện tại (mặc định: 0)
- `statusIn`: Lọc theo trạng thái (mặc định: ["RUNNING"])
- `orderBy`: Sắp xếp (mặc định: "createdAt_desc")

## Lưu ý

- Token authorization có thể hết hạn, cần cập nhật token mới khi cần
- Script sử dụng fetch API (có sẵn từ Node.js 18+)
