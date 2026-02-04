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

// Chuyển đổi dữ liệu điểm danh sang CSV
function convertAttendanceToCSV(classes) {
  const rows = [];
  
  // Header
  const headers = [
    'ID lớp',
    'Tên lớp',
    'Buổi học',
    'Ngày học',
    'Giờ bắt đầu',
    'Giờ kết thúc',
    'ID học viên',
    'Tên học viên',
    'Email',
    'SĐT',
    'Trạng thái điểm danh',
    'Nhận xét',
    'Trạng thái gửi nhận xét',
    'Người tạo',
    'Thời gian tạo',
    'Người sửa',
    'Thời gian sửa'
  ];
  
  rows.push(headers.join(','));
  
  // Duyệt qua từng lớp
  classes.forEach(cls => {
    const classId = cls.id || '';
    const className = cls.name || '';
    
    // Duyệt qua từng slot (buổi học)
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotNumber = slotIndex + 1;
        const slotDate = slot.date || '';
        const startTime = slot.startTime || '';
        const endTime = slot.endTime || '';
        
        // Duyệt qua điểm danh học viên
        if (slot.studentAttendance && slot.studentAttendance.length > 0) {
          slot.studentAttendance.forEach(attendance => {
            const student = attendance.student || {};
            const row = [
              classId,
              `"${className}"`,
              slotNumber,
              slotDate,
              startTime,
              endTime,
              student.id || '',
              `"${student.fullName || ''}"`,
              student.email || '',
              student.phoneNumber || '',
              attendance.status || '',
              `"${(attendance.comment || '').replace(/"/g, '""')}"`,
              attendance.sendCommentStatus || '',
              attendance.createdBy || '',
              attendance.createdAt || '',
              attendance.lastModifiedBy || '',
              attendance.lastModifiedAt || ''
            ];
            rows.push(row.join(','));
          });
        } else {
          // Slot không có điểm danh
          const row = [
            classId,
            `"${className}"`,
            slotNumber,
            slotDate,
            startTime,
            endTime,
            '',
            '',
            '',
            '',
            'Chưa điểm danh',
            '',
            '',
            '',
            '',
            '',
            ''
          ];
          rows.push(row.join(','));
        }
      });
    }
  });
  
  return rows.join('\n');
}

// Tạo CSV chi tiết theo lớp và học viên
function convertAttendanceSummaryToCSV(classes) {
  const studentAttendanceMap = new Map();
  
  // Thu thập dữ liệu
  classes.forEach(cls => {
    const classId = cls.id;
    const className = cls.name;
    
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        if (slot.studentAttendance && slot.studentAttendance.length > 0) {
          slot.studentAttendance.forEach(attendance => {
            const student = attendance.student;
            const key = `${classId}_${student.id}`;
            
            if (!studentAttendanceMap.has(key)) {
              studentAttendanceMap.set(key, {
                classId,
                className,
                studentId: student.id,
                studentName: student.fullName,
                studentEmail: student.email,
                studentPhone: student.phoneNumber,
                totalSlots: 0,
                attended: 0,
                absent: 0,
                late: 0,
                excused: 0,
                notMarked: 0
              });
            }
            
            const record = studentAttendanceMap.get(key);
            record.totalSlots++;
            
            switch (attendance.status) {
              case 'ATTENDED':
                record.attended++;
                break;
              case 'ABSENT':
                record.absent++;
                break;
              case 'LATE_ARRIVED':
                record.late++;
                break;
              case 'EXCUSED':
                record.excused++;
                break;
              default:
                record.notMarked++;
            }
          });
        }
      });
    }
  });
  
  // Tạo CSV
  const headers = [
    'ID lớp',
    'Tên lớp',
    'ID học viên',
    'Tên học viên',
    'Email',
    'SĐT',
    'Tổng buổi',
    'Có mặt',
    'Vắng',
    'Đi muộn',
    'Có phép',
    'Chưa điểm danh',
    'Tỷ lệ đi học (%)'
  ];
  
  const rows = [headers.join(',')];
  
  studentAttendanceMap.forEach(record => {
    const attendanceRate = record.totalSlots > 0 
      ? ((record.attended + record.late) / record.totalSlots * 100).toFixed(2)
      : 0;
    
    const row = [
      record.classId,
      `"${record.className}"`,
      record.studentId,
      `"${record.studentName}"`,
      record.studentEmail,
      record.studentPhone,
      record.totalSlots,
      record.attended,
      record.absent,
      record.late,
      record.excused,
      record.notMarked,
      attendanceRate
    ];
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

// Xuất điểm danh giáo viên
function convertTeacherAttendanceToCSV(classes) {
  const rows = [];
  
  const headers = [
    'ID lớp',
    'Tên lớp',
    'Buổi học',
    'Ngày học',
    'Giờ bắt đầu',
    'Giờ kết thúc',
    'ID giáo viên',
    'Tên giáo viên',
    'Email',
    'SĐT',
    'Vai trò',
    'Trạng thái điểm danh',
    'Ghi chú',
    'Người tạo',
    'Thời gian tạo'
  ];
  
  rows.push(headers.join(','));
  
  classes.forEach(cls => {
    const classId = cls.id || '';
    const className = cls.name || '';
    
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotNumber = slotIndex + 1;
        const slotDate = slot.date || '';
        const startTime = slot.startTime || '';
        const endTime = slot.endTime || '';
        
        if (slot.teacherAttendance && slot.teacherAttendance.length > 0) {
          slot.teacherAttendance.forEach(attendance => {
            const teacher = attendance.teacher || {};
            const row = [
              classId,
              `"${className}"`,
              slotNumber,
              slotDate,
              startTime,
              endTime,
              teacher.id || '',
              `"${teacher.fullName || ''}"`,
              teacher.email || '',
              teacher.phoneNumber || '',
              '', // Vai trò - cần lấy từ slot.teachers
              attendance.status || '',
              `"${(attendance.note || '').replace(/"/g, '""')}"`,
              attendance.createdBy || '',
              attendance.createdAt || ''
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
  console.log('🚀 Bắt đầu xuất dữ liệu điểm danh...\n');
  
  const classes = loadClassesData();
  console.log(`✓ Đã tải ${classes.length} lớp học`);
  
  // 1. Xuất điểm danh chi tiết học viên
  const studentAttendanceCSV = convertAttendanceToCSV(classes);
  fs.writeFileSync('student_attendance_detail.csv', studentAttendanceCSV, 'utf-8');
  console.log('✓ Đã xuất điểm danh chi tiết học viên: student_attendance_detail.csv');
  
  // 2. Xuất tổng hợp điểm danh học viên
  const summaryCSV = convertAttendanceSummaryToCSV(classes);
  fs.writeFileSync('student_attendance_summary.csv', summaryCSV, 'utf-8');
  console.log('✓ Đã xuất tổng hợp điểm danh học viên: student_attendance_summary.csv');
  
  // 3. Xuất điểm danh giáo viên
  const teacherAttendanceCSV = convertTeacherAttendanceToCSV(classes);
  fs.writeFileSync('teacher_attendance.csv', teacherAttendanceCSV, 'utf-8');
  console.log('✓ Đã xuất điểm danh giáo viên: teacher_attendance.csv');
  
  console.log('\n📊 Hoàn thành! Các file đã được tạo:');
  console.log('   - student_attendance_detail.csv: Điểm danh chi tiết từng buổi');
  console.log('   - student_attendance_summary.csv: Tổng hợp điểm danh theo học viên');
  console.log('   - teacher_attendance.csv: Điểm danh giáo viên');
}

main();
