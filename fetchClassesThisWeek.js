const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getToken } = require('./getToken');

// Cấu hình API
const API_URL = 'https://lms-api.mindx.vn/';
let AUTH_TOKEN; // Sẽ được lấy tự động bằng getToken() trong main()

/**
 * Tính ngày thứ 5 tuần này
 * Luôn lấy T5 của tuần hiện tại (CN-T7)
 */
function getThisThursday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  
  // Công thức đơn giản: 4 - dayOfWeek
  // Âm = T5 đã qua (T6, T7), Dương = T5 sắp tới (CN-T4), 0 = hôm nay (T5)
  const daysToThursday = 4 - dayOfWeek;
  
  const thursday = new Date(today);
  thursday.setDate(today.getDate() + daysToThursday);
  thursday.setHours(0, 0, 0, 0);
  
  return thursday;
}

/**
 * Tính ngày thứ 4 tuần sau
 * = Thứ 5 tuần này + 6 ngày (tổng 7 ngày)
 */
function getNextWednesday() {
  const thisThursday = getThisThursday();
  const nextWednesday = new Date(thisThursday);
  nextWednesday.setDate(thisThursday.getDate() + 6);
  nextWednesday.setHours(23, 59, 59, 999);
  
  return nextWednesday;
}

/**
 * GraphQL query
 */
const query = `query GetClasses($endDateFrom: Date, $endDateTo: Date, $pageIndex: Int!, $itemsPerPage: Int!) {
  classes(payload: {
    endDate_gt: $endDateFrom, 
    endDate_lt: $endDateTo, 
    pageIndex: $pageIndex, 
    itemsPerPage: $itemsPerPage, 
    orderBy: "endDate"
  }) {
    data {
      id
      name
      centre {
        id
        name
        shortName
      }
      startDate
      endDate
      status
      course {
        id
        name
        shortName
      }
      teachers {
        user {
          id
          fullName
          username
        }
        type
      }
      studentCount
    }
    pagination {
      totalCount
      pageIndex
      itemsPerPage
      totalPages
    }
  }
}`;

/**
 * Format teachers
 */
function formatTeachers(teachers) {
  if (!teachers || teachers.length === 0) return '';
  
  return teachers.map(t => {
    const name = t.user.fullName;
    const username = t.user.username;
    const typeMap = {
      'LECTURER': 'Lecturer',
      'JUDGE': 'Judge',
      'TEACHER_ASSISSTANT': 'Teacher Assistant',
      'SUPPLY_TEACHER': 'Supply Teacher'
    };
    const type = typeMap[t.type] || t.type;
    return `${name} - ${username} (${type})`;
  }).join(' ; ');
}

/**
 * Fetch dữ liệu từ API
 */
async function fetchClassesData() {
  try {
    const thisThursday = getThisThursday();
    const nextWednesday = getNextWednesday();
    
    console.log(`📅 Kéo dữ liệu từ ${thisThursday.toLocaleDateString('vi-VN')} đến ${nextWednesday.toLocaleDateString('vi-VN')}`);
    
    const allClasses = [];
    let pageIndex = 1;
    const itemsPerPage = 100;
    let totalPages = 1;
    
    while (pageIndex <= totalPages) {
      const variables = {
        endDateFrom: thisThursday.toISOString(),
        endDateTo: nextWednesday.toISOString(),
        pageIndex: pageIndex,
        itemsPerPage: itemsPerPage
      };
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': AUTH_TOKEN
        },
        body: JSON.stringify({
          query: query,
          variables: variables
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API trả về lỗi: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      }
      
      const classes = data.data.classes.data;
      const pagination = data.data.classes.pagination;
      
      allClasses.push(...classes);
      totalPages = pagination.totalPages;
      
      console.log(`✅ Đã kéo trang ${pageIndex}/${pagination.totalPages}: ${classes.length} lớp`);
      
      pageIndex++;
      
      // Delay để tránh rate limit
      if (pageIndex <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`🎉 Tổng cộng: ${allClasses.length} lớp`);
    
    return allClasses;
    
  } catch (error) {
    console.error(`❌ Lỗi: ${error.message}`);
    throw error;
  }
}

/**
 * Xuất ra CSV
 */
function exportToCSV(classes, filename) {
  const headers = [
    'class_id',
    'class_name',
    'centre',
    'start_date',
    'end_date',
    'status',
    'course',
    'teachers',
    'student_count'
  ];
  
  const rows = classes.map(c => [
    c.id,
    c.name,
    c.centre ? c.centre.name : '',
    c.startDate,
    c.endDate,
    c.status,
    c.course ? c.course.name : '',
    formatTeachers(c.teachers),
    c.studentCount || 0
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape dấu ngoặc kép và xuống dòng
      const escaped = String(cell).replace(/"/g, '""');
      // Wrap trong quotes nếu có dấu phẩy hoặc xuống dòng
      return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
    }).join(','))
  ].join('\n');
  
  fs.writeFileSync(filename, '\uFEFF' + csvContent, 'utf8'); // UTF-8 BOM để Excel đọc được tiếng Việt
  console.log(`✅ Đã xuất file: ${filename}`);
}

/**
 * Xuất ra JSON
 */
function exportToJSON(classes, filename) {
  fs.writeFileSync(filename, JSON.stringify(classes, null, 2), 'utf8');
  console.log(`✅ Đã xuất file: ${filename}`);
}

/**
 * Main function
 */
async function main() {
  try {
    AUTH_TOKEN = await getToken();
    console.log('🚀 Bắt đầu kéo dữ liệu...\n');
    
    const classes = await fetchClassesData();
    
    // Tạo tên file với timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    const csvFilename = `classes_thisweek_${timestamp}.csv`;
    const jsonFilename = `classes_thisweek_${timestamp}.json`;
    
    exportToCSV(classes, csvFilename);
    exportToJSON(classes, jsonFilename);
    
    console.log('\n✅ Hoàn thành!');
    
  } catch (error) {
    console.error(`\n❌ Lỗi: ${error.message}`);
    process.exit(1);
  }
}

// Chạy
main();
