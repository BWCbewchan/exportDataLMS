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

// Lấy tất cả các tuần trong tháng hiện tại
function getMonthWeeks() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Ngày đầu tháng
  const firstDay = new Date(year, month, 1);
  // Ngày cuối tháng
  const lastDay = new Date(year, month + 1, 0);
  
  // Tìm thứ 2 đầu tiên (có thể từ tháng trước)
  const firstMonday = new Date(firstDay);
  const dayOfWeek = firstDay.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  firstMonday.setDate(firstDay.getDate() + diff);
  firstMonday.setHours(0, 0, 0, 0);
  
  const weeks = [];
  let currentMonday = new Date(firstMonday);
  
  // Lấy tất cả các tuần cho đến hết tháng
  while (currentMonday <= lastDay || currentMonday.getMonth() === month) {
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentMonday);
      date.setDate(currentMonday.getDate() + i);
      weekDates.push(date);
    }
    
    // Chỉ thêm tuần nếu có ít nhất 1 ngày trong tháng
    const hasDateInMonth = weekDates.some(d => d.getMonth() === month);
    if (hasDateInMonth) {
      weeks.push({
        start: new Date(weekDates[0]),
        end: new Date(weekDates[6]),
        dates: weekDates
      });
    }
    
    // Chuyển sang thứ 2 tuần sau
    currentMonday.setDate(currentMonday.getDate() + 7);
    
    // Dừng nếu đã qua tháng
    if (currentMonday.getMonth() > month && currentMonday.getFullYear() === year) break;
    if (currentMonday.getFullYear() > year) break;
  }
  
  return weeks;
}

// Format ngày
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Kiểm tra 2 ngày có cùng ngày không
function isSameDate(date1, date2) {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}

