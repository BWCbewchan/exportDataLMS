const fs = require('fs');

/**
 * Export danh sách học viên nghỉ >= 2 buổi
 * Đọc dữ liệu từ robotics_classes_full.json và tổng hợp số buổi vắng
 */

// Đọc dữ liệu từ file JSON
function loadClassesData() {
  try {
    const data = fs.readFileSync('robotics_classes_full.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Lỗi khi đọc file robotics_classes_full.json:', error.message);
    console.log('💡 Hãy chạy fetchData.js trước để lấy dữ liệu lớp học');
    process.exit(1);
  }
}

/**
 * Tổng hợp số buổi vắng của từng học viên trong từng lớp
 */
function analyzeStudentAbsence(classes) {
  const result = [];
  
  classes.forEach(cls => {
    const classId = cls.id || '';
    const className = cls.name || '';
    const centre = cls.centre?.name || '';
    const course = cls.course?.name || '';
    const totalSlots = cls.slots?.length || 0;
    
    // Map để lưu thông tin vắng của từng học viên
    const studentAbsenceMap = new Map();
    
    // Duyệt qua từng slot để tổng hợp
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotNumber = slotIndex + 1;
        const slotDate = slot.date || '';
        
        // Kiểm tra điểm danh
        if (slot.studentAttendance && slot.studentAttendance.length > 0) {
          slot.studentAttendance.forEach(attendance => {
            const student = attendance.student || {};
            const studentId = student.id || '';
            const studentName = student.fullName || '';
            const status = attendance.status || '';
            
            // Chỉ quan tâm học viên VẮNG
            if (status === 'ABSENT') {
              if (!studentAbsenceMap.has(studentId)) {
                studentAbsenceMap.set(studentId, {
                  id: studentId,
                  name: studentName,
                  email: student.email || '',
                  phone: student.phoneNumber || '',
                  absentCount: 0,
                  absentSlots: []
                });
              }
              
              const studentData = studentAbsenceMap.get(studentId);
              studentData.absentCount++;
              studentData.absentSlots.push({
                slotNumber,
                date: slotDate
              });
            }
          });
        }
      });
    }
    
    // Lọc ra những học viên nghỉ >= 2 buổi
    studentAbsenceMap.forEach((studentData) => {
      if (studentData.absentCount >= 2) {
        result.push({
          classId,
          className,
          centre,
          course,
          totalSlots,
          studentId: studentData.id,
          studentName: studentData.name,
          studentEmail: studentData.email,
          studentPhone: studentData.phone,
          absentCount: studentData.absentCount,
          absentSlots: studentData.absentSlots,
          absentRate: ((studentData.absentCount / totalSlots) * 100).toFixed(2)
        });
      }
    });
  });
  
  return result;
}

/**
 * Xác định mức độ nghiêm trọng
 */
function getSeverityLevel(absentCount) {
  if (absentCount >= 5) {
    return 'NGHIÊM TRỌNG';
  } else if (absentCount >= 3) {
    return 'ĐÁNG CHÚ Ý';
  } else {
    return 'CẢNH BÁO';
  }
}

/**
 * Chuyển đổi sang CSV
 */
