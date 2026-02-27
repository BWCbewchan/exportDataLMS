/**
 * Script gửi email khảo sát kế hoạch nghỉ Tết 2026
 * Gửi đến giáo viên HCM 1&4 active
 */

function sendKeHoachNghiTetEmail() {
  try {
    // Lấy spreadsheet hiện tại
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Full-gv-hcm14-active');
    
    if (!sheet) {
      throw new Error('Sheet "Full-gv-hcm14-active" không tồn tại!');
    }
    
    // Lấy dữ liệu từ sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const STATUS_COL = 4; // Cột E (index 4, bắt đầu từ 0)
    
    // Kiểm tra và tạo header cho cột E nếu chưa có
    if (!headers[STATUS_COL] || headers[STATUS_COL].toString().trim() === '') {
      sheet.getRange(1, STATUS_COL + 1).setValue('Status');
      headers[STATUS_COL] = 'Status';
    }
    
    // Tìm vị trí cột
    const fullNameCol = headers.indexOf('Full name');
    const emailCol = headers.indexOf('Work email');
    
    if (fullNameCol === -1 || emailCol === -1) {
      throw new Error('Không tìm thấy cột "Full name" hoặc "Work email"');
    }
    
    // Lấy danh sách email BCC chưa gửi (bỏ qua header)
    const pendingEmails = [];
    for (let i = 1; i < data.length; i++) {
      const email = data[i][emailCol];
      const status = data[i][STATUS_COL];
      
      // Chỉ lấy email hợp lệ và chưa gửi (cột E không phải "đã gửi")
      if (email && email.toString().trim() !== '' && 
          status !== 'đã gửi' && status !== 'Đã gửi') {
        pendingEmails.push({
          email: email.toString().trim(),
          rowIndex: i + 1 // +1 vì sheet bắt đầu từ 1
        });
      }
    }
    
    if (pendingEmails.length === 0) {
      throw new Error('Không có email nào cần gửi! Tất cả đã được gửi (check cột E).');
    }
    
    const bccEmails = pendingEmails.map(item => item.email);
    
    // Thông tin email
    const recipient = 'anhpnh@mindx.com.vn';
    const cc = 'tuannh@mindx.com.vn,nguyennhk@mindx.com.vn,mydtt01@mindx.com.vn,baotc@mindx.com.vn';
    const subject = 'KHẢO SÁT KẾ HOẠCH NGHỈ TẾT 2026 - Teaching HCM 1&4';
    const senderName = 'Teaching HCM01&04 - no reply';
    
    // Nội dung HTML email
    const htmlBody = getEmailTemplate();
    
    // Chia BCC thành các batch
    // Batch đầu: To + CC + 90 BCC = 95 recipients (an toàn)
    // Batch sau: To + 94 BCC = 95 recipients (không CC)
    const firstBatchSize = 90;
    const subsequentBatchSize = 94;
    const batches = [];
    
    // Batch đầu tiên
    if (pendingEmails.length > 0) {
      batches.push({
        emails: pendingEmails.slice(0, firstBatchSize),
        includeCC: true
      });
    }
    
    // Các batch tiếp theo (không CC để tránh duplicate)
    for (let i = firstBatchSize; i < pendingEmails.length; i += subsequentBatchSize) {
      batches.push({
        emails: pendingEmails.slice(i, i + subsequentBatchSize),
        includeCC: false
      });
    }
    
    // Gửi email cho từng batch
    let totalSent = 0;
    const sentRows = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const bccList = batch.emails.map(item => item.email);
      
      const emailOptions = {
        htmlBody: htmlBody,
        bcc: bccList.join(','),
        name: senderName
      };
      
      // Chỉ thêm CC vào batch đầu tiên
      if (batch.includeCC) {
        emailOptions.cc = cc;
      }
      
      GmailApp.sendEmail(recipient, subject, '', emailOptions);
      
      // Lưu lại các row đã gửi để update sau
      batch.emails.forEach(item => sentRows.push(item.rowIndex));
      
      totalSent += batch.emails.length;
      Logger.log(`✅ Đã gửi batch ${i + 1}/${batches.length}: ${batch.emails.length} người (CC: ${batch.includeCC})`);
      
      // Delay 2 giây giữa các batch để tránh spam
      if (i < batches.length - 1) {
        Utilities.sleep(2000);
      }
    }
    
    // Update cột E "đã gửi" cho các email đã gửi thành công
    sentRows.forEach(rowIndex => {
      sheet.getRange(rowIndex, STATUS_COL + 1).setValue('đã gửi');
    });
    
    Logger.log('✅ Đã gửi email thành công!');
    Logger.log('📧 Tổng số đã gửi: ' + totalSent);
    Logger.log('📧 Số batch: ' + batches.length);
    Logger.log('📧 To: ' + recipient);
    Logger.log('📧 CC: ' + cc);
    
    const totalInSheet = data.length - 1; // Trừ header
    const alreadySent = totalInSheet - pendingEmails.length;
    
    // Hiển thị thông báo
    SpreadsheetApp.getUi().alert(
      '✅ Gửi email thành công!\n\n' +
      'Lần này đã gửi: ' + totalSent + ' người\n' +
      'Tổng trong sheet: ' + totalInSheet + ' người\n' +
      'Đã gửi trước đó: ' + alreadySent + ' người\n' +
      'Còn lại chưa gửi: 0 người\n\n' +
      'Số batch: ' + batches.length + '\n' +
      'To: ' + recipient + '\n' +
      'CC: ' + cc + '\n\n' +
      'Cột E đã được cập nhật "đã gửi"!'
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.message);
    SpreadsheetApp.getUi().alert('❌ Lỗi: ' + error.message);
  }
}

