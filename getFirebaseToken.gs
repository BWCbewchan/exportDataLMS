/**
 * FIREBASE TOKEN FETCHER
 * Script để lấy idToken từ Firebase Authentication
 * 
 * Hướng dẫn sử dụng:
 * 1. Mở Google Sheets
 * 2. Extensions > Apps Script
 * 3. Tạo file mới và copy code này vào
 * 4. Cập nhật EMAIL và PASSWORD bên dưới
 * 5. Chạy function getFirebaseIdToken()
 * 6. Token sẽ được ghi vào sheet "Firebase Token"
 */

// ========================================
// CẤU HÌNH
// ========================================

const FIREBASE_CONFIG = {
  API_URL: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
  API_KEY: 'AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4',
  
  // ⚠️ CẬP NHẬT THÔNG TIN ĐĂNG NHẬP
  EMAIL: 'anhpnh@mindx.com.vn',
  PASSWORD: 'Hoanganh@123',
  
  // Tên sheet để ghi token
  SHEET_NAME: 'Firebase Token'
};

// ========================================
// MAIN FUNCTION
// ========================================

/**
 * Hàm chính để lấy Firebase ID Token
 */
function getFirebaseIdToken() {
  try {
    Logger.log('🔐 Bắt đầu lấy Firebase ID Token...');
    
    // Fetch token từ Firebase
    const tokenData = fetchFirebaseToken();
    
    if (!tokenData || !tokenData.idToken) {
      throw new Error('Không nhận được ID Token từ Firebase');
    }
    
    Logger.log('✅ Đã lấy token thành công!');
    Logger.log('Token expires in: ' + tokenData.expiresIn + ' seconds');
    
    // Ghi token vào sheet
    writeTokenToSheet(tokenData);
    
    // Hiển thị thông báo
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Token đã được lưu vào sheet "' + FIREBASE_CONFIG.SHEET_NAME + '"',
      '✅ Thành công',
      5
    );
    
    // Log token (có thể comment dòng này nếu không muốn log token)
    Logger.log('ID Token: ' + tokenData.idToken);
    
    return tokenData.idToken;
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
    throw error;
  }
}

/**
 * Fetch token từ Firebase Authentication API
 */
function fetchFirebaseToken() {
  const url = FIREBASE_CONFIG.API_URL + '?key=' + FIREBASE_CONFIG.API_KEY;
  
  const payload = {
    returnSecureToken: true,
    email: FIREBASE_CONFIG.EMAIL,
    password: FIREBASE_CONFIG.PASSWORD,
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
  
  Logger.log('📡 Đang gửi request đến Firebase...');
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    const errorText = response.getContentText();
    Logger.log('Response: ' + errorText);
    throw new Error(`Firebase API trả về lỗi: ${responseCode} - ${errorText}`);
  }
  
  const result = JSON.parse(response.getContentText());
  
  return {
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    localId: result.localId,
    email: result.email
  };
}

/**
 * Ghi token vào Google Sheet
 */
function writeTokenToSheet(tokenData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FIREBASE_CONFIG.SHEET_NAME);
  
  // Tạo sheet mới nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet(FIREBASE_CONFIG.SHEET_NAME);
  }
  
  // Clear sheet
  sheet.clear();
  
  // Tạo header
  const headers = [
    ['Loại', 'Giá trị', 'Thời gian lấy', 'Expires In (seconds)']
  ];
  sheet.getRange(1, 1, 1, 4).setValues(headers);
  sheet.getRange(1, 1, 1, 4)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Ghi dữ liệu
  const now = new Date();
  const timeString = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  
  const data = [
    ['ID Token', tokenData.idToken, timeString, tokenData.expiresIn],
    ['Refresh Token', tokenData.refreshToken, timeString, ''],
    ['Local ID', tokenData.localId, timeString, ''],
    ['Email', tokenData.email, timeString, '']
  ];
  
  sheet.getRange(2, 1, data.length, 4).setValues(data);
  
  // Format
  sheet.autoResizeColumns(1, 4);
  sheet.getRange(1, 1, data.length + 1, 4)
    .setBorder(true, true, true, true, true, true);
  
  // Wrap text cho cột token (dài)
  sheet.getRange(2, 2, data.length, 1).setWrap(true);
  
  Logger.log('💾 Đã ghi token vào sheet "' + FIREBASE_CONFIG.SHEET_NAME + '"');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Chỉ lấy ID Token và trả về string
 */
