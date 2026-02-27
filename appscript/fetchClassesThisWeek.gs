/**
 * FETCH CLASSES THIS WEEK
 * 
 * LẤY LỚP HỌC CÓ END_DATE TỪ THỨ 5 TUẦN NÀY ĐẾN THỨ 4 TUẦN SAU
 * 
 * Logic tính ngày:
 * - Thứ 5 tuần này = T5 của tuần hiện tại (CN-T7)
 * - Thứ 4 tuần sau = T5 + 6 ngày (tổng 7 ngày)
 * 
 * Output: Sheet "Classes_ThisWeek"
 */

// ========================================
// CẤU HÌNH
// ========================================

const CLASSES_THISWEEK_CONFIG = {
  API_URL: 'https://lms-api.mindx.vn/',
  AUTH_TOKEN: '', // Sẽ được tự động cập nhật
  SHEET_NAME: 'Classes_ThisWeek',
  RECORDS_PER_PAGE: 50, // Giảm xuống để tránh timeout
  MAX_RETRIES: 3,
  SLEEP_TIME: 1000 // ms
};

// ========================================
// TÍNH TOÁN NGÀY
// ========================================

/**
 * Tính ngày thứ 5 tuần này
 * Luôn lấy T5 của tuần hiện tại (CN-T7)
 */
function getThisThursday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  
  // Công thức: 4 - dayOfWeek
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
 * Tính ngày thứ 5 tuần SAU (tuần tiếp theo)
 * = Thứ 5 tuần này + 7 ngày
 */
function getNextThursday() {
  const thisThursday = getThisThursday();
  const nextThursday = new Date(thisThursday);
  nextThursday.setDate(thisThursday.getDate() + 7);
  nextThursday.setHours(0, 0, 0, 0);
  
  return nextThursday;
}

/**
 * Tính ngày thứ 4 tuần tiếp theo
 * = Thứ 5 tuần sau + 6 ngày
 */
function getNextNextWednesday() {
  const nextThursday = getNextThursday();
  const nextNextWednesday = new Date(nextThursday);
  nextNextWednesday.setDate(nextThursday.getDate() + 6);
  nextNextWednesday.setHours(23, 59, 59, 999);
  
  return nextNextWednesday;
}

/**
 * Tạo tên sheet theo format: data dd/mm - dd/mm
 */
function getSheetNameForDateRange(startDate, endDate) {
  const startStr = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'dd/MM');
  const endStr = Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'dd/MM');
  return `data ${startStr} - ${endStr}`;
}

// ========================================
// GRAPHQL QUERY
// ========================================

