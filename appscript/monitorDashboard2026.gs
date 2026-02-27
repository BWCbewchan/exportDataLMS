/**
 * Script theo dõi thay đổi dữ liệu Dashboard 2026
 * Gửi email khi có thay đổi ở row 9, cột T-AG
 */

/**
 * Trigger tự động khi có edit trong sheet
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();
    
    // Chỉ theo dõi sheet "Dashboard 2026"
    if (sheetName !== 'Dashboard 2026') {
      return;
    }
    
    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();
    
    // Kiểm tra row 9 và cột T (20) đến AG (33)
    if (row === 9 && col >= 20 && col <= 33) {
      sendChangeNotification(e);
    }
    
  } catch (error) {
    Logger.log('❌ Lỗi onEdit: ' + error.message);
  }
}

/**
 * Gửi email thông báo khi có thay đổi
 */
function sendChangeNotification(e) {
  try {
    const sheet = e.range.getSheet();
    const row = e.range.getRow();
    const col = e.range.getColumn();
    const columnName = getColumnLetter(col);
    const oldValue = e.oldValue || '(trống)';
    const newValue = e.value || '(trống)';
    
    // Thông tin người chỉnh sửa
    const user = Session.getActiveUser().getEmail();
    const timestamp = new Date();
    const formattedTime = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    
    // Email nhận thông báo
    const recipient = 'baotran.060103@gmail.com';
    const subject = '🔔 Thay đổi dữ liệu Dashboard 2026 - Row 9';
    
    // Nội dung email HTML
    const htmlBody = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Thông báo thay đổi dữ liệu</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
  
  <!-- HEADER -->
  <div style="background: #d0021b; color: #ffffff; padding: 20px; text-align: center;">
    <h2 style="margin: 0; font-size: 20px;">🔔 THÔNG BÁO THAY ĐỔI DỮ LIỆU</h2>
    <p style="margin: 5px 0 0 0; font-size: 14px;">Dashboard 2026</p>
  </div>
  
  <!-- CONTENT -->
  <div style="padding: 24px;">
    <p style="font-size: 15px; color: #333;">Có thay đổi dữ liệu vừa được thực hiện:</p>
    
    <!-- THÔNG TIN THAY ĐỔI -->
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <tr style="background: #f8f9fa;">
        <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd; width: 35%;">Sheet</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">Dashboard 2026</td>
      </tr>
      <tr>
        <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">Vị trí</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">
          <strong style="color: #d0021b;">Row 9, Cột ${columnName}</strong>
        </td>
      </tr>
      <tr style="background: #f8f9fa;">
        <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">Giá trị cũ</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; color: #666;">
          ${escapeHtml(oldValue)}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">Giá trị mới</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">
          <strong style="color: #28a745;">${escapeHtml(newValue)}</strong>
        </td>
      </tr>
      <tr style="background: #f8f9fa;">
        <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">Người sửa</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${user}</td>
      </tr>
      <tr>
        <td style="padding: 12px; font-weight: bold;">Thời gian</td>
        <td style="padding: 12px;">${formattedTime}</td>
      </tr>
    </table>
    
    <!-- LINK XEM SHEET -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="${e.source.getUrl()}" 
         style="display: inline-block; background: #d0021b; color: #ffffff; 
                padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                font-weight: bold;">
        📊 Xem Sheet Dashboard
      </a>
    </div>
    
    <p style="font-size: 13px; color: #666; margin-top: 20px; padding-top: 20px; 
       border-top: 1px solid #eee; text-align: center;">
      Email tự động từ hệ thống theo dõi Dashboard 2026
    </p>
  </div>
  
</div>
</body>
</html>`;
    
    // Gửi email
    GmailApp.sendEmail(recipient, subject, '', {
      htmlBody: htmlBody,
      name: 'Dashboard Monitor - MindX'
    });
    
    Logger.log(`✅ Đã gửi email thông báo đến ${recipient}`);
    Logger.log(`📍 Vị trí: Row ${row}, Column ${columnName}`);
    Logger.log(`🔄 Thay đổi: "${oldValue}" → "${newValue}"`);
    
  } catch (error) {
    Logger.log('❌ Lỗi gửi email: ' + error.message);
  }
}

/**
 * Chuyển số cột thành chữ cái (1 -> A, 20 -> T, 33 -> AG)
 */
function getColumnLetter(columnNumber) {
  let letter = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
}

/**
 * Escape HTML để tránh XSS
 */
function escapeHtml(text) {
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Test function để kiểm tra email
 */
function testEmailNotification() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Dashboard 2026');
  
  if (!sheet) {
    throw new Error('Sheet "Dashboard 2026" không tồn tại!');
  }
  
  // Tạo event giả để test
  const testEvent = {
    range: sheet.getRange('T9'),
    oldValue: '1000',
    value: '1500',
    source: ss
  };
  
  sendChangeNotification(testEvent);
  
  SpreadsheetApp.getUi().alert(
    '✅ Test thành công!\n\n' +
    'Kiểm tra email: baotran.060103@gmail.com\n\n' +
    'Nếu không thấy email, kiểm tra:\n' +
    '• Spam/Junk folder\n' +
    '• Script có quyền gửi email chưa'
  );
}
