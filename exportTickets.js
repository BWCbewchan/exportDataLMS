const fs = require('fs');
require('dotenv').config();
const { getToken } = require('./getToken');

// ========================================
// CẤU HÌNH
// ========================================

const API_URL = 'https://lms-api.mindx.vn/';
let AUTH_TOKEN; // Sẽ được lấy tự động bằng getToken() trong main()
const RECORDS_PER_PAGE = 50;
const MAX_RETRIES = 3;

// Centre IDs (8 TP centres)
const CENTRE_IDS = [
  "62d6dc936e356729147d7399",
  "62b0234675379306da49f051", 
  "609bf4149535070ca5e3edc0",
  "63034f877d1d1e1cb14e4e5f",
  "62918d02af37d11e2da237e5",
  "62d6dcc16e356729147d73a6",
  "63034f4a7d1d1e1cb14e4e57",
  "62cc07753c1309654f472e60"
];



// ========================================
// GRAPHQL QUERY
// ========================================

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
          shortName
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
// HELPER FUNCTIONS
// ========================================

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
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    month: month + 1,
    year: year
  };
}

/**
 * Format comments thành text dễ đọc
 * Format: [User] Message (Time)
 */
function formatComments(comments) {
  if (!comments || comments.length === 0) return '';
  
  return comments.map(comment => {
    const user = comment.user?.username || comment.user?.displayName || 'Unknown';
    const message = comment.message || '';
    const time = comment.createdAt ? formatDate(comment.createdAt) : '';
    
    return `[${user}] ${message}${time ? ' (' + time + ')' : ''}`;
  }).join(' | ');
}

/**
 * Format date - API returns timestamp in milliseconds
 * Example: 1770333031377 -> 06/02/2026 16:30:31
 */
function formatDate(dateStr) {
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
    } else {
      console.log(`⚠️ Unknown date type: ${typeof dateStr}`);
      return '';
    }
    
    // Validate date
    if (!date || isNaN(date.getTime())) {
      console.log(`⚠️ Invalid date: ${JSON.stringify(dateStr)}`);
      return '';
    }
    
    // Format: dd/mm/yyyy hh:mm:ss
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    
  } catch (err) { 
    console.log(`⚠️ Error formatting date: ${JSON.stringify(dateStr)} - ${err.toString()}`);
    return ''; 
  }
}

/**
 * Escape CSV value (xử lý dấu phẩy và quotes)
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Nếu có dấu phẩy, quotes, hoặc xuống dòng thì bọc trong quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// API FETCH FUNCTIONS
// ========================================

/**
 * Fetch tickets từ API với retry logic
 */
