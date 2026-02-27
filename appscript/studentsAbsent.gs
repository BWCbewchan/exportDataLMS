/**
 * STUDENTS ABSENT ANALYZER
 * 
 * PHÂN TÍCH HỌC VIÊN VẮNG >= 2 BUỔI
 * Script tự động fetch dữ liệu từ LMS API, phân tích điểm danh và tìm học viên vắng nhiều buổi
 * 
 * TÍNH NĂNG:
 * - Fetch toàn bộ lớp RUNNING từ API với dữ liệu điểm danh
 * - Tổng hợp số buổi vắng của mỗi học viên
 * - Tô màu theo mức độ nghiêm trọng (Vàng/Cam/Đỏ)
 * - Sắp xếp, lọc theo trung tâm
 * 
 * OUTPUT:
 * - Sheet: "Students Absent 2+" - Danh sách học viên vắng >= 2 buổi với màu cảnh báo
 */

// ========================================
// CẤU HÌNH
// ========================================

const ABSENT_CONFIG = {
  API_URL: 'https://lms-api.mindx.vn/',
  AUTH_TOKEN: '',
  SHEET_NAME: 'Students Absent 2+',
  MIN_ABSENT_COUNT: 2, // Số buổi vắng tối thiểu để hiển thị
  RECORDS_PER_PAGE: 50,
  MAX_RETRIES: 3,
  SLEEP_TIME: 1000,
  
  // Màu cảnh báo theo mức độ nghiêm trọng
  COLOR_LEVELS: {
    WARNING: { min: 2, max: 2, color: '#fff3cd' },    // Vàng - 2 buổi
    SERIOUS: { min: 3, max: 4, color: '#ffc107' },    // Cam - 3-4 buổi  
    CRITICAL: { min: 5, max: 999, color: '#f8d7da' }  // Đỏ - 5+ buổi
  }
};

// GraphQL Query - Lấy classes với full attendance data
const ABSENT_CLASSES_QUERY = `query GetClasses($search: String, $centre: String, $centres: [String], $courses: [String], $statusIn: [String], $pageIndex: Int!, $itemsPerPage: Int!) {
  classes(payload: {filter_textSearch: $search, centre_equals: $centre, centre_in: $centres, course_in: $courses, status_in: $statusIn, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: "createdAt_desc"}) {
    data {
      id
      name
      course {
        id
        name
        shortName
      }
      centre {
        id
        name
        shortName
      }
      status
      students {
        _id
        student {
          id
          fullName
          email
          phoneNumber
        }
      }
      slots {
        _id
        date
        startTime
        endTime
        studentAttendance {
          _id
          student {
            id
            fullName
            email
            phoneNumber
          }
          status
          comment
        }
      }
    }
    pagination {
      type
      total
    }
  }
}`;

// ========================================
// MAIN FUNCTION
// ========================================

/**
 * Phân tích học viên vắng >= 2 buổi
 */
