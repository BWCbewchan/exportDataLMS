/**
 * ROBOTICS SESSION 4 & 8 FETCHER
 * 
 * LẤY LỚP HỌC ROBOTICS CÓ BUỔI 4 VÀ BUỔI 8 TRONG THÁNG CHỈ ĐỊNH
 * Script chuyên dụng để lấy danh sách lớp Robotics có buổi 4 hoặc buổi 8 trong tháng cụ thể
 * 
 * THAM SỐ:
 * - targetMonth: Tháng cần lấy (1-12), mặc định = tháng hiện tại
 * - targetYear: Năm cần lấy (VD: 2026), mặc định = năm hiện tại
 * 
 * OUTPUT:
 * - Sheet 1: "All Robotics Classes" - Toàn bộ lớp Robotics đang RUNNING
 * - Sheet 2: "Robotics Session 4 & 8" - Lọc lớp có buổi 4/8 trong tháng
 */

// ========================================
// CẤU HÌNH
// ========================================

const ROBOTICS_CONFIG = {
  API_URL: 'https://lms-api.mindx.vn/',
  AUTH_TOKEN: '', // Sẽ được tự động cập nhật
  SHEET_ALL_CLASSES: 'All Robotics Classes',  // Sheet chứa TẤT CẢ lớp
  SHEET_SESSION_4_8: 'Robotics Session 4 & 8', // Sheet chỉ lọc buổi 4&8
  RECORDS_PER_PAGE: 50, // Giảm xuống để tránh lỗi 502/Timeout
  MAX_RETRIES: 3,       // Số lần thử lại khi lỗi
  SLEEP_TIME: 1000      // Thời gian nghỉ giữa các page (ms)
};

// Robotics-specific GraphQL query
const ROBOTICS_CLASSES_QUERY = `query GetClasses($search: String, $centre: String, $operationMethodId: [String], $openStatus: [String], $centres: [String], $courses: [String], $courseLines: [String], $startDateFrom: Date, $startDateTo: Date, $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date, $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String, $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String], $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $teacherId: String, $teacherSlot: [String], $passedSessionIndex: Int, $unpassedSessionIndex: Int, $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery) {
  classes(payload: {filter_textSearch: $search, centre_equals: $centre, centre_in: $centres, operationMethodId_in: $operationMethodId, teacher_equals: $teacherId, teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines, startDate_gt: $startDateFrom, startDate_lt: $startDateTo, endDate_gt: $endDateFrom, endDate_lt: $endDateTo, haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo, status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status, attendanceStatus_in: $attendanceStatus, studentAttendanceStatus_in: $studentAttendanceStatus, teacherAttendanceStatus_in: $teacherAttendanceStatus, attendanceChecked_exists: $attendanceCheckedExists, haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex, unpassedSessionIndex: $unpassedSessionIndex, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, comments: $comments, openStatus: $openStatus}) {
    data {
      id
      name
      status
      startDate
      endDate
      students {
        _id
        student {
          id
        }
      }
      teachers {
        _id
        teacher {
          id
          fullName
        }
        role {
          id
          name
          shortName
        }
        isActive
      }
      slots {
        _id
        date
        startTime
        endTime
      }
    }
    pagination {
      type
      total
    }
  }
}`;

// Robotics Course Line IDs (Session 4 & 8 specific)
const ROBOTICS_SESSION_4_8_COURSE_LINES = ["63f9bf1389ef5647c31978dd", "66aa05fff072e5001cb61320"];

// ========================================
// MAIN FUNCTION
// ========================================

/**
 * Hàm chính: 
 * 1. Fetch TOÀN BỘ dữ liệu lớp Robotics về trước
 * 2. Ghi tất cả lớp vào sheet "All Robotics Classes"
 * 3. Lọc và ghi lớp có buổi 4 & 8 vào sheet "Robotics Session 4 & 8"
 * 
 * @param {number} targetMonth - Tháng cần lấy (1-12), mặc định = tháng hiện tại
 * @param {number} targetYear - Năm cần lấy (VD: 2026), mặc định = năm hiện tại
 */
