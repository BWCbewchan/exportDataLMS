/**
 * APP.GS - MAIN ORCHESTRATOR
 * File chính để quản lý tất cả scripts:
 * - getFirebaseToken.gs: Quản lý Firebase authentication token
 * - teacherCompliance.gs: Fetch Teacher Compliance data
 * - roboticsSession4And8.gs: Fetch lớp Robotics có buổi 4 & 8
 * 
 * ✨ TÍNH NĂNG:
 * - Menu tổng hợp thống nhất
 * - Dashboard hiện đại
 * - 1-click workflows
 * - Multi-script management
 */

// ========================================
// MAIN MENU
// ========================================

/**
 * Tạo menu chính khi mở spreadsheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🎯 MindX LMS')
    // Quick Actions
    .addSubMenu(ui.createMenu('⚡ Quick Actions')
      .addItem('📊 Compliance 2026 (Auto)', 'quickFetchCompliance')
      .addItem('🎫 Tickets Tháng Này', 'fetchTicketsCurrentMonth')
      .addItem('📅 Lớp Buổi 4/8 Tháng Này', 'quickFetchCurrentMonth')
      .addSeparator()
      .addItem('📈 Dashboard Tổng Quan', 'showModernDashboard'))
    
    .addSeparator()
    
    // Data Management
    .addSubMenu(ui.createMenu('📊 Data Management')
      .addItem('🎓 Teacher Compliance 2026', 'fetchTeacherComplianceData')
      .addSeparator()
      .addItem('� Tickets Tháng Hiện Tại', 'fetchTicketsCurrentMonth')
      .addItem('�🏙️ ALL TP - Buổi 4/8 (Tất cả cơ sở)', 'fetchAllClassesCurrentMonth')
      .addSeparator()
      .addItem('📅 Robotics Buổi 4/8 - Tháng Hiện Tại', 'fetchCurrentMonth')
      .addItem('📅 Robotics Buổi 4/8 - Tháng 1/2026', 'fetchJanuary2026')
      .addItem('📅 Robotics Buổi 4/8 - Tháng 2/2026', 'fetchFebruary2026')
      .addItem('📅 Robotics Buổi 4/8 - Tháng 3/2026', 'fetchMarch2026')
      .addItem('📆 Robotics - Chọn Tháng Tùy Chỉnh...', 'showCustomMonthDialog'))
    
    .addSeparator()
    
    // Token Management
    .addSubMenu(ui.createMenu('🔐 Token')
      .addItem('🔑 Lấy Token Mới', 'getFirebaseIdToken')
      .addItem('👁️ Xem Token', 'showModernTokenStatus')
      .addItem('🗑️ Xóa Cache', 'clearTokenCache'))
    
    .addSeparator()
    
    // Tools & Settings
    .addSubMenu(ui.createMenu('⚙️ Tools')
      .addItem('🧪 Test API', 'testAPIConnection')
      .addItem('📖 Hướng Dẫn', 'showModernHelp')
      .addItem('ℹ️ About', 'showModernAbout'))
    
    .addToUi();
}

// ========================================
// QUICK ACTIONS (1-CLICK WORKFLOWS)
// ========================================

/**
 * ⚡ Quick Fetch Compliance
 */