const CLASSES_THISWEEK_QUERY = `query GetClasses($endDateFrom: Date, $endDateTo: Date, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
  classes(payload: {
    endDate_gt: $endDateFrom, 
    endDate_lt: $endDateTo, 
    pageIndex: $pageIndex, 
    itemsPerPage: $itemsPerPage, 
    orderBy: $orderBy
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
        _id
        teacher {
          id
          fullName
          username
        }
        role {
          id
          name
          shortName
        }
        isActive
      }
      students {
        _id
        student {
          id
        }
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

// ========================================
// MAIN FUNCTION
// ========================================

/**
 * Hàm chính: Fetch lớp học có end_date từ T5 tuần này → T4 tuần sau
 */
function fetchClassesThisWeek() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    
    const thisThursday = getThisThursday();
    const nextWednesday = getNextWednesday();
    const sheetName = getSheetNameForDateRange(thisThursday, nextWednesday);
    
    const thursdayStr = Utilities.formatDate(thisThursday, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const wednesdayStr = Utilities.formatDate(nextWednesday, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    
    Logger.log(`📅 Khung thời gian: ${thursdayStr} → ${wednesdayStr}`);
    Logger.log(`📋 Sheet name: ${sheetName}`);
    ss.toast(`📅 Chuẩn bị fetch dữ liệu ${thursdayStr} → ${wednesdayStr}...`, 'Bắt đầu', 3);
    
    // BƯỚC 1: Clear sheet cũ
    Logger.log('🗑️ Xóa dữ liệu cũ...');
    clearClassesThisWeekSheet(sheetName);
    
    // BƯỚC 2: Lấy Token
    Logger.log('🔐 Lấy Firebase token...');
    CLASSES_THISWEEK_CONFIG.AUTH_TOKEN = getClassesThisWeekFirebaseToken();
    
    // BƯỚC 3: Fetch Data
    Logger.log('🚀 Đang lấy danh sách lớp học từ API...');
    ss.toast('🚀 Đang lấy danh sách lớp học...', 'Fetching API', 3);
    
    const allClasses = fetchClassesThisWeekData(thisThursday, nextWednesday);
    Logger.log(`✅ Đã fetch xong: ${allClasses.length} lớp học.`);
    
    // BƯỚC 4: Ghi Sheet
    Logger.log(`📝 Đang ghi ${allClasses.length} lớp vào sheet...`);
    ss.toast(`📝 Đang ghi ${allClasses.length} lớp vào sheet...`, 'Writing Data', 2);
    writeClassesThisWeekToSheet(allClasses, thisThursday, nextWednesday, sheetName);
    
    // BƯỚC 5: Hoàn thành
    Logger.log(`\n🎉 HOÀN THÀNH! Tổng: ${allClasses.length} lớp`);
    ss.toast(
      `✅ Hoàn thành! ${allClasses.length} lớp từ ${thursdayStr} → ${wednesdayStr}`, 
      'Thành công', 
      5
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('❌ Lỗi: ' + error.toString());
  }
}

/**
 * Hàm fetch lớp học TUẦN SAU (T5 tuần sau → T4 tuần tiếp theo)
 */
function fetchClassesNextWeek() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    
    const nextThursday = getNextThursday();
    const nextNextWednesday = getNextNextWednesday();
    const sheetName = getSheetNameForDateRange(nextThursday, nextNextWednesday);
    
    const thursdayStr = Utilities.formatDate(nextThursday, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const wednesdayStr = Utilities.formatDate(nextNextWednesday, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    
    Logger.log(`📅 Khung thời gian TUẦN SAU: ${thursdayStr} → ${wednesdayStr}`);
    Logger.log(`📋 Sheet name: ${sheetName}`);
    ss.toast(`📅 Chuẩn bị fetch dữ liệu TUẦN SAU ${thursdayStr} → ${wednesdayStr}...`, 'Bắt đầu', 3);
    
    // BƯỚC 1: Clear sheet cũ
    Logger.log('🗑️ Xóa dữ liệu cũ...');
    clearClassesThisWeekSheet(sheetName);
    
    // BƯỚC 2: Lấy Token
    Logger.log('🔐 Lấy Firebase token...');
    CLASSES_THISWEEK_CONFIG.AUTH_TOKEN = getClassesThisWeekFirebaseToken();
    
    // BƯỚC 3: Fetch Data
    Logger.log('🚀 Đang lấy danh sách lớp học TUẦN SAU từ API...');
    ss.toast('🚀 Đang lấy danh sách lớp học TUẦN SAU...', 'Fetching API', 3);
    
    const allClasses = fetchClassesThisWeekData(nextThursday, nextNextWednesday);
    Logger.log(`✅ Đã fetch xong: ${allClasses.length} lớp học.`);
    
    // BƯỚC 4: Ghi Sheet
    Logger.log(`📝 Đang ghi ${allClasses.length} lớp vào sheet...`);
    ss.toast(`📝 Đang ghi ${allClasses.length} lớp vào sheet...`, 'Writing Data', 2);
    writeClassesThisWeekToSheet(allClasses, nextThursday, nextNextWednesday, sheetName);
    
    // BƯỚC 5: Hoàn thành
    Logger.log(`\n🎉 HOÀN THÀNH! Tổng: ${allClasses.length} lớp (TUẦN SAU)`);
    ss.toast(
      `✅ Hoàn thành! ${allClasses.length} lớp TUẦN SAU từ ${thursdayStr} → ${wednesdayStr}`, 
      'Thành công', 
      5
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('❌ Lỗi: ' + error.toString());
  }
}

/**
 * Clear sheet cũ
 */
function clearClassesThisWeekSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
    Logger.log(`   ✓ Đã xóa "${sheetName}"`);
  }
}

/**
 * Fetch toàn bộ dữ liệu với pagination
 */
function fetchClassesThisWeekData(startDate, endDate) {
  let allData = [];
  let page = 0;
  let hasMore = true;
  let emptyCount = 0;
  
  do {
    Logger.log(`📥 Đang tải trang ${page + 1}... (Đã lấy: ${allData.length})`);
    
    let response;
    try {
      response = fetchClassesThisWeekWithRetry(page, startDate, endDate);
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
      emptyCount++;
      if (emptyCount >= 2) hasMore = false;
      break;
    } else {
      emptyCount = 0;
    }
    
    allData = allData.concat(classData);
    
    // Kiểm tra đã lấy đủ chưa
    if (total > 0 && allData.length >= total) {
      Logger.log(`✅ Đã lấy đủ ${total} lớp.`);
      hasMore = false;
    }
    
    // Hoặc lấy ít hơn limit -> hết trang
    if (classData.length < CLASSES_THISWEEK_CONFIG.RECORDS_PER_PAGE) {
      hasMore = false;
    }
    
    page++;
    Utilities.sleep(CLASSES_THISWEEK_CONFIG.SLEEP_TIME);
    
  } while (hasMore);
  
  return allData;
}

/**
 * Fetch API với retry mechanism (giống allClassesSession4And8.gs)
 */
function fetchClassesThisWeekWithRetry(page, startDate, endDate) {
  const makeRequest = () => {
    const variables = {
      endDateFrom: startDate.toISOString(),
      endDateTo: endDate.toISOString(),
      pageIndex: page,
      itemsPerPage: CLASSES_THISWEEK_CONFIG.RECORDS_PER_PAGE,
      orderBy: 'endDate_asc'
    };
    
    const payload = {
      operationName: 'GetClasses',
      variables: variables,
      query: CLASSES_THISWEEK_QUERY
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'accept': '*/*',
        'authorization': CLASSES_THISWEEK_CONFIG.AUTH_TOKEN,
        'cache-control': 'no-cache',
        'content-language': 'vi',
        'origin': 'https://lms.mindx.edu.vn',
        'referer': 'https://lms.mindx.edu.vn/'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    return UrlFetchApp.fetch(CLASSES_THISWEEK_CONFIG.API_URL, options);
  };
  
  let attempts = 0;
  let lastError;
  
  while (attempts < CLASSES_THISWEEK_CONFIG.MAX_RETRIES) {
    try {
      if (attempts > 0) {
        Logger.log(`🔄 Thử lại lần ${attempts}... (Page ${page + 1})`);
        Utilities.sleep(1000 * Math.pow(2, attempts)); // Exponential backoff
      }
      
      let response = makeRequest();
      const code = response.getResponseCode();
      
      // Xử lý 401: Refresh Token
      if (code === 401) {
        Logger.log('⚠️ Token hết hạn (401). Đang refresh token...');
        try {
          CLASSES_THISWEEK_CONFIG.AUTH_TOKEN = getFirebaseIdToken();
          response = makeRequest(); // Thử lại với token mới
        } catch (e) {
          throw new Error('Không thể refresh token: ' + e.toString());
        }
      }
      
      // Xử lý 5xx: Server Error -> Retry
      if (code >= 500) {
        throw new Error(`Server Error ${code}`);
      }
      
      // 200 OK
      if (code === 200) {
        return response;
      }
      
      // Các lỗi khác
      throw new Error(`API Error: ${code} - ${response.getContentText()}`);
      
    } catch (e) {
      lastError = e;
      Logger.log(`⚠️ Lỗi fetch (Attempt ${attempts + 1}): ` + e.toString());
      attempts++;
    }
  }
  
  throw lastError;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Ghi dữ liệu vào sheet
 */
function writeClassesThisWeekToSheet(classes, startDate, endDate, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Title
  const thursdayStr = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const wednesdayStr = Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const title = `Lớp kết thúc từ ${thursdayStr} → ${wednesdayStr} (T5 tuần này → T4 tuần sau)`;
  
  sheet.getRange('A1:L1').merge();
  sheet.getRange(1, 1).setValue(title)
    .setBackground('#2C3E50')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontSize(12);
  
  // Headers
  const headers = ['Tên lớp', 'Cơ sở', 'Time Demo', 'Date', 'Time', 'Khóa học', 'Ngày bắt đầu', 'Ngày kết thúc', 'Status', 'LEC', 'Số HS', 'Số buổi'];
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  if (classes.length === 0) {
    Logger.log('⚠️ Không có lớp nào.');
    return;
  }
  
  // Data rows
  const rows = classes.map(cls => {
    const className = cls.name || '';
    const courseName = cls.course?.shortName || cls.course?.name || '';
    const centreName = cls.centre?.shortName || cls.centre?.name || '';
    const startDateStr = cls.startDate ? Utilities.formatDate(new Date(cls.startDate), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '';
    const endDateStr = cls.endDate ? Utilities.formatDate(new Date(cls.endDate), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '';
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
    
    // Lấy thông tin buổi 14 (index = 13)
    let timeDemo = '';
    let dateDemo = '';
    let timeOnly = '';
    
    if (cls.slots && cls.slots.length >= 14) {
      const session14 = cls.slots[13]; // Index 13 = buổi 14
      if (session14 && session14.date && session14.startTime && session14.endTime) {
        const sessionDate = new Date(session14.date);
        const dateStr = Utilities.formatDate(sessionDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        const timeStr = `${session14.startTime} - ${session14.endTime}`;
        
        timeDemo = `${dateStr} ${timeStr}`;
        dateDemo = dateStr;
        timeOnly = timeStr;
      }
    }
    
    return [className, centreName, timeDemo, dateDemo, timeOnly, courseName, startDateStr, endDateStr, status, allTeachers, totalStudents, totalSlots];
  });
  
  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);
  
  // Format
  formatClassesThisWeekSheet(sheet, rows.length + 2, headers.length);
  
  // Timestamp
  sheet.getRange(rows.length + 4, 1).setValue(`Cập nhật lúc: ${new Date()}`);
  
  Logger.log(`✅ Đã ghi ${classes.length} lớp vào sheet "${sheetName}"`);
}

/**
 * Format sheet
 */
function formatClassesThisWeekSheet(sheet, lastRow, lastCol) {
  if (lastRow <= 2) return;
  
  // Auto resize
  sheet.autoResizeColumns(1, lastCol);
  
  // Freeze header
  sheet.setFrozenRows(2);
  
  // Borders
  sheet.getRange(2, 1, lastRow - 1, lastCol)
    .setBorder(true, true, true, true, true, true);
  
  // Align
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, lastCol).setVerticalAlignment('top');
    
    // Highlight cột Time Demo, Date, Time (columns 3, 4, 5)
    sheet.getRange(3, 3, lastRow - 2, 3)
      .setBackground('#FFF9E6')
      .setFontWeight('bold');
    
    // Màu Status (column 9)
    const statusRange = sheet.getRange(3, 9, lastRow - 2, 1);
    const statusValues = statusRange.getValues();
    statusValues.forEach((row, index) => {
      const cell = sheet.getRange(index + 3, 9);
      if (row[0] === 'RUNNING') {
        cell.setBackground('#90ee90');
      } else if (row[0] === 'FINISHED' || row[0] === 'CLOSED') {
        cell.setBackground('#d3d3d3');
      }
    });
  }
}

// ========================================
// FIREBASE AUTH
// ========================================

/**
 * Lấy Firebase token (ưu tiên từ sheet, không có thì fetch mới)
 */
function getClassesThisWeekFirebaseToken() {
  const tokenFromSheet = readClassesThisWeekTokenFromSheet();
  if (tokenFromSheet) return tokenFromSheet;
  return getFirebaseIdToken();
}

/**
 * Đọc token từ sheet "Firebase Token"
 */
function readClassesThisWeekTokenFromSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Firebase Token');
    if (!sheet || sheet.getLastRow() < 2) return null;
    
    const tokenRow = sheet.getRange(2, 1, 1, 4).getValues()[0];
    if (!tokenRow[1] || tokenRow[0] !== 'ID Token') return null;
    
    // Check expiry
    if (tokenRow[2] && tokenRow[3]) {
      const parts = tokenRow[2].split(' ')[0].split('/');
      const timeParts = tokenRow[2].split(' ')[1].split(':');
      const tokenTime = new Date(parts[2], parts[1] - 1, parts[0], timeParts[0], timeParts[1], timeParts[2]);
      if ((new Date() - tokenTime) / 1000 > (tokenRow[3] - 300)) return null;
    }
    
    return tokenRow[1];
  } catch (e) {
    return null;
  }
}

// ========================================
// TEST & MENU
// ========================================

/**
 * Test tính ngày
 */
function testDateCalculation() {
  const thisThursday = getThisThursday();
  const nextWednesday = getNextWednesday();
  
  const timeZone = Session.getScriptTimeZone();
  const today = new Date();
  
  // Tính số ngày chênh lệch
  const daysToThursday = Math.floor((thisThursday - today) / (1000 * 60 * 60 * 24));
  const rangeDays = Math.floor((nextWednesday - thisThursday) / (1000 * 60 * 60 * 24)) + 1;
  
  Logger.log('=== TEST TÍNH NGÀY ===');
  Logger.log(`Hôm nay: ${Utilities.formatDate(today, timeZone, 'dd/MM/yyyy (EEEE)')}`);
  Logger.log(`Thứ 5 tuần này: ${Utilities.formatDate(thisThursday, timeZone, 'dd/MM/yyyy (EEEE)')} (${daysToThursday > 0 ? '+' : ''}${daysToThursday} ngày)`);
  Logger.log(`Thứ 4 tuần sau: ${Utilities.formatDate(nextWednesday, timeZone, 'dd/MM/yyyy (EEEE)')}`);
  Logger.log(`Range: ${rangeDays} ngày`);
  
  SpreadsheetApp.getUi().alert(
    '📅 Test tính ngày',
    `Hôm nay: ${Utilities.formatDate(today, timeZone, 'dd/MM/yyyy (EEEE)')}\n\n` +
    `Thứ 5 tuần này: ${Utilities.formatDate(thisThursday, timeZone, 'dd/MM/yyyy (EEEE)')}\n` +
    `(${daysToThursday > 0 ? 'Còn ' + daysToThursday + ' ngày' : daysToThursday === 0 ? 'Chính hôm nay' : 'Đã qua ' + Math.abs(daysToThursday) + ' ngày'})\n\n` +
    `Thứ 4 tuần sau: ${Utilities.formatDate(nextWednesday, timeZone, 'dd/MM/yyyy (EEEE)')}\n\n` +
    `📊 Range: ${rangeDays} ngày (${Utilities.formatDate(thisThursday, timeZone, 'dd/MM')} → ${Utilities.formatDate(nextWednesday, timeZone, 'dd/MM')})`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Tạo Checklist Sheet từ data đã fetch
 */
function createChecklistFromData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    
    // Tìm sheet data gần nhất (format: "data dd/mm - dd/mm")
    const allSheets = ss.getSheets();
    const dataSheets = allSheets.filter(s => s.getName().startsWith('data '));
    
    if (dataSheets.length === 0) {
      ui.alert('⚠️ Không tìm thấy sheet data nào!\n\nVui lòng fetch dữ liệu trước.');
      return;
    }
    
    // Lấy sheet data mới nhất (giả định là sheet cuối cùng)
    const sourceSheet = dataSheets[dataSheets.length - 1];
    const dataSheetName = sourceSheet.getName();
    const dateRange = dataSheetName.replace('data ', '');
    
    Logger.log(`📋 Tạo checklist từ sheet: ${dataSheetName}`);
    ss.toast(`📋 Đang tạo checklist từ: ${dataSheetName}...`, 'Bắt đầu', 3);
    
    // Đọc dữ liệu từ source sheet
    const lastRow = sourceSheet.getLastRow();
    if (lastRow < 3) {
      ui.alert('⚠️ Sheet data trống!');
      return;
    }
    
    const dataRange = sourceSheet.getRange(3, 1, lastRow - 3, 12); // Bỏ title và header, lấy 12 cột
    const data = dataRange.getValues();
    
    if (data.length === 0) {
      ui.alert('⚠️ Không có dữ liệu lớp học!');
      return;
    }
    
    // Tạo sheet checklist
    const checklistName = `Checklist ${dateRange}`;
    let checklistSheet = ss.getSheetByName(checklistName);
    
    if (checklistSheet) {
      const response = ui.alert(
        'Sheet đã tồn tại',
        `Sheet "${checklistName}" đã tồn tại. Ghi đè?`,
        ui.ButtonSet.YES_NO
      );
      if (response === ui.Button.NO) return;
      checklistSheet.clear();
    } else {
      checklistSheet = ss.insertSheet(checklistName);
    }
    
    // Group dữ liệu theo bộ môn (khóa học)
    const groupedByCourse = {};
    data.forEach(row => {
      const course = row[5] || 'Khác'; // Column F (index 5): Khóa học
      if (!groupedByCourse[course]) {
        groupedByCourse[course] = [];
      }
      groupedByCourse[course].push(row);
    });
    
    // Ghi dữ liệu vào checklist
    writeChecklistSheet(checklistSheet, groupedByCourse, dateRange, data.length);
    
    Logger.log(`✅ Hoàn thành tạo checklist: ${data.length} lớp`);
    ss.toast(`✅ Đã tạo "${checklistName}" với ${data.length} lớp!`, 'Thành công', 5);
    
    // Activate sheet mới
    checklistSheet.activate();
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('❌ Lỗi: ' + error.toString());
  }
}

/**
 * Ghi dữ liệu vào Checklist Sheet (layout ngang theo bộ môn)
 */
function writeChecklistSheet(sheet, groupedData, dateRange, totalClasses) {
  const courses = Object.keys(groupedData).sort();
  const COLS_PER_COURSE = 14; // Mỗi bộ môn chiếm 14 cột (thêm Time Demo, Date, Time)
  const totalCols = courses.length * COLS_PER_COURSE;
  
  let currentRow = 1;
  
  // ===== TITLE =====
  sheet.getRange(currentRow, 1, 1, totalCols).merge();
  sheet.getRange(currentRow, 1)
    .setValue(`CHECKLIST DEMODAY - ${dateRange}`)
    .setBackground('#2C3E50')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontSize(14);
  currentRow++;
  
  // ===== SUMMARY =====
  sheet.getRange(currentRow, 1, 1, totalCols).merge();
  sheet.getRange(currentRow, 1)
    .setValue(`Tổng số: ${totalClasses} lớp | ${courses.length} bộ môn | Cập nhật: ${new Date()}`)
    .setBackground('#34495E')
    .setFontColor('#ECF0F1')
    .setHorizontalAlignment('center')
    .setFontSize(10);
  currentRow++;
  currentRow++; // Blank row
  
  // ===== COURSE HEADERS (ngang) =====
  courses.forEach((course, index) => {
    const startCol = index * COLS_PER_COURSE + 1;
    const classes = groupedData[course];
    
    sheet.getRange(currentRow, startCol, 1, COLS_PER_COURSE).merge();
    sheet.getRange(currentRow, startCol)
      .setValue(`📚 ${course} (${classes.length} lớp)`)
      .setBackground('#E67E22')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setFontSize(11);
  });
  currentRow++;
  
  // ===== COLUMN HEADERS (cho mỗi bộ môn) =====
  const headers = ['Tên lớp', 'Cơ sở', 'Time Demo', 'Date', 'Time', 'Khóa học', 'Ngày bắt đầu', 'Ngày kết thúc', 'Status', 'LEC', 'Số HS', 'Số buổi', 'Judge', 'Leader xác nhận'];
  
  courses.forEach((course, index) => {
    const startCol = index * COLS_PER_COURSE + 1;
    sheet.getRange(currentRow, startCol, 1, headers.length).setValues([headers]);
    sheet.getRange(currentRow, startCol, 1, headers.length)
      .setBackground('#4A90E2')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setWrap(true);
  });
  currentRow++;
  
  // ===== DATA (mỗi bộ môn một cột) =====
  // Tìm bộ môn có nhiều lớp nhất để biết cần bao nhiêu hàng
  let maxRows = 0;
  courses.forEach(course => {
    maxRows = Math.max(maxRows, groupedData[course].length);
  });
  
  // Ghi data cho từng bộ môn
  courses.forEach((course, courseIndex) => {
    const classes = groupedData[course];
    const startCol = courseIndex * COLS_PER_COURSE + 1;
    
    const rows = classes.map(cls => {
      return [
        cls[0], // Tên lớp
        cls[1], // Cơ sở
        cls[2], // Time Demo
        cls[3], // Date
        cls[4], // Time
        cls[5], // Khóa học
        cls[6], // Ngày bắt đầu
        cls[7], // Ngày kết thúc
        cls[8], // Status
        cls[9], // LEC
        cls[10], // Số HS
        cls[11], // Số buổi
        '',     // Judge (để trống)
        ''      // Leader xác nhận (để trống)
      ];
    });
    
    // Ghi dữ liệu
    if (rows.length > 0) {
      sheet.getRange(currentRow, startCol, rows.length, 14).setValues(rows);
      
      // Format data rows
      const dataRange = sheet.getRange(currentRow, startCol, rows.length, 14);
      dataRange.setVerticalAlignment('top');
      dataRange.setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
      
      // Highlight cột Time Demo, Date, Time (columns 3, 4, 5 trong mỗi khối)
      sheet.getRange(currentRow, startCol + 2, rows.length, 3)
        .setBackground('#FFF9E6')
        .setFontWeight('bold');
      
      // Màu Status (column 9 trong mỗi khối)
      for (let i = 0; i < rows.length; i++) {
        const statusCell = sheet.getRange(currentRow + i, startCol + 8); // +8 vì Status ở index 8
        if (rows[i][8] === 'RUNNING') {
          statusCell.setBackground('#90ee90');
        } else if (rows[i][8] === 'FINISHED' || rows[i][8] === 'CLOSED') {
          statusCell.setBackground('#d3d3d3');
        }
      }
      
      // Highlight cột Judge và Leader xác nhận
      sheet.getRange(currentRow, startCol + 12, rows.length, 2) // +12 vì Judge ở index 12
        .setBackground('#FFF3CD')
        .setBorder(true, true, true, true, true, true, '#FFC107', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
  });
  
  currentRow += maxRows;
  currentRow++; // Blank row
  
  // ===== FOOTER =====
  sheet.getRange(currentRow, 1, 1, totalCols).merge();
  sheet.getRange(currentRow, 1)
    .setValue(`⚠️ Lưu ý: Điền Judge và Leader xác nhận trước DemoDay`)
    .setBackground('#E74C3C')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontSize(10);
  
  // ===== FORMATTING =====
  // Auto resize columns for each course block
  courses.forEach((course, index) => {
    const startCol = index * COLS_PER_COURSE + 1;
    sheet.autoResizeColumns(startCol, 12);
    sheet.setColumnWidth(startCol + 12, 120);  // Judge
    sheet.setColumnWidth(startCol + 13, 120); // Leader xác nhận
  });
  
  sheet.setFrozenRows(5); // Freeze title + summary + blank + course headers + column headers
  
  Logger.log(`✅ Đã ghi checklist: ${courses.length} bộ môn (từ trái qua phải), ${totalClasses} lớp`);
}

/**
 * Menu custom
 */
function onOpenFetchClassesThisWeekMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📅 Lớp Tuần Này')
    .addItem('🚀 Tuần này (T5→T4)', 'fetchClassesThisWeek')
    .addItem('⏭️ Tuần sau (T5→T4)', 'fetchClassesNextWeek')
    .addSeparator()
    .addItem('📋 Tạo Checklist DemoDay', 'createChecklistFromData')
    .addSeparator()
    .addItem('🧪 Test tính ngày', 'testDateCalculation')
    .addToUi();
}