function analyzeStudentsAbsent() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    Logger.log('📊 Bắt đầu phân tích học viên vắng...');
    ss.toast('📊 Đang phân tích học viên vắng...', 'Bắt đầu', 3);
    
    // BƯỚC 1: Lấy Firebase Token
    Logger.log('🔐 Lấy Firebase token...');
    ABSENT_CONFIG.AUTH_TOKEN = getAbsentFirebaseToken();
    
    // BƯỚC 2: Fetch dữ liệu lớp học từ API
    Logger.log('🚀 Đang lấy danh sách lớp học từ API...');
    ss.toast('🚀 Đang lấy danh sách lớp...', 'Fetching API', 3);
    
    const allClasses = fetchClassesForAbsenceAnalysis();
    Logger.log(`✅ Đã lấy được ${allClasses.length} lớp học`);
    
    // BƯỚC 3: Phân tích điểm danh
    Logger.log('🔍 Đang phân tích điểm danh...');
    ss.toast('🔍 Đang phân tích điểm danh...', 'Analyzing', 3);
    
    const absenceData = analyzeAbsenceFromClasses(allClasses);
    Logger.log(`   ✓ Tìm thấy ${absenceData.length} học viên vắng >= ${ABSENT_CONFIG.MIN_ABSENT_COUNT} buổi`);
    
    // BƯỚC 4: Ghi vào sheet và tô màu
    Logger.log('📝 Đang ghi vào sheet...');
    ss.toast('📝 Đang ghi dữ liệu...', 'Writing', 2);
    writeAbsenceToSheet(absenceData);
    Logger.log(`   ✓ Đã ghi xong sheet "${ABSENT_CONFIG.SHEET_NAME}"`);
    
    // BƯỚC 5: Hoàn thành
    Logger.log('\n🎉 HOÀN THÀNH!');
    Logger.log(`   - Tổng số lớp: ${allClasses.length}`);
    Logger.log(`   - Học viên vắng >= 2 buổi: ${absenceData.length}`);
    
    ss.toast(
      `✅ Tìm thấy ${absenceData.length} học viên vắng (từ ${allClasses.length} lớp)!`, 
      'Hoàn thành', 
      5
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

/**
 * Fetch classes từ API với attendance data
 */
function fetchClassesForAbsenceAnalysis() {
  let allData = [];
  let page = 0;
  let hasMore = true;
  
  do {
    Logger.log(`📥 Đang tải trang ${page + 1}... (Đã lấy: ${allData.length})`);
    
    let response;
    try {
      response = fetchAbsentClassesWithRetry(page);
    } catch (e) {
      Logger.log(`⚠️ Bỏ qua trang ${page + 1} do lỗi: ` + e.message);
      break;
    }
    
    if (!response) break;
    
    const result = JSON.parse(response.getContentText());
    if (result.errors) throw new Error('API Error: ' + JSON.stringify(result.errors));
    
    const classData = result.data?.classes?.data || [];
    const pagination = result.data?.classes?.pagination || {};
    const total = pagination.total || 0;
    
    if (classData.length === 0) {
      hasMore = false;
      break;
    }
    
    allData = allData.concat(classData);
    
    if (total > 0 && allData.length >= total) {
      Logger.log(`✅ Đã lấy đủ ${total} lớp.`);
      hasMore = false;
    }
    
    if (classData.length < ABSENT_CONFIG.RECORDS_PER_PAGE) {
      hasMore = false;
    }
    
    page++;
    Utilities.sleep(ABSENT_CONFIG.SLEEP_TIME);
    
  } while (hasMore);
  
  return allData;
}

/**
 * Fetch API với retry
 */
function fetchAbsentClassesWithRetry(page) {
  const makeRequest = () => {
    const variables = {
      search: "",
      centres: [],
      courses: [],
      statusIn: ["RUNNING"],
      pageIndex: page,
      itemsPerPage: ABSENT_CONFIG.RECORDS_PER_PAGE
    };
    
    const payload = {
      operationName: 'GetClasses',
      variables: variables,
      query: ABSENT_CLASSES_QUERY
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'accept': '*/*',
        'authorization': ABSENT_CONFIG.AUTH_TOKEN,
        'cache-control': 'no-cache',
        'content-language': 'vi',
        'origin': 'https://lms.mindx.edu.vn',
        'referer': 'https://lms.mindx.edu.vn/'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    return UrlFetchApp.fetch(ABSENT_CONFIG.API_URL, options);
  };

  let attempts = 0;
  let lastError;
  
  while (attempts < ABSENT_CONFIG.MAX_RETRIES) {
    try {
      if (attempts > 0) {
        Logger.log(`🔄 Thử lại lần ${attempts}... (Page ${page + 1})`);
        Utilities.sleep(1000 * Math.pow(2, attempts));
      }
      
      let response = makeRequest();
      const code = response.getResponseCode();
      
      if (code === 401) {
        Logger.log('⚠️ Token hết hạn (401). Đang refresh token...');
        try {
          ABSENT_CONFIG.AUTH_TOKEN = getFirebaseIdToken();
          response = makeRequest();
        } catch (e) {
          throw new Error('Không thể refresh token: ' + e.toString());
        }
      }
      
      if (code >= 500) {
        throw new Error(`Server Error ${code}`);
      }
      
      if (code === 200) {
        return response;
      }
      
      throw new Error(`API Error: ${code} - ${response.getContentText()}`);
      
    } catch (e) {
      lastError = e;
      Logger.log(`⚠️ Lỗi fetch (Attempt ${attempts + 1}): ` + e.toString());
      attempts++;
    }
  }
  
  throw lastError;
}

/**
 * Phân tích điểm danh từ dữ liệu classes
 */
function analyzeAbsenceFromClasses(classes) {
  const result = [];
  
  classes.forEach(cls => {
    const classId = cls.id || '';
    const className = cls.name || '';
    const centre = cls.centre?.name || cls.centre?.shortName || '';
    const course = cls.course?.name || cls.course?.shortName || '';
    const totalSlots = cls.slots?.length || 0;
    
    // Map để lưu thông tin vắng của từng học viên
    const studentAbsenceMap = new Map();
    
    // Duyệt qua từng slot để tổng hợp
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotNumber = slotIndex + 1;
        const slotDate = slot.date || '';
        
        // Kiểm tra điểm danh
        if (slot.studentAttendance && slot.studentAttendance.length > 0) {
          slot.studentAttendance.forEach(attendance => {
            const student = attendance.student || {};
            const studentId = student.id || '';
            const studentName = student.fullName || '';
            const status = attendance.status || '';
            
            // Chỉ quan tâm học viên VẮNG
            if (status === 'ABSENT') {
              if (!studentAbsenceMap.has(studentId)) {
                studentAbsenceMap.set(studentId, {
                  id: studentId,
                  name: studentName,
                  email: student.email || '',
                  phone: student.phoneNumber || '',
                  absentCount: 0,
                  absentSlots: []
                });
              }
              
              const studentData = studentAbsenceMap.get(studentId);
              studentData.absentCount++;
              studentData.absentSlots.push({
                slotNumber,
                date: slotDate
              });
            }
          });
        }
      });
    }
    
    // Lọc ra những học viên nghỉ >= MIN_ABSENT_COUNT buổi
    studentAbsenceMap.forEach((studentData) => {
      if (studentData.absentCount >= ABSENT_CONFIG.MIN_ABSENT_COUNT) {
        const absentSlotsList = studentData.absentSlots
          .map(slot => {
            const date = slot.date ? formatAbsentDate(slot.date) : '';
            return `Buổi ${slot.slotNumber}${date ? ' (' + date + ')' : ''}`;
          })
          .join('; ');
        
        result.push({
          classId,
          className,
          centre,
          course,
          totalSlots,
          studentId: studentData.id,
          studentName: studentData.name,
          studentEmail: studentData.email,
          studentPhone: studentData.phone,
          absentCount: studentData.absentCount,
          absentSlots: absentSlotsList,
          absentRate: ((studentData.absentCount / totalSlots) * 100).toFixed(2)
        });
      }
    });
  });
  
  // Sắp xếp theo số buổi vắng (nhiều → ít)
  result.sort((a, b) => b.absentCount - a.absentCount);
  
  return result;
}

