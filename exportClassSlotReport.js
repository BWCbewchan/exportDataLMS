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

// Xuất điểm danh theo lớp, buổi học và số lượng học sinh
function exportClassSlotAttendance(classes) {
  const rows = [];
  
  // Header
  const headers = [
    'ID lớp',
    'Tên lớp',
    'Trung tâm',
    'Khóa học',
    'Buổi thứ',
    'Ngày học',
    'Thời gian bắt đầu',
    'Thời gian kết thúc',
    'Tổng học sinh trong lớp',
    'Số HS đã điểm danh',
    'Số HS có mặt',
    'Số HS vắng',
    'Số HS đi muộn',
    'Số HS có phép',
    'Số HS chưa điểm danh',
    'Tỷ lệ có mặt (%)',
    'Giáo viên',
    'Trạng thái điểm danh GV',
    'Tóm tắt buổi học',
    'Bài tập về nhà'
  ];
  
  rows.push(headers.join(','));
  
  // Duyệt qua từng lớp
  classes.forEach(cls => {
    const classId = cls.id || '';
    const className = cls.name || '';
    const centre = cls.centre?.name || '';
    const course = cls.course?.name || '';
    const totalStudentsInClass = cls.students?.length || 0;
    
    // Duyệt qua từng slot (buổi học)
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotNumber = slotIndex + 1;
        const slotDate = slot.date || '';
        const startTime = slot.startTime || '';
        const endTime = slot.endTime || '';
        const summary = slot.summary || '';
        const homework = slot.homework || '';
        
        // Thống kê điểm danh học sinh
        let totalMarked = 0;
        let attended = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;
        let notMarked = 0;
        
        if (slot.studentAttendance && slot.studentAttendance.length > 0) {
          totalMarked = slot.studentAttendance.length;
          
          slot.studentAttendance.forEach(attendance => {
            switch (attendance.status) {
              case 'ATTENDED':
                attended++;
                break;
              case 'ABSENT':
                absent++;
                break;
              case 'LATE_ARRIVED':
                late++;
                break;
              case 'EXCUSED':
                excused++;
                break;
              default:
                notMarked++;
            }
          });
        }
        
        // Số học sinh chưa điểm danh = tổng HS - số đã điểm danh
        notMarked = totalStudentsInClass - totalMarked;
        
        // Tỷ lệ có mặt
        const attendanceRate = totalMarked > 0 
          ? ((attended + late) / totalMarked * 100).toFixed(2)
          : 0;
        
        // Lấy thông tin giáo viên
        const teachers = slot.teachers?.map(t => t.teacher?.fullName).filter(Boolean).join(', ') || '';
        const teacherAttendanceStatus = slot.teacherAttendance?.map(t => t.status).join(', ') || '';
        
        const row = [
          classId,
          `"${className}"`,
          `"${centre}"`,
          `"${course}"`,
          slotNumber,
          slotDate,
          startTime,
          endTime,
          totalStudentsInClass,
          totalMarked,
          attended,
          absent,
          late,
          excused,
          notMarked,
          attendanceRate,
          `"${teachers}"`,
          teacherAttendanceStatus,
          `"${summary.replace(/"/g, '""')}"`,
          `"${homework.replace(/"/g, '""')}"`
        ];
        
        rows.push(row.join(','));
      });
    } else {
      // Lớp chưa có buổi học nào
      const row = [
        classId,
        `"${className}"`,
        `"${centre}"`,
        `"${course}"`,
        0,
        '',
        '',
        '',
        totalStudentsInClass,
        0,
        0,
        0,
        0,
        0,
        totalStudentsInClass,
        0,
        '',
        '',
        'Chưa có lịch học',
        ''
      ];
      rows.push(row.join(','));
    }
  });
  
  return rows.join('\n');
}

// Xuất danh sách học sinh từng lớp với điểm danh chi tiết
function exportStudentsByClass(classes) {
  const rows = [];
  
  const headers = [
    'ID lớp',
    'Tên lớp',
    'Trung tâm',
    'Khóa học',
    'Buổi thứ',
    'Ngày học',
    'Giờ học',
    'STT',
    'ID học sinh',
    'Tên học sinh',
    'Email',
    'SĐT',
    'Giới tính',
    'Trạng thái điểm danh'
  ];
  
  rows.push(headers.join(','));
  
  classes.forEach(cls => {
    const classId = cls.id || '';
    const className = cls.name || '';
    const centre = cls.centre?.name || '';
    const course = cls.course?.name || '';
    
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotNumber = slotIndex + 1;
        const slotDate = slot.date || '';
        const timeRange = `${slot.startTime || ''} - ${slot.endTime || ''}`;
        
        if (slot.studentAttendance && slot.studentAttendance.length > 0) {
          slot.studentAttendance.forEach((attendance, idx) => {
            const student = attendance.student || {};
            const row = [
              classId,
              `"${className}"`,
              `"${centre}"`,
              `"${course}"`,
              slotNumber,
              slotDate,
              timeRange,
              idx + 1,
              student.id || '',
              `"${student.fullName || ''}"`,
              student.email || '',
              student.phoneNumber || '',
              student.gender || '',
              attendance.status || ''
            ];
            rows.push(row.join(','));
          });
        }
      });
    }
  });
  
  return rows.join('\n');
}

// Hàm chính
function main() {
  console.log('🚀 Bắt đầu xuất báo cáo điểm danh theo lớp...\n');
  
  const classes = loadClassesData();
  console.log(`✓ Đã tải ${classes.length} lớp học`);
  
  // 1. Xuất thống kê điểm danh theo buổi học
  const slotAttendanceCSV = exportClassSlotAttendance(classes);
  fs.writeFileSync('class_slot_attendance_report.csv', slotAttendanceCSV, 'utf-8');
  console.log('✓ Đã xuất báo cáo điểm danh theo buổi: class_slot_attendance_report.csv');
  
  // 2. Xuất danh sách học sinh từng buổi
  const studentsByClassCSV = exportStudentsByClass(classes);
  fs.writeFileSync('students_by_slot_detail.csv', studentsByClassCSV, 'utf-8');
  console.log('✓ Đã xuất danh sách học sinh theo buổi: students_by_slot_detail.csv');
  
  console.log('\n📊 Hoàn thành! Các file đã được tạo:');
  console.log('   - class_slot_attendance_report.csv: Thống kê điểm danh từng buổi học');
  console.log('   - students_by_slot_detail.csv: Danh sách học sinh từng buổi với điểm danh');
}

main();