function fetchSession4And8Classes(targetMonth, targetYear) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Xác định tháng/năm cần lấy
    const now = new Date();
    const month = targetMonth || (now.getMonth() + 1);
    const year = targetYear || now.getFullYear();
    
    Logger.log(`📅 Khung thời gian: Tháng ${month}/${year}`);
    ss.toast(`📅 Chuẩn bị fetch dữ liệu tháng ${month}/${year}...`, 'Bắt đầu', 3);
    
    // BƯỚC 1: Clear sheets cũ trước
    Logger.log('🗑️ Xóa dữ liệu cũ trước khi fetch mới...');
    ss.toast('🗑️ Đang xóa dữ liệu cũ...', 'Chuẩn bị', 2);
    clearOldSheets();
    
    // BƯỚC 2: Chuẩn bị Token
    Logger.log('🔐 Lấy Firebase token...');
    ROBOTICS_CONFIG.AUTH_TOKEN = getSessionFirebaseToken();
    
    // BƯỚC 3: FETCH LẠI TOÀN BỘ DANH SÁCH LỚP ROBOTICS
    Logger.log('🚀 Đang lấy lại TOÀN BỘ danh sách lớp Robotics từ API...');
    ss.toast('🚀 Đang lấy lại danh sách ALL Robotics Classes...', 'Fetching API', 3);
    
    const allClasses = fetchAllClassesData();
    Logger.log(`✅ Đã fetch xong: ${allClasses.length} lớp Robotics.`);
    ss.toast(`✅ Đã lấy được ${allClasses.length} lớp Robotics!`, 'Fetch Complete', 2);
    
    // BƯỚC 4: GHI TẤT CẢ LỚP VÀO SHEET 1
    Logger.log(`📝 Đang ghi ${allClasses.length} lớp vào sheet "${ROBOTICS_CONFIG.SHEET_ALL_CLASSES}"...`);
    ss.toast(`📝 Đang ghi ${allClasses.length} lớp vào "All Robotics Classes"...`, 'Writing Data', 2);
    writeAllClassesToSheet(allClasses);
    Logger.log(`✅ Đã ghi xong sheet "All Robotics Classes"`);
    
    // BƯỚC 5: LỌC VÀ GHI BUỔI 4 & 8 VÀO SHEET 2
    Logger.log(`🔄 Đang lọc lớp có buổi 4 & 8 trong tháng ${month}/${year}...`);
    ss.toast(`🔄 Đang lọc lớp có buổi 4/8 tháng ${month}/${year}...`, 'Filtering', 2);
    
    const filteredClasses = filterSession4And8(allClasses, month, year);
    Logger.log(`📝 Đang ghi ${filteredClasses.length} lớp có buổi 4&8 vào sheet "${ROBOTICS_CONFIG.SHEET_SESSION_4_8}"...`);
    writeSession4And8ToSheet(filteredClasses, month, year);
    Logger.log(`✅ Đã ghi xong sheet "Robotics Session 4 & 8"`);
    
    // BƯỚC 6: THÔNG BÁO HOÀN THÀNH
    Logger.log(`\n🎉 HOÀN THÀNH!`);
    Logger.log(`   - Tổng số lớp Robotics: ${allClasses.length} (đã refresh từ API)`);
    Logger.log(`   - Lớp có buổi 4/8 tháng ${month}/${year}: ${filteredClasses.length}`);
    
    ss.toast(
      `✅ Tháng ${month}/${year}: ${allClasses.length} lớp Robotics (mới), ${filteredClasses.length} lớp có buổi 4/8!`, 
      'Hoàn thành', 
      5
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

/**
 * Clear các sheet cũ trước khi fetch dữ liệu mới
 */
function clearOldSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Clear sheet All Robotics Classes
  let sheet = ss.getSheetByName(ROBOTICS_CONFIG.SHEET_ALL_CLASSES);
  if (sheet) {
    sheet.clear();
    Logger.log(`   ✓ Đã xóa "${ROBOTICS_CONFIG.SHEET_ALL_CLASSES}"`);
  }
  
  // Clear sheet Robotics Session 4 & 8
  sheet = ss.getSheetByName(ROBOTICS_CONFIG.SHEET_SESSION_4_8);
  if (sheet) {
    sheet.clear();
    Logger.log(`   ✓ Đã xóa "${ROBOTICS_CONFIG.SHEET_SESSION_4_8}"`);
  }
}