/**
 * Format date
 */
function formatAbsentDate(isoString) {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
}

/**
 * Ghi dữ liệu vào sheet với format và màu sắc
 */
function writeAbsenceToSheet(absenceData) {
  const sheet = prepareSheet();
  
  if (absenceData.length === 0) {
    Logger.log('⚠️ Không có học viên vắng >= 2 buổi.');
    return;
  }
  
  // Title row
  const title = `Học viên vắng >= ${ABSENT_CONFIG.MIN_ABSENT_COUNT} buổi`;
  sheet.getRange('A1:L1').merge();
  sheet.getRange(1, 1).setValue(title)
    .setBackground('#c9302c')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontSize(14);
  
  // Header row
  const headers = [
    'ID lớp',
    'Tên lớp',
    'Trung tâm',
    'Khóa học',
    'Tổng số buổi',
    'Tên học viên',
    'Email',
    'SĐT',
    'Số buổi vắng',
    'Tỷ lệ vắng (%)',
    'Danh sách buổi vắng',
    'Mức độ'
  ];
  
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, headers.length)
    .setBackground('#34495e')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  
  // Data rows
  const rows = absenceData.map(record => {
    const severity = getSeverityLevel(record.absentCount);
    
    return [
      record.classId,
      record.className,
      record.centre,
      record.course,
      record.totalSlots,
      record.studentName,
      record.studentEmail,
      record.studentPhone,
      record.absentCount,
      record.absentRate,
      record.absentSlots,
      severity.label
    ];
  });
  
  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);
  
  // Format và tô màu
  formatAbsenceSheet(sheet, rows.length + 2, headers.length, absenceData);
}

/**
 * Chuẩn bị sheet
 */
function prepareSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ABSENT_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ABSENT_CONFIG.SHEET_NAME);
  }
  sheet.clear();
  return sheet;
}

/**
 * Format sheet và tô màu theo mức độ nghiêm trọng
 */
function formatAbsenceSheet(sheet, lastRow, lastCol, absenceData) {
  if (lastRow <= 2) return;
  
  // Set column widths
  sheet.setColumnWidth(1, 180); // ID lớp
  sheet.setColumnWidth(2, 150); // Tên lớp
  sheet.setColumnWidth(3, 120); // Trung tâm
  sheet.setColumnWidth(4, 150); // Khóa học
  sheet.setColumnWidth(5, 100); // Tổng số buổi
  sheet.setColumnWidth(6, 150); // Tên học viên
  sheet.setColumnWidth(7, 180); // Email
  sheet.setColumnWidth(8, 120); // SĐT
  sheet.setColumnWidth(9, 120); // Số buổi vắng
  sheet.setColumnWidth(10, 120); // Tỷ lệ vắng
  sheet.setColumnWidth(11, 300); // Danh sách buổi vắng
  sheet.setColumnWidth(12, 100); // Mức độ
  
  // Freeze header
  sheet.setFrozenRows(2);
  
  // Borders
  sheet.getRange(2, 1, lastRow - 1, lastCol)
    .setBorder(true, true, true, true, true, true);
  
  // Align
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, lastCol).setVerticalAlignment('top');
    sheet.getRange(3, 1, lastRow - 2, lastCol).setWrap(true);
    
    // Center align cho các cột số
    sheet.getRange(3, 5, lastRow - 2, 1).setHorizontalAlignment('center'); // Tổng số buổi
    sheet.getRange(3, 9, lastRow - 2, 1).setHorizontalAlignment('center'); // Số buổi vắng
    sheet.getRange(3, 10, lastRow - 2, 1).setHorizontalAlignment('center'); // Tỷ lệ vắng
    sheet.getRange(3, 12, lastRow - 2, 1).setHorizontalAlignment('center'); // Mức độ
    
    // TÔ MÀU theo số buổi vắng (cả hàng)
    absenceData.forEach((record, index) => {
      const rowNumber = index + 3;
      const severity = getSeverityLevel(record.absentCount);
      
      // Tô màu TOÀN BỘ hàng
      const rowRange = sheet.getRange(rowNumber, 1, 1, lastCol);
      rowRange.setBackground(severity.color);
      
      // Highlight cột "Số buổi vắng" đậm hơn
      const absentCountCell = sheet.getRange(rowNumber, 9);
      absentCountCell.setFontWeight('bold');
      absentCountCell.setFontSize(11);
      
      // Highlight cột "Mức độ"
      const severityCell = sheet.getRange(rowNumber, 12);
      severityCell.setFontWeight('bold');
      severityCell.setFontColor(severity.fontColor);
    });
  }
  
  // Thêm chú thích màu bên phải
  addColorLegend(sheet, absenceData.length + 2);
}

/**
 * Xác định mức độ nghiêm trọng
 */
function getSeverityLevel(absentCount) {
  if (absentCount >= ABSENT_CONFIG.COLOR_LEVELS.CRITICAL.min) {
    return {
      label: 'NGHIÊM TRỌNG',
      color: ABSENT_CONFIG.COLOR_LEVELS.CRITICAL.color,
      fontColor: '#721c24'
    };
  } else if (absentCount >= ABSENT_CONFIG.COLOR_LEVELS.SERIOUS.min) {
    return {
      label: 'ĐÁNG CHÚ Ý',
      color: ABSENT_CONFIG.COLOR_LEVELS.SERIOUS.color,
      fontColor: '#856404'
    };
  } else {
    return {
      label: 'CẢNH BÁO',
      color: ABSENT_CONFIG.COLOR_LEVELS.WARNING.color,
      fontColor: '#856404'
    };
  }
}

/**
 * Thêm chú thích màu bên phải data
 */
