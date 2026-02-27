const fs = require('fs');
require('dotenv').config();
const { getToken } = require('./getToken');

// Cấu hình API
const API_URL = 'https://lms-api.mindx.vn/';
let AUTH_TOKEN; // Sẽ được lấy tự động bằng getToken() trong main()

// GraphQL query
const query = `query FindTeacherComplianceRecords($payload: TeacherComplianceRecordQueryPayload!) {
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

// Variables cho query
const variables = {
  payload: {
    filters: {},  // Bỏ filter, lấy tất cả rồi filter sau
    pagination: {
      page: 0,
      limit: 100  // Tăng lên 100 để fetch nhanh hơn
    }
  }
};

// Năm 2026 timestamps để filter ở client side
const YEAR_2026_START = new Date('2026-01-01T00:00:00Z').getTime();
const YEAR_2026_END = new Date('2026-12-31T23:59:59Z').getTime();

// Hàm check xem record có thuộc năm 2026 không
function isYear2026(record) {
  const createdAt = parseInt(record.createdAt);
  return createdAt >= YEAR_2026_START && createdAt <= YEAR_2026_END;
}

// Hàm fetch dữ liệu từ API (1 trang)
async function fetchDataPage(page) {
  try {
    const pageVariables = {
      ...variables,
      payload: {
        ...variables.payload,
        pagination: {
          ...variables.payload.pagination,
          page: page
        }
      }
    };
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'vi,en;q=0.9',
        'authorization': AUTH_TOKEN,
        'cache-control': 'no-cache',
        'content-language': 'vi',
        'content-type': 'application/json',
        'origin': 'https://lms.mindx.edu.vn',
        'pragma': 'no-cache',
        'referer': 'https://lms.mindx.edu.vn/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        operationName: 'FindTeacherComplianceRecords',
        variables: pageVariables,
        query: query
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('❌ Lỗi GraphQL:', JSON.stringify(result.errors, null, 2));
      throw new Error('GraphQL query failed');
    }

    return result.data.findTeacherComplianceRecords;
  } catch (error) {
    console.error('❌ Lỗi khi lấy dữ liệu:', error.message);
    throw error;
  }
}

// Hàm fetch TẤT CẢ dữ liệu với pagination và filter năm 2026
async function fetchAllTeacherComplianceData() {
  try {
    console.log('🔄 Đang lấy TOÀN BỘ dữ liệu Teacher Compliance...');
    console.log(`📅 Sẽ filter dữ liệu năm 2026: 01/01/2026 - 31/12/2026\n`);
    
    let allRecords = [];
    let records2026 = [];
    let page = 0;
    let totalRecords = 0;
    
    // Fetch trang đầu tiên để biết tổng số
    const firstPage = await fetchDataPage(page);
    totalRecords = firstPage.total;
    allRecords = allRecords.concat(firstPage.data);
    
    // Filter records năm 2026
    const filtered = firstPage.data.filter(isYear2026);
    records2026 = records2026.concat(filtered);
    
    console.log(`📊 Tổng số bản ghi: ${totalRecords}`);
    console.log(`✅ Trang ${page + 1}: ${firstPage.data.length} bản ghi, ${filtered.length} thuộc năm 2026 (Tổng 2026: ${records2026.length})`);
    
    // Fetch các trang còn lại
    page++;
    while (allRecords.length < totalRecords) {
      const pageData = await fetchDataPage(page);
      
      if (pageData.data.length === 0) {
        break; // Hết dữ liệu
      }
      
      allRecords = allRecords.concat(pageData.data);
      
      // Filter năm 2026
      const filtered2026 = pageData.data.filter(isYear2026);
      records2026 = records2026.concat(filtered2026);
      
      console.log(`✅ Trang ${page + 1}: ${pageData.data.length} bản ghi, ${filtered2026.length} thuộc năm 2026 (Tổng 2026: ${records2026.length}/${allRecords.length})`);
      
      page++;
      
      // Delay nhỏ để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`\n🎉 Hoàn thành!`);
    console.log(`   - Tổng số bản ghi: ${allRecords.length}`);
    console.log(`   - Bản ghi năm 2026: ${records2026.length}\n`);
    
    return {
      total: records2026.length,
      totalAll: allRecords.length,
      data: records2026,
      year: 2026,
      fetchedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Lỗi khi fetch all data:', error.message);
    throw error;
  }
}

// Hàm lưu dữ liệu ra file JSON
function saveToJSON(data, filename) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Đã lưu dữ liệu vào file: ${filename}`);
  } catch (error) {
    console.error('❌ Lỗi khi lưu file JSON:', error.message);
    throw error;
  }
}

// Hàm chuyển đổi dữ liệu sang CSV
function convertToCSV(records) {
  if (!records || records.length === 0) return '';

  // Headers
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
    'Last Modified By'
  ];

  // Data rows
  const rows = records.map(record => [
    record.id,
    record.teacherId,
    record.teacher?.fullName || '',
    record.class?.className || '',
    record.violationStatus,
    record.totalCriterias,
    record.violatedCriterias,
    record.score,
    record.createdBy,
    record.createdAt,
    record.lastModifiedAt,
    record.lastModifiedBy
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape commas and quotes in cell values
      const cellStr = String(cell || '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');

  return csvContent;
}

// Hàm lưu dữ liệu ra file CSV
function saveToCSV(records, filename) {
  try {
    const csvContent = convertToCSV(records);
    fs.writeFileSync(filename, '\uFEFF' + csvContent, 'utf-8'); // Add BOM for Excel
    console.log(`💾 Đã lưu dữ liệu vào file: ${filename}`);
  } catch (error) {
    console.error('❌ Lỗi khi lưu file CSV:', error.message);
    throw error;
  }
}

// Hàm chính
async function main() {
  try {
    AUTH_TOKEN = await getToken();
    console.log('=====================================');
    console.log('🚀 BẮT ĐẦU LẤY DỮ LIỆU TEACHER COMPLIANCE NĂM 2026');
    console.log('=====================================\n');

    // Lấy TOÀN BỘ dữ liệu từ API với pagination
    const complianceData = await fetchAllTeacherComplianceData();

    // Lưu dữ liệu dạng JSON đầy đủ
    saveToJSON(complianceData, 'teacher_compliance_2026_full.json');

    // Lưu dữ liệu dạng CSV (chỉ các thông tin chính)
    saveToCSV(complianceData.data, 'teacher_compliance_2026_records.csv');

    console.log('\n=====================================');
    console.log('✅ HOÀN THÀNH!');
    console.log('=====================================');
    console.log(`📅 Năm: 2026`);
    console.log(`📊 Tổng số bản ghi: ${complianceData.total}`);
    console.log(`📥 Đã lấy: ${complianceData.data.length} bản ghi`);
    console.log(`📁 File JSON: teacher_compliance_2026_full.json`);
    console.log(`📁 File CSV: teacher_compliance_2026_records.csv`);

  } catch (error) {
    console.error('\n❌ Có lỗi xảy ra:', error.message);
    process.exit(1);
  }
}

// Chạy chương trình
main();