/**
 * Hàm fetch TOÀN BỘ dữ liệu (Loop trang)
 */
function fetchAllClassesData() {
  let allData = [];
  let page = 0;
  let hasMore = true;
  let emptyCount = 0;
  
  do {
    Logger.log(`📥 Đang tải trang ${page + 1}... (Đã lấy: ${allData.length})`);
    
    let response;
    try {
      response = fetchClassesWithRetry(page);
    } catch (e) {
      Logger.log(`⚠️ Bỏ qua trang ${page + 1} do lỗi lặp lại: ` + e.message);
      break; 
    }
    
    if (!response) break;
    
    const result = JSON.parse(response.getContentText());
    if (result.errors) throw new Error('API Error: ' + JSON.stringify(result.errors));
    
    const classData = result.data?.classes?.data || [];
    const pagination = result.data?.classes?.pagination || {};
    const total = pagination.total || 0;
    
    if (classData.length === 0) {
      emptyCount++;
      if(emptyCount >= 2) hasMore = false; // Dừng nếu 2 lần liên tiếp rỗng
      break;
    } else {
      emptyCount = 0;
    }
    
    allData = allData.concat(classData);
    
    // Kiểm tra xem đã lấy đủ chưa
    if (total > 0 && allData.length >= total) {
      Logger.log(`✅ Đã lấy đủ ${total} lớp.`);
      hasMore = false;
    }
    
    // Hoặc nếu lấy ít hơn limit -> hết trang
    if (classData.length < ROBOTICS_CONFIG.RECORDS_PER_PAGE) {
       hasMore = false;
    }
    
    page++;
    Utilities.sleep(ROBOTICS_CONFIG.SLEEP_TIME); // Nghỉ xíu tránh 502
    
  } while (hasMore);
  
  return allData;
}

/**
 * Fetch API với cơ chế Retry khi lỗi server (5xx) hoặc 401
 */
function fetchClassesWithRetry(page) {
  const makeRequest = () => {
    const variables = {
        search: "-rob-",
        centres: [],
        courses: [],
        courseLines: ROBOTICS_SESSION_4_8_COURSE_LINES,
        startDate: [null, null],
        endDate: [null, null],
        statusIn: ["RUNNING"],
        pageIndex: page,
        itemsPerPage: ROBOTICS_CONFIG.RECORDS_PER_PAGE,
        orderBy: "createdAt_desc",
        type: "OFFSET",
        teacherSlot: [],
        passedSessionIndex: null,
        unpassedSessionIndex: null,
        haveSlotIn: {},
        comments: { criteria: [] }
    };
    
    const payload = {
        operationName: 'GetClasses',
        variables: variables,
        query: ROBOTICS_CLASSES_QUERY
    };
    
    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'accept': '*/*',
            'authorization': ROBOTICS_CONFIG.AUTH_TOKEN,
            'cache-control': 'no-cache',
            'content-language': 'vi',
            'origin': 'https://lms.mindx.edu.vn',
            'referer': 'https://lms.mindx.edu.vn/'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };
    
    return UrlFetchApp.fetch(ROBOTICS_CONFIG.API_URL, options);
  };

  let attempts = 0;
  let lastError;
  
  while (attempts < ROBOTICS_CONFIG.MAX_RETRIES) {
    try {
      if (attempts > 0) {
        Logger.log(`🔄 Thử lại lần ${attempts}... (Page ${page + 1})`);
        Utilities.sleep(1000 * Math.pow(2, attempts)); // Exponential backoff
      }
      
      let response = makeRequest();
      const code = response.getResponseCode();
      
      // 2. Xử lý lỗi 401: Refresh Token và thử lại ngay lập tức
      if (code === 401) {
        Logger.log('⚠️ Token hết hạn (401). Đang gọi getFirebaseIdToken()...');
        try {
           ROBOTICS_CONFIG.AUTH_TOKEN = getFirebaseIdToken(); 
           response = makeRequest(); // Thử lại ngay với token mới
        } catch (e) {
           throw new Error('Không thể refresh token: ' + e.toString());
        }
      }
      
      // 3. Xử lý lỗi 5xx (Server Error) -> Retry loop
      if (code >= 500) {
        throw new Error(`Server Error ${code}`);
      }
      
      // 4. Nếu 200 OK -> Return
      if (code === 200) {
        return response;
      }
      
      // Các lỗi khác (400, 403, etc) -> Throw luôn
      throw new Error(`API Error: ${code} - ${response.getContentText()}`);
      
    } catch (e) {
      lastError = e;
      Logger.log(`⚠️ Lỗi fetch (Attempt ${attempts + 1}): ` + e.toString());
      attempts++;
    }
  }
  
  throw lastError; // Hết số lần thử mà vẫn lỗi
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Ghi TẤT CẢ lớp Robotics vào sheet 1
 */
