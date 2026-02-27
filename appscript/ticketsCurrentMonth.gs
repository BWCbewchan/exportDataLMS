/**
 * TICKETS CURRENT MONTH FETCHER
 * 
 * LẤY DANH SÁCH TICKETS/FEEDBACK CỦA THÁNG HIỆN TẠI
 * Script để lấy tickets từ hệ thống LMS cho tháng hiện tại
 * 
 * OUTPUT:
 * - Sheet: "Tickets Current Month" - Danh sách tickets tháng hiện tại
 */

// ========================================
// CẤU HÌNH
// ========================================

const TICKETS_CONFIG = {
  API_URL: 'https://lms-api.mindx.vn/',
  AUTH_TOKEN: '', // Sẽ được tự động cập nhật
  SHEET_NAME: 'Tickets Current Month',
  RECORDS_PER_PAGE: 50,
  MAX_RETRIES: 3,
  SLEEP_TIME: 1000,
  
  // Centre IDs (TP centres)
  CENTRE_IDS: [
    "62d6dc936e356729147d7399",
    "62b0234675379306da49f051", 
    "609bf4149535070ca5e3edc0",
    "63034f877d1d1e1cb14e4e5f",
    "62918d02af37d11e2da237e5",
    "62d6dcc16e356729147d73a6",
    "63034f4a7d1d1e1cb14e4e57",
    "62cc07753c1309654f472e60"
  ]
};