async function fetchTicketsPage(page, startDate, endDate) {
  const variables = {
    payload: {
      pageIndex: page,
      itemsPerPage: RECORDS_PER_PAGE,
      assignee_in: [],
      centreId_in: CENTRE_IDS,
      feedbackTopic_in: [],
      status_in: [],
      channel_in: [],
      filter_textSearch: "",
      deadline_gte: "",
      deadline_lte: "",
      createdAt_gte: startDate,
      createdAt_lte: endDate
    }
  };
  
  const payload = {
    operationName: 'FindTicketPaginate',
    variables: variables,
    query: TICKETS_QUERY
  };
  
  const options = {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'authorization': AUTH_TOKEN,
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'content-language': 'vi',
      'origin': 'https://lms.mindx.edu.vn',
      'referer': 'https://lms.mindx.edu.vn/'
    },
    body: JSON.stringify(payload)
  };
  
  let attempts = 0;
  let lastError;
  
  while (attempts < MAX_RETRIES) {
    try {
      if (attempts > 0) {
        console.log(`🔄 Thử lại lần ${attempts}... (Page ${page + 1})`);
        await sleep(1000 * Math.pow(2, attempts));
      }
      
      const response = await fetch(API_URL, options);
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error('GraphQL Error: ' + JSON.stringify(result.errors));
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Lỗi fetch (Attempt ${attempts + 1}): ${error.message}`);
      attempts++;
    }
  }
  
  throw lastError;
}

/**
 * Fetch tất cả tickets với phân trang
 */
async function fetchAllTickets(startDate, endDate) {
  let allData = [];
  let page = 0;
  let hasMore = true;
  
  console.log(`📆 Đang lấy tickets...`);
  
  do {
    console.log(`📥 Đang tải trang ${page + 1}... (Đã lấy: ${allData.length})`);
    
    let result;
    try {
      result = await fetchTicketsPage(page, startDate, endDate);
    } catch (error) {
      console.log(`⚠️ Bỏ qua trang ${page + 1} do lỗi: ${error.message}`);
      break;
    }
    
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
      console.log(`✅ Đã lấy đủ ${total} tickets.`);
      hasMore = false;
    }
    
    if (ticketData.length < RECORDS_PER_PAGE) {
      hasMore = false;
    }
    
    page++;
    await sleep(1000);
    
  } while (hasMore);
  
  return allData;
}

// ========================================
// CSV EXPORT FUNCTIONS
// ========================================

/**
 * Convert tickets data sang CSV format
 */
function convertTicketsToCSV(tickets) {
  const rows = [];
  
  // Header với BOM để Excel hiển thị đúng tiếng Việt
  const headers = [
    'Ticket Code',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Topic',
    'Assignee Username',
    'Assignee Email',
    'Centre',
    'Student Name',
    'Student ID',
    'Class Name',
    'Channel',
    'Created At',
    'Closed At',
    'Deadline',
    'Customer ID',
    'Product User ID',
    'Comments Count',
    'Comments Detail'
  ];
  
  rows.push(headers.join(','));
  
  // Data rows
  tickets.forEach((ticket, index) => {
    // Debug: Log first ticket to see FULL raw data
    if (index === 0) {
      console.log('\n🔍 FULL RAW TICKET OBJECT (first ticket):');
      console.log(JSON.stringify(ticket, null, 2));
      console.log('\n');
    }
    
    const row = [
      escapeCSV(ticket.ticketCode || ''),
      escapeCSV(ticket.title || ''),
      escapeCSV(ticket.description || ''),
      escapeCSV(ticket.status || ''),
      escapeCSV(ticket.priority || ''),
      escapeCSV(ticket.feedbackTopic || ''),
      escapeCSV(ticket.assignee?.username || ''),
      escapeCSV(ticket.assignee?.email || ''),
      escapeCSV(ticket.ticketSource?.centre?.shortName || ''),
      escapeCSV(ticket.ticketSource?.studentName || ''),
      escapeCSV(ticket.ticketSource?.studentId || ''),
      escapeCSV(ticket.ticketSource?.className || ''),
      escapeCSV(ticket.ticketSource?.channel || ''),
      escapeCSV(formatDate(ticket.createdAt)),
      escapeCSV(formatDate(ticket.closedDate)),
      escapeCSV(formatDate(ticket.deadline)),
      escapeCSV(ticket.customerId || ''),
      escapeCSV(ticket.productUserId || ''),
      escapeCSV(ticket.comments?.length || 0),
      escapeCSV(formatComments(ticket.comments || []))
    ];
    
    rows.push(row.join(','));
  });
  
  // Add BOM for Excel UTF-8 support
  return '\uFEFF' + rows.join('\n');
}

/**
 * Lưu CSV ra file
 */
function saveCSV(csvContent, filename) {
  try {
    fs.writeFileSync(filename, csvContent, 'utf-8');
    console.log(`✅ Đã lưu file: ${filename}`);
  } catch (error) {
    console.error(`❌ Lỗi khi lưu file: ${error.message}`);
    throw error;
  }
}

// ========================================
// MAIN FUNCTION
// ========================================

async function main() {
  try {
    AUTH_TOKEN = await getToken();
    console.log('🎫 EXPORT TICKETS TO CSV');
    console.log('='.repeat(50));
    
    // 1. Tính toán khoảng thời gian tháng hiện tại
    const { startDate, endDate, month, year } = getCurrentMonthRange();
    console.log(`📅 Tháng: ${month}/${year}`);
    console.log(`📆 Từ: ${startDate}`);
    console.log(`📆 Đến: ${endDate}`);
    console.log('');
    
    // 2. Fetch tickets
    const tickets = await fetchAllTickets(startDate, endDate);
    console.log(`✅ Đã lấy được ${tickets.length} tickets`);
    console.log('');
    
    if (tickets.length === 0) {
      console.log('⚠️ Không có tickets trong tháng này.');
      return;
    }
    
    // 3. Convert sang CSV
    console.log('📝 Đang chuyển đổi sang CSV...');
    const csvContent = convertTicketsToCSV(tickets);
    
    // 4. Lưu file
    const filename = `tickets_thang_${month}_${year}.csv`;
    saveCSV(csvContent, filename);
    
    // 5. Thống kê
    console.log('');
    console.log('📊 THỐNG KÊ:');
    console.log(`   - Tổng tickets: ${tickets.length}`);
    
    // Thống kê theo status
    const statusCount = {};
    tickets.forEach(t => {
      const status = t.status || 'UNKNOWN';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    console.log('   - Theo trạng thái:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`     + ${status}: ${count}`);
    });
    
    // Thống kê theo centre
    const centreCount = {};
    tickets.forEach(t => {
      const centre = t.ticketSource?.centre?.shortName || 'UNKNOWN';
      centreCount[centre] = (centreCount[centre] || 0) + 1;
    });
    console.log('   - Theo cơ sở:');
    Object.entries(centreCount).forEach(([centre, count]) => {
      console.log(`     + ${centre}: ${count}`);
    });
    
    console.log('');
    console.log('🎉 HOÀN THÀNH!');
    console.log(`📂 File CSV: ${filename}`);
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ========================================
// RUN
// ========================================

main();