function writeAllClassesToSheet(allClasses) {
  const sheet = prepareSheet(ROBOTICS_CONFIG.SHEET_ALL_CLASSES);
  
  // Header
  const headers = ['Tên lớp', 'Status', 'Số học sinh', 'LEC', 'Tổng số buổi', 'Giờ học'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#34495E')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Data rows
  const rows = allClasses.map(cls => {
    const className = cls.name || '';
    const status = cls.status || '';
    const totalStudents = cls.students?.length || 0;
    const totalSlots = cls.slots?.length || 0;
    
    const teachers = cls.teachers
      ?.filter(t => t.role?.shortName === 'LEC' || t.role?.name?.includes('LEC'))
      .map(t => t.teacher?.fullName)
      .filter(Boolean)
      .join(', ') || '';
      
    const allTeachers = teachers || cls.teachers
      ?.map(t => t.teacher?.fullName)
      .filter(Boolean)
      .join(', ') || '';
    
    // Lấy các khung giờ học unique từ slots
    const timeSlots = cls.slots
      ?.map(slot => {
        if (!slot.startTime || !slot.endTime) return null;
        return `${slot.startTime}-${slot.endTime}`;
      })
      .filter(Boolean) || [];
    
    // Loại bỏ duplicate và sắp xếp
    const uniqueTimeSlots = [...new Set(timeSlots)].sort().join(', ');
    
    return [className, status, totalStudents, allTeachers, totalSlots, uniqueTimeSlots];
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    formatSheet(sheet, rows.length + 1, headers.length, 2); // Column 2 = Status
  }
}

/**
 * Lọc lớp có buổi 4 HOẶC buổi 8 trong tháng chỉ định
 */
function filterSession4And8(allClasses, targetMonth, targetYear) {
  const filtered = [];
  
  allClasses.forEach(cls => {
    if (!cls.slots || cls.slots.length === 0) return;
    
    let session4 = null;
    let session8 = null;
    let session4InMonth = false;
    let session8InMonth = false;
    
    // Tìm buổi 4 và buổi 8
    cls.slots.forEach((slot, index) => {
      const sessionNumber = index + 1;
      if (sessionNumber === 4) {
        session4 = slot;
        if (isInTargetMonth(slot.date, targetMonth, targetYear)) session4InMonth = true;
      }
      if (sessionNumber === 8) {
        session8 = slot;
        if (isInTargetMonth(slot.date, targetMonth, targetYear)) session8InMonth = true;
      }
    });
    
    // Lấy lớp có ít nhất 1 trong 2 buổi trong tháng này
    if (session4 && session8 && (session4InMonth || session8InMonth)) {
      filtered.push({
        class: cls,
        session4: session4,
        session8: session8,
        session4InMonth: session4InMonth,
        session8InMonth: session8InMonth
      });
    }
  });
  
  return filtered;
}

/**
 * Ghi lớp có buổi 4 & 8 vào sheet 2
 */
function writeSession4And8ToSheet(filteredClasses, targetMonth, targetYear) {
  const sheet = prepareSheet(ROBOTICS_CONFIG.SHEET_SESSION_4_8);
  
  // Header với thông tin tháng/năm
  const title = `Lớp có buổi 4/8 - Tháng ${targetMonth}/${targetYear}`;
  sheet.getRange('A1:F1').merge();
  sheet.getRange(1, 1).setValue(title)
    .setBackground('#2C3E50')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontSize(12);
  
  const headers = ['Tên lớp', 'Buổi 4', 'Buổi 8', 'LEC', 'Số học sinh', 'Status', 'Giờ học'];
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  if (filteredClasses.length === 0) {
    Logger.log('⚠️ Không có lớp nào có buổi 4/8 trong tháng này.');
    return;
  }
  
  // Data rows
  const rows = filteredClasses.map(item => {
    const cls = item.class;
    const className = cls.name || '';
    const status = cls.status || '';
    const totalStudents = cls.students?.length || 0;
    
    const teachers = cls.teachers
      ?.filter(t => t.role?.shortName === 'LEC' || t.role?.name?.includes('LEC'))
      .map(t => t.teacher?.fullName)
      .filter(Boolean)
      .join(', ') || '';
      
    const allTeachers = teachers || cls.teachers
      ?.map(t => t.teacher?.fullName)
      .filter(Boolean)
      .join(', ') || '';
    
    const session4Date = item.session4InMonth ? formatSessionDate(item.session4.date) : '';
    const session8Date = item.session8InMonth ? formatSessionDate(item.session8.date) : '';
    
    // Lấy các khung giờ học unique từ slots
    const timeSlots = cls.slots
      ?.map(slot => {
        if (!slot.startTime || !slot.endTime) return null;
        return `${slot.startTime}-${slot.endTime}`;
      })
      .filter(Boolean) || [];
    
    // Loại bỏ duplicate và sắp xếp
    const uniqueTimeSlots = [...new Set(timeSlots)].sort().join(', ');
    
    return [className, session4Date, session8Date, allTeachers, totalStudents, status, uniqueTimeSlots];
  });
  
  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows); // Row 3 vì row 1 là title
  formatSheet(sheet, rows.length + 2, headers.length, 6); // +2 vì có title row
}

/**
 * Chuẩn bị sheet (clear và tạo mới nếu cần)
 */
function prepareSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clear();
  return sheet;
}

