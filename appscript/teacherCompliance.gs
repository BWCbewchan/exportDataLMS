/**
 * TEACHER COMPLIANCE DATA FETCHER - NĂM 2026
 * Script để lấy dữ liệu Teacher Compliance năm 2026 từ MindX LMS API và đưa vào Google Sheets
 * 
 * ✨ TÍNH NĂNG: AUTO TOKEN - HỆ THỐNG THÔNG MINH
 * - Ưu tiên đọc token từ sheet "Firebase Token" (do getFirebaseToken.gs tạo)
 * - Tự động kiểm tra token còn hiệu lực (< 55 phút tuổi)
 * - Tự động fetch token mới nếu không có hoặc hết hạn
 * - Tự động lưu token mới vào sheet để dùng lại
 * 
 * 💡 CÁCH SỬ DỤNG TỐI ƯU:
 * 1. Chạy getFirebaseToken.gs 1 lần để lấy token vào sheet
 * 2. Chạy script này nhiều lần (trong vòng 55 phút) mà không cần fetch token mới
 * 3. Tiết kiệm API calls, tăng tốc độ xử lý
 * 
 * Hướng dẫn setup:
 * 1. Mở Google Sheets
 * 2. Extensions > Apps Script
 * 3. Copy toàn bộ code này vào
 * 4. (Tùy chọn) Chạy getFirebaseToken.gs trước để tạo token cache
 * 5. Save và chạy function fetchTeacherComplianceData()
 * 
 * LƯU Ý: 
 * - Script này CHỈ LẤY DỮ LIỆU NĂM 2026 (01/01/2026 - 31/12/2026)
 * - Token tự động được quản lý (đọc từ sheet hoặc fetch mới)
 * - Load tới đâu ghi tới đó (realtime)
 */

// ========================================
// CẤU HÌNH
// ========================================

const CONFIG = {
  API_URL: 'https://lms-api.mindx.vn/',
  
  // ⚠️ TOKEN SẼ TỰ ĐỘNG LẤY TỪ FIREBASE (không cần update manual)
  AUTH_TOKEN: '', // Sẽ được tự động cập nhật
  
  // Tên sheet sẽ ghi dữ liệu vào
  SHEET_NAME: 'Teacher Compliance',
  
  // Số bản ghi mỗi lần fetch (max 100)
  RECORDS_PER_PAGE: 100,
  
  // Có fetch tất cả bản ghi hay không (true = fetch all, false = chỉ fetch 1 trang)
  FETCH_ALL: true
};

// ========================================
// FIREBASE AUTHENTICATION CONFIG
// ========================================

const COMPLIANCE_FIREBASE_CONFIG = {
  API_URL: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
  API_KEY: 'AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4',
  
  // ⚠️ CẬP NHẬT THÔNG TIN ĐĂNG NHẬP
  EMAIL: 'anhpnh@mindx.com.vn',
  PASSWORD: 'Hoanganh@123'
};

// ========================================
// GRAPHQL QUERY
// ========================================

const QUERY = `query FindTeacherComplianceRecords($payload: TeacherComplianceRecordQueryPayload!) {
  findTeacherComplianceRecords(payload: $payload) {
    total
    data {
      id
      teacherId
      violationStatus
      totalCriterias
      violatedCriterias
      createdBy
      createdAt
      lastModifiedAt
      lastModifiedBy
      class {
        className
      }
      teacher {
        id
        fullName
      }
      results {
        id
        category
        criteriaResults {
          id
          name
          description
          mistakeLevel
          isViolated
          note
        }
      }
      score
    }
  }
}`;

// ========================================
// MAIN FUNCTIONS
// ========================================

// Năm 2026 timestamps để filter
const YEAR_2026_START = new Date('2026-01-01T00:00:00Z').getTime();
const YEAR_2026_END = new Date('2026-12-31T23:59:59Z').getTime();

/**
 * Hàm check xem record có thuộc năm 2026 không
 */