// Tạo dữ liệu calendar cho một tuần
function generateWeekCalendar(classes, weekDates) {
  const weekDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  
  // Thu thập tất cả cơ sở và giáo viên
  const centres = new Set();
  const teachers = new Set();
  
  classes.forEach(cls => {
    if (cls.centre?.name) {
      centres.add(cls.centre.name);
    }
    cls.teachers?.forEach(t => {
      if (t.teacher?.fullName) {
        teachers.add(t.teacher.fullName);
      }
    });
  });
  
  // Tạo cấu trúc dữ liệu calendar
  const calendar = {
    weekStart: formatDate(weekDates[0]),
    weekEnd: formatDate(weekDates[6]),
    centres: Array.from(centres).sort(),
    teachers: Array.from(teachers).sort(),
    days: weekDays.map((dayName, dayIndex) => ({
      dayName,
      date: formatDate(weekDates[dayIndex]),
      classes: []
    }))
  };
  
  // Thêm các lớp học vào từng ngày
  classes.forEach(cls => {
    const className = cls.name || '';
    const centreName = cls.centre?.name || 'Chưa xác định';
    const totalStudents = cls.students?.length || 0;
    const teachers = cls.teachers?.map(t => t.teacher?.fullName).filter(Boolean).join(', ') || '';
    
    // Xác định loại lớp
    let classType = 'other';
    if (className.toLowerCase().includes('-rob-')) {
      classType = 'robotics';
    } else if (className.toLowerCase().includes('-kind-')) {
      classType = 'kindergarten';
    }
    
    if (cls.slots && cls.slots.length > 0) {
      cls.slots.forEach((slot, slotIndex) => {
        const slotDate = new Date(slot.date);
        
        // Parse và format startTime và endTime
        let startTime = '';
        let endTime = '';
        
        if (slot.startTime) {
          const startDateTime = new Date(slot.startTime);
          startTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`;
        }
        
        if (slot.endTime) {
          const endDateTime = new Date(slot.endTime);
          endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
        }
        
        // Kiểm tra slot có trong tuần không
        weekDates.forEach((weekDate, dayIndex) => {
          if (isSameDate(slotDate, weekDate)) {
            calendar.days[dayIndex].classes.push({
              className,
              centre: centreName,
              session: slotIndex + 1,
              totalSessions: cls.numberOfSessions || cls.slots.length,
              startTime: startTime,
              endTime: endTime,
              teachers,
              studentCount: totalStudents,
              summary: slot.summary || '',
              homework: slot.homework || '',
              classType: classType
            });
          }
        });
      });
    }
  });
  
  // Sắp xếp các lớp theo thời gian
  calendar.days.forEach(day => {
    day.classes.sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
  });
  
  return calendar;
}

// Tạo HTML
function generateHTML(allWeeksData, currentWeekIndex) {
  const calendarData = allWeeksData[currentWeekIndex];
  const totalWeeks = allWeeksData.length;
  
  return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lịch học Robotics - Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .week-navigation {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            padding: 15px;
            background: #f0f0f0;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .week-navigation button {
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .week-navigation button:hover:not(:disabled) {
            background: #764ba2;
            transform: translateY(-2px);
        }
        
        .week-navigation button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .week-navigation span {
            font-weight: 600;
            font-size: 1.1em;
        }
        
        .controls {
            padding: 20px 30px;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .controls label {
            font-weight: 600;
            color: #495057;
        }
        
        .controls select, .controls input {
            padding: 10px 15px;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            font-size: 1em;
            background: white;
            transition: all 0.3s;
        }
        
        .controls input {
            min-width: 250px;
        }
        
        .controls select:hover, .controls input:focus {
            border-color: #667eea;
        }
        
        .controls select:focus, .controls input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .filter-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .stats {
            padding: 15px 30px;
            background: #e7f3ff;
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .stat-item strong {
            color: #667eea;
        }
        
        .calendar-wrapper {
            padding: 20px;
        }
        
        .calendar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .day-column {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        
        .day-column:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }
        
        .day-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: center;
            font-weight: 600;
        }
        
        .day-header .day-name {
            font-size: 1.1em;
            margin-bottom: 5px;
        }
        
        .day-header .day-date {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .day-content {
            padding: 15px;
            max-height: 700px;
            overflow-y: auto;
        }
        
        .day-content::-webkit-scrollbar {
            width: 6px;
        }
        
        .day-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }
        
        .day-content::-webkit-scrollbar-thumb {
            background: #667eea;
            border-radius: 10px;
        }
        
        .day-content::-webkit-scrollbar-thumb:hover {
            background: #764ba2;
        }
        
        .class-card {
            color: white;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            border-left: 4px solid rgba(255,255,255,0.5);
        }
        
        .class-card.robotics {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .class-card.kindergarten {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .class-card.other {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        
        .class-card:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        
        .class-card:last-child {
            margin-bottom: 0;
        }
        
        .class-type-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.65em;
            font-weight: 700;
            background: rgba(255,255,255,0.3);
            margin-bottom: 4px;
        }
        
        .class-name {
            font-weight: 700;
            font-size: 0.95em;
            margin-bottom: 6px;
            line-height: 1.3;
        }
        
        .class-time {
            font-size: 0.85em;
            opacity: 0.95;
            margin-bottom: 6px;
        }
        
        .class-session {
            background: rgba(255,255,255,0.3);
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 0.75em;
            display: inline-block;
            margin-bottom: 6px;
        }
        
        .class-students {
            font-size: 0.8em;
            opacity: 0.95;
            margin-bottom: 4px;
        }
        
        .class-teacher {
            font-size: 0.75em;
            opacity: 0.9;
            font-style: italic;
            margin-bottom: 6px;
        }
        
        .class-centre {
            background: rgba(255,255,255,0.3);
            padding: 3px 8px;
            border-radius: 8px;
            font-size: 0.7em;
            display: inline-block;
        }
        
        .empty-day {
            text-align: center;
            color: #999;
            padding: 40px 20px;
            font-style: italic;
        }
        
        .hidden {
            display: none !important;
        }
        
        @media (max-width: 768px) {
            .calendar {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 1.8em;
            }
            
            .controls {
                flex-direction: column;
                align-items: stretch;
            }
            
            .controls input {
                min-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Lịch Học Robotics</h1>
            <p>Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}</p>
        </div>
        
        <div class="week-navigation">
            <button id="prevWeek" onclick="changeWeek(-1)">⬅️ Tuần trước</button>
            <span id="weekInfo">Tuần ${currentWeekIndex + 1}/${totalWeeks}: ${calendarData.weekStart} - ${calendarData.weekEnd}</span>
            <button id="nextWeek" onclick="changeWeek(1)">Tuần sau ➡️</button>
        </div>
        
        <div class="controls">
            <div class="filter-group">
                <label for="centreFilter">🏢 Cơ sở:</label>
                <select id="centreFilter" onchange="applyFilters()">
                    <option value="all">Tất cả cơ sở</option>
                    ${calendarData.centres.map(centre => `<option value="${centre}">${centre}</option>`).join('')}
                </select>
            </div>
            
            <div class="filter-group">
                <label for="classTypeFilter">📚 Loại lớp:</label>
                <select id="classTypeFilter" onchange="applyFilters()">
                    <option value="all">Tất cả</option>
                    <option value="robotics">Robotics (-rob-)</option>
                    <option value="kindergarten">Kindergarten (-kind-)</option>
                    <option value="other">Khác</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label for="teacherSearch">👨‍🏫 Tìm giáo viên:</label>
                <input type="text" id="teacherSearch" placeholder="Gõ tên giáo viên..." oninput="applyFilters()">
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-item">
                <strong>📚 Tổng số buổi học trong tuần:</strong>
                <span id="totalClasses">0</span>
            </div>
            <div class="stat-item">
                <strong>👁️ Đang hiển thị:</strong>
                <span id="displayedClasses">0</span>
            </div>
        </div>
        
        <div class="calendar-wrapper">
            <div class="calendar">
                ${calendarData.days.map((day, index) => `
                    <div class="day-column">
                        <div class="day-header">
                            <div class="day-name">${day.dayName}</div>
                            <div class="day-date">${day.date}</div>
                        </div>
                        <div class="day-content" id="day-${index}">
                            ${day.classes.length === 0 ? '<div class="empty-day">Không có lớp học</div>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    
    <script>
        const allWeeksData = ${JSON.stringify(allWeeksData)};
        let currentWeekIndex = ${currentWeekIndex};
        let calendarData = allWeeksData[currentWeekIndex];
        
        function renderClasses() {
            calendarData.days.forEach((day, dayIndex) => {
                const dayContent = document.getElementById('day-' + dayIndex);
                const classes = day.classes;
                
                if (classes.length > 0) {
                    dayContent.innerHTML = '';
                }
                
                classes.forEach((cls) => {
                    const card = document.createElement('div');
                    card.className = 'class-card ' + cls.classType;
                    card.setAttribute('data-centre', cls.centre);
                    card.setAttribute('data-teachers', cls.teachers.toLowerCase());
                    card.setAttribute('data-classtype', cls.classType);
                    
                    let typeName = 'Khác';
                    if (cls.classType === 'robotics') typeName = 'ROB';
                    if (cls.classType === 'kindergarten') typeName = 'KIND';
                    
                    let content = '<span class="class-type-badge">' + typeName + '</span>';
                    content += '<div class="class-name">' + cls.className + '</div>';
                    content += '<div class="class-time">⏰ ' + cls.startTime + ' - ' + cls.endTime + '</div>';
                    content += '<div><span class="class-session">Buổi ' + cls.session + '/' + cls.totalSessions + '</span></div>';
                    content += '<div class="class-students">👥 ' + cls.studentCount + ' học sinh</div>';
                    content += '<div class="class-teacher">👨‍🏫 ' + (cls.teachers || 'Chưa có GV') + '</div>';
                    content += '<div><span class="class-centre">📍 ' + cls.centre + '</span></div>';
                    
                    card.innerHTML = content;
                    dayContent.appendChild(card);
                });
            });
            
            updateStats();
        }
        
        function changeWeek(direction) {
            const newIndex = currentWeekIndex + direction;
            if (newIndex < 0 || newIndex >= allWeeksData.length) return;
            
            currentWeekIndex = newIndex;
            calendarData = allWeeksData[currentWeekIndex];
            
            document.getElementById('weekInfo').textContent = 
                'Tuần ' + (currentWeekIndex + 1) + '/' + allWeeksData.length + ': ' + 
                calendarData.weekStart + ' - ' + calendarData.weekEnd;
            
            document.getElementById('prevWeek').disabled = currentWeekIndex === 0;
            document.getElementById('nextWeek').disabled = currentWeekIndex === allWeeksData.length - 1;
            
            renderClasses();
            applyFilters();
        }
        
        function applyFilters() {
            const selectedCentre = document.getElementById('centreFilter').value;
            const selectedClassType = document.getElementById('classTypeFilter').value;
            const teacherSearch = document.getElementById('teacherSearch').value.toLowerCase().trim();
            const allCards = document.querySelectorAll('.class-card');
            let displayedCount = 0;
            
            allCards.forEach(card => {
                const cardCentre = card.getAttribute('data-centre');
                const cardTeachers = card.getAttribute('data-teachers');
                const cardClassType = card.getAttribute('data-classtype');
                
                let show = true;
                
                // Lọc theo cơ sở
                if (selectedCentre !== 'all' && cardCentre !== selectedCentre) {
                    show = false;
                }
                
                // Lọc theo loại lớp
                if (selectedClassType !== 'all' && cardClassType !== selectedClassType) {
                    show = false;
                }
                
                // Lọc theo giáo viên - chỉ filter khi có text
                if (teacherSearch.length > 0 && !cardTeachers.includes(teacherSearch)) {
                    show = false;
                }
                
                if (show) {
                    card.classList.remove('hidden');
                    card.style.display = '';
                    displayedCount++;
                } else {
                    card.classList.add('hidden');
                    card.style.display = 'none';
                }
            });
            
            document.getElementById('displayedClasses').textContent = displayedCount;
            
            // Cập nhật trạng thái empty cho mỗi ngày
            calendarData.days.forEach((day, dayIndex) => {
                const dayContent = document.getElementById('day-' + dayIndex);
                const visibleCards = dayContent.querySelectorAll('.class-card:not(.hidden)');
                const emptyDay = dayContent.querySelector('.empty-day');
                
                if (visibleCards.length === 0) {
                    if (!emptyDay) {
                        const emptyDiv = document.createElement('div');
                        emptyDiv.className = 'empty-day';
                        emptyDiv.textContent = 'Không có lớp học';
                        dayContent.appendChild(emptyDiv);
                    }
                } else {
                    if (emptyDay) {
                        emptyDay.remove();
                    }
                }
            });
        }
        
        function updateStats() {
            let totalClasses = 0;
            calendarData.days.forEach(day => {
                totalClasses += day.classes.length;
            });
            document.getElementById('totalClasses').textContent = totalClasses;
            document.getElementById('displayedClasses').textContent = totalClasses;
        }
        
        renderClasses();
        document.getElementById('prevWeek').disabled = currentWeekIndex === 0;
        document.getElementById('nextWeek').disabled = currentWeekIndex === allWeeksData.length - 1;
    </script>
</body>
</html>`;
}

// Hàm chính
function main() {
  console.log('🚀 Bắt đầu tạo lịch học tháng...\n');
  
  const classes = loadClassesData();
  console.log(`✓ Đã tải ${classes.length} lớp học`);
  
  const weeks = getMonthWeeks();
  console.log(`✓ Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()} có ${weeks.length} tuần`);
  
  const allWeeksData = weeks.map((week, index) => {
    const calendar = generateWeekCalendar(classes, week.dates);
    let totalSlots = 0;
    calendar.days.forEach(day => totalSlots += day.classes.length);
    console.log(`  - Tuần ${index + 1} (${formatDate(week.start)} - ${formatDate(week.end)}): ${totalSlots} buổi học`);
    return calendar;
  });
  
  const now = new Date();
  let currentWeekIndex = 0;
  weeks.forEach((week, index) => {
    if (now >= week.start && now <= week.end) {
      currentWeekIndex = index;
    }
  });
  
  console.log(`✓ Tuần hiện tại: Tuần ${currentWeekIndex + 1}`);
  
  const html = generateHTML(allWeeksData, currentWeekIndex);
  const filename = 'robotics_week_calendar.html';
  fs.writeFileSync(filename, html, 'utf-8');
  
  console.log(`\n✅ Đã tạo file: ${filename}`);
  console.log('\n📝 Tính năng:');
  console.log('   ✓ Hiển thị lịch cả tháng với điều hướng tuần');
  console.log('   ✓ Tìm kiếm theo giáo viên (realtime)');
  console.log('   ✓ Lọc theo cơ sở và loại lớp');
  console.log('   ✓ Phân biệt rõ lớp Robotics (-rob-) và Kindergarten (-kind-)');
  console.log('   ✓ Giao diện thân thiện, dễ đọc');
  console.log('\n💡 Mở file trong trình duyệt để xem!');
}

main();