function getIdTokenOnly() {
  const tokenData = fetchFirebaseToken();
  return tokenData.idToken;
}

/**
 * Copy ID Token vào clipboard (hiển thị dialog)
 */
function showIdToken() {
  try {
    const token = getIdTokenOnly();
    
    const html = HtmlService.createHtmlOutput(`
      <h3>🔑 Firebase ID Token</h3>
      <p><small>Token expires in 3600 seconds (1 hour)</small></p>
      <textarea id="token" style="width: 100%; height: 200px; font-family: monospace; font-size: 11px;">${token}</textarea>
      <br><br>
      <button onclick="copyToken()">📋 Copy Token</button>
      
      <script>
        function copyToken() {
          const tokenField = document.getElementById('token');
          tokenField.select();
          document.execCommand('copy');
          alert('✅ Token đã được copy vào clipboard!');
        }
        
        // Auto select on load
        document.getElementById('token').select();
      </script>
    `)
    .setWidth(600)
    .setHeight(350);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Firebase ID Token');
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

/**
 * Lấy token và ghi vào file .txt (dùng Drive API)
 */
function saveTokenToFile() {
  try {
    const tokenData = fetchFirebaseToken();
    
    const fileName = 'firebase_token_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.txt';
    
    const content = `Firebase ID Token
=================
Generated: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')}
Expires in: ${tokenData.expiresIn} seconds (${Math.floor(tokenData.expiresIn / 60)} minutes)
Email: ${tokenData.email}

ID TOKEN:
${tokenData.idToken}

REFRESH TOKEN:
${tokenData.refreshToken}

LOCAL ID:
${tokenData.localId}
`;
    
    // Tạo file trong Google Drive (thư mục root)
    const file = DriveApp.createFile(fileName, content, 'text/plain');
    
    Logger.log('💾 Đã lưu token vào file: ' + fileName);
    Logger.log('📁 File URL: ' + file.getUrl());
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Token đã được lưu vào file: ' + fileName,
      '✅ Thành công',
      5
    );
    
    // Hiển thị link file
    const html = HtmlService.createHtmlOutput(`
      <h3>✅ Token đã được lưu!</h3>
      <p><strong>File:</strong> ${fileName}</p>
      <p><a href="${file.getUrl()}" target="_blank">🔗 Mở file trong Google Drive</a></p>
    `)
    .setWidth(400)
    .setHeight(150);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'File đã tạo');
    
    return file.getUrl();
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

// ========================================
// MENU CUSTOM
// ========================================

/**
 * Tạo menu custom
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔐 Firebase Token')
    .addItem('🔑 Lấy ID Token', 'getFirebaseIdToken')
    .addItem('📋 Hiển thị Token', 'showIdToken')
    .addItem('💾 Lưu Token vào File', 'saveTokenToFile')
    .addSeparator()
    .addItem('ℹ️ Hướng dẫn', 'showTokenHelp')
    .addToUi();
}

/**
 * Hiển thị hướng dẫn
 */
function showTokenHelp() {
  const html = HtmlService.createHtmlOutput(`
    <h2>📖 Hướng dẫn sử dụng Firebase Token</h2>
    
    <h3>1. Cấu hình:</h3>
    <p>Cập nhật <code>EMAIL</code> và <code>PASSWORD</code> trong biến <code>FIREBASE_CONFIG</code></p>
    
    <h3>2. Các chức năng:</h3>
    <ul>
      <li><strong>🔑 Lấy ID Token:</strong> Fetch token và ghi vào sheet</li>
      <li><strong>📋 Hiển thị Token:</strong> Hiển thị token trong dialog để copy</li>
      <li><strong>💾 Lưu Token vào File:</strong> Tạo file .txt trong Google Drive</li>
    </ul>
    
    <h3>3. Lưu ý:</h3>
    <ul>
      <li>Token có thời hạn <strong>3600 giây (1 giờ)</strong></li>
      <li>Cần lấy token mới khi hết hạn</li>
      <li>Không chia sẻ token với người khác</li>
    </ul>
    
    <h3>4. Chạy từ code:</h3>
    <pre>
// Lấy token dạng string
const token = getIdTokenOnly();

// Lấy token và ghi vào sheet
getFirebaseIdToken();

// Lưu vào file
saveTokenToFile();
    </pre>
  `)
  .setWidth(600)
  .setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Hướng dẫn Firebase Token');
}