function convertToCSV(data) {
  const rows = [];
  
  // Header
  const headers = [
    'ID lớp',
    'Tên lớp',
    'Trung tâm',
    'Khóa học',
    'Tổng số buổi',
    'ID học viên',
    'Tên học viên',
    'Email',
    'SĐT',
    'Số buổi vắng',
    'Tỷ lệ vắng (%)',
    'Danh sách buổi vắng',
    'Mức độ'
  ];
  
  rows.push(headers.join(','));
  
  // Data rows
  data.forEach(record => {
    // Format danh sách buổi vắng: "Buổi 1 (01/02/2026); Buổi 3 (15/02/2026)"
    const absentSlotsList = record.absentSlots
      .map(slot => {
        const date = slot.date ? formatDate(slot.date) : '';
        return `Buổi ${slot.slotNumber}${date ? ' (' + date + ')' : ''}`;
      })
      .join('; ');
    
    const severity = getSeverityLevel(record.absentCount);
    
    const row = [
      record.classId,
      `"${record.className}"`,
      `"${record.centre}"`,
      `"${record.course}"`,
      record.totalSlots,
      record.studentId,
      `"${record.studentName}"`,
      record.studentEmail,
      record.studentPhone,
      record.absentCount,
      record.absentRate,
      `"${absentSlotsList}"`,
      severity
    ];
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Format date từ ISO string
 */
function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
}

/**
 * Lưu file CSV
 */
function saveCSV(csvContent, filename) {
  try {
    // Add UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    fs.writeFileSync(filename, BOM + csvContent, 'utf-8');
    console.log(`✅ Đã xuất file: ${filename}`);
  } catch (error) {
    console.error('❌ Lỗi khi lưu file:', error.message);
  }
}

/**
 * Main function
 */
function main() {
  console.log('📊 BẮT ĐẦU PHÂN TÍCH HỌC VIÊN VẮNG >= 2 BUỔI\n');
  
  // Bước 1: Load dữ liệu
  console.log('📥 Đang đọc dữ liệu từ robotics_classes_full.json...');
  const classes = loadClassesData();
  console.log(`   ✓ Đã load ${classes.length} lớp học\n`);
  
  // Bước 2: Phân tích
  console.log('🔍 Đang phân tích điểm danh...');
  const studentsAbsent = analyzeStudentAbsence(classes);
  console.log(`   ✓ Tìm thấy ${studentsAbsent.length} học viên vắng >= 2 buổi\n`);
  
  // Sắp xếp theo số buổi vắng (nhiều nhất trước)
  studentsAbsent.sort((a, b) => b.absentCount - a.absentCount);
  
  // Bước 3: Convert to CSV
  console.log('📝 Đang chuyển đổi sang CSV...');
  const csvContent = convertToCSV(studentsAbsent);
  
  // Bước 4: Save file
  const filename = 'students_absent_2plus.csv';
  saveCSV(csvContent, filename);
  
  // Thống kê
  console.log('\n📈 THỐNG KÊ:');
  console.log(`   - Tổng số lớp: ${classes.length}`);
  console.log(`   - Học viên vắng >= 2 buổi: ${studentsAbsent.length}`);
  
  // Thống kê theo số buổi vắng
  const absenceDistribution = {};
  studentsAbsent.forEach(s => {
    const count = s.absentCount;
    absenceDistribution[count] = (absenceDistribution[count] || 0) + 1;
  });
  
  console.log('\n📊 PHÂN BỐ THEO SỐ BUỔI VẮNG:');
  Object.keys(absenceDistribution)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(count => {
      console.log(`   - Vắng ${count} buổi: ${absenceDistribution[count]} học viên`);
    });
  
  // Thống kê theo mức độ nghiêm trọng
  const severityStats = {
    'CẢNH BÁO': 0,
    'ĐÁNG CHÚ Ý': 0,
    'NGHIÊM TRỌNG': 0
  };
  
  studentsAbsent.forEach(s => {
    const severity = getSeverityLevel(s.absentCount);
    severityStats[severity]++;
  });
  
  console.log('\n🎨 PHÂN BỐ THEO MỨC ĐỘ:');
  console.log(`   🟡 CẢNH BÁO (2 buổi): ${severityStats['CẢNH BÁO']} học viên`);
  console.log(`   🟠 ĐÁNG CHÚ Ý (3-4 buổi): ${severityStats['ĐÁNG CHÚ Ý']} học viên`);
  console.log(`   🔴 NGHIÊM TRỌNG (5+ buổi): ${severityStats['NGHIÊM TRỌNG']} học viên`);
  
  // Top 10 học viên vắng nhiều nhất
  console.log('\n🔴 TOP 10 HỌC VIÊN VẮNG NHIỀU NHẤT:');
  const topAbsent = [...studentsAbsent]
    .sort((a, b) => b.absentCount - a.absentCount)
    .slice(0, 10);
  
  topAbsent.forEach((student, index) => {
    const severity = getSeverityLevel(student.absentCount);
    const icon = severity === 'NGHIÊM TRỌNG' ? '🔴' : 
                 severity === 'ĐÁNG CHÚ Ý' ? '🟠' : '🟡';
    
    console.log(`   ${index + 1}. ${icon} ${student.studentName} (${student.className})`);
    console.log(`      Vắng: ${student.absentCount}/${student.totalSlots} buổi (${student.absentRate}%) - ${severity}`);
  });
  
  console.log('\n✅ HOÀN THÀNH!\n');
}

// Chạy script
main();