function isYear2026(record) {
  // Kiểm tra record hợp lệ trước khi truy cập thuộc tính
  if (!record || !record.createdAt) {
    return false;
  }
  const createdAt = parseInt(record.createdAt);
  return createdAt >= YEAR_2026_START && createdAt <= YEAR_2026_END;
}

// ========================================
// FIREBASE AUTHENTICATION
// ========================================

/**
 * Lấy Firebase ID Token tự động
 * CHIẾN LƯỢC:
 * 1. Thử đọc token từ sheet "Firebase Token" (do getFirebaseToken.gs tạo ra)
 * 2. Kiểm tra xem token còn hiệu lực không (< 55 phút tuổi)
 * 3. Nếu không có hoặc hết hạn → Fetch token mới từ Firebase API
 */
function getFirebaseToken() {
  // Thử đọc token từ sheet trước
  const tokenFromSheet = readTokenFromSheet();
  
  if (tokenFromSheet) {
    Logger.log('✅ Đã lấy token từ sheet "Firebase Token" (còn hiệu lực)');
    return tokenFromSheet;
  }
  
  // Nếu không có token hợp lệ → Fetch mới từ Firebase
  Logger.log('📡 Không có token hợp lệ trong sheet → Fetch token mới từ Firebase...');
  return fetchNewFirebaseToken();
}

/**
 * Đọc token từ sheet "Firebase Token"
 * Returns: token string nếu hợp lệ, null nếu không có hoặc hết hạn
 */
function readTokenFromSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Firebase Token');
    
    if (!sheet) {
      Logger.log('⚠️ Sheet "Firebase Token" không tồn tại');
      return null;
    }
    
    // Đọc data từ sheet
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('⚠️ Sheet "Firebase Token" trống');
      return null;
    }
    
    // Row 2 chứa ID Token (theo cấu trúc của getFirebaseToken.gs)
    const tokenRow = sheet.getRange(2, 1, 1, 4).getValues()[0];
    const tokenType = tokenRow[0];  // "ID Token"
    const tokenValue = tokenRow[1]; // Token string
    const timeString = tokenRow[2]; // "dd/MM/yyyy HH:mm:ss"
    const expiresIn = tokenRow[3];  // seconds (3600)
    
    if (!tokenValue || tokenType !== 'ID Token') {
      Logger.log('⚠️ Không tìm thấy ID Token trong sheet');
      return null;
    }
    
    // Kiểm tra token còn hiệu lực không
    if (timeString && expiresIn) {
      const tokenTime = parseVietnameseDateTime(timeString);
      const now = new Date();
      const ageSeconds = (now - tokenTime) / 1000;
      const maxAge = expiresIn - 300; // Còn ít nhất 5 phút (buffer)
      
      if (ageSeconds > maxAge) {
        Logger.log(`⚠️ Token đã hết hạn (tuổi: ${Math.floor(ageSeconds)}s, max: ${maxAge}s)`);
        return null;
      }
      
      Logger.log(`🔐 Token từ sheet còn hiệu lực (tuổi: ${Math.floor(ageSeconds)}s/${expiresIn}s)`);
    }
    
    return tokenValue;
    
  } catch (error) {
    Logger.log('⚠️ Lỗi khi đọc token từ sheet: ' + error.toString());
    return null;
  }
}

/**
 * Parse datetime string định dạng Việt Nam: "dd/MM/yyyy HH:mm:ss"
 */
function parseVietnameseDateTime(dateString) {
  try {
    const parts = dateString.split(' ');
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    return new Date(
      parseInt(dateParts[2]), // year
      parseInt(dateParts[1]) - 1, // month (0-indexed)
      parseInt(dateParts[0]), // day
      parseInt(timeParts[0]), // hour
      parseInt(timeParts[1]), // minute
      parseInt(timeParts[2])  // second
    );
  } catch (e) {
    return null;
  }
}

/**
 * Fetch token mới từ Firebase API
 */