/**
 * Template HTML email
 */
function getEmailTemplate() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Khảo sát kế hoạch nghỉ Tết 2026</title>
</head>
<body>
<div style="font-family: Arial, sans-serif;
  max-width: 700px;
  margin: 30px auto;
  background: #ffffff;
  padding: 24px 32px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  border: 1px solid #f0f0f0;">

  <!-- HEADER -->
  <div style="text-align:center; margin-bottom:20px;">
    <img src="https://static.ladipage.net/5cefbc1ed062e8345a24dfe8/logo-mau-20240513110258-jalnx.png" alt="MindX Logo" style="width:120px;height:64px;object-fit:contain;display:block;margin:0 auto 12px;">
    <div style="font-size:22px;font-weight:bold;color:#d0021b;
      text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
      KHẢO SÁT KẾ HOẠCH NGHỈ TẾT 2026
    </div>
    <div style="font-size:14px;color:#555;">
      Tết Nguyên Đán Ất Tỵ
    </div>
  </div>

  <!-- OPENING -->
  <p style="font-size:15px;">
    <strong>Dear team,</strong>
  </p>

  <p style="font-size:15px;">
    Nhằm hỗ trợ công tác sắp xếp và nắm chính xác kế hoạch hoạt động của nhân sự trong dịp Tết Nguyên Đán 2026, team vui lòng dành ít phút điền thông tin vào khảo sát dưới đây:
  </p>

  <!-- LINK KHẢO SÁT -->
  <div style="background:#fff2f2;padding:20px 24px;border-radius:12px;
    border-left:4px solid #d0021b;margin:24px 0;text-align:center;">
    <p style="font-size:18px;font-weight:bold;color:#d0021b;margin:0 0 16px 0;">
      Link khảo sát:
    </p>
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSdcwFTMk04JsQKjp5WHnQ0eeZDIj6gAslW4qYIGPQFIUiVBEw/viewform" 
       target="_blank" 
       style="display:inline-block;background:#d0021b;color:#ffffff;font-weight:bold;font-size:16px;
              text-decoration:none;padding:14px 32px;border-radius:8px;
              box-shadow:0 2px 8px rgba(208,2,27,0.3);">
      &raquo; Nhấn vào đây để điền khảo sát
    </a>
  </div>

  <!-- THÔNG TIN LƯU Ý -->
  <div style="border-left:4px solid #d0021b;border-radius:12px;overflow:hidden;margin:20px 0;">
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      <thead>
        <tr>
          <th colspan="2" style="background:#d0021b;color:#fff;padding:12px;text-align:left;font-size:16px;">
            THÔNG TIN LƯU Ý
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:12px 16px;font-weight:bold;background:#f8f9fa;width:40%;">Ngày chính thức nghỉ lễ</td>
          <td style="padding:12px 16px;font-weight:bold;color:#d0021b;">13/02/2026 (tức 28 Tết Âm lịch)</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-weight:bold;background:#f8f9fa;">Ngày hoạt động trở lại</td>
          <td style="padding:12px 16px;font-weight:bold;color:#d0021b;">23/02/2026</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- LƯU Ý THÊM -->
  <p style="font-weight:bold;font-size:18px;color:#d0021b;margin-top:24px;">&raquo; Lưu ý thêm:</p>

  <ul style="background:#fff2f2;padding:14px 18px;border-radius:10px;
    border:1px solid #ffcfcf;font-size:15px;list-style:none;margin:12px 0;">
    <li style="margin-bottom:10px;">• <strong>Các bạn ở khu vực TP.HCM</strong> và có nhu cầu kiếm thêm thu nhập trong thời gian Tết, vui lòng nhanh tay điền đầy đủ thông tin trong form để team chủ động liên hệ và sắp xếp.</li>
    <li style="margin-bottom:10px;">• Trường hợp giáo viên có kế hoạch quay lại làm việc sau khi lớp đã diễn ra buổi học, vui lòng điền đầy đủ thông tin tại link hỗ trợ giáo viên <b>SUPPLY</b> được đính kèm trong form.</li>
  </ul>

  <!-- DEADLINE -->
  <div style="background:#fffbea;padding:16px 20px;border-radius:12px;
    border-left:4px solid #ffa500;margin:20px 0;text-align:center;">
    <p style="font-size:16px;font-weight:bold;color:#d0021b;margin:0;">
      Deadline đăng ký: trước 16h00 &ndash; Thứ Năm, ngày 13/02/2026
    </p>
  </div>

  <p style="font-size:15px;margin-top:16px;">
    Rất mong nhận được sự phối hợp của mọi người để team chủ động trong công tác vận hành và sắp xếp nhân sự dịp Tết.
  </p>

  <p style="font-size:15px;margin-top:20px;">Trân trọng,</p>
  <p style="font-weight:bold;font-size:15px;">Teaching HCM 1&4.</p>

  <!-- CONTACT -->
  <div style="background:#fafafa;padding:12px 18px;border-radius:10px;
    border-left:4px solid #d0021b;margin:20px 0;font-size:15px;">
    <div><strong style="color:#d0021b;">M</strong> +84 775 463 088</div>
    <div><strong style="color:#d0021b;">E</strong> teachinghcm1&4@mindx.com.vn</div>
  </div>

  <!-- SIGNATURE -->
  <div style="border-top:1px solid #eee;padding-top:16px;font-size:14px;color:#444;">
    <p><strong>Trường học Công nghệ MindX</strong></p>
    <p>Be extraordinary</p>
    <p><strong style="color:#d0021b;">HO</strong> Hanoi: 5th fl., 71 Nguyen Chi Thanh, Dong Da</p>
    <p>HCMC: 9th fl., International Plaza, 343 Pham Ngu Lao, Dist.1</p>
  </div>