function addColorLegend(sheet, lastDataRow) {
  const legendStartCol = 14; // Column N (bên phải column M - Mức độ)
  const legendStartRow = 2; // Bắt đầu từ header row
  
  // Title
  sheet.getRange(legendStartRow, legendStartCol).setValue('CHÚ THÍCH MÀU SẮC:')
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground('#f0f0f0');
  
  // Warning - 2 buổi
  sheet.getRange(legendStartRow + 1, legendStartCol).setValue('CẢNH BÁO')
    .setBackground(ABSENT_CONFIG.COLOR_LEVELS.WARNING.color)
    .setFontWeight('bold');
  sheet.getRange(legendStartRow + 1, legendStartCol + 1).setValue('Vắng 2 buổi');
  
  // Serious - 3-4 buổi
  sheet.getRange(legendStartRow + 2, legendStartCol).setValue('ĐÁNG CHÚ Ý')
    .setBackground(ABSENT_CONFIG.COLOR_LEVELS.SERIOUS.color)
    .setFontWeight('bold');
  sheet.getRange(legendStartRow + 2, legendStartCol + 1).setValue('Vắng 3-4 buổi');
  
  // Critical - 5+ buổi
  sheet.getRange(legendStartRow + 3, legendStartCol).setValue('NGHIÊM TRỌNG')
    .setBackground(ABSENT_CONFIG.COLOR_LEVELS.CRITICAL.color)
    .setFontWeight('bold')
    .setFontColor('#721c24');
  sheet.getRange(legendStartRow + 3, legendStartCol + 1).setValue('Vắng 5+ buổi');
  
  // Set width cho legend columns
  sheet.setColumnWidth(legendStartCol, 130);
  sheet.setColumnWidth(legendStartCol + 1, 120);
  
  // Borders cho legend
  sheet.getRange(legendStartRow, legendStartCol, 4, 2)
    .setBorder(true, true, true, true, true, true);
}

/**
 * Sắp xếp theo số buổi vắng (nhiều nhất trước)
 */
function sortByAbsentCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABSENT_CONFIG.SHEET_NAME);
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet không tồn tại. Hãy chạy analyzeStudentsAbsent() trước.');
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;
  
  // Sort by column 9 (Số buổi vắng) descending
  const range = sheet.getRange(3, 1, lastRow - 2, 12);
  range.sort({column: 9, ascending: false});
  
  SpreadsheetApp.getUi().alert('✅ Đã sắp xếp theo số buổi vắng (nhiều → ít)');
}

/**
 * Lọc theo trung tâm
 */
function filterByCentre() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Lọc theo trung tâm',
    'Nhập tên trung tâm (ví dụ: "Phan Văn Trị", "414 Lũy Bán Bích"):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() !== ui.Button.OK) return;
  
  const centreName = result.getResponseText().trim();
  if (!centreName) {
    ui.alert('Vui lòng nhập tên trung tâm');
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABSENT_CONFIG.SHEET_NAME);
  
  if (!sheet) {
    ui.alert('Sheet không tồn tại. Hãy chạy analyzeStudentsAbsent() trước.');
    return;
  }
  
  // Apply filter
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;
  
  const range = sheet.getRange(2, 1, lastRow - 1, 12);
  const filter = range.createFilter();
  
  // Filter column 3 (Trung tâm)
  const criteria = SpreadsheetApp.newFilterCriteria()
    .whenTextContains(centreName)
    .build();
  
  filter.setColumnFilterCriteria(3, criteria);
  
  ui.alert(`✅ Đã lọc theo trung tâm: "${centreName}"`);
}

/**
 * Xóa filter
 */
function clearFilter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABSENT_CONFIG.SHEET_NAME);
  
  if (!sheet) return;
  
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
    SpreadsheetApp.getUi().alert('✅ Đã xóa filter');
  }
}

// ========================================
// FIREBASE AUTH
// ========================================

function getAbsentFirebaseToken() {
  const tokenFromSheet = readAbsentTokenFromSheet();
  if (tokenFromSheet) return tokenFromSheet;
  return getFirebaseIdToken();
}

function readAbsentTokenFromSheet() {
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
 * Menu custom
 */
function onOpenAbsentMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚨 Học Viên Vắng')
    .addItem('📊 Phân tích học viên vắng', 'analyzeStudentsAbsent')
    .addSeparator()
    .addItem('🔽 Sắp xếp theo số buổi vắng', 'sortByAbsentCount')
    .addItem('🔍 Lọc theo trung tâm', 'filterByCentre')
    .addItem('❌ Xóa filter', 'clearFilter')
    .addToUi();
}