function quickFetchCompliance() {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Đang fetch Teacher Compliance 2026...',
      '⚡ Quick Action',
      3
    );
    fetchTeacherComplianceData();
  } catch (error) {
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

/**
 * ⚡ Quick Fetch Session 4/8 tháng hiện tại (All Classes)
 */
function quickFetchCurrentMonth() {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Đang fetch TẤT CẢ lớp có buổi 4/8...',
      '⚡ Quick Action',
      3
    );
    fetchAllClassesCurrentMonth();
  } catch (error) {
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

// ========================================
// MODERN DASHBOARD
// ========================================

/**
 * 📈 Dashboard hiện đại với UI đẹp
 */
function showModernDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Thu thập thông tin
    const stats = collectDashboardStats(ss);
    
    const html = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
          }
          .container { max-width: 800px; margin: 0 auto; }
          .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
          }
          .header h1 { font-size: 32px; margin-bottom: 10px; }
          .header p { opacity: 0.9; }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .stat-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
          }
          .stat-card:hover { transform: translateY(-5px); }
          
          .stat-icon {
            font-size: 32px;
            margin-bottom: 10px;
          }
          .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
          }
          .stat-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .stat-detail {
            font-size: 12px;
            color: #999;
            margin-top: 8px;
          }
          
          .info-panel {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .info-panel h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 18px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 500; color: #666; }
          .info-value { color: #333; }
          
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }
          .status-active { background: #d4edda; color: #155724; }
          .status-expired { background: #f8d7da; color: #721c24; }
          .status-warning { background: #fff3cd; color: #856404; }
          .status-none { background: #e2e3e5; color: #383d41; }
          
          .footer {
            text-align: center;
            color: white;
            opacity: 0.8;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📈 MindX LMS Dashboard</h1>
            <p>Tổng quan dữ liệu và trạng thái hệ thống</p>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🔐</div>
              <div class="stat-value">${stats.token.status}</div>
              <div class="stat-label">Token Status</div>
              <div class="stat-detail">${stats.token.remaining}</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">🎓</div>
              <div class="stat-value">${stats.compliance.records}</div>
              <div class="stat-label">Compliance Records</div>
              <div class="stat-detail">${stats.compliance.sheet}</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📅</div>
              <div class="stat-value">${stats.classes.total}</div>
              <div class="stat-label">All Classes</div>
              <div class="stat-detail">${stats.classes.sheet}</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📌</div>
              <div class="stat-value">${stats.session48.records}</div>
              <div class="stat-label">Session 4&8</div>
              <div class="stat-detail">${stats.session48.sheet}</div>
            </div>
          </div>
          
          <div class="info-panel">
            <h2>🔐 Token Details</h2>
            <div class="info-row">
              <span class="info-label">Trạng thái</span>
              <span class="info-value">${stats.token.badge}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Thời gian lấy</span>
              <span class="info-value">${stats.token.time}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Còn lại</span>
              <span class="info-value">${stats.token.remaining}</span>
            </div>
          </div>
          
          <div class="info-panel">
            <h2>📊 Data Summary</h2>
            <div class="info-row">
              <span class="info-label">Teacher Compliance 2026</span>
              <span class="info-value">${stats.compliance.records} records</span>
            </div>
            <div class="info-row">
              <span class="info-label">All Robotics Classes</span>
              <span class="info-value">${stats.classes.total} classes</span>
            </div>
            <div class="info-row">
              <span class="info-label">Robotics Session 4 & 8</span>
              <span class="info-value">${stats.session48.records} classes</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Last updated: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </body>
      </html>
    `)
    .setWidth(850)
    .setHeight(700);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard - MindX LMS');
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('Lỗi Dashboard: ' + error.toString());
  }
}

/**
 * Thu thập stats cho dashboard
 */
function collectDashboardStats(ss) {
  const stats = {
    token: { status: '❌', badge: '<span class="status-badge status-none">Chưa có</span>', time: 'N/A', remaining: 'N/A' },
    compliance: { records: 0, sheet: 'Chưa có dữ liệu' },
    classes: { total: 0, sheet: 'Chưa có dữ liệu' },
    session48: { records: 0, sheet: 'Chưa có dữ liệu' }
  };
  
  // Token status
  const tokenSheet = ss.getSheetByName('Firebase Token');
  if (tokenSheet && tokenSheet.getLastRow() >= 2) {
    const tokenRow = tokenSheet.getRange(2, 1, 1, 4).getValues()[0];
    const timeString = tokenRow[2];
    const expiresIn = tokenRow[3];
    
    const parsedTime = parseVietnameseDateTime(timeString);
    const now = new Date();
    const ageSeconds = Math.floor((now - parsedTime) / 1000);
    const remainingSeconds = expiresIn - ageSeconds;
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    
    if (remainingSeconds > 300) {
      stats.token.status = '✅';
      stats.token.badge = '<span class="status-badge status-active">Còn hiệu lực</span>';
      stats.token.remaining = `${remainingMinutes} phút`;
    } else if (remainingSeconds > 0) {
      stats.token.status = '⚠️';
      stats.token.badge = '<span class="status-badge status-warning">Sắp hết hạn</span>';
      stats.token.remaining = `${remainingMinutes} phút`;
    } else {
      stats.token.status = '❌';
      stats.token.badge = '<span class="status-badge status-expired">Hết hạn</span>';
      stats.token.remaining = 'Đã hết hạn';
    }
    stats.token.time = timeString;
  }
  
  // Compliance data
  const complianceSheet = ss.getSheetByName('Teacher Compliance');
  if (complianceSheet && complianceSheet.getLastRow() > 1) {
    stats.compliance.records = complianceSheet.getLastRow() - 1;
    stats.compliance.sheet = 'Teacher Compliance';
  }
  
  // All classes
  const allClassesSheet = ss.getSheetByName('All Robotics Classes');
  if (allClassesSheet && allClassesSheet.getLastRow() > 1) {
    stats.classes.total = allClassesSheet.getLastRow() - 1;
    stats.classes.sheet = 'All Robotics Classes';
  }
  
  // Session 4&8
  const session48Sheet = ss.getSheetByName('Robotics Session 4 & 8');
  if (session48Sheet && session48Sheet.getLastRow() > 2) { // Row 1 = title, row 2 = header
    stats.session48.records = session48Sheet.getLastRow() - 2;
    stats.session48.sheet = 'Robotics Session 4 & 8';
  }
  
  return stats;
}

// ========================================
// MODERN UI COMPONENTS
// ========================================

/**
 * 👁️ Token status với UI hiện đại
 */
function showModernTokenStatus() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Firebase Token');
    
    if (!sheet || sheet.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('⚠️ Chưa có token\n\nVui lòng chạy "Lấy Token Mới" trước.');
      return;
    }
    
    const tokenRow = sheet.getRange(2, 1, 1, 4).getValues()[0];
    const tokenValue = tokenRow[1];
    const timeString = tokenRow[2];
    const expiresIn = tokenRow[3];
    
    const tokenTime = parseVietnameseDateTime(timeString);
    const now = new Date();
    const ageSeconds = Math.floor((now - tokenTime) / 1000);
    const remainingSeconds = expiresIn - ageSeconds;
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    
    let statusClass = 'status-active';
    let statusText = 'Còn hiệu lực';
    if (remainingSeconds < 300) {
      statusClass = 'status-warning';
      statusText = 'Sắp hết hạn';
    }
    if (remainingSeconds < 0) {
      statusClass = 'status-expired';
      statusText = 'Đã hết hạn';
    }
    
    const html = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          h1 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 28px;
          }
          .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
          }
          .status-active { background: #d4edda; color: #155724; }
          .status-expired { background: #f8d7da; color: #721c24; }
          .status-warning { background: #fff3cd; color: #856404; }
          
          .info-grid {
            display: grid;
            gap: 15px;
            margin: 20px 0;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .info-label {
            font-weight: 600;
            color: #666;
          }
          .info-value {
            color: #333;
            font-family: monospace;
          }
          
          .token-preview {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            font-family: monospace;
            font-size: 11px;
            max-height: 120px;
            overflow-y: auto;
            word-break: break-all;
            color: #495057;
          }
          
          .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin: 20px 0;
          }
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: ${Math.max(0, Math.min(100, (remainingSeconds / expiresIn) * 100))}%;
            transition: width 0.3s ease;
          }
          
          .tip {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
            font-size: 14px;
            color: #0c5460;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Token Status</h1>
          
          <div class="status-badge ${statusClass}">${statusText}</div>
          
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">📅 Thời gian lấy</span>
              <span class="info-value">${timeString}</span>
            </div>
            <div class="info-item">
              <span class="info-label">⏰ Tuổi token</span>
              <span class="info-value">${ageSeconds}s (${Math.floor(ageSeconds/60)} phút)</span>
            </div>
            <div class="info-item">
              <span class="info-label">⏳ Còn lại</span>
              <span class="info-value">${remainingSeconds}s (${remainingMinutes} phút)</span>
            </div>
            <div class="info-item">
              <span class="info-label">📊 Expires in</span>
              <span class="info-value">${expiresIn}s (60 phút)</span>
            </div>
          </div>
          
          <h3 style="margin: 25px 0 10px 0; color: #667eea;">Token Preview:</h3>
          <div class="token-preview">${tokenValue.substring(0, 300)}...</div>
          
          <div class="tip">
            <strong>💡 Lưu ý:</strong> Token hết hạn sau 60 phút. Script tự động refresh khi cần.
          </div>
        </div>
      </body>
      </html>
    `)
    .setWidth(650)
    .setHeight(600);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Token Details');
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}


/**
 * 🗑️ Xóa token cache
 */
function clearTokenCache() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Firebase Token');
    
    if (!sheet) {
      SpreadsheetApp.getUi().alert('Không có token cache để xóa.');
      return;
    }
    
    const response = SpreadsheetApp.getUi().alert(
      'Xác nhận xóa token?',
      'Sheet "Firebase Token" sẽ bị xóa.',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );
    
    if (response === SpreadsheetApp.getUi().Button.YES) {
      ss.deleteSheet(sheet);
      SpreadsheetApp.getActiveSpreadsheet().toast('✅ Đã xóa token cache', 'Success', 3);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

// ========================================
// MODERN HELP & ABOUT
// ========================================

/**
 * 📖 Help dialog hiện đại
 */
function showModernHelp() {
  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 30px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #667eea;
          margin-bottom: 20px;
          font-size: 28px;
          border-bottom: 3px solid #667eea;
          padding-bottom: 15px;
        }
        h2 {
          color: #764ba2;
          margin: 25px 0 15px 0;
          font-size: 20px;
        }
        .feature-card {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 15px 0;
          border-radius: 8px;
        }
        .feature-card h3 {
          color: #667eea;
          margin-bottom: 10px;
        }
        .step-list {
          counter-reset: step;
          list-style: none;
          padding: 0;
        }
        .step-list li {
          counter-increment: step;
          padding: 12px 15px 12px 45px;
          position: relative;
          margin: 8px 0;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .step-list li:before {
          content: counter(step);
          position: absolute;
          left: 12px;
          top: 10px;
          background: #667eea;
          color: white;
          width: 25px;
          height: 25px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
        }
        .quick-ref {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .quick-ref h3 { color: white; margin-bottom: 15px; }
        .quick-ref ul { padding-left: 20px; }
        .quick-ref li { margin: 8px 0; }
        code {
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: #e83e8c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📖 Hướng Dẫn Sử Dụng</h1>
        
        <div class="quick-ref">
          <h3>⚡ Quick Start trong 30 giây</h3>
          <ol class="step-list" style="color: white; background: transparent;">
            <li style="background: rgba(255,255,255,0.2);">Menu: <strong>MindX LMS → Quick Actions</strong></li>
            <li style="background: rgba(255,255,255,0.2);">Chọn task cần làm (Compliance hoặc Session 4/8)</li>
            <li style="background: rgba(255,255,255,0.2);">Đợi fetch xong → Xem kết quả trong sheet</li>
          </ol>
        </div>
        
        <h2>🎯 Tính Năng Chính</h2>
        
        <div class="feature-card">
          <h3>📊 Teacher Compliance 2026</h3>
          <ul>
            <li>Tự động lấy dữ liệu Teacher Compliance năm 2026</li>
            <li>Filter chính xác thời gian: 01/01/2026 - 31/12/2026</li>
            <li>Ghi data realtime (tránh mất dữ liệu nếu timeout)</li>
            <li>Sheet output: <code>Teacher Compliance</code></li>
          </ul>
        </div>
        
        <div class="feature-card">
          <h3>📅 Lớp Có Buổi 4 & 8</h3>
          <ul>
            <li>Lấy lớp Robotics có buổi 4 HOẶC buổi 8 trong tháng</li>
            <li>Chọn tháng linh hoạt (tháng hiện tại, 1/2026, 2/2026...)</li>
            <li>2 sheets output:</li>
            <ul>
              <li><code>All Robotics Classes</code> - Tất cả lớp</li>
              <li><code>Robotics Session 4 & 8</code> - Lớp đã lọc</li>
            </ul>
          </ul>
        </div>
        
        <div class="feature-card">
          <h3>🔐 Token Management</h3>
          <ul>
            <li><strong>Auto:</strong> Script tự động lấy token khi cần</li>
            <li><strong>Cache:</strong> Token được lưu 55 phút, dùng lại không fetch mới</li>
            <li><strong>Manual:</strong> Có thể force refresh token bất cứ lúc nào</li>
          </ul>
        </div>
        
        <h2>📈 Dashboard</h2>
        <p>Xem tổng quan tất cả dữ liệu:</p>
        <ul style="padding-left: 20px; margin: 10px 0;">
          <li>Token status (còn bao nhiêu phút)</li>
          <li>Số lượng records trong mỗi sheet</li>
          <li>Trạng thái fetch data</li>
        </ul>
        
        <div class="feature-card" style="border-left-color: #28a745; margin-top: 25px;">
          <h3>💡 Tips & Tricks</h3>
          <ul>
            <li>Token hết hạn sau 60 phút - script sẽ tự động refresh</li>
            <li>Dùng Quick Actions để thao tác nhanh nhất</li>
            <li>Kiểm tra Dashboard để biết data đã fetch chưa</li>
            <li>Mỗi sheet có màu status (xanh = active, xám = closed)</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `)
  .setWidth(850)
  .setHeight(700);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Hướng Dẫn');
}

/**
 * ℹ️ About dialog hiện đại
 */
function showModernAbout() {
  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 50px 40px;
          max-width: 600px;
          margin: 0 auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .logo {
          font-size: 72px;
          margin-bottom: 20px;
        }
        h1 {
          color: #667eea;
          font-size: 36px;
          margin-bottom: 10px;
        }
        .version {
          color: #999;
          font-size: 16px;
          margin-bottom: 30px;
        }
        .description {
          color: #666;
          font-size: 18px;
          line-height: 1.6;
          margin: 30px 0;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin: 30px 0;
          text-align: left;
        }
        .feature-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 10px;
          border-left: 3px solid #667eea;
        }
        .feature-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .feature-text {
          font-size: 14px;
          color: #666;
        }
        .footer {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 2px solid #f0f0f0;
          color: #999;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🎯</div>
        <h1>MindX LMS Tools</h1>
        <p class="version">Version 2.0.0 • February 2026</p>
        
        <p class="description">
          Hệ thống tự động thu thập và quản lý dữ liệu<br>
          từ MindX LMS Platform
        </p>
        
        <div class="features">
          <div class="feature-item">
            <div class="feature-icon">🎓</div>
            <div class="feature-text">Teacher Compliance Tracking</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📅</div>
            <div class="feature-text">Class Session Management</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🔐</div>
            <div class="feature-text">Auto Token Management</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <div class="feature-text">Real-time Dashboard</div>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Developed for MindX Education</strong></p>
          <p style="margin-top: 10px;">
            <a href="mailto:anhpnh@mindx.com.vn">📧 Contact Support</a>
          </p>
          <p style="margin-top: 15px; font-size: 12px;">
            © 2026 MindX Education Technology
          </p>
        </div>
      </div>
    </body>
    </html>
  `)
  .setWidth(650)
  .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'About');
}

// ========================================
// API CONNECTION TEST
// ========================================

/**
 * 🧪 Test kết nối với LMS API
 */
function testAPIConnection() {
  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 700px;
          margin: 0 auto;
        }
        h1 {
          color: #667eea;
          margin-bottom: 30px;
          font-size: 32px;
          text-align: center;
        }
        .test-section {
          margin: 25px 0;
          padding: 25px;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #667eea;
        }
        .test-header {
          font-size: 18px;
          font-weight: bold;
          color: #333;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .test-icon {
          font-size: 24px;
        }
        .status {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          margin: 8px 5px 8px 0;
        }
        .status.running {
          background: #fff3cd;
          color: #856404;
        }
        .status.success {
          background: #d4edda;
          color: #155724;
        }
        .status.error {
          background: #f8d7da;
          color: #721c24;
        }
        .detail {
          color: #666;
          font-size: 14px;
          margin: 8px 0;
          padding-left: 20px;
        }
        .summary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 25px;
          border-radius: 12px;
          margin-top: 30px;
          text-align: center;
        }
        .summary h2 {
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧪 Test Kết Nối LMS</h1>
        
        <div class="test-section">
          <div class="test-header">
            <span class="test-icon">🔐</span>
            <span>Test 1: Token Authentication</span>
          </div>
          <div id="test1">
            <span class="status running">⏳ Đang kiểm tra...</span>
          </div>
        </div>
        
        <div class="test-section">
          <div class="test-header">
            <span class="test-icon">🌐</span>
            <span>Test 2: GraphQL API Connection</span>
          </div>
          <div id="test2">
            <span class="status running">⏳ Chờ test 1...</span>
          </div>
        </div>
        
        <div class="test-section">
          <div class="test-header">
            <span class="test-icon">📊</span>
            <span>Test 3: Data Fetch (Sample Query)</span>
          </div>
          <div id="test3">
            <span class="status running">⏳ Chờ test 2...</span>
          </div>
        </div>
        
        <div class="summary" id="summary" style="display: none;">
          <h2>✅ Tất Cả Test Passed</h2>
          <p>Hệ thống sẵn sàng sử dụng!</p>
        </div>
      </div>
      
      <script>
        // Bắt đầu test
        setTimeout(() => {
          runTest();
        }, 500);
        
        function runTest() {
          // Test 1: Token
          google.script.run
            .withSuccessHandler(onTest1Success)
            .withFailureHandler(onTest1Failure)
            .runTest1();
        }
        
        function onTest1Success(result) {
          const div = document.getElementById('test1');
          if (result.success) {
            div.innerHTML = 
              '<span class="status success">✅ Success</span>' +
              '<div class="detail">Token valid, expires in ' + result.ttl + 'm</div>';
            
            // Run Test 2
            setTimeout(() => {
              google.script.run
                .withSuccessHandler(onTest2Success)
                .withFailureHandler(onTest2Failure)
                .runTest2();
            }, 500);
          } else {
            div.innerHTML = 
              '<span class="status error">❌ Failed</span>' +
              '<div class="detail">' + result.error + '</div>';
          }
        }
        
        function onTest1Failure(error) {
          document.getElementById('test1').innerHTML = 
            '<span class="status error">❌ Failed</span>' +
            '<div class="detail">' + error.message + '</div>';
        }
        
        function onTest2Success(result) {
          const div = document.getElementById('test2');
          if (result.success) {
            div.innerHTML = 
              '<span class="status success">✅ Success</span>' +
              '<div class="detail">Connected to ' + result.endpoint + '</div>';
            
            // Run Test 3
            setTimeout(() => {
              google.script.run
                .withSuccessHandler(onTest3Success)
                .withFailureHandler(onTest3Failure)
                .runTest3();
            }, 500);
          } else {
            div.innerHTML = 
              '<span class="status error">❌ Failed</span>' +
              '<div class="detail">' + result.error + '</div>';
          }
        }
        
        function onTest2Failure(error) {
          document.getElementById('test2').innerHTML = 
            '<span class="status error">❌ Failed</span>' +
            '<div class="detail">' + error.message + '</div>';
        }
        
        function onTest3Success(result) {
          const div = document.getElementById('test3');
          if (result.success) {
            div.innerHTML = 
              '<span class="status success">✅ Success</span>' +
              '<div class="detail">Fetched ' + result.count + ' records</div>';
            
            // Show summary
            document.getElementById('summary').style.display = 'block';
          } else {
            div.innerHTML = 
              '<span class="status error">❌ Failed</span>' +
              '<div class="detail">' + result.error + '</div>';
          }
        }
        
        function onTest3Failure(error) {
          document.getElementById('test3').innerHTML = 
            '<span class="status error">❌ Failed</span>' +
            '<div class="detail">' + error.message + '</div>';
        }
      </script>
    </body>
    </html>
  `)
  .setWidth(750)
  .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Connection Test');
}

/**
 * Test 1: Token authentication
 */
function runTest1() {
  try {
    const token = getOrFetchToken();
    const ttl = getTokenTTL(token);
    
    return {
      success: true,
      ttl: Math.floor(ttl / 60)
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test 2: API connection
 */
function runTest2() {
  try {
    const endpoint = 'https://api-gateway.mindx.edu.vn/api-gateway/cms/graphql';
    return {
      success: true,
      endpoint: endpoint
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test 3: Sample data fetch
 */
function runTest3() {
  try {
    const token = getOrFetchToken();
    const query = `
      query GetClasses($search: String, $pageIndex: Int, $itemsPerPage: Int) {
        classes(search: $search, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage) {
          data { _id name }
          pagination { total }
        }
      }
    `;
    
    const response = UrlFetchApp.fetch('https://api-gateway.mindx.edu.vn/api-gateway/cms/graphql', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify({
        query: query,
        variables: {
          search: "-rob-",
          pageIndex: 0,
          itemsPerPage: 5
        }
      }),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.errors) {
      return {
        success: false,
        error: result.errors[0].message
      };
    }
    
    return {
      success: true,
      count: result.data.classes.data.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 📊 Hiển thị dashboard tổng quan
 */
function showDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Kiểm tra token status
    let tokenStatus = '❌ Chưa có token';
    let tokenTime = 'N/A';
    let tokenRemaining = 'N/A';
    
    const tokenSheet = ss.getSheetByName('Firebase Token');
    if (tokenSheet && tokenSheet.getLastRow() >= 2) {
      const tokenRow = tokenSheet.getRange(2, 1, 1, 4).getValues()[0];
      const timeString = tokenRow[2];
      const expiresIn = tokenRow[3];
      
      const parsedTime = parseVietnameseDateTime(timeString);
      const now = new Date();
      const ageSeconds = Math.floor((now - parsedTime) / 1000);
      const remainingSeconds = expiresIn - ageSeconds;
      
      if (remainingSeconds > 0) {
        tokenStatus = '✅ Token còn hiệu lực';
        tokenRemaining = Math.floor(remainingSeconds / 60) + ' phút';
      } else {
        tokenStatus = '⚠️ Token đã hết hạn';
        tokenRemaining = 'Hết hạn';
      }
      tokenTime = timeString;
    }
    
    // Kiểm tra data status
    let dataStatus = '❌ Chưa có dữ liệu';
    let dataRecords = 0;
    let dataTime = 'N/A';
    
    const dataSheet = ss.getSheetByName('Teacher Compliance');
    if (dataSheet && dataSheet.getLastRow() > 1) {
      dataRecords = dataSheet.getLastRow() - 1; // Trừ header
      dataStatus = `✅ Có ${dataRecords} bản ghi`;
      // Có thể lấy thời gian từ cell metadata nếu cần
    }
    
    const html = HtmlService.createHtmlOutput(`
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .dashboard-card { 
          background: #f8f9fa; 
          padding: 20px; 
          margin: 15px 0; 
          border-radius: 8px;
          border-left: 4px solid #4A90E2;
        }
        .status-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 10px 0;
          padding: 5px 0;
          border-bottom: 1px solid #eee;
        }
        .status-label { font-weight: bold; }
        h2 { color: #333; margin-top: 0; }
        .action-btn {
          background: #4A90E2;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
          font-size: 14px;
        }
        .action-btn:hover { background: #357ABD; }
      </style>
      
      <h2>📊 MindX App Dashboard</h2>
      
      <div class="dashboard-card">
        <h3>🔐 Token Status</h3>
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span>${tokenStatus}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Thời gian lấy:</span>
          <span>${tokenTime}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Còn lại:</span>
          <span>${tokenRemaining}</span>
        </div>
      </div>
      
      <div class="dashboard-card">
        <h3>📊 Data Status</h3>
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span>${dataStatus}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Bản ghi:</span>
          <span>${dataRecords}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Sheet:</span>
          <span>Teacher Compliance</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <p><strong>🎯 Quick Actions:</strong></p>
        <p>Dùng menu "MindX App" → "Quick Actions" để thao tác nhanh</p>
      </div>
    `)
    .setWidth(600)
    .setHeight(500);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard - MindX App');
    
  } catch (error) {
    Logger.log('❌ Dashboard error: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

// ========================================
// HELP & DOCUMENTATION
// ========================================

/**
 * 📖 Hiển thị hướng dẫn tổng quan
 */
function showMainHelp() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h2 { color: #4A90E2; border-bottom: 2px solid #4A90E2; padding-bottom: 10px; }
      h3 { color: #333; margin-top: 25px; }
      .feature-box { 
        background: #f0f8ff; 
        padding: 15px; 
        margin: 10px 0; 
        border-radius: 5px;
        border-left: 4px solid #4A90E2;
      }
      code { 
        background: #f5f5f5; 
        padding: 2px 6px; 
        border-radius: 3px;
        font-family: monospace;
      }
      ul { line-height: 1.8; }
    </style>
    
    <h2>📖 Hướng Dẫn Sử Dụng MindX App</h2>
    
    <div class="feature-box">
      <strong>🎯 App này gộp 2 scripts:</strong>
      <ul>
        <li><strong>getFirebaseToken.gs:</strong> Quản lý Firebase token</li>
        <li><strong>teacherCompliance.gs:</strong> Fetch dữ liệu Teacher Compliance 2026</li>
      </ul>
    </div>
    
    <h3>⚡ Quick Start (Cách nhanh nhất)</h3>
    <ol>
      <li>Menu: <strong>MindX App → Quick Actions → ⚡ Fetch Data Nhanh</strong></li>
      <li>Chờ script tự động lấy token và fetch data</li>
      <li>Xem kết quả trong sheet "Teacher Compliance"</li>
    </ol>
    
    <h3>🔐 Quản Lý Token</h3>
    <ul>
      <li><strong>Lấy Token Mới:</strong> Fetch token từ Firebase và lưu vào sheet</li>
      <li><strong>Xem Token:</strong> Kiểm tra token hiện tại, thời gian còn lại</li>
      <li><strong>Xóa Cache:</strong> Xóa token cache (lần fetch tiếp sẽ lấy token mới)</li>
    </ul>
    
    <h3>📊 Fetch Data</h3>
    <ul>
      <li><strong>Auto Token:</strong> Script tự động đọc token từ cache hoặc fetch mới</li>
      <li><strong>Filter năm 2026:</strong> Chỉ lấy dữ liệu 01/01/2026 - 31/12/2026</li>
      <li><strong>Realtime:</strong> Load tới đâu ghi tới đó (không lo timeout)</li>
    </ul>
    
    <h3>🎯 Workflows Khuyến Nghị</h3>
    
    <div class="feature-box">
      <strong>Cách 1: Tối ưu nhất (Tiết kiệm API)</strong>
      <ol>
        <li>Lấy token 1 lần: <code>Lấy Token Mới</code></li>
        <li>Fetch data nhiều lần: <code>Fetch Data Nhanh</code> (trong 55 phút)</li>
        <li>Token được cache, dùng lại không cần fetch mới</li>
      </ol>
    </div>
    
    <div class="feature-box">
      <strong>Cách 2: Tự động hoàn toàn</strong>
      <ol>
        <li>Chỉ chạy: <code>Fetch Data Nhanh</code></li>
        <li>Script tự động lấy token nếu cần</li>
      </ol>
    </div>
    
    <h3>📊 Dashboard</h3>
    <p>Menu: <strong>Quick Actions → 📊 Dashboard</strong></p>
    <ul>
      <li>Xem token status (còn bao nhiêu phút)</li>
      <li>Xem data status (có bao nhiêu records)</li>
      <li>Tổng quan toàn bộ hệ thống</li>
    </ul>
    
    <h3>⚠️ Lưu Ý</h3>
    <ul>
      <li>Token hết hạn sau <strong>1 giờ (3600s)</strong></li>
      <li>Script tự động kiểm tra và refresh khi cần</li>
      <li>Dữ liệu được ghi realtime, an toàn với timeout</li>
    </ul>
  `)
  .setWidth(700)
  .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Hướng Dẫn - MindX App');
}

/**
 * ℹ️ About
 */
function showAbout() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; text-align: center; }
      h1 { color: #4A90E2; margin-bottom: 10px; }
      .version { color: #666; font-size: 14px; }
      .info { margin: 20px 0; line-height: 1.8; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; }
    </style>
    
    <h1>🎯 MindX App</h1>
    <p class="version">Version 1.0.0 - February 2026</p>
    
    <div class="info">
      <p><strong>Teacher Compliance Data Fetcher</strong></p>
      <p>Hệ thống tự động lấy và quản lý dữ liệu Teacher Compliance từ MindX LMS</p>
    </div>
    
    <h3>✨ Features</h3>
    <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
      <li>🔐 Auto Firebase Token Management</li>
      <li>📊 Teacher Compliance Data Fetching (2026)</li>
      <li>⚡ Smart Token Caching (55min)</li>
      <li>💾 Realtime Data Writing</li>
      <li>📈 Dashboard & Monitoring</li>
    </ul>
    
    <div class="footer">
      <p>Developed for MindX Education</p>
      <p><small>Contact: anhpnh@mindx.com.vn</small></p>
    </div>
  `)
  .setWidth(500)
  .setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'About');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Parse datetime string định dạng Việt Nam: "dd/MM/yyyy HH:mm:ss"
 * (Copy từ teacherCompliance.gs để dùng trong app.gs)
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
