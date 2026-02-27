const fs = require('fs');
require('dotenv').config();
const { getToken } = require('./getToken');

// Cấu hình API
const API_URL = 'https://lms-api.mindx.vn/';
let AUTH_TOKEN; // Sẽ được lấy tự động bằng getToken() trong main()

// GraphQL query
const query = `query GetClasses($search: String, $centre: String, $operationMethodId: [String], $openStatus: [String], $centres: [String], $courses: [String], $courseLines: [String], $startDateFrom: Date, $startDateTo: Date, $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date, $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String, $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String], $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $teacherId: String, $teacherSlot: [String], $passedSessionIndex: Int, $unpassedSessionIndex: Int, $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery) {
  classes(payload: {filter_textSearch: $search, centre_equals: $centre, centre_in: $centres, operationMethodId_in: $operationMethodId, teacher_equals: $teacherId, teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines, startDate_gt: $startDateFrom, startDate_lt: $startDateTo, endDate_gt: $endDateFrom, endDate_lt: $endDateTo, haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo, status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status, attendanceStatus_in: $attendanceStatus, studentAttendanceStatus_in: $studentAttendanceStatus, teacherAttendanceStatus_in: $teacherAttendanceStatus, attendanceChecked_exists: $attendanceCheckedExists, haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex, unpassedSessionIndex: $unpassedSessionIndex, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, comments: $comments, openStatus: $openStatus}) {
    data {
      id
      name
      level
      course {
        id
        name
        shortName
      }
      classSites {
        _id
        name
      }
      startDate
      endDate
      status
      centre {
        id
        name
        shortName
      }
      openingRoomNo
      numberOfSessions
      numberOfSessionsStatus
      sessionHour
      totalHour
      slots {
        _id
        date
        startTime
        endTime
        sessionHour
        summary
        homework
        teachers {
          _id
          teacher {
            id
            username
            code
            fullName
            email
            phoneNumber
            user
            imageUrl
          }
          role {
            id
            name
            shortName
          }
          isActive
        }
        teacherAttendance {
          _id
          teacher {
            id
            username
            code
            fullName
            email
            phoneNumber
            user
            imageUrl
          }
          status
          note
          createdBy
          createdAt
          lastModifiedBy
          lastModifiedAt
        }
        studentAttendance {
          _id
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
          }
          status
          comment
          sendCommentStatus
        }
      }
      students {
        _id
        student {
          id
          customer {
            fullName
            phoneNumber
            email
            facebook
            zalo
          }
        }
        note
        activeInClass
        createdBy
        createdAt
      }
      teachers {
        _id
        teacher {
          id
          username
          code
          fullName
          email
          phoneNumber
          user
          imageUrl
        }
        role {
          id
          name
          shortName
        }
        isActive
      }
      operator {
        id
        username
        firstName
        middleName
        lastName
      }
      operationMethod {
        id
        name
      }
      classOpeningPlanId
      hasSchedule
      createdBy
      createdAt
      lastModifiedBy
      lastModifiedAt
    }
    pagination {
      type
      total
    }
  }
}
`;

// Variables cho query (template)
const getVariables = (pageIndex) => ({
  search: "",
  centres: [],
  courses: [],
  courseLines: ["63f9bf1389ef5647c31978dd", "66aa05fff072e5001cb61320"],
  startDate: [],
  endDate: [],
  statusIn: ["RUNNING"],
  pageIndex: pageIndex,
  itemsPerPage: 100,
  orderBy: "createdAt_desc",
  type: "OFFSET",
  teacherSlot: [],
  passedSessionIndex: null,
  unpassedSessionIndex: null,
  haveSlotIn: {},
  comments: {
    criteria: []
  }
});

