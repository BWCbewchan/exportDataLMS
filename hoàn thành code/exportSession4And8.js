const fs = require('fs');

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

// Format ngày sang dd/mm/yyyy
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateStr;
  }
}

// Kiểm tra ngày có trong tháng hiện tại không
function isInCurrentMonth(dateStr) {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  } catch (error) {
    return false;
  }
}

// Xuất báo cáo lớp có buổi 4 và buổi 8 trong tháng này
function exportSession4And8Report(classes) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  console.log(`\n📅 Lọc các lớp có buổi 4 HOẶC buổi 8 trong tháng ${currentMonth}/${currentYear}...\n`);
  
  const rows = [];
  const headers = [
    'Tên lớp',
    'Buổi 4',
    'Buổi 8',
    'LEC',
    'Student Count'
  ];
  
  rows.push(headers.join(','));
  
  let classCount = 0;
  
  classes.forEach(cls => {
    const className = cls.name || '';
    const totalStudents = cls.students?.length || 0;
    
    // Tìm buổi 4 và buổi 8
    let session4 = null;
    let session8 = null;
    let session4InMonth = false;
    let session8InMonth = false;
    
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, index) => {
        const sessionNumber = index + 1;
        
        if (sessionNumber === 4) {
          session4 = slot;
          if (isInCurrentMonth(slot.date)) {
            session4InMonth = true;
          }
        }
        if (sessionNumber === 8) {
          session8 = slot;
          if (isInCurrentMonth(slot.date)) {
            session8InMonth = true;
          }
        }
      });
    }
    
    // Lấy lớp có ít nhất 1 trong 2 buổi (4 hoặc 8) nằm trong tháng này
    if (session4 && session8 && (session4InMonth || session8InMonth)) {
      // Lấy tên giáo viên (LEC)
      const teachers = cls.teachers
        ?.filter(t => t.role?.shortName === 'LEC' || t.role?.name?.includes('LEC'))
        .map(t => t.teacher?.fullName)
        .filter(Boolean)
        .join(', ') || '';
      
      // Nếu không có LEC, lấy tất cả giáo viên
      const allTeachers = teachers || cls.teachers
        ?.map(t => t.teacher?.fullName)
        .filter(Boolean)
        .join(', ') || '';
      
      // Chỉ hiển thị ngày nếu buổi đó nằm trong tháng này
      const session4Date = session4InMonth ? formatDate(session4.date) : '';
      const session8Date = session8InMonth ? formatDate(session8.date) : '';
      
      const row = [
        `"${className}"`,
        session4Date,
        session8Date,
        `"${allTeachers}"`,
        totalStudents
      ];
      
      rows.push(row.join(','));
      classCount++;
      
      const s4Display = session4Date || '(ngoài tháng)';
      const s8Display = session8Date || '(ngoài tháng)';
      console.log(`✓ ${className}: Buổi 4 (${s4Display}), Buổi 8 (${s8Display})`);
    }
  });
  
  console.log(`\n📊 Tìm thấy ${classCount} lớp có ít nhất 1 trong 2 buổi (4 hoặc 8) trong tháng ${currentMonth}/${currentYear}`);
  
  return rows.join('\n');
}

// Hàm chính
function main() {
  console.log('🚀 Bắt đầu xuất báo cáo lớp có buổi 4 và buổi 8...');
  
  const classes = loadClassesData();
  console.log(`✓ Đã tải ${classes.length} lớp học`);
  
  const reportCSV = exportSession4And8Report(classes);
  const filename = 'classes_session4_and_8_this_month.csv';
  
  fs.writeFileSync(filename, reportCSV, 'utf-8');
  console.log(`\n✓ Đã xuất báo cáo: ${filename}`);
  
  console.log('\n📝 Các cột trong file:');
  console.log('   - Tên lớp');
  console.log('   - Buổi 4: Ngày học buổi 4 (dd/mm/yyyy)');
  console.log('   - Buổi 8: Ngày học buổi 8 (dd/mm/yyyy)');
  console.log('   - LEC: Giáo viên chính');
  console.log('   - Student Count: Số lượng học sinh');
}

main();
