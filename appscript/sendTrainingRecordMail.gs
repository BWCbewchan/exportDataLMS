/**
 * sendTrainingRecordMail.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Gửi email chia sẻ link record buổi Training Kịch Bản Trải Nghiệm Tết 2026.
 *
 * CẤU TRÚC SHEET (gid=411196705):
 *   Cột A : Full name
 *   Cột B : Work email
 *   Cột C : 01/2026  (Active / Inactive)
 *   Cột D : (trống hoặc cột phụ)
 *   Cột E : đã gửi training  (TRUE / FALSE)
 *   Cột F : đã gửi record    (TRUE / FALSE)  ← cột mới, thêm vào sheet nếu chưa có
 *
 * CÁCH DÙNG:
 *   1. Mở Apps Script của Spreadsheet.
 *   2. Dán toàn bộ file này vào.
 *   3. Chỉnh CONFIG bên dưới nếu cần.
 *   4. Chạy hàm  sendRecordEmails()  (thủ công hoặc đặt trigger).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ════════════════════════════════════════════════════════════════
//  CONFIG – chỉnh sửa tại đây
// ════════════════════════════════════════════════════════════════
const RECORD_CONFIG = {
  SPREADSHEET_ID : "1RDlgZKJD9rhV0HopshUCl8XqNlcCAlYR2F_GArkgaM0",
  SHEET_GID      : 411196705,

  HEADER_ROWS    : 1,

  // Vị trí cột (0-based)
  COL_NAME       : 0,   // A – Full name
  COL_EMAIL      : 1,   // B – Work email
  COL_SENT_RECORD: 5,   // F – đã gửi record  (thêm cột F vào sheet nếu chưa có)

  // Thông tin email
  EMAIL_SUBJECT  : "[MindX] [Record] Training Kịch Bản Trải Nghiệm Tết Nguyên Đán 2026",
  CC_EMAILS      : "anhpnh@mindx.com.vn,tuannh@mindx.com.vn,nguyennhk@mindx.com.vn,baotc@mindx.com.vn",

  // ── Link record buổi training ──────────────────────────────
  LINK_RECORD    : "https://www.youtube.com/watch?v=SPFDHoWAIQI",
  LINK_RESOURCES : "https://drive.google.com/drive/u/0/folders/14vyfpIHxr3oxFt6iI-ciRgD18Q9A_akO",
  LINK_PRODUCT   : "https://project-gallery-hcm1-4.vercel.app/",
  LINK_FEEDBACK  : "https://docs.google.com/forms/d/e/1FAIpQLSen8OdfiUJqqWPIw65zqdVelES9my3HLCbigf6cyUR5zj68Pw/viewform",
};

// ════════════════════════════════════════════════════════════════
//  HÀM CHÍNH
// ════════════════════════════════════════════════════════════════
function sendRecordEmails() {
  const sheet = getRecordSheetByGid(RECORD_CONFIG.SPREADSHEET_ID, RECORD_CONFIG.SHEET_GID);
  if (!sheet) {
    Logger.log("❌ Không tìm thấy sheet với gid=" + RECORD_CONFIG.SHEET_GID);
    return;
  }

  const data    = sheet.getDataRange().getValues();
  const toSend  = [];
  let   skipped = 0;

  for (let i = RECORD_CONFIG.HEADER_ROWS; i < data.length; i++) {
    const row         = data[i];
    const name        = String(row[RECORD_CONFIG.COL_NAME]).trim();
    const email       = String(row[RECORD_CONFIG.COL_EMAIL]).trim();
    const alreadySent = String(row[RECORD_CONFIG.COL_SENT_RECORD]).trim().toUpperCase();

    if (!name || !email) continue;

    if (alreadySent === "TRUE") {
      Logger.log(`⏭ Đã gửi record trước đó: ${name} <${email}>`);
      skipped++;
      continue;
    }

    toSend.push({ rowIndex: i, name, email });
  }

  if (toSend.length === 0) {
    showRecordAlert("Không có ai cần gửi mail record.");
    return;
  }

  const BATCH_SIZE  = 30;
  const htmlBody    = buildRecordEmailHtml("Thầy/Cô");
  const senderEmail = Session.getActiveUser().getEmail();
  let   batchCount  = 0;
  let   sentTotal   = 0;

  for (let b = 0; b < toSend.length; b += BATCH_SIZE) {
    const batch   = toSend.slice(b, b + BATCH_SIZE);
    const bccList = batch.map(r => r.email).join(",");

    try {
      MailApp.sendEmail({
        to      : senderEmail,
        subject : RECORD_CONFIG.EMAIL_SUBJECT,
        htmlBody: htmlBody,
        name    : "Teaching HCM01&04 - no reply",
        bcc     : bccList,
        cc      : (RECORD_CONFIG.CC_EMAILS && b === 0) ? RECORD_CONFIG.CC_EMAILS : "",
      });

      for (const r of batch) {
        sheet.getRange(r.rowIndex + 1, RECORD_CONFIG.COL_SENT_RECORD + 1).setValue(true);
      }

      sentTotal += batch.length;
      batchCount++;
      Logger.log(`✅ Batch ${batchCount}: đã gửi ${batch.length} BCC (${batch.map(r => r.email).join(", ")})`);

      if (b + BATCH_SIZE < toSend.length) Utilities.sleep(2000);

    } catch (err) {
      const isQuotaErr = err.message.toLowerCase().includes("too many times")
                      || err.message.toLowerCase().includes("quota");
      const progress = `Đã gửi xong: ${sentTotal}/${toSend.length} người (${batchCount} batch).`;
      if (isQuotaErr) {
        const msg = `⚠️ Hết quota email trong ngày!\n\n${progress}\n\nChạy lại sendRecordEmails() vào ngày mai.`;
        Logger.log("⚠️ Quota hết: " + progress);
        showRecordAlert(msg);
      } else {
        Logger.log(`❌ Lỗi batch ${batchCount + 1}: ${err.message}`);
        showRecordAlert(`❌ Lỗi ở batch ${batchCount + 1}:\n${err.message}\n\n${progress}`);
      }
      return;
    }
  }

  const summary = `📊 Gửi xong ${batchCount} batch → ${sentTotal} người nhận BCC | CC: ${RECORD_CONFIG.CC_EMAILS || "(không có)"} | Bỏ qua: ${skipped}`;
  Logger.log(summary);
  showRecordAlert("Gửi mail record hoàn tất!\n" + summary);
}

// ════════════════════════════════════════════════════════════════
//  HELPER – tìm sheet theo GID
// ════════════════════════════════════════════════════════════════
function getRecordSheetByGid(spreadsheetId, gid) {
  const ss     = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();
  for (const s of sheets) {
    if (s.getSheetId() === gid) return s;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
//  BUILD HTML – nội dung email gửi record
// ════════════════════════════════════════════════════════════════
function buildRecordEmailHtml(recipientName) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @media only screen and (max-width: 600px) {
    .email-wrapper { padding: 16px !important; border-radius: 8px !important; margin: 0 8px 24px !important; }
    .email-title   { font-size: 17px !important; letter-spacing: 0.3px !important; }
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
      [RECORD] TRAINING KỊCH BẢN TRẢI NGHIỆM TẾT NGUYÊN ĐÁN 2026
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
    Teaching HCM1&amp;4 xin gửi đến thầy/cô <strong>link record buổi Training Kịch Bản Trải Nghiệm Tết Nguyên Đán 2026</strong>
    đã diễn ra vào tối ngày <strong>25/02/2026</strong>.
  </p>
  <p style="font-size:16px;">
    Thầy/cô chưa tham dự hoặc muốn xem lại có thể theo dõi toàn bộ nội dung buổi training qua link bên dưới.
  </p>

  <!-- LINK RECORD NỔI BẬT -->
  <div style="background:#fff2f2;padding:28px 24px;border-radius:14px;
    border:2px solid #d0021b;text-align:center;margin:24px 0;">
    <div style="font-size:18px;font-weight:bold;color:#d0021b;margin-bottom:16px;">
      🎬 RECORD BUỔI TRAINING
    </div>
    <div style="font-size:15px;color:#555;margin-bottom:20px;">
      Thứ Tư, 25/02/2026 &ndash; 19h00 &ndash; 20h00
    </div>
    <a href="${RECORD_CONFIG.LINK_RECORD}"
       class="btn-full"
       style="display:inline-block;background:#d0021b;color:#ffffff;
              font-weight:bold;font-size:16px;text-decoration:none;
              padding:15px 36px;border-radius:10px;border:2px solid #a30016;
              box-shadow:0 2px 8px rgba(208,2,27,0.35);letter-spacing:0.3px;">
      ▶ XEM RECORD NGAY
    </a>
    <div style="font-size:13px;color:#999;margin-top:12px;">
      ${RECORD_CONFIG.LINK_RECORD}
    </div>
  </div>

  <!-- TÀI NGUYÊN -->
  <div style="border-left:4px solid #1a73e8;padding:18px 22px;border-radius:10px;
    background:#f0f7ff;margin:20px 0;font-size:16px;">
    <p style="font-weight:bold;color:#1558b0;margin:0 0 12px;">📁 Tài nguyên đính kèm:</p>
    <a href="${RECORD_CONFIG.LINK_RESOURCES}"
       class="btn-full"
       style="display:inline-block;background:#1a73e8;color:#ffffff;
              font-weight:bold;font-size:15px;text-decoration:none;
              padding:13px 26px;border-radius:8px;border:2px solid #1558b0;
              box-shadow:0 2px 6px rgba(26,115,232,0.3);letter-spacing:0.3px;margin-bottom:12px;">
      &raquo; Tài nguyên dự án &amp; Link tham khảo
    </a><br>
    <a href="${RECORD_CONFIG.LINK_PRODUCT}"
       class="btn-full"
       style="display:inline-block;background:#1a73e8;color:#ffffff;
              font-weight:bold;font-size:15px;text-decoration:none;
              padding:13px 26px;border-radius:8px;border:2px solid #1558b0;
              box-shadow:0 2px 6px rgba(26,115,232,0.3);letter-spacing:0.3px;">
      &raquo; Link sản phẩm trải nghiệm
    </a>
  </div>

  <!-- FORM FEEDBACK -->
  <div style="background:#fffbea;padding:20px 24px;border-radius:12px;
    border-left:4px solid #ffa500;margin:20px 0;font-size:16px;">
    <p style="font-weight:bold;color:#b35900;margin:0 0 10px;">📝 Góp ý &amp; Phản hồi:</p>
    <p style="margin:0 0 14px;color:#555;">
      Nếu sau khi xem record thầy/cô có thêm thắc mắc hoặc phản hồi về kịch bản,
      vui lòng điền vào form bên dưới để team Teaching tổng hợp và hỗ trợ kịp thời.
    </p>
    <a href="${RECORD_CONFIG.LINK_FEEDBACK}"
       class="btn-full"
       style="display:inline-block;background:#d0021b;color:#ffffff;
              font-weight:bold;font-size:15px;text-decoration:none;
              padding:13px 28px;border-radius:8px;border:2px solid #a30016;
              box-shadow:0 2px 6px rgba(208,2,27,0.3);letter-spacing:0.3px;">
      &raquo; Điền Form Feedback
    </a>
  </div>

  <!-- LƯU Ý -->
  <div style="background:#fffbea;padding:20px 24px;border-radius:12px;
    border-left:4px solid #ffa500;margin:20px 0;">
    <p style="font-size:16px;font-weight:bold;color:#b35900;margin:0 0 6px;">
      ⚠ Lưu ý:
    </p>
    <p style="font-size:16px;margin:0;color:#555;">
      Kịch bản chỉ áp dụng tại khu vực <strong>HCM1 &amp; HCM4</strong>.
      Giáo viên sử dụng kịch bản khi dạy trải nghiệm trong nội bộ các cơ sở thuộc khu vực HCM1&amp;4.
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
//  TEST – gửi 1 mail thử, KHÔNG đánh dấu sheet
// ════════════════════════════════════════════════════════════════
function sendTestRecordEmail() {
  const TEST_EMAIL = "baotran.060103@gmail.com";
  const TEST_NAME  = "Baotran (Test)";

  MailApp.sendEmail({
    to      : TEST_EMAIL,
    subject : "[TEST] " + RECORD_CONFIG.EMAIL_SUBJECT,
    htmlBody: buildRecordEmailHtml(TEST_NAME),
    name    : "Teaching HCM01&04 - no reply",
    cc      : RECORD_CONFIG.CC_EMAILS,
  });
  Logger.log(`✅ Test record mail đã gửi tới: ${TEST_EMAIL}`);
  showRecordAlert(`Test mail đã gửi tới:\n${TEST_EMAIL}\n\nCC: ${RECORD_CONFIG.CC_EMAILS}`);
}

// ════════════════════════════════════════════════════════════════
//  PREVIEW – mở email thử trong trình duyệt (không gửi thật)
// ════════════════════════════════════════════════════════════════
function previewRecordEmail() {
  const html   = buildRecordEmailHtml("Nguyễn Văn A (Test)");
  const output = HtmlService.createHtmlOutput(html)
    .setWidth(750)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(output, "👁 Preview Email Record Training");
}

// ════════════════════════════════════════════════════════════════
//  HELPER – hiện alert an toàn
// ════════════════════════════════════════════════════════════════
function showRecordAlert(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log("[Alert] " + msg);
  }
}