// Hàm fetch data từ API với pagination
async function fetchClasses(pageIndex = 0) {
  try {
    console.log(`Đang gửi request trang ${pageIndex}...`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'vi,en;q=0.9',
        'authorization': AUTH_TOKEN,
        'cache-control': 'no-cache',
        'content-language': 'vi',
        'content-type': 'application/json',
        'origin': 'https://lms.mindx.edu.vn',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://lms.mindx.edu.vn/',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        operationName: 'GetClasses',
        variables: getVariables(pageIndex),
        query: query
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Debug: kiểm tra response
    if (pageIndex === 0) {
      console.log('Response status:', response.status);
      if (data.errors) {
        console.log('API Errors:', JSON.stringify(data.errors, null, 2));
      }
    }
    
    console.log(`✓ Trang ${pageIndex}: Nhận ${data.data?.classes?.data?.length || 0} bản ghi`);
    
    return data;
  } catch (error) {
    console.error(`Lỗi khi fetch trang ${pageIndex}:`, error);
    throw error;
  }
}

// Hàm fetch tất cả dữ liệu với pagination tự động
async function fetchAllClasses() {
  const allClasses = [];
  let pageIndex = 0;
  let total = 0;
  
  try {
    while (true) {
      const result = await fetchClasses(pageIndex);
      
      if (!result.data?.classes?.data || result.data.classes.data.length === 0) {
        console.log('Không còn dữ liệu. Dừng lại.');
        break;
      }
      
      // Lưu total từ lần fetch đầu tiên
      if (pageIndex === 0) {
        total = result.data.classes.pagination.total;
        console.log(`📊 Tổng số lớp Robotics: ${total}`);
      }
      
      // Thêm dữ liệu vào mảng
      allClasses.push(...result.data.classes.data);
      
      // Kiểm tra xem đã lấy hết chưa
      if (allClasses.length >= total) {
        console.log('✓ Đã lấy hết dữ liệu!');
        break;
      }
      
      console.log(`Tiến độ: ${allClasses.length}/${total} lớp`);
      
      // Chuyển sang trang tiếp theo
      pageIndex++;
      
      // Delay nhẹ để tránh quá tải server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      classes: allClasses,
      total: total
    };
    
  } catch (error) {
    console.error('Lỗi khi fetch all data:', error);
    throw error;
  }
}

// Hàm chuyển đổi JSON sang CSV
function convertToCSV(classes) {
  if (!classes || classes.length === 0) {
    return '';
  }

  // Định nghĩa các cột cho CSV
  const headers = [
    'ID',
    'Tên lớp',
    'Level',
    'Khóa học',
    'Trung tâm',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Trạng thái',
    'Phòng học',
    'Số buổi học',
    'Giờ/buổi',
    'Tổng giờ',
    'Số học viên',
    'Giáo viên'
  ];

  // Tạo header row
  let csv = headers.join(',') + '\n';

  // Thêm data rows
  classes.forEach(cls => {
    const row = [
      cls.id || '',
      `"${cls.name || ''}"`,
      cls.level || '',
      `"${cls.course?.name || ''}"`,
      `"${cls.centre?.name || ''}"`,
      cls.startDate || '',
      cls.endDate || '',
      cls.status || '',
      cls.openingRoomNo || '',
      cls.numberOfSessions || '',
      cls.sessionHour || '',
      cls.totalHour || '',
      cls.students?.length || 0,
      `"${cls.teachers?.map(t => t.teacher?.fullName).filter(Boolean).join(', ') || ''}"`
    ];
    
    csv += row.join(',') + '\n';
  });

  return csv;
}

// Hàm chính
async function main() {
  try {
    AUTH_TOKEN = await getToken();
    console.log('🚀 Bắt đầu kéo dữ liệu lớp Robotics...\n');
    
    // Fetch tất cả data
    const { classes, total } = await fetchAllClasses();
    
    console.log(`\n✓ Hoàn thành! Đã lấy ${classes.length}/${total} lớp Robotics`);
    
    // Lưu JSON đầy đủ
    fs.writeFileSync('robotics_classes_full.json', JSON.stringify(classes, null, 2), 'utf-8');
    console.log('✓ Đã lưu JSON đầy đủ vào robotics_classes_full.json');
    
    // Chuyển đổi và lưu CSV
    if (classes.length > 0) {
      const csv = convertToCSV(classes);
      fs.writeFileSync('robotics_classes.csv', csv, 'utf-8');
      console.log('✓ Đã lưu CSV vào robotics_classes.csv');
      console.log(`\n📊 Thống kê:`);
      console.log(`   - Tổng số lớp: ${classes.length}`);
      console.log(`   - File JSON: robotics_classes_full.json`);
      console.log(`   - File CSV: robotics_classes.csv`);
    } else {
      console.log('⚠ Không có dữ liệu để lưu');
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

// Chạy chương trình
main();