</div>
</body>
</html>`;
}

/**
 * Reset status cột E để gửi lại
 */
function resetEmailStatus() {
  const ui = SpreadsheetApp.getUi();
  
  // Xác nhận trước khi reset
  const response = ui.alert(
    'Xác nhận reset',
    'Bạn có chắc muốn xóa tất cả status "đã gửi" trong cột E?\n\n' +
    'Sau khi reset, bạn có thể gửi lại email cho tất cả mọi người.',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    ui.alert('Đã hủy reset.');
    return;
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Full-gv-hcm14-active');
    
    if (!sheet) {
      throw new Error('Sheet "Full-gv-hcm14-active" không tồn tại!');
    }
    
    const STATUS_COL = 5; // Cột E (1-based)
    const lastRow = sheet.getLastRow();
    
    // Xóa status từ row 2 đến cuối (giữ header)
    if (lastRow > 1) {
      sheet.getRange(2, STATUS_COL, lastRow - 1, 1).clearContent();
    }
    
    ui.alert('✅ Đã reset status thành công!\n\nBạn có thể gửi email lại cho tất cả.');
    Logger.log('✅ Đã reset status cột E');
    
  } catch (error) {
    Logger.log('❌ Lỗi reset: ' + error.message);
    ui.alert('❌ Lỗi: ' + error.message);
  }
}

/**
 * Tạo menu custom trong Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gửi Email')
    .addItem('Khảo sát kế hoạch nghỉ Tết', 'sendKeHoachNghiTetEmail')
    .addSeparator()
    .addItem('Reset status để gửi lại', 'resetEmailStatus')
    .addSeparator()
    .addSubMenu(ui.createMenu('Dashboard Monitor')
      .addItem('Test email thông báo', 'testEmailNotification'))
    .addToUi();
}