// Tickets GraphQL Query
const TICKETS_QUERY = `query FindTicketPaginate($payload: TicketQuery) {
  findTicketPaginate(payload: $payload) {
    data {
      id
      ticketCode
      title
      description
      priority
      feedbackTopic
      status
      deadline
      customerId
      productUserId
      assignee {
        id
        username
        email
      }
      ticketSource {
        id
        channel
        noteId
        classId
        callId
        surveyResponseId
        studentName
        studentId
        className
        centreId
        surveyId
        centre {
          id
          name
          shortName
        }
        answers {
          questionId
          value
        }
        questions {
          id
          title
          description
          options
          type
          isRequired
          group
        }
      }
      attachments {
        fileName
        fileUrl
      }
      comments {
        id
        message
        userId
        createdAt
        user {
          id
          username
          email
        }
      }
      createdAt
      closedDate
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
 * Lấy tickets của tháng hiện tại
 */
function fetchTicketsCurrentMonth() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    Logger.log(`📅 Lấy tickets tháng ${month}/${year}`);
    ss.toast(`📅 Đang lấy tickets tháng ${month}/${year}...`, 'Bắt đầu', 3);
    
    // BƯỚC 1: Clear sheet cũ
    Logger.log('🗑️ Xóa dữ liệu cũ...');
    ss.toast('🗑️ Đang xóa dữ liệu cũ...', 'Chuẩn bị', 2);
    clearTicketsSheet();
    
    // BƯỚC 2: Lấy Token
    Logger.log('🔐 Lấy Firebase token...');
    TICKETS_CONFIG.AUTH_TOKEN = getTicketsFirebaseToken();
    
    // BƯỚC 3: Tính toán khoảng thời gian tháng hiện tại
    const { startDate, endDate } = getCurrentMonthRange();
    Logger.log(`📆 Từ ${startDate} đến ${endDate}`);
    
    // BƯỚC 4: Fetch tickets
    Logger.log('🚀 Đang lấy tickets từ API...');
    ss.toast('🚀 Đang lấy tickets...', 'Fetching API', 3);
    
    const tickets = fetchAllTickets(startDate, endDate);
    Logger.log(`✅ Đã lấy được ${tickets.length} tickets`);
    ss.toast(`✅ Đã lấy được ${tickets.length} tickets!`, 'Fetch Complete', 2);
    
    // BƯỚC 5: Ghi vào sheet
    Logger.log(`📝 Đang ghi ${tickets.length} tickets vào sheet...`);
    ss.toast(`📝 Đang ghi ${tickets.length} tickets...`, 'Writing Data', 2);
    writeTicketsToSheet(tickets, month, year);
    Logger.log(`✅ Đã ghi xong sheet "${TICKETS_CONFIG.SHEET_NAME}"`);
    
    // BƯỚC 6: Hoàn thành
    Logger.log(`\n🎉 HOÀN THÀNH!`);
    Logger.log(`   - Tháng ${month}/${year}: ${tickets.length} tickets`);
    
    ss.toast(
      `✅ Tháng ${month}/${year}: ${tickets.length} tickets!`, 
      'Hoàn thành', 
      5
    );
    
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    SpreadsheetApp.getUi().alert('Lỗi: ' + error.toString());
  }
}

/**
 * Tính toán khoảng thời gian của tháng hiện tại
 */
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  
  // Ngày đầu tháng: 00:00:00
  const startDate = new Date(year, month, 1, 0, 0, 0);
  
  // Ngày cuối tháng: 23:59:59
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  // Format ISO string
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

/**
 * Clear sheet cũ
 */
function clearTicketsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TICKETS_CONFIG.SHEET_NAME);
  if (sheet) {
    sheet.clear();
    Logger.log(`   ✓ Đã xóa "${TICKETS_CONFIG.SHEET_NAME}"`);
  }
}

/**
 * Fetch tất cả tickets (phân trang)
 */
function fetchAllTickets(startDate, endDate) {
  let allData = [];
  let page = 0;
  let hasMore = true;
  
  do {
    Logger.log(`📥 Đang tải trang ${page + 1}... (Đã lấy: ${allData.length})`);
    
    let response;
    try {
      response = fetchTicketsWithRetry(page, startDate, endDate);
    } catch (e) {
      Logger.log(`⚠️ Bỏ qua trang ${page + 1} do lỗi: ` + e.message);
      break;
    }
    
    if (!response) break;
    
    const result = JSON.parse(response.getContentText());
    if (result.errors) throw new Error('API Error: ' + JSON.stringify(result.errors));
    
    const ticketData = result.data?.findTicketPaginate?.data || [];
    const pagination = result.data?.findTicketPaginate?.pagination || {};
    const total = pagination.total || 0;
    
    if (ticketData.length === 0) {
      hasMore = false;
      break;
    }
    
    allData = allData.concat(ticketData);
    
    // Kiểm tra đã lấy đủ chưa
    if (total > 0 && allData.length >= total) {
      Logger.log(`✅ Đã lấy đủ ${total} tickets.`);
      hasMore = false;
    }
    
    if (ticketData.length < TICKETS_CONFIG.RECORDS_PER_PAGE) {
      hasMore = false;
    }
    
    page++;
    Utilities.sleep(TICKETS_CONFIG.SLEEP_TIME);
    
  } while (hasMore);
  
  return allData;
}

/**
 * Fetch API với retry
 */
function fetchTicketsWithRetry(page, startDate, endDate) {
  const makeRequest = () => {
    const variables = {
      payload: {
        pageIndex: page,
        itemsPerPage: TICKETS_CONFIG.RECORDS_PER_PAGE,
        assignee_in: [],
        centreId_in: TICKETS_CONFIG.CENTRE_IDS,
        feedbackTopic_in: [],
        status_in: [],
        channel_in: [],
        filter_textSearch: "",
        deadline_gte: "",
        deadline_lte: "",
        createdAt_gte: startDate,  // Lọc từ đầu tháng
        createdAt_lte: endDate     // Lọc đến cuối tháng
      }
    };
    
    const payload = {
      operationName: 'FindTicketPaginate',
      variables: variables,
      query: TICKETS_QUERY
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'accept': '*/*',
        'authorization': TICKETS_CONFIG.AUTH_TOKEN,
        'cache-control': 'no-cache',
        'content-language': 'vi',
        'origin': 'https://lms.mindx.edu.vn',
        'referer': 'https://lms.mindx.edu.vn/'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    return UrlFetchApp.fetch(TICKETS_CONFIG.API_URL, options);
  };

  let attempts = 0;
  let lastError;
  
  while (attempts < TICKETS_CONFIG.MAX_RETRIES) {
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
          TICKETS_CONFIG.AUTH_TOKEN = getFirebaseIdToken();
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
 * Ghi tickets vào sheet
 */
function writeTicketsToSheet(tickets, month, year) {
  const sheet = prepareTicketsSheet();
  
  if (tickets.length === 0) {
    Logger.log('⚠️ Không có tickets trong tháng này.');
    return;
  }
  
  // Collect all unique questions from all tickets
  const allQuestions = collectAllQuestions(tickets);
  Logger.log(`📋 Tìm thấy ${allQuestions.length} câu hỏi khảo sát`);
  
  // Build headers
  const baseHeaders = [
    'Id',
    'Code', 
    'Cơ sở',
    'Mẫu khảo sát',
    'Mức độ',
    'Mã lớp',
    'Học viên'
  ];
  
  const questionHeaders = allQuestions.map(q => q.title || '');
  const scoreHeaders = ['Điểm 1', 'Điểm 2'];
  const headers = [...baseHeaders, ...questionHeaders, ...scoreHeaders];
  
  const totalCols = headers.length;
  
  // Title row
  const title = `Tickets Tháng ${month}/${year}`;
  sheet.getRange(1, 1, 1, totalCols).merge();
  sheet.getRange(1, 1).setValue(title)
    .setBackground('#2C3E50')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontSize(12);
  
  // Header row
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  
  // Data rows
  const rows = tickets.map(ticket => {
    const baseData = [
      ticket.id || '',
      ticket.ticketCode || '',
      ticket.ticketSource?.centre?.name || ticket.ticketSource?.centre?.shortName || '',
      ticket.feedbackTopic || '',
      ticket.priority || '',
      ticket.ticketSource?.className || '',
      ticket.ticketSource?.studentName || ''
    ];
    
    // Extract answers for all questions
    const answers = extractAnswersForQuestions(ticket, allQuestions);
    
    // Calculate scores (based on numeric answers)
    const scores = calculateScores(answers);
    
    return [...baseData, ...answers, scores.score1, scores.score2];
  });
  
  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);
  formatTicketsSheet(sheet, rows.length + 2, headers.length);
}

/**
 * Chuẩn bị sheet
 */
function prepareTicketsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TICKETS_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TICKETS_CONFIG.SHEET_NAME);
  }
  sheet.clear();
  return sheet;
}

/**
 * Format sheet
 */
function formatTicketsSheet(sheet, lastRow, lastCol) {
  if (lastRow <= 2) return;
  
  // Auto resize - set specific widths for better readability
  sheet.setColumnWidth(1, 180); // Id
  sheet.setColumnWidth(2, 100); // Code
  sheet.setColumnWidth(3, 100); // Cơ sở
  sheet.setColumnWidth(4, 120); // Mẫu khảo sát
  sheet.setColumnWidth(5, 80);  // Mức độ
  sheet.setColumnWidth(6, 100); // Mã lớp
  sheet.setColumnWidth(7, 120); // Học viên
  
  // Auto resize remaining columns (questions and scores)
  for (let col = 8; col <= lastCol; col++) {
    sheet.setColumnWidth(col, 200); // Questions need more space
  }
  
  // Freeze header
  sheet.setFrozenRows(2);
  
  // Borders
  sheet.getRange(2, 1, lastRow - 1, lastCol)
    .setBorder(true, true, true, true, true, true);
  
  // Align
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, lastCol).setVerticalAlignment('top');
    sheet.getRange(3, 1, lastRow - 2, lastCol).setWrap(true);
    
    // Màu cho Mức độ column (column 5)
    const priorityRange = sheet.getRange(3, 5, lastRow - 2, 1);
    const priorityValues = priorityRange.getValues();
    priorityValues.forEach((row, index) => {
      const cell = sheet.getRange(index + 3, 5);
      const priority = row[0];
      if (priority === 'HIGH' || priority === 'URGENT') {
        cell.setBackground('#f8d7da'); // Red
      } else if (priority === 'MEDIUM') {
        cell.setBackground('#fff3cd'); // Yellow
      } else if (priority === 'LOW') {
        cell.setBackground('#d4edda'); // Green
      }
    });
  }
}

/**
 * Collect all unique questions from all tickets
 */
function collectAllQuestions(tickets) {
  const questionMap = new Map();
  
  tickets.forEach(ticket => {
    const questions = ticket.ticketSource?.questions || [];
    questions.forEach(q => {
      if (!questionMap.has(q.id)) {
        questionMap.set(q.id, q);
      }
    });
  });
  
  // Convert to array and sort by title
  const allQuestions = Array.from(questionMap.values());
  allQuestions.sort((a, b) => {
    const titleA = a.title || '';
    const titleB = b.title || '';
    // Extract number from title if exists (e.g., "1. Question" -> 1)
    const numA = parseInt(titleA.match(/^(\d+)/)?.[1] || '999');
    const numB = parseInt(titleB.match(/^(\d+)/)?.[1] || '999');
    if (numA !== numB) return numA - numB;
    return titleA.localeCompare(titleB, 'vi');
  });
  
  return allQuestions;
}

/**
 * Extract answers for specific questions from a ticket
 * Convert to score for rating questions, keep text for open-ended questions
 */
function extractAnswersForQuestions(ticket, allQuestions) {
  const answers = ticket.ticketSource?.answers || [];
  const answerMap = {};
  
  // Map questionId to answer value
  answers.forEach(ans => {
    answerMap[ans.questionId] = ans.value;
  });
  
  // Return answers in order of allQuestions
  return allQuestions.map(q => {
    const rawAnswer = answerMap[q.id] || '';
    
    // Check if this is the open-ended question (keep text)
    const questionTitle = (q.title || '').toLowerCase();
    if (questionTitle.includes('hoạt động') && 
        questionTitle.includes('phần thưởng')) {
      return rawAnswer; // Keep original text
    }
    
    // For all other questions, convert to score
    return convertAnswerToScore(rawAnswer);
  });
}

/**
 * Convert answer to numeric score
 * Returns numeric value or empty string
 */
function convertAnswerToScore(answer) {
  if (!answer) return '';
  
  // Already a number
  const num = parseFloat(answer);
  if (!isNaN(num)) return num;
  
  // Convert text answers to scores (1-5 scale)
  const lowerAnswer = answer.toLowerCase().trim();
  
  // Positive answers -> 5
  if (lowerAnswer.includes('rất') || 
      lowerAnswer.includes('luôn') ||
      lowerAnswer.includes('hoàn toàn')) {
    return 5;
  }
  
  // Good answers -> 4
  if (lowerAnswer.includes('có') || 
      lowerAnswer.includes('thích') || 
      lowerAnswer.includes('tốt') ||
      lowerAnswer.includes('dễ') ||
      lowerAnswer.includes('hay') ||
      lowerAnswer.includes('vui')) {
    return 4;
  }
  
  // Neutral -> 3
  if (lowerAnswer.includes('bình thường') ||
      lowerAnswer.includes('được') ||
      lowerAnswer.includes('ok')) {
    return 3;
  }
  
  // Negative answers -> 2
  if (lowerAnswer.includes('không') && 
      !lowerAnswer.includes('không tốt')) {
    return 2;
  }
  
  // Very negative -> 1
  if (lowerAnswer.includes('không tốt') ||
      lowerAnswer.includes('kém') ||
      lowerAnswer.includes('chán')) {
    return 1;
  }
  
  // Cannot convert -> return empty
  return '';
}

/**
 * Calculate scores from answers
 * Điểm 1: Trung bình các câu trả lời số
 * Điểm 2: Số câu trả lời tích cực
 */
function calculateScores(answers) {
  let numericAnswers = [];
  let positiveCount = 0;
  
  answers.forEach(answer => {
    if (!answer) return;
    
    // Try to parse as number
    const num = parseFloat(answer);
    if (!isNaN(num)) {
      numericAnswers.push(num);
      if (num >= 4) positiveCount++; // Assuming 5-point scale
    } else {
      // Check for positive text responses
      const lowerAnswer = answer.toLowerCase();
      if (lowerAnswer.includes('có') || 
          lowerAnswer.includes('thích') || 
          lowerAnswer.includes('tốt') ||
          lowerAnswer.includes('dễ')) {
        positiveCount++;
      }
    }
  });
  
  const score1 = numericAnswers.length > 0 
    ? (numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length).toFixed(2)
    : '';
  
  const score2 = positiveCount;
  
  return { score1, score2 };
}

/**
 * Format date - API returns timestamp in milliseconds
 * Example: 1770333031377 -> 06/02/2026 16:30:31
 */
function formatTicketDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    let date;
    
    // API returns timestamp as number (milliseconds since epoch)
    if (typeof dateStr === 'number') {
      date = new Date(dateStr);
    } else if (typeof dateStr === 'string') {
      // Try parsing as number first
      const timestamp = parseInt(dateStr, 10);
      if (!isNaN(timestamp)) {
        date = new Date(timestamp);
      } else {
        // Fallback to ISO string parsing
        date = new Date(dateStr);
      }
    } else if (dateStr instanceof Date) {
      date = dateStr;
    } else {
      Logger.log(`⚠️ Unknown date type: ${typeof dateStr}`);
      return '';
    }
    
    // Validate date
    if (!date || isNaN(date.getTime())) {
      Logger.log(`⚠️ Invalid date: ${JSON.stringify(dateStr)}`);
      return '';
    }
    
    // Format: dd/MM/yyyy HH:mm:ss
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    
  } catch (err) { 
    Logger.log(`⚠️ Error formatting date: ${JSON.stringify(dateStr)} - ${err.toString()}`);
    return ''; 
  }
}

// ========================================
// FIREBASE AUTH
// ========================================

function getTicketsFirebaseToken() {
  const tokenFromSheet = readTicketsTokenFromSheet();
  if (tokenFromSheet) return tokenFromSheet;
  return getFirebaseIdToken();
}

function readTicketsTokenFromSheet() {
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
function onOpenTicketsMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎫 Tickets')
    .addItem('📅 Lấy Tickets Tháng Này', 'fetchTicketsCurrentMonth')
    .addToUi();
}
