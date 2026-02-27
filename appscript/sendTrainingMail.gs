/**
 * sendTrainingMail.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Gửi email training kịch bản trải nghiệm Tết 2026 cho giáo viên.
 *
 * CẤU TRÚC SHEET (gid=411196705):
 *   Cột A : Full name
 *   Cột B : Work email
 *   Cột C : 01/2026  (Active / Inactive)
 *   Cột D : (trống hoặc cột phụ)
 *   Cột E : đã gửi   (TRUE / FALSE)
 *
 * CÁCH DÙNG:
 *   1. Mở Apps Script của Spreadsheet.
 *   2. Dán toàn bộ file này vào.
 *   3. Điền SPREADSHEET_ID, SHEET_NAME bên dưới (nếu khác mặc định).
 *   4. Điền các link thực tế vào phần CONFIG.
 *   5. Chạy hàm  sendTrainingEmails()  (chạy thủ công hoặc đặt trigger).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ════════════════════════════════════════════════════════════════
//  CONFIG – chỉnh sửa tại đây
// ════════════════════════════════════════════════════════════════
const CONFIG = {
  SPREADSHEET_ID : "1RDlgZKJD9rhV0HopshUCl8XqNlcCAlYR2F_GArkgaM0",
  SHEET_GID      : 411196705,          // dùng để tìm sheet đúng tab
  HEADER_ROWS    : 1,                  // số dòng tiêu đề cần bỏ qua

  // Vị trí cột (0-based)
  COL_NAME       : 0,   // A – Full name
  COL_EMAIL      : 1,   // B – Work email
  COL_STATUS     : 2,   // C – 01/2026 (Active)
  COL_SENT       : 4,   // E – đã gửi

  // Thông tin email
  EMAIL_SUBJECT  : "[MindX] Training Kịch Bản Trải Nghiệm Tết Nguyên Đán 2026",
  CC_EMAILS      : "anhpnh@mindx.com.vn,tuannh@mindx.com.vn,nguyennhk@mindx.com.vn,baotc@mindx.com.vn",
// 
  // ── REPLACE các link thực tế vào đây ──────────────────────────
  LINK_TRAINING  : "https://meet.google.com/gkw-yagf-ncc",
  LINK_RESOURCES : "https://drive.google.com/drive/u/0/folders/14vyfpIHxr3oxFt6iI-ciRgD18Q9A_akO",
  LINK_PRODUCT   : "https://project-gallery-hcm1-4.vercel.app/",
  LINK_FEEDBACK  : "https://docs.google.com/forms/d/e/1FAIpQLSen8OdfiUJqqWPIw65zqdVelES9my3HLCbigf6cyUR5zj68Pw/viewform",
};

// ════════════════════════════════════════════════════════════════
//  HÀM CHÍNH
// ════════════════════════════════════════════════════════════════
function sendTrainingEmails() {
  const sheet = getSheetByGid(CONFIG.SPREADSHEET_ID, CONFIG.SHEET_GID);
  if (!sheet) {
    Logger.log("❌ Không tìm thấy sheet với gid=" + CONFIG.SHEET_GID);
    return;
  }

  const data    = sheet.getDataRange().getValues();
  const toSend  = [];   // { rowIndex, name, email }
  let   skipped = 0;

  for (let i = CONFIG.HEADER_ROWS; i < data.length; i++) {
    const row         = data[i];
    const name        = String(row[CONFIG.COL_NAME]).trim();
    const email       = String(row[CONFIG.COL_EMAIL]).trim();
    const alreadySent = String(row[CONFIG.COL_SENT]).trim().toUpperCase();

    if (!name || !email) continue;

    // Chỉ bỏ qua người đã được đánh dấu gửi rồi (cột E = TRUE)
    if (alreadySent === "TRUE") {
      Logger.log(`⏭ Đã gửi trước đó: ${name} <${email}>`);
      skipped++;
      continue;
    }

    toSend.push({ rowIndex: i, name, email });
  }

  if (toSend.length === 0) {
    showAlert("Không có ai cần gửi mail.");
    return;
  }

  // Gmail giới hạn 30 recipients/email → chia batch
  const BATCH_SIZE  = 30;
  const htmlBody    = buildEmailHtml("Thầy/Cô");
  const senderEmail = Session.getActiveUser().getEmail();
  let   batchCount  = 0;
  let   sentTotal   = 0;

  for (let b = 0; b < toSend.length; b += BATCH_SIZE) {
    const batch   = toSend.slice(b, b + BATCH_SIZE);
    const bccList = batch.map(r => r.email).join(",");

    try {
      // MailApp hoạt động với mọi loại tài khoản Google (kể cả Workspace bị hạn chế GmailApp)
      MailApp.sendEmail({
        to      : senderEmail,
        subject : CONFIG.EMAIL_SUBJECT,
        htmlBody: htmlBody,
        name    : "Teaching HCM01&04 - no reply",
        bcc     : bccList,
        cc      : (CONFIG.CC_EMAILS && b === 0) ? CONFIG.CC_EMAILS : "",
      });

      // Đánh dấu đã gửi cho từng người trong batch
      for (const r of batch) {
        sheet.getRange(r.rowIndex + 1, CONFIG.COL_SENT + 1).setValue(true);
      }

      sentTotal += batch.length;
      batchCount++;
      Logger.log(`✅ Batch ${batchCount}: đã gửi ${batch.length} BCC (${batch.map(r => r.email).join(", ")})`);

      // Nghỉ 2s giữa các batch để tránh rate limit
      if (b + BATCH_SIZE < toSend.length) Utilities.sleep(2000);

    } catch (err) {
      const isQuotaErr = err.message.toLowerCase().includes("too many times")
                      || err.message.toLowerCase().includes("quota");
      const progress = `Đã gửi xong: ${sentTotal}/${toSend.length} người (${batchCount} batch).`;
      if (isQuotaErr) {
        const msg = `⚠️ Hết quota email trong ngày!\n\n${progress}\n\nSheet đã được cập nhật đến đây.\nChạy lại sendTrainingEmails() vào ngày mai — script sẽ tự bỏ qua người đã nhận.`;
        Logger.log("⚠️ Quota hết: " + progress);
        showAlert(msg);
      } else {
        Logger.log(`❌ Lỗi batch ${batchCount + 1}: ${err.message}`);
        showAlert(`❌ Lỗi ở batch ${batchCount + 1}:\n${err.message}\n\n${progress}`);
      }
      return;
    }
  }

  const summary = `📊 Gửi xong ${batchCount} batch → ${sentTotal} người nhận BCC | CC: ${CONFIG.CC_EMAILS || "(không có)"} | Bỏ qua: ${skipped}`;
  Logger.log(summary);
  showAlert("Gửi mail hoàn tất!\n" + summary);
}

// ════════════════════════════════════════════════════════════════
//  HELPER – tìm sheet theo GID (tab id)
// ════════════════════════════════════════════════════════════════
function getSheetByGid(spreadsheetId, gid) {
  const ss     = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();
  for (const s of sheets) {
    if (s.getSheetId() === gid) return s;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
//  BUILD HTML – thay {{TEN}} + điền link thực tế
// ════════════════════════════════════════════════════════════════
function buildEmailHtml(recipientName) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @media only screen and (max-width: 600px) {
    .email-wrapper { padding: 16px !important; border-radius: 8px !important; margin: 0 8px 24px !important; }
    .email-title   { font-size: 17px !important; letter-spacing: 0.3px !important; }
    .info-table td { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    .info-label    { border-bottom: none !important; padding-bottom: 4px !important; }
    .info-value    { padding-top: 4px !important; }
    .btn-full      { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 12px 8px !important; font-size: 13px !important; }
    .cc-line       { font-size: 12px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">

<div class="email-wrapper" style="font-family:Arial,sans-serif;
  max-width:860px;
  width:100%;
  box-sizing:border-box;
  margin:0 auto 40px;
  background:#ffffff;
  padding:36px 48px;
  border-radius:16px;
  box-shadow:0 4px 20px rgba(0,0,0,0.08);
  border:1px solid #f0f0f0;">

  <!-- HEADER -->
  <div style="text-align:center;margin-bottom:20px;">
    <img src="https://static.ladipage.net/5cefbc1ed062e8345a24dfe8/logo-mau-20240513110258-jalnx.png"
         alt="MindX Logo"
         style="width:120px;height:64px;object-fit:contain;display:block;margin:0 auto 12px;">
    <div class="email-title" style="font-size:26px;font-weight:bold;color:#d0021b;
      text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
      TRAINING KỊCH BẢN TRẢI NGHIỆM TẾT NGUYÊN ĐÁN 2026
    </div>
    <div style="font-size:16px;color:#555;">
      Khối Coding-Robotics &ndash; Khu vực HCM1 &amp; HCM4
    </div>
  </div>

  <!-- OPENING -->
  <p style="font-size:16px;">
    Thân gửi <strong>${recipientName}</strong>,
  </p>
  <p class="cc-line" style="font-size:15px;color:#555;font-style:italic;">
    Cc: TEGL Hoàng Anh &nbsp;|&nbsp; TC Thanh Bình &nbsp;|&nbsp; CL Hoàng Tuấn &nbsp;|&nbsp; CL Khôi Nguyên &nbsp;|&nbsp; RL Chí Bảo
  </p>

  <p style="font-size:16px;">
    Với mục tiêu nắm bắt chủ đề trải nghiệm đầu vào học viên <strong>Tết Nguyên Đán 2026</strong>,
    Teaching HCM1&amp;4 xây dựng kịch bản trải nghiệm chủ đề Tết để các bạn giáo viên nắm bắt và
    tạo không khí trong buổi trải nghiệm trong thời gian này.
  </p>

  <!-- THÔNG TIN BUỔI TRAINING -->
  <div style="border-left:4px solid #d0021b;border-radius:12px;overflow:hidden;margin:20px 0;">
    <table class="info-table" style="width:100%;border-collapse:collapse;font-size:16px;">
      <thead>
        <tr>
          <th colspan="2" style="background:#d0021b;color:#fff;padding:14px 18px;
            text-align:left;font-size:16px;letter-spacing:0.5px;">
            THÔNG TIN BUỔI TRAINING
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="info-label" style="padding:14px 18px;font-weight:bold;background:#f8f9fa;width:38%;">Thời gian</td>
          <td class="info-value" style="padding:14px 18px;font-weight:bold;color:#d0021b;">
            Thứ Tư, ngày 25/02/2026 &ndash; 19h00 đến 20h00
          </td>
        </tr>
        <tr>
          <td class="info-label" style="padding:14px 18px;font-weight:bold;background:#f8f9fa;">Host</td>
          <td class="info-value" style="padding:14px 18px;">Anh Nguyễn Hoàng Tuấn</td>
        </tr>
        <tr>
          <td class="info-label" style="padding:14px 18px;font-weight:bold;background:#f8f9fa;">Hình thức</td>
          <td class="info-value" style="padding:14px 18px;">
            <span style="background:#e8f5e9;color:#2e7d32;font-weight:bold;padding:3px 10px;
              border-radius:20px;font-size:13px;">Online</span>
          </td>
        </tr>
        <tr>
          <td class="info-label" style="padding:14px 18px;font-weight:bold;background:#f8f9fa;">Link tham gia</td>
          <td class="info-value" style="padding:14px 18px;">
            <a href="${CONFIG.LINK_TRAINING}"
               class="btn-full"
               style="display:inline-block;background:#d0021b;color:#ffffff;
                      font-weight:bold;font-size:15px;text-decoration:none;
                      padding:13px 26px;border-radius:8px;border:2px solid #a30016;
                      box-shadow:0 2px 6px rgba(208,2,27,0.3);letter-spacing:0.3px;">
              &raquo; TRAINING KỊCH BẢN TRẢI NGHIỆM MỚI
            </a>
          </td>
        </tr>
        <tr>
          <td class="info-label" style="padding:14px 18px;font-weight:bold;background:#f8f9fa;">Tài nguyên &amp; Sản phẩm</td>
          <td class="info-value" style="padding:14px 18px;">
            <a href="${CONFIG.LINK_RESOURCES}"
               class="btn-full"
               style="display:inline-block;background:#1a73e8;color:#ffffff;
                      font-weight:bold;font-size:15px;text-decoration:none;
                      padding:13px 26px;border-radius:8px;border:2px solid #1558b0;
                      box-shadow:0 2px 6px rgba(26,115,232,0.3);letter-spacing:0.3px;">
              &raquo; Link TG - Tài nguyên dự án - Sản phẩm
            </a><br><br>
            <a href="${CONFIG.LINK_PRODUCT}"
               class="btn-full"
               style="display:inline-block;background:#1a73e8;color:#ffffff;
                      font-weight:bold;font-size:15px;text-decoration:none;
                      padding:13px 26px;border-radius:8px;border:2px solid #1558b0;
                      box-shadow:0 2px 6px rgba(26,115,232,0.3);letter-spacing:0.3px;">
              &raquo; Link sản phẩm trải nghiệm
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- GIÁO ÁN -->
  <div style="background:#fff8f8;padding:18px 22px;border-radius:10px;
    border:1px solid #ffcfcf;font-size:16px;margin:16px 0;">
    <p style="margin:0 0 8px;font-weight:bold;color:#d0021b;">Giáo án biên soạn bởi:</p>
    <ul style="list-style:none;padding:0;margin:0;">
      <li style="margin-bottom:6px;">• <strong>Huỳnh Hải Bằng</strong> &ndash; TF khu vực HCM4</li>
      <li>• <strong>Nguyễn Quốc Thành</strong> &ndash; TF khu vực HCM1</li>
    </ul>
  </div>

  <!-- YÊU CẦU TRƯỚC TRAINING -->
  <p style="font-weight:bold;font-size:18px;color:#d0021b;margin-top:24px;">! Yêu cầu trước buổi training:</p>

  <ul style="background:#fff2f2;padding:18px 22px;border-radius:10px;
    border:1px solid #ffcfcf;font-size:16px;list-style:none;margin:12px 0;">
    <li style="margin-bottom:10px;">
      • Đề nghị thầy/cô <strong>đọc trước nội dung kịch bản trải nghiệm mới</strong>
      đã được đính kèm để buổi training diễn ra đúng trọng tâm và mang lại hiệu quả thực tế.
    </li>
    <li>
      • <a href="${CONFIG.LINK_FEEDBACK}" style="color:#d0021b;font-weight:bold;text-decoration:none;">
          <strong>Điền form feedback</strong>
        </a>
      để tổng hợp thắc mắc, góp ý và phản hồi trong buổi training.
      <br><br>
      <a href="${CONFIG.LINK_FEEDBACK}"
         class="btn-full"
         style="display:inline-block;background:#d0021b;color:#ffffff;
        font-weight:bold;font-size:15px;text-decoration:none;
        padding:13px 28px;border-radius:8px;border:2px solid #a30016;
        box-shadow:0 2px 6px rgba(208,2,27,0.3);letter-spacing:0.3px;">
        &raquo; Điền Form Feedback Ngay
      </a>
    </li>
  </ul>

  <!-- LƯU Ý -->
  <div style="background:#fffbea;padding:20px 24px;border-radius:12px;
    border-left:4px solid #ffa500;margin:20px 0;">
    <p style="font-size:16px;font-weight:bold;color:#b35900;margin:0 0 6px;">
      ⚠ Lưu ý:
    </p>
    <p style="font-size:16px;margin:0;color:#555;">
      Kịch bản chỉ đang áp dụng ở khu vực <strong>HCM1 &amp; HCM4</strong>.
      Chưa áp dụng toàn hệ thống — giáo viên sử dụng kịch bản khi trải nghiệm trong nội bộ
      các cơ sở thuộc khu vực HCM1&amp;4.
    </p>
  </div>

  <p style="font-size:16px;margin-top:16px;">
    Nếu có bất kỳ thắc mắc nào, thầy/cô vui lòng liên hệ <strong>Quản lý trực tiếp</strong>
    để được giải đáp.
  </p>

  <p style="font-size:16px;margin-top:20px;">Trân trọng,</p>
  <p style="font-weight:bold;font-size:16px;">Teaching Leader HCM1&amp;4.</p>

  <!-- CONTACT -->
  <div style="background:#fafafa;padding:14px 20px;border-radius:10px;
    border-left:4px solid #d0021b;margin:20px 0;font-size:16px;">
    <div><strong style="color:#d0021b;">M</strong> +84 775 463 088</div>
    <div><strong style="color:#d0021b;">E</strong> teachinghcm14@mindx.com.vn</div>
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

// ════════════════════════════════════════════════════════════════
//  TEST – gửi 1 mail thử về địa chỉ cá nhân, KHÔNG đánh dấu sheet
// ════════════════════════════════════════════════════════════════
function sendTestEmail() {
  const TEST_EMAIL = "baotran.060103@gmail.com";
  const TEST_NAME  = "Baotran (Test)";

  MailApp.sendEmail({
    to      : TEST_EMAIL,
    subject : "[TEST] " + CONFIG.EMAIL_SUBJECT,
    htmlBody: buildEmailHtml(TEST_NAME),
    name    : "Teaching HCM01&04 - no reply",
    cc      : CONFIG.CC_EMAILS,
  });
  Logger.log(`✅ Test mail đã gửi tới: ${TEST_EMAIL}`);
  showAlert(`Test mail đã gửi tới:\n${TEST_EMAIL}\n\nCC: ${CONFIG.CC_EMAILS}`);
}

// ════════════════════════════════════════════════════════════════
//  HELPER – hiện alert an toàn (không crash khi chạy từ editor)
// ════════════════════════════════════════════════════════════════
function showAlert(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log("[Alert] " + msg);
  }
}

// ════════════════════════════════════════════════════════════════
//  PREVIEW – mở email thử trong trình duyệt (không gửi thật)
// ════════════════════════════════════════════════════════════════
function previewEmail() {
  const html = buildEmailHtml("Nguyễn Văn A (Test)");
  const output = HtmlService.createHtmlOutput(html)
    .setWidth(750)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(output, "👁 Preview Email Training");
}