function fetchNewFirebaseToken() {
  const url = COMPLIANCE_FIREBASE_CONFIG.API_URL + '?key=' + COMPLIANCE_FIREBASE_CONFIG.API_KEY;
  
  const payload = {
    returnSecureToken: true,
    email: COMPLIANCE_FIREBASE_CONFIG.EMAIL,
    password: COMPLIANCE_FIREBASE_CONFIG.PASSWORD,
    clientType: 'CLIENT_TYPE_WEB'
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'accept': '*/*',
      'origin': 'https://base.mindx.edu.vn',
      'x-client-version': 'Chrome/JsCore/9.23.0/FirebaseCore-web',
      'x-firebase-gmpid': '1:469103925618:web:06ab79fed8c9edcad2a5eb'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  Logger.log('🔐 Đang fetch token mới từ Firebase API...');
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    const errorText = response.getContentText();
    throw new Error(`Firebase Auth lỗi: ${responseCode} - ${errorText}`);
  }
  
  const result = JSON.parse(response.getContentText());
  
  Logger.log('✅ Đã fetch token mới thành công! (expires in: ' + result.expiresIn + 's)');
  
  // Tự động cập nhật vào sheet để dùng cho lần sau
  updateTokenToSheet(result);
  
  return result.idToken;
}

/**
 * Cập nhật token mới vào sheet "Firebase Token"
 */
function updateTokenToSheet(tokenData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Firebase Token');
    
    // Tạo sheet mới nếu chưa có
    if (!sheet) {
      sheet = ss.insertSheet('Firebase Token');
      Logger.log('📋 Đã tạo sheet "Firebase Token"');
    }
    
    // Clear và ghi lại
    sheet.clear();
    
    // Header
    const headers = [['Loại', 'Giá trị', 'Thời gian lấy', 'Expires In (seconds)']];
    sheet.getRange(1, 1, 1, 4).setValues(headers);
    sheet.getRange(1, 1, 1, 4)
      .setBackground('#4A90E2')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Data
    const now = new Date();
    const timeString = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    
    const data = [
      ['ID Token', tokenData.idToken, timeString, tokenData.expiresIn],
      ['Refresh Token', tokenData.refreshToken || '', timeString, ''],
      ['Local ID', tokenData.localId || '', timeString, ''],
      ['Email', tokenData.email || '', timeString, '']
    ];
    
    sheet.getRange(2, 1, data.length, 4).setValues(data);
    
    // Format
    sheet.autoResizeColumns(1, 4);
    sheet.getRange(1, 1, data.length + 1, 4)
      .setBorder(true, true, true, true, true, true);
    sheet.getRange(2, 2, data.length, 1).setWrap(true);
    
    Logger.log('💾 Đã cập nhật token vào sheet "Firebase Token"');
    
  } catch (error) {
    Logger.log('⚠️ Không thể cập nhật token vào sheet: ' + error.toString());
    // Không throw error vì token vẫn lấy được, chỉ là không lưu vào sheet
  }
}

// ========================================
// MAIN FUNCTIONS
// ========================================

/**
 * Hàm chính để fetch và ghi dữ liệu vào sheet
 * Chạy function này để lấy dữ liệu (CHỈ LẤY DỮ LIỆU NĂM 2026)
 * ✨ AUTO LẤY TOKEN - Không cần update manual
 */