/**
 * Format sheet chung
 */
function formatSheet(sheet, lastRow, lastCol, statusCol) {
  if (lastRow <= 2) return; // Cần ít nhất header + 1 data row
  
  // Auto resize
  sheet.autoResizeColumns(1, lastCol);
  
  // Freeze header (row 2 nếu có title, row 1 nếu không)
  const hasTitle = (sheet.getName() === ROBOTICS_CONFIG.SHEET_SESSION_4_8);
  sheet.setFrozenRows(hasTitle ? 2 : 1);
  
  // Borders
  const startRow = hasTitle ? 2 : 1; // Header row
  sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol)
    .setBorder(true, true, true, true, true, true);
  
  // Align (data rows only)
  const dataStartRow = hasTitle ? 3 : 2;
  if (lastRow >= dataStartRow) {
    sheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, lastCol).setVerticalAlignment('top');
  
    // Màu cho Status column
    if (statusCol > 0) {
      const statusRange = sheet.getRange(dataStartRow, statusCol, lastRow - dataStartRow + 1, 1);
      const statusValues = statusRange.getValues();
      statusValues.forEach((row, index) => {
        const cell = sheet.getRange(index + dataStartRow, statusCol);
        if (row[0] === 'ACTIVE' || row[0] === 'STUDYING') {
          cell.setBackground('#90ee90');
        } else if (row[0] === 'FINISHED' || row[0] === 'CLOSED') {
          cell.setBackground('#d3d3d3');
        }
      });
    }
  }
}

/**
 * Kiểm tra ngày có trong tháng/năm chỉ định không
 */
function isInTargetMonth(dateStr, targetMonth, targetYear) {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    return (date.getMonth() + 1) === targetMonth && date.getFullYear() === targetYear;
  } catch (err) { return false; }
}

function formatSessionDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (err) { return dateStr; }
}

// ========================================
// FIREBASE AUTH (Delegate to getFirebaseToken.gs)
// ========================================

/**
 * HELPER FUNCTIONS - Gọi nhanh cho các tháng phổ biến
 */

// Lấy dữ liệu tháng HIỆN TẠI
function fetchCurrentMonth() {
  const now = new Date();
  fetchSession4And8Classes(now.getMonth() + 1, now.getFullYear());
}