function fetchTeacherComplianceData() {
  try {
    Logger.log('🚀 Bắt đầu lấy dữ liệu Teacher Compliance NĂM 2026...');
    Logger.log('📅 Filter: 01/01/2026 - 31/12/2026');
    Logger.log('💾 LOAD TỚI ĐÂU - GHI TỚI ĐÓ (Realtime)');
    Logger.log('🔐 AUTO TOKEN: Đọc từ sheet → Nếu không có/hết hạn → Fetch mới\n');
    
    // ⚡ TỰ ĐỘNG LẤY TOKEN (ưu tiên từ sheet, fallback to API)
    CONFIG.AUTH_TOKEN = getFirebaseToken();
    
    // Lấy hoặc tạo sheet
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    
    // Clear sheet và tạo header
    sheet.clear();
    createHeader(sheet);
    
    // Biến đếm
    let totalFetchedRecords = 0;
    let totalRecords2026 = 0;
    let page = 0;
    let totalAll = 0;
    let currentRow = 2; // Bắt đầu từ row 2 (row 1 là header)
    
    do {
      Logger.log(`📥 Đang lấy trang ${page + 1}...`);
      
      const response = fetchDataFromAPI(page);
      
      if (!response || !response.data || !response.data.findTeacherComplianceRecords) {
        throw new Error('Không nhận được dữ liệu từ API');
      }
      
      const result = response.data.findTeacherComplianceRecords;
      totalAll = result.total;
      totalFetchedRecords += result.data.length;
      
      // Filter dữ liệu năm 2026
      const filtered2026 = result.data.filter(isYear2026);
      
      // ⚡ GHI NGAY VÀO SHEET (không đợi)
      if (filtered2026.length > 0) {
        appendDataToSheet(sheet, filtered2026, currentRow);
        currentRow += filtered2026.length;
        totalRecords2026 += filtered2026.length;
        
        // Update toast để user thấy tiến độ
        SpreadsheetApp.getActiveSpreadsheet().toast(
          `Đã ghi ${totalRecords2026} bản ghi năm 2026...`,
          `Đang xử lý trang ${page + 1}`,
          2
        );
      }
      
      Logger.log(`✅ Trang ${page + 1}: ${result.data.length} bản ghi, ${filtered2026.length} thuộc năm 2026 → Đã ghi vào sheet (Tổng: ${totalRecords2026})`);
      
      page++;
      
      // Nếu không fetch all, chỉ lấy 1 trang
      if (!CONFIG.FETCH_ALL) break;
      
      // Dừng khi đã lấy hết
      if (totalFetchedRecords >= totalAll) break;
      
      // Delay để tránh rate limit
      Utilities.sleep(500);
      
    } while (true);
    
    // Log kết quả
    Logger.log(`\n🎉 Hoàn thành fetch!`);
    Logger.log(`   - Tổng số bản ghi fetched: ${totalFetchedRecords}`);
    Logger.log(`   - Bản ghi năm 2026 đã ghi: ${totalRecords2026}`);
    
    // Format sheet
    Logger.log('🎨 Đang format sheet...');
    formatSheet(sheet);
    
    // Thông báo hoàn thành
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `✅ Đã lấy thành công ${totalRecords2026} bản ghi năm 2026 (từ ${totalFetchedRecords} tổng số)!`,
      'Hoàn thành - Năm 2026',
      5
    );
    
    Logger.log(`🎉 HOÀN THÀNH! Đã ghi ${totalRecords2026} bản ghi năm 2026 vào sheet "${CONFIG.SHEET_NAME}"`);
    Logger.log(`   (Tổng số bản ghi trong hệ thống: ${totalAll})`);
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

/**
 * Fetch dữ liệu từ API theo trang
 */
function fetchDataFromAPI(page) {
  const variables = {
    payload: {
      filters: {},
      pagination: {
        page: page,
        limit: CONFIG.RECORDS_PER_PAGE
      }
    }
  };
  
  const payload = {
    operationName: 'FindTeacherComplianceRecords',
    variables: variables,
    query: QUERY
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'accept': '*/*',
      'accept-language': 'vi,en;q=0.9',
      'authorization': CONFIG.AUTH_TOKEN,
      'cache-control': 'no-cache',
      'content-language': 'vi',
      'origin': 'https://lms.mindx.edu.vn',
      'referer': 'https://lms.mindx.edu.vn/'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    throw new Error(`API trả về lỗi: ${responseCode} - ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Lấy hoặc tạo sheet mới
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  return sheet;
}

/**
 * Tạo header cho sheet
 */
function createHeader(sheet) {
  const headers = [
    'ID',
    'Teacher ID',
    'Teacher Name',
    'Class Name',
    'Violation Status',
    'Total Criterias',
    'Violated Criterias',
    'Score',
    'Created By',
    'Created At',
    'Last Modified At',
    'Last Modified By',
    'Categories',
    'Violated Items'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Style header
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

/**
 * Ghi dữ liệu vào sheet (kế thừa từ version cũ, không dùng trong realtime mode)
 */
function writeDataToSheet(sheet, records) {
  if (records.length === 0) {
    Logger.log('⚠️ Không có dữ liệu để ghi');
    return;
  }
  
  const rows = convertRecordsToRows(records);
  
  // Ghi dữ liệu từ row 2 trở đi
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Append dữ liệu vào sheet (GHI NGAY - Realtime)
 */
function appendDataToSheet(sheet, records, startRow) {
  if (records.length === 0) {
    return;
  }
  
  const rows = convertRecordsToRows(records);
  
  // Ghi dữ liệu từ startRow
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Convert records thành rows để ghi vào sheet
 */
function convertRecordsToRows(records) {
  return records.map(record => {
    // Lấy danh sách categories
    const categories = record.results ? record.results.map(r => r.category).join(', ') : '';
    
    // Lấy danh sách violated items
    const violatedItems = [];
    if (record.results) {
      record.results.forEach(result => {
        if (result.criteriaResults) {
          result.criteriaResults.forEach(criteria => {
            if (criteria.isViolated) {
              violatedItems.push(`${criteria.name}${criteria.note ? ': ' + criteria.note : ''}`);
            }
          });
        }
      });
    }
    const violatedItemsStr = violatedItems.join(' | ');
    
    return [
      record.id || '',
      record.teacherId || '',
      record.teacher?.fullName || '',
      record.class?.className || '',
      record.violationStatus || '',
      record.totalCriterias || 0,
      record.violatedCriterias || 0,
      record.score || 0,
      record.createdBy || '',
      record.createdAt ? formatDate(record.createdAt) : '',
      record.lastModifiedAt ? formatDate(record.lastModifiedAt) : '',
      record.lastModifiedBy || '',
      categories,
      violatedItemsStr
    ];
  });
}

/**
 * Format sheet cho đẹp
 */
function formatSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1) return;
  
  // Auto resize columns
  for (let i = 1; i <= lastCol; i++) {
    sheet.autoResizeColumn(i);
  }
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Add borders
  sheet.getRange(1, 1, lastRow, lastCol)
    .setBorder(true, true, true, true, true, true);
  
  // Align text
  sheet.getRange(2, 1, lastRow - 1, lastCol).setVerticalAlignment('top');
  
  // Center align cho các cột số
  const numberColumns = [5, 6, 7, 8]; // Violation Status, Total, Violated, Score
  numberColumns.forEach(col => {
    if (lastRow > 1) {
      sheet.getRange(2, col, lastRow - 1, 1).setHorizontalAlignment('center');
    }
  });
  
  // Màu sắc cho Violation Status
  if (lastRow > 1) {
    const violationStatusRange = sheet.getRange(2, 5, lastRow - 1, 1);
    const violationStatusValues = violationStatusRange.getValues();
    
    violationStatusValues.forEach((row, index) => {
      const cell = sheet.getRange(index + 2, 5);
      if (row[0] === 'VIOLATED') {
        cell.setBackground('#ffcccb'); // Đỏ nhạt
      } else if (row[0] === 'NOT_VIOLATED') {
        cell.setBackground('#90ee90'); // Xanh nhạt
      }
    });
  }
  
  // Set wrap text cho cột Violated Items
  if (lastRow > 1) {
    sheet.getRange(2, 14, lastRow - 1, 1).setWrap(true);
  }
}

/**
 * Format date từ timestamp (milliseconds) sang định dạng dễ đọc
 */
function formatDate(timestampString) {
  try {
    // Parse timestamp từ string sang number (milliseconds)
    const timestamp = parseInt(timestampString);
    
    // Kiểm tra timestamp hợp lệ
    if (isNaN(timestamp) || timestamp === 0) {
      return timestampString;
    }
    
    const date = new Date(timestamp);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  } catch (e) {
    return timestampString;
  }
}

// ========================================
// MENU CUSTOM
// ========================================

/**
 * Tạo menu custom khi mở spreadsheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 MindX Data')
    .addItem('🚀 Lấy Teacher Compliance 2026', 'fetchTeacherComplianceData')
    .addSeparator()
    .addItem('📖 Hướng dẫn', 'showInstructions')
    .addItem('🔐 Về Auto Token', 'showTokenUpdateDialog')
    .addToUi();
}

/**
 * Hiển thị hướng dẫn sử dụng
 */
function showInstructions() {
  const html = HtmlService.createHtmlOutput(`
    <h2>📖 Hướng dẫn sử dụng - Teacher Compliance 2026</h2>
    
    <h3>✨ AUTO TOKEN - Hệ thống thông minh</h3>
    <p>Script tự động quản lý token theo 2 chiến lược:</p>
    <ol>
      <li><strong>Đọc từ sheet "Firebase Token"</strong> (ưu tiên - tiết kiệm API)</li>
      <li><strong>Fetch từ Firebase API</strong> (nếu không có/hết hạn)</li>
    </ol>
    
    <h3>1. Lần đầu sử dụng:</h3>
    <ul>
      <li>✅ Không cần token manual!</li>
      <li><strong>Tùy chọn:</strong> Chạy <code>getFirebaseToken.gs</code> trước để tạo token cache</li>
      <li>Chạy menu: <strong>MindX Data > Lấy Teacher Compliance 2026</strong></li>
      <li>Cho phép quyền truy cập khi được yêu cầu</li>
    </ul>
    
    <h3>2. Sử dụng hiệu quả:</h3>
    <ul>
      <li>🎯 <strong>Cách tốt nhất:</strong> Chạy <code>getFirebaseToken.gs</code> 1 lần</li>
      <li>📊 Token được lưu vào sheet "Firebase Token"</li>
      <li>🔄 Dùng token đó cho nhiều lần fetch (trong 55 phút)</li>
      <li>⚡ Tiết kiệm thời gian, giảm API calls</li>
    </ul>
    
    <h3>3. Cấu hình:</h3>
    <ul>
      <li><strong>COMPLIANCE_FIREBASE_CONFIG:</strong> Email & Password (chỉ dùng khi fetch mới)</li>
      <li><strong>FETCH_ALL:</strong> true = lấy tất cả, false = chỉ lấy 1 trang</li>
      <li><strong>RECORDS_PER_PAGE:</strong> số bản ghi mỗi trang (max 100)</li>
    </ul>
    
    <h3>4. Filter năm 2026:</h3>
    <ul>
      <li>Script tự động <strong>CHỈ LẤY DỮ LIỆU NĂM 2026</strong></li>
      <li>Thời gian: 01/01/2026 00:00:00 - 31/12/2026 23:59:59</li>
      <li>Dữ liệu ngoài năm 2026 sẽ bị bỏ qua</li>
    </ul>
    
    <h3>5. Load tới đâu - Ghi tới đó:</h3>
    <ul>
      <li>Dữ liệu được ghi ngay vào sheet sau mỗi trang</li>
      <li>Xem tiến độ realtime trên Google Sheets</li>
      <li>Không lo mất dữ liệu nếu timeout</li>
    </ul>
    
    <h3>6. Lưu ý:</h3>
    <ul>
      <li>✅ Token tự động quản lý - không cần làm gì!</li>
      <li>📋 Xem sheet "Firebase Token" để biết token hiện tại</li>
      <li>Fetch tất cả dữ liệu có thể mất vài phút</li>
      <li>Sheet sẽ được xóa và ghi lại mỗi lần chạy</li>
    </ul>
  `)
  .setWidth(700)
  .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Hướng dẫn - Teacher Compliance 2026');
}

/**
 * Hiển thị hướng dẫn về Auto Token
 */
function showTokenUpdateDialog() {
  const html = HtmlService.createHtmlOutput(`
    <h3>🔐 Auto Token - Hệ thống thông minh</h3>
    <p><strong>✨ 2 cách lấy token tự động!</strong></p>
    
    <h4>📋 Cách 1: Đọc từ Sheet (Ưu tiên)</h4>
    <ol>
      <li>Chạy script <code>getFirebaseToken.gs</code> để lấy token vào sheet "Firebase Token"</li>
      <li>Script này sẽ tự động đọc token từ sheet đó</li>
      <li><strong>Lợi ích:</strong> Tiết kiệm API calls, dùng lại token trong vòng 55 phút</li>
    </ol>
    
    <h4>🔄 Cách 2: Auto-fetch từ Firebase (Fallback)</h4>
    <ol>
      <li>Nếu không có token trong sheet hoặc đã hết hạn</li>
      <li>Script tự động fetch token mới từ Firebase API</li>
      <li>Token mới được lưu vào sheet để dùng cho lần sau</li>
    </ol>
    
    <h4>⚙️ Cách thay đổi tài khoản:</h4>
    <p>Cập nhật <code>COMPLIANCE_FIREBASE_CONFIG</code> trong code:</p>
    <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
COMPLIANCE_FIREBASE_CONFIG
  EMAIL: 'your-email@mindx.com.vn'
  PASSWORD: 'your-password'</pre>
    
    <h4>📊 Kiểm tra token:</h4>
    <p>Xem sheet <strong>"Firebase Token"</strong> để biết:</p>
    <ul>
      <li>Token hiện tại</li>
      <li>Thời gian lấy</li>
      <li>Thời gian hết hạn (3600s = 1 giờ)</li>
    </ul>
    
    <p><strong>💡 Tips:</strong> Chạy <code>getFirebaseToken.gs</code> 1 lần, sau đó dùng token đó cho nhiều lần fetch data!</p>
  `)
  .setWidth(600)
  .setHeight(550);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Auto Token - Hệ thống thông minh');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Test function để kiểm tra API connection
 */
function testAPIConnection() {
  try {
    Logger.log('🧪 Testing API connection...');
    const response = fetchDataFromAPI(0);
    
    if (response && response.data) {
      Logger.log('✅ API connection successful!');
      Logger.log('Total records available: ' + response.data.findTeacherComplianceRecords.total);
      return true;
    }
    
    Logger.log('❌ API connection failed');
    return false;
    
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    return false;
  }
}

/**
 * Function để export detailed violations sang sheet riêng
 */
function exportDetailedViolations() {
  try {
    Logger.log('🚀 Bắt đầu export chi tiết violations...');
    
    // Lấy sheet chính
    const mainSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!mainSheet) {
      throw new Error('Vui lòng chạy fetchTeacherComplianceData() trước');
    }
    
    // Tạo sheet mới cho details
    const detailSheet = getOrCreateSheet('Violation Details');
    detailSheet.clear();
    
    // Header cho detail sheet
    const detailHeaders = [
      'Record ID',
      'Teacher Name',
      'Class Name',
      'Category',
      'Criteria Name',
      'Description',
      'Mistake Level',
      'Note'
    ];
    
    detailSheet.getRange(1, 1, 1, detailHeaders.length).setValues([detailHeaders]);
    detailSheet.getRange(1, 1, 1, detailHeaders.length)
      .setBackground('#E74C3C')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Fetch lại data và extract violations
    Logger.log('📥 Đang lấy dữ liệu...');
    const response = fetchDataFromAPI(0);
    const records = response.data.findTeacherComplianceRecords.data;
    
    const detailRows = [];
    
    records.forEach(record => {
      if (record.results) {
        record.results.forEach(result => {
          if (result.criteriaResults) {
            result.criteriaResults.forEach(criteria => {
              if (criteria.isViolated) {
                detailRows.push([
                  record.id,
                  record.teacher?.fullName || '',
                  record.class?.className || '',
                  result.category || '',
                  criteria.name || '',
                  criteria.description || '',
                  criteria.mistakeLevel || '',
                  criteria.note || ''
                ]);
              }
            });
          }
        });
      }
    });
    
    if (detailRows.length > 0) {
      detailSheet.getRange(2, 1, detailRows.length, detailRows[0].length).setValues(detailRows);
      formatSheet(detailSheet);
    }
    
    Logger.log(`✅ Đã export ${detailRows.length} violations chi tiết`);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Đã export ${detailRows.length} violations chi tiết!`,
      'Hoàn thành',
      3
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}