// Lấy dữ liệu tháng TRƯỚC
function fetchLastMonth() {
  const now = new Date();
  let month = now.getMonth(); // 0-11
  let year = now.getFullYear();
  
  if (month === 0) { // Tháng 1 -> lùi về tháng 12 năm trước
    month = 12;
    year--;
  }
  
  fetchSession4And8Classes(month, year);
}

// Lấy dữ liệu tháng SAU
function fetchNextMonth() {
  const now = new Date();
  let month = now.getMonth() + 2; // +1 để convert 0-11 -> 1-12, +1 để next month
  let year = now.getFullYear();
  
  if (month > 12) { // Tháng 13 -> chuyển thành tháng 1 năm sau
    month = 1;
    year++;
  }
  
  fetchSession4And8Classes(month, year);
}

// Lấy dữ liệu THÁNG 1/2026
function fetchJanuary2026() {
  fetchSession4And8Classes(1, 2026);
}

// Lấy dữ liệu THÁNG 2/2026
function fetchFebruary2026() {
  fetchSession4And8Classes(2, 2026);
}

// Lấy dữ liệu THÁNG 3/2026
function fetchMarch2026() {
  fetchSession4And8Classes(3, 2026);
}

// ========================================
// FIREBASE AUTH (Delegate to getFirebaseToken.gs)
// ========================================

function getSessionFirebaseToken() {
  const tokenFromSheet = readSessionTokenFromSheet();
  if (tokenFromSheet) return tokenFromSheet;
  return getFirebaseIdToken();
}

function readSessionTokenFromSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Firebase Token');
    if (!sheet || sheet.getLastRow() < 2) return null;
    const tokenRow = sheet.getRange(2, 1, 1, 4).getValues()[0];
    if (!tokenRow[1] || tokenRow[0] !== 'ID Token') return null;
    if (tokenRow[2] && tokenRow[3]) {
      const parts = tokenRow[2].split(' ')[0].split('/');
      const timeParts = tokenRow[2].split(' ')[1].split(':');
      const tokenTime = new Date(parts[2], parts[1]-1, parts[0], timeParts[0], timeParts[1], timeParts[2]);
      if ((new Date() - tokenTime) / 1000 > (tokenRow[3] - 300)) return null; 
    }
    return tokenRow[1];
  } catch (e) { return null; }
}

// ========================================
// MENU & UI
// ========================================

/**
 * Tạo menu custom
 */
function onOpenSession4And8Menu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📅 Session 4 & 8')
    .addItem('🚀 Tháng hiện tại', 'fetchCurrentMonth')
    .addItem('⏮️ Tháng trước', 'fetchLastMonth')
    .addItem('⏭️ Tháng sau', 'fetchNextMonth')
    .addSeparator()
    .addItem('1️⃣ Tháng 1/2026', 'fetchJanuary2026')
    .addItem('2️⃣ Tháng 2/2026', 'fetchFebruary2026')
    .addItem('3️⃣ Tháng 3/2026', 'fetchMarch2026')
    .addSeparator()
    .addItem('📆 Chọn tháng/năm tùy chỉnh...', 'showCustomMonthDialog')
    .addToUi();
}

/**
 * Hiển thị dialog chọn tháng/năm tùy chỉnh
 */
function showCustomMonthDialog() {
  const ui = SpreadsheetApp.getUi();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const monthResult = ui.prompt(
    'Chọn tháng/năm',
    `Nhập tháng (1-12):\n(Hiện tại: Tháng ${currentMonth})`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (monthResult.getSelectedButton() !== ui.Button.OK) return;
  
  const month = parseInt(monthResult.getResponseText());
  if (isNaN(month) || month < 1 || month > 12) {
    ui.alert('Lỗi', 'Tháng phải từ 1-12!', ui.ButtonSet.OK);
    return;
  }
  
  const yearResult = ui.prompt(
    'Chọn năm',
    `Nhập năm (VD: 2026):\n(Hiện tại: ${currentYear})`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (yearResult.getSelectedButton() !== ui.Button.OK) return;
  
  const year = parseInt(yearResult.getResponseText());
  if (isNaN(year) || year < 2020 || year > 2030) {
    ui.alert('Lỗi', 'Năm phải từ 2020-2030!', ui.ButtonSet.OK);
    return;
  }
  
  // Gọi hàm chính với tháng/năm đã chọn
  fetchSession4And8Classes(month, year);
}
