/**
 * TEACHER LOOKUP BY LMS USERNAME
 * 
 * Tra cứu thông tin giáo viên dựa trên Username (LMS).
 * Dữ liệu lấy từ Google Sheets: danh sách nhân sự MindX.
 *
 * ─── TRIỂN KHAI ───────────────────────────────────────────────────────────────
 * 1. Mở Google Spreadsheet chứa danh sách nhân sự
 *    https://docs.google.com/spreadsheets/d/1Nd2ZQwtGMkX93YbiUJJ1zl8LjBJzSJET3sLEZDBHxWQ
 * 2. Extensions > Apps Script
 * 3. Tạo file mới "teacherLookup" → paste code này → Ctrl+S
 * 4. Deploy > New deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone (hoặc Anyone with Google account)
 * 5. Copy URL, dùng theo cú pháp:
 *    GET  ?username=maimonmen17102003          → trả JSON thông tin GV
 *    GET  ?username=xxx&format=sheet           → trả kèm tên sheet đang dùng
 *    GET  (không có username)                  → health check
 *
 * ─── CẬP NHẬT ─────────────────────────────────────────────────────────────────
 * Mỗi khi sửa code: Deploy > Manage deployments > ✏️ Edit > New version > Deploy
 */

// ==========================================
// CẤU HÌNH
// ==========================================

const TEACHER_LOOKUP_CONFIG = {
  SPREADSHEET_ID: '1Nd2ZQwtGMkX93YbiUJJ1zl8LjBJzSJET3sLEZDBHxWQ',
  SHEET_GID     : 1869664336,
  DATA_START_ROW: 4,
  USERNAME_COL  : 12,
  CACHE_SECONDS : 270,
  CACHE_VERSION : 'v6',      // bump khi đổi cấu trúc
  CHUNK_SIZE    : 85000,
  PROP_CHUNK_SZ : 8500
};

// Sheet leader (join key = cơ sở, update mỗi tháng)
const TEACHER_LEADER_CONFIG = {
  SPREADSHEET_ID: '1KSdzf8MhHSeoiWLj-y41X3nUqSQjXtvbmMoaoin9F0Y',
  SHEET_GID     : 163775659,
  DATA_START_ROW: 2,          // hàng đầu tiên có data (sau header)
  CACHE_SECONDS : 21600,      // 6 tiếng (data thay đổi 1 lần/tháng)
  CACHE_KEY_META: 'tl_ldr_meta_v2',
  CACHE_KEY_PFX : 'tl_ldr_c'
};

// Cột sheet leader (1-based) – khớp cấu trúc thực tế
// Header: Tháng | Năm | Time | BU | Area | Status | TC | TE | CL | RL | AL | TE Coding | TEGL
const LEADER_COLUMNS = {
  thang   : 1,   // "Tháng 1", "Tháng 2"...
  nam     : 2,   // năm số, VD: 2024
  time    : 3,   // "MM/YYYY"
  buCoSo  : 4,   // join key
  area    : 5,   // HCM 1, HN 2...
  status  : 6,   // Active / Deactive
  TC      : 7,
  TE      : 8,
  CL      : 9,   // Coding Content Leader
  RL      : 10,  // Robotics Content Leader
  AL      : 11,  // X-Art Content Leader
  TECoding: 12,
  TEGL    : 13
};

// Sheet bổ sung (LMS status, center, rank...)
const TEACHER_EXT_CONFIG = {
  SPREADSHEET_ID: '1KSdzf8MhHSeoiWLj-y41X3nUqSQjXtvbmMoaoin9F0Y',
  SHEET_GID     : 1671700116,
  DATA_START_ROW: 3,         // 2 dòng header
  JOIN_COL      : 16,        // cột P – "Data HR (Raw)" = maGV
  CACHE_KEY_META: 'tl_ext_meta_v5',
  CACHE_KEY_PFX : 'tl_ext_c'
};

// Cột sheet bổ sung (1-based)
const EXT_COLUMNS = {
  fullName    : 2,
  code        : 3,
  userName    : 4,
  workEmail   : 5,
  statusLms   : 8,   // Active / Deactive
  centers     : 9,
  khoiFinal   : 10,
  role        : 11,
  courseLine  : 12,
  rank        : 13,
  joinedDate  : 14,
  teacherPoint: 15,
  dataHRRaw   : 16   // join key = maGV
};

// ─── In-memory L0 cache (sống trong 1 execution context) ──────────────────────
// Apps Script tái dùng V8 context trong ~30s → hit L0 với các request liên tiếp
const _MEM = {};

// Map tên trường → chỉ số cột (1-based)
const TEACHER_COLUMNS = {
  maGV:              1,
  tinhTrang:         2,
  hoVaTen:           3,
  emailCongViec:     4,
  emailCaNhan:       5,
  boPhan:            6,
  teamPhuTrach:      7,
  maTeaching:        8,
  khuVucLamViec:     9,
  chiNhanhLamViec:   10,
  diaDiemCoSo:       11,
  usernameLms:       12,
  onboard:           13,   // D/M/Y onboard
  dOnboard:          14,
  mOnboard:          15,
  yOnboard:          16,
  offboard:          17,   // D/M/Y offboard
  dOffboard:         18,
  mOffboard:         19,
  yOffboard:         20,
  thamNien:          21,
  rateLectureK12:    22,
  rateMentorK12:     23,
  rateSuperTeacher:  24,
  rateLecture18:     25,
  rateTheoBuoi:      26,
  stkNganHang:       27,
  nganHang:          28,
  chuTaiKhoan:       29,
  chiNhanhNH:        30,
  ngaySinh:          31,
  sdtCaNhan:         32,
  gioiTinh:          33
};

// ==========================================
// ENTRY POINT – WEB APP
// ==========================================

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action   = (params.action   || '').toString().trim().toLowerCase();
  const username = (params.username || '').toString().trim().toLowerCase();

  // --- ACTION: birthday ---
  // GET ?action=birthday                     → sinh nhật tháng hiện tại (chỉ GV đang làm)
  // GET ?action=birthday&month=3             → tháng chỉ định
  // GET ?action=birthday&all=true            → bao gồm cả GV đã nghỉ
  if (action === 'birthday') {
    try {
      const month     = params.month ? parseInt(params.month) : null;
      const onlyActive = params.all !== 'true';
      const list      = getTeachersBirthdayInMonth(month, onlyActive);
      const label     = 'tháng ' + (month || (new Date().getMonth() + 1));
      return teacherJsonResponse({
        status    : 'ok',
        month     : month || (new Date().getMonth() + 1),
        total     : list.length,
        onlyActive: onlyActive,
        message   : 'Giáo viên có sinh nhật trong ' + label + (onlyActive ? ' (chỉ đang làm việc)' : ' (tất cả)'),
        data      : list
      });
    } catch (err) {
      Logger.log('❌ Birthday lookup error: ' + err.toString());
      return teacherJsonResponse({ status: 'error', message: err.toString() });
    }
  }

  // --- ACTION: list (lấy danh sách GV theo trạng thái) ---
  // GET ?action=list                          → tất cả GV đang làm việc
  // GET ?action=list&status=Đã%20nghỉ        → GV đã nghỉ
  // GET ?action=list&status=all              → tất cả không lọc
  if (action === 'list') {
    try {
      const statusFilter = params.status || 'Đang làm việc';
      const list         = getTeachersByStatus(statusFilter === 'all' ? null : statusFilter);
      return teacherJsonResponse({
        status      : 'ok',
        total       : list.length,
        statusFilter: statusFilter,
        data        : list
      });
    } catch (err) {
      Logger.log('❌ List lookup error: ' + err.toString());
      return teacherJsonResponse({ status: 'error', message: err.toString() });
    }
  }

  // --- ACTION: tra cứu theo username ---
  if (!username) {
    return teacherJsonResponse({
      status   : 'ok',
      message  : 'Teacher Lookup API đang hoạt động',
      endpoints: [
        '?username=<lms_username>              → thông tin 1 giáo viên',
        '?action=birthday                      → GV đang làm có sinh nhật tháng này',
        '?action=birthday&month=<1-12>         → GV có sinh nhật tháng chỉ định',
        '?action=birthday&all=true             → bao gồm cả GV đã nghỉ',
        '?action=list                          → danh sách GV đang làm việc',
        '?action=list&status=<trạng thái>     → lọc theo tình trạng',
        '?action=list&status=all               → tất cả GV (không lọc)'
      ],
      timestamp: new Date().toISOString()
    });
  }

  try {
    const teacher = findTeacherByUsername(username);
    if (!teacher) {
      return teacherJsonResponse({
        status : 'not_found',
        message: 'Không tìm thấy giáo viên với username: ' + username
      });
    }
    return teacherJsonResponse({ status: 'ok', data: teacher });
  } catch (err) {
    Logger.log('❌ Teacher lookup error: ' + err.toString());
    return teacherJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ==========================================
// CORE LOGIC
// ==========================================

/**
 * Tìm kiếm giáo viên theo username LMS.
 * 3-layer cache: L0 in-memory → L1 PropertiesService → L2 CacheService → L3 Sheet
 * @param {string} username đã lowercase
 * @returns {Object|null}
 */
function findTeacherByUsername(username) {
  const index = loadUsernameIndex();
  return index[username] || null;
}

/**
 * Load username→teacherObject index theo thứ tự ưu tiên cache:
 *
 *  L0 – In-memory (_MEM):        ~0ms   (sống trong 1 V8 context ~30s)
 *  L1 – PropertiesService:       ~20ms  (persistent, không expire)
 *  L2 – CacheService (chunked):  ~150ms (expire sau 4.5 phút)
 *  L3 – Google Sheets:           ~3-5s  (source of truth, rebuild tất cả cache)
 *
 * @returns {Object} { username: teacherObject, ... }
 */
function loadUsernameIndex() {
  const ver      = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  const memKey   = 'idx_' + ver;

  // ── L0: in-memory ────────────────────────────────────────────────────────
  if (_MEM[memKey]) return _MEM[memKey];

  // ── L1: PropertiesService (chunked, persistent) ───────────────────────────
  const props    = PropertiesService.getScriptProperties();
  const metaRaw  = props.getProperty('tl_idx_meta_' + ver);
  if (metaRaw) {
    try {
      const { chunks } = JSON.parse(metaRaw);
      // Đọc tất cả chunk trong 1 lần getProperties()
      const keys    = Array.from({ length: chunks }, (_, i) => 'tl_ip' + i + '_' + ver);
      const allProps = props.getProperties();
      let json = '';
      let ok   = true;
      for (const k of keys) {
        if (!allProps[k]) { ok = false; break; }
        json += allProps[k];
      }
      if (ok && json) {
        const index = JSON.parse(json);
        _MEM[memKey] = index; // promote to L0
        return index;
      }
    } catch (e) { /* corrupt → fall through */ }
  }

  // ── L2: CacheService (chunked) ────────────────────────────────────────────
  const cache    = CacheService.getScriptCache();
  const cIdxMeta = cache.get('tl_idx_cm_' + ver);
  if (cIdxMeta) {
    try {
      const { chunks } = JSON.parse(cIdxMeta);
      const keys    = Array.from({ length: chunks }, (_, i) => 'tl_ic' + i + '_' + ver);
      const allVals = cache.getAll(keys);
      let json = '';
      let ok   = true;
      for (const k of keys) {
        if (!allVals[k]) { ok = false; break; }
        json += allVals[k];
      }
      if (ok && json) {
        const index = JSON.parse(json);
        _MEM[memKey] = index;
        // Promote to L1
        _storeIndexToProps(index, ver);
        return index;
      }
    } catch (e) {}
  }

  // ── L3: rebuild từ Sheet ──────────────────────────────────────────────────
  const data           = _readSheetAndCache();
  const usernameColIdx = TEACHER_LOOKUP_CONFIG.USERNAME_COL - 1;
  const index          = {};
  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][usernameColIdx] || '').trim().toLowerCase();
    if (key) index[key] = buildTeacherObject(data[i]);
  }

  _MEM[memKey] = index;
  _storeIndexToProps(index, ver);
  _storeIndexToCache(index, ver);
  return index;
}

/**
 * Lưu index vào PropertiesService (chunked 8.5KB/property).
 * PropertiesService: tổng 500KB, 9KB/property.
 */
function _storeIndexToProps(index, ver) {
  try {
    const props   = PropertiesService.getScriptProperties();
    const json    = JSON.stringify(index);
    const sz      = TEACHER_LOOKUP_CONFIG.PROP_CHUNK_SZ;
    const chunks  = [];
    for (let i = 0; i < json.length; i += sz) chunks.push(json.slice(i, i + sz));

    const batch = { ['tl_idx_meta_' + ver]: JSON.stringify({ chunks: chunks.length }) };
    chunks.forEach((c, i) => { batch['tl_ip' + i + '_' + ver] = c; });
    props.setProperties(batch);
    Logger.log('📦 L1(Props): ' + chunks.length + ' chunk(s), ' + json.length + ' bytes');
  } catch (e) {
    Logger.log('⚠️ Props store failed: ' + e.toString());
  }
}

/**
 * Lưu index vào CacheService (chunked 85KB/key).
 */
function _storeIndexToCache(index, ver) {
  try {
    const cache  = CacheService.getScriptCache();
    const json   = JSON.stringify(index);
    const sz     = TEACHER_LOOKUP_CONFIG.CHUNK_SIZE;
    const chunks = [];
    for (let i = 0; i < json.length; i += sz) chunks.push(json.slice(i, i + sz));

    const batch = { ['tl_idx_cm_' + ver]: JSON.stringify({ chunks: chunks.length }) };
    chunks.forEach((c, i) => { batch['tl_ic' + i + '_' + ver] = c; });
    cache.putAll(batch, TEACHER_LOOKUP_CONFIG.CACHE_SECONDS);
  } catch (e) {}
}

/**
 * Chuyển mảng dữ liệu hàng → object có tên trường rõ ràng.
 * Tự động merge dữ liệu mở rộng từ sheet LMS (status, rank, center...).
 */
function buildTeacherObject(row) {
  function cell(colName) {
    const val = row[TEACHER_COLUMNS[colName] - 1];
    if (val === null || val === undefined || val === '') return null;
    return String(val).trim();
  }

  const maGV = cell('maGV');

  // Merge dữ liệu từ sheet bổ sung
  const extIndex = loadExtIndex();
  const ext      = (maGV && extIndex[maGV]) || {};

  return {
    // Thông tin cơ bản
    maGV           : maGV,
    tinhTrang      : cell('tinhTrang'),
    hoVaTen        : cell('hoVaTen'),
    emailCongViec  : cell('emailCongViec'),
    emailCaNhan    : cell('emailCaNhan'),
    boPhan         : cell('boPhan'),
    teamPhuTrach   : cell('teamPhuTrach'),
    maTeaching     : cell('maTeaching'),
    usernameLms    : cell('usernameLms'),

    // Địa điểm
    khuVucLamViec  : cell('khuVucLamViec'),
    chiNhanhLamViec: cell('chiNhanhLamViec'),
    diaDiemCoSo    : cell('diaDiemCoSo'),

    // Thời gian làm việc
    onboard        : cell('onboard'),
    offboard       : cell('offboard'),
    thamNien       : cell('thamNien') ? Number(cell('thamNien')) : null,

    // Rate lương
    rate: {
      lectureK12  : cell('rateLectureK12'),
      mentorK12   : cell('rateMentorK12'),
      superTeacher: cell('rateSuperTeacher'),
      lecture18   : cell('rateLecture18'),
      theoBuoi    : cell('rateTheoBuoi')
    },

    // Ngân hàng
    nganHang: {
      stk        : cell('stkNganHang'),
      tenNganHang: cell('nganHang'),
      chuTaiKhoan: cell('chuTaiKhoan'),
      chiNhanh   : cell('chiNhanhNH')
    },

    // Cá nhân
    ngaySinh: cell('ngaySinh'),
    sdt     : cell('sdtCaNhan'),
    gioiTinh: cell('gioiTinh'),

    // ── Dữ liệu bổ sung từ LMS sheet ──
    lms: Object.keys(ext).length > 0 ? ext : null,

    // ── Leader (join theo cơ sở) ──
    // Ưu tiên: chiNhanhLamViec → diaDiemCoSo → lms.centers (dự phòng khi chi nhánh lưu mã ngắn)
    // myContentLeader: tự động chọn CL/RL/AL dựa trên khoiFinal của GV
    leader: (function() {
      const l = _getLeaderByCoSo(cell('chiNhanhLamViec'), cell('diaDiemCoSo'), ext.centers || null);
      if (!l) return null;
      const khoi = (ext.khoiFinal || '').toLowerCase();
      let myCL = null;
      if      (khoi.includes('coding'))                              myCL = l.contentLeader.Coding;
      else if (khoi.includes('robotics'))                            myCL = l.contentLeader.Robotics;
      else if (khoi.includes('art') || khoi.includes('game'))       myCL = l.contentLeader.XArt;
      return Object.assign({}, l, { myContentLeader: myCL || null });
    })()
  };
}

/**
 * Tra cứu leader theo tên cơ sở.
 * Thử lần lượt: chiNhanhLamViec → diaDiemCoSo → lms.centers
 * Mỗi ứng viên: khớp chính xác trước, sau đó fuzzy includes.
 * @param {...string|null} candidates  các giá trị cần thử
 * @returns {Object|null}
 */
function _getLeaderByCoSo(...candidates) {
  const leaderIndex = loadLeaderIndex();
  const keys        = Object.keys(leaderIndex);

  for (const raw of candidates) {
    if (!raw) continue;
    const c = raw.trim();
    // 1. Khớp chính xác
    if (leaderIndex[c]) return leaderIndex[c];
    // 2. Fuzzy
    const hit = keys.find(k => c.includes(k) || k.includes(c));
    if (hit) return leaderIndex[hit];
  }
  return null;
}

/**
 * Lấy danh sách giáo viên có sinh nhật trong tháng chỉ định.
 * @param {number|null} targetMonth  1–12, null = tháng hiện tại
 * @param {boolean}     onlyActive   true = chỉ lấy GV đang làm việc
 * @returns {Array<Object>}
 */
function getTeachersBirthdayInMonth(targetMonth, onlyActive) {
  const month        = targetMonth || (new Date().getMonth() + 1);
  const filterActive = onlyActive !== false;
  const data         = loadSheetData();
  const bdColIdx     = TEACHER_COLUMNS.ngaySinh - 1;
  const stColIdx     = TEACHER_COLUMNS.tinhTrang - 1;
  const results      = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (filterActive && !String(row[stColIdx] || '').includes('Đang làm')) continue;

    const raw = row[bdColIdx];
    if (!raw) continue;
    const parts = String(raw).split('/');
    if (parts.length < 2) continue;
    const birthDay   = parseInt(parts[0]);
    const birthMonth = parseInt(parts[1]);
    if (birthMonth !== month) continue;

    // Dùng buildTeacherObject → tự động merge ext data
    const obj = buildTeacherObject(row);
    results.push({
      maGV              : obj.maGV,
      tinhTrang         : obj.tinhTrang,
      hoVaTen           : obj.hoVaTen,
      emailCongViec     : obj.emailCongViec,
      usernameLms       : obj.usernameLms,
      boPhan            : obj.boPhan,
      khuVucLamViec     : obj.khuVucLamViec,
      chiNhanhLamViec   : obj.chiNhanhLamViec,
      ngaySinh          : obj.ngaySinh,
      ngaySinhTrongThang: birthDay,
      sdt               : obj.sdt,
      gioiTinh          : obj.gioiTinh,
      lms               : obj.lms
    });
  }

  results.sort((a, b) => (a.ngaySinhTrongThang || 0) - (b.ngaySinhTrongThang || 0));
  return results;
}

/**
 * Lấy danh sách giáo viên theo tình trạng.
 * @param {string|null} statusFilter  VD: 'Đang làm việc', 'Đã nghỉ', null = tất cả
 * @returns {Array<Object>}
 */
function getTeachersByStatus(statusFilter) {
  const data         = loadSheetData();
  const statusColIdx = TEACHER_COLUMNS.tinhTrang - 1;
  const results      = [];

  for (let i = 0; i < data.length; i++) {
    const row    = data[i];
    const status = String(row[statusColIdx] || '').trim();
    if (!status) continue;
    if (statusFilter && !status.includes(statusFilter)) continue;

    // buildTeacherObject tự động merge ext data
    const obj = buildTeacherObject(row);
    results.push({
      maGV           : obj.maGV,
      tinhTrang      : obj.tinhTrang,
      hoVaTen        : obj.hoVaTen,
      emailCongViec  : obj.emailCongViec,
      usernameLms    : obj.usernameLms,
      boPhan         : obj.boPhan,
      teamPhuTrach   : obj.teamPhuTrach,
      khuVucLamViec  : obj.khuVucLamViec,
      chiNhanhLamViec: obj.chiNhanhLamViec,
      onboard        : obj.onboard,
      ngaySinh       : obj.ngaySinh,
      sdt            : obj.sdt,
      gioiTinh       : obj.gioiTinh,
      lms            : obj.lms
    });
  }

  return results;
}

// ==========================================
// EXT SHEET (LMS): load & cache
// ==========================================

/**
 * Load index từ sheet bổ sung: { maGV → extObject }
 * Cache chung với PropertiesService (L1) + CacheService (L2).
 */
function loadExtIndex() {
  const memKey = 'ext_' + TEACHER_EXT_CONFIG.CACHE_KEY_META;
  if (_MEM[memKey]) return _MEM[memKey];

  // L1: PropertiesService
  const props    = PropertiesService.getScriptProperties();
  const metaRaw  = props.getProperty(TEACHER_EXT_CONFIG.CACHE_KEY_META);
  if (metaRaw) {
    try {
      const { chunks } = JSON.parse(metaRaw);
      const keys    = Array.from({ length: chunks }, (_, i) => TEACHER_EXT_CONFIG.CACHE_KEY_PFX + i);
      const allProps = props.getProperties();
      let json = ''; let ok = true;
      for (const k of keys) { if (!allProps[k]) { ok = false; break; } json += allProps[k]; }
      if (ok && json) {
        const index    = JSON.parse(json);
        _MEM[memKey]   = index;
        return index;
      }
    } catch (e) {}
  }

  // L2: CacheService
  const cache   = CacheService.getScriptCache();
  const cMeta   = cache.get(TEACHER_EXT_CONFIG.CACHE_KEY_META + '_c');
  if (cMeta) {
    try {
      const { chunks } = JSON.parse(cMeta);
      const keys    = Array.from({ length: chunks }, (_, i) => TEACHER_EXT_CONFIG.CACHE_KEY_PFX + 'c' + i);
      const allVals = cache.getAll(keys);
      let json = ''; let ok = true;
      for (const k of keys) { if (!allVals[k]) { ok = false; break; } json += allVals[k]; }
      if (ok && json) {
        const index  = JSON.parse(json);
        _MEM[memKey] = index;
        _storeExtToProps(index);
        return index;
      }
    } catch (e) {}
  }

  // L3: đọc Sheet
  const index = _buildExtIndex();
  _MEM[memKey] = index;
  _storeExtToProps(index);
  _storeExtToCache(index);
  return index;
}

/** Đọc sheet bổ sung, trả về { maGV → extObject } */
function _buildExtIndex() {
  const ss      = SpreadsheetApp.openById(TEACHER_EXT_CONFIG.SPREADSHEET_ID);
  let   sheet   = ss.getSheets().find(s => s.getSheetId() === TEACHER_EXT_CONFIG.SHEET_GID);
  if (!sheet) sheet = ss.getSheets()[0];

  const lastRow = sheet.getLastRow();
  if (lastRow < TEACHER_EXT_CONFIG.DATA_START_ROW) return {};

  const numRows = lastRow - TEACHER_EXT_CONFIG.DATA_START_ROW + 1;
  const numCols = Math.max(...Object.values(EXT_COLUMNS));
  const raw     = sheet.getRange(TEACHER_EXT_CONFIG.DATA_START_ROW, 1, numRows, numCols).getValues();

  const index    = {};
  const joinIdx  = EXT_COLUMNS.dataHRRaw - 1;

  const g = (row, col) => {
    const v = row[col - 1];
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
    return String(v).trim();
  };

  for (let i = 0; i < raw.length; i++) {
    const row   = raw[i];
    const maGV  = String(row[joinIdx] || '').trim();
    if (!maGV) continue;
    index[maGV] = {
      statusLms   : g(row, EXT_COLUMNS.statusLms),
      centers     : g(row, EXT_COLUMNS.centers),
      khoiFinal   : g(row, EXT_COLUMNS.khoiFinal),
      role        : g(row, EXT_COLUMNS.role),
      courseLine  : g(row, EXT_COLUMNS.courseLine),
      rank        : g(row, EXT_COLUMNS.rank),
      joinedDate  : g(row, EXT_COLUMNS.joinedDate),
      teacherPoint: g(row, EXT_COLUMNS.teacherPoint)
    };
  }

  Logger.log('📗 Ext index built: ' + Object.keys(index).length + ' entries');
  return index;
}

function _storeExtToProps(index) {
  try {
    const props  = PropertiesService.getScriptProperties();
    const json   = JSON.stringify(index);
    const sz     = TEACHER_LOOKUP_CONFIG.PROP_CHUNK_SZ;
    const chunks = [];
    for (let i = 0; i < json.length; i += sz) chunks.push(json.slice(i, i + sz));
    const batch  = { [TEACHER_EXT_CONFIG.CACHE_KEY_META]: JSON.stringify({ chunks: chunks.length }) };
    chunks.forEach((c, i) => { batch[TEACHER_EXT_CONFIG.CACHE_KEY_PFX + i] = c; });
    props.setProperties(batch);
  } catch (e) { Logger.log('⚠️ Ext props store failed: ' + e); }
}

// ==========================================
// LEADER SHEET: load & cache
// ==========================================

/**
 * Load index leader: { coSoName → leaderObject }
 * TTL dài (6h) vì data thay đổi 1 lần/tháng.
 * Khi có thay đổi: chạy clearLeaderCache() rồi warmupCache().
 */
function loadLeaderIndex() {
  const memKey = 'ldr_' + TEACHER_LEADER_CONFIG.CACHE_KEY_META;
  if (_MEM[memKey]) return _MEM[memKey];

  // L1: PropertiesService
  const props   = PropertiesService.getScriptProperties();
  const metaRaw = props.getProperty(TEACHER_LEADER_CONFIG.CACHE_KEY_META);
  if (metaRaw) {
    try {
      const { chunks } = JSON.parse(metaRaw);
      const keys       = Array.from({ length: chunks }, (_, i) => TEACHER_LEADER_CONFIG.CACHE_KEY_PFX + i);
      const allProps   = props.getProperties();
      let json = ''; let ok = true;
      for (const k of keys) { if (!allProps[k]) { ok = false; break; } json += allProps[k]; }
      if (ok && json) {
        const index = JSON.parse(json);
        _MEM[memKey] = index;
        return index;
      }
    } catch (e) {}
  }

  // L2: CacheService
  const cache = CacheService.getScriptCache();
  const cMeta = cache.get(TEACHER_LEADER_CONFIG.CACHE_KEY_META + '_c');
  if (cMeta) {
    try {
      const { chunks } = JSON.parse(cMeta);
      const keys       = Array.from({ length: chunks }, (_, i) => TEACHER_LEADER_CONFIG.CACHE_KEY_PFX + 'c' + i);
      const allVals    = cache.getAll(keys);
      let json = ''; let ok = true;
      for (const k of keys) { if (!allVals[k]) { ok = false; break; } json += allVals[k]; }
      if (ok && json) {
        const index = JSON.parse(json);
        _MEM[memKey] = index;
        _storeLeaderToProps(index);
        return index;
      }
    } catch (e) {}
  }

  // L3: đọc Sheet
  const index = _buildLeaderIndex();
  _MEM[memKey] = index;
  _storeLeaderToProps(index);
  _storeLeaderToCache(index);
  return index;
}

/** Đọc sheet leader, trả về { buCoSo → leaderObject } – lấy tháng MỚI NHẤT mỗi cơ sở */
function _buildLeaderIndex() {
  const ss    = SpreadsheetApp.openById(TEACHER_LEADER_CONFIG.SPREADSHEET_ID);
  let   sheet = ss.getSheets().find(s => s.getSheetId() === TEACHER_LEADER_CONFIG.SHEET_GID);
  if (!sheet) {
    Logger.log('⚠️ Không tìm thấy leader sheet GID=' + TEACHER_LEADER_CONFIG.SHEET_GID);
    return {};
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < TEACHER_LEADER_CONFIG.DATA_START_ROW) return {};

  const numRows = lastRow - TEACHER_LEADER_CONFIG.DATA_START_ROW + 1;
  const numCols = Math.max(...Object.values(LEADER_COLUMNS));
  const raw     = sheet.getRange(TEACHER_LEADER_CONFIG.DATA_START_ROW, 1, numRows, numCols).getValues();

  // Buớc 1: tìm dòng mới nhất (sort theo Năm*100+Tháng) cho mỗi BU
  const latest  = {}; // { buCoSo: { sk: number, row: [] } }
  const buIdx   = LEADER_COLUMNS.buCoSo - 1;
  const namIdx  = LEADER_COLUMNS.nam    - 1;
  const thIdx   = LEADER_COLUMNS.thang  - 1;

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const bu  = String(row[buIdx] || '').trim();
    if (!bu) continue;
    const thangNum = parseInt(String(row[thIdx] || '').replace(/[^\d]/g, '')) || 0;
    const namNum   = parseInt(row[namIdx]) || 0;
    const sk       = namNum * 100 + thangNum;
    if (!latest[bu] || sk > latest[bu].sk) latest[bu] = { sk, row };
  }

  // Buớc 2: build index từ dòng mới nhất mỗi BU
  const g = (row, col) => {
    const v = row[col - 1];
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
    return String(v).trim();
  };

  const index = {};
  for (const bu of Object.keys(latest)) {
    const row = latest[bu].row;
    index[bu] = {
      buCoSo  : bu,
      area    : g(row, LEADER_COLUMNS.area),
      status  : g(row, LEADER_COLUMNS.status),
      time    : g(row, LEADER_COLUMNS.time),
      TC      : g(row, LEADER_COLUMNS.TC),
      TE      : g(row, LEADER_COLUMNS.TE),
      // CL / RL / AL nhóm thành khối contentLeader
      contentLeader: {
        Coding  : g(row, LEADER_COLUMNS.CL),   // Coding
        Robotics: g(row, LEADER_COLUMNS.RL),   // Robotics
        XArt    : g(row, LEADER_COLUMNS.AL)    // X-Art / Game Lab
      },
      TECoding: g(row, LEADER_COLUMNS.TECoding),
      TEGL    : g(row, LEADER_COLUMNS.TEGL)
    };
  }

  Logger.log('📋 Leader index built: ' + Object.keys(index).length + ' cơ sở (latest month each)');
  return index;
}

function _storeLeaderToProps(index) {
  try {
    const props  = PropertiesService.getScriptProperties();
    const json   = JSON.stringify(index);
    const sz     = TEACHER_LOOKUP_CONFIG.PROP_CHUNK_SZ;
    const chunks = [];
    for (let i = 0; i < json.length; i += sz) chunks.push(json.slice(i, i + sz));
    const batch  = { [TEACHER_LEADER_CONFIG.CACHE_KEY_META]: JSON.stringify({ chunks: chunks.length }) };
    chunks.forEach((c, i) => { batch[TEACHER_LEADER_CONFIG.CACHE_KEY_PFX + i] = c; });
    props.setProperties(batch);
  } catch (e) { Logger.log('⚠️ Leader props store failed: ' + e); }
}

function _storeLeaderToCache(index) {
  try {
    const cache  = CacheService.getScriptCache();
    const json   = JSON.stringify(index);
    const sz     = TEACHER_LOOKUP_CONFIG.CHUNK_SIZE;
    const chunks = [];
    for (let i = 0; i < json.length; i += sz) chunks.push(json.slice(i, i + sz));
    const batch  = { [TEACHER_LEADER_CONFIG.CACHE_KEY_META + '_c']: JSON.stringify({ chunks: chunks.length }) };
    chunks.forEach((c, i) => { batch[TEACHER_LEADER_CONFIG.CACHE_KEY_PFX + 'c' + i] = c; });
    cache.putAll(batch, TEACHER_LEADER_CONFIG.CACHE_SECONDS);
  } catch (e) {}
}

/**
 * Xoá cache leader (dùng khi update leader hàng tháng).
 * Sau khi xoá, lần request tiếp theo sẽ tự rebuild từ Sheet.
 */
function clearLeaderCache() {
  delete _MEM['ldr_' + TEACHER_LEADER_CONFIG.CACHE_KEY_META];
  CacheService.getScriptCache().remove(TEACHER_LEADER_CONFIG.CACHE_KEY_META + '_c');
  PropertiesService.getScriptProperties().deleteProperty(TEACHER_LEADER_CONFIG.CACHE_KEY_META);
  Logger.log('✅ Leader cache cleared – sẽ rebuild từ Sheet ở request tiếp theo');
}

function _storeExtToCache(index) {
  try {
    const cache  = CacheService.getScriptCache();
    const json   = JSON.stringify(index);
    const sz     = TEACHER_LOOKUP_CONFIG.CHUNK_SIZE;
    const chunks = [];
    for (let i = 0; i < json.length; i += sz) chunks.push(json.slice(i, i + sz));
    const batch  = { [TEACHER_EXT_CONFIG.CACHE_KEY_META + '_c']: JSON.stringify({ chunks: chunks.length }) };
    chunks.forEach((c, i) => { batch[TEACHER_EXT_CONFIG.CACHE_KEY_PFX + 'c' + i] = c; });
    cache.putAll(batch, TEACHER_LOOKUP_CONFIG.CACHE_SECONDS);
  } catch (e) {}
}

// ==========================================
// DATA LOADING & CHUNKED CACHE
// ==========================================

/**
 * Load raw sheet data với CHUNKED CACHE.
 *
 * Vấn đề: CacheService giới hạn 100KB/key.
 * Giải pháp: chia JSON thành nhiều chunk 90KB, lưu nhiều key.
 *
 * Keys dùng:
 *   tl_meta_{ver}    → { chunks: N, rows: R }
 *   tl_c0_{ver}      → chunk 0  (≤90KB)
 *   tl_c1_{ver}      → chunk 1
 *   ...
 *
 * Lần 1 (cache cold): ~2-4s (đọc Sheet)
 * Lần 2+ (cache warm): ~100-300ms
 *
 * @returns {Array<Array>}
 */
function loadSheetData() {
  const cache   = CacheService.getScriptCache();
  const ver     = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  const metaKey = 'tl_meta_' + ver;
  const meta    = cache.get(metaKey);

  if (meta) {
    try {
      const { chunks } = JSON.parse(meta);
      // Đọc tất cả chunk song song bằng getAll()
      const keys    = Array.from({ length: chunks }, (_, i) => 'tl_c' + i + '_' + ver);
      const allVals = cache.getAll(keys);
      let json = '';
      for (const k of keys) {
        if (!allVals[k]) { json = null; break; }
        json += allVals[k];
      }
      if (json) return JSON.parse(json);
    } catch (e) { /* cache corrupt, rebuild */ }
  }

  return _readSheetAndCache();
}

/**
 * Đọc Sheet, pre-convert, lưu chunked cache.
 * @returns {Array<Array>}
 */
function _readSheetAndCache() {
  const sheet   = getTeacherSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < TEACHER_LOOKUP_CONFIG.DATA_START_ROW) return [];

  const numRows = lastRow - TEACHER_LOOKUP_CONFIG.DATA_START_ROW + 1;
  const numCols = Math.max(...Object.values(TEACHER_COLUMNS));
  const raw     = sheet.getRange(
    TEACHER_LOOKUP_CONFIG.DATA_START_ROW, 1, numRows, numCols
  ).getValues();

  // Pre-convert Date → string "DD/MM/YYYY"
  const data = raw.map(row =>
    row.map(val =>
      val instanceof Date
        ? Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy')
        : val
    )
  );

  _cacheChunked(data);
  return data;
}

/**
 * Lưu data vào nhiều cache key (mỗi key ≤ CHUNK_SIZE bytes).
 */
function _cacheChunked(data) {
  const cache    = CacheService.getScriptCache();
  const ver      = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  const ttl      = TEACHER_LOOKUP_CONFIG.CACHE_SECONDS;
  const chunkSz  = TEACHER_LOOKUP_CONFIG.CHUNK_SIZE;

  const json   = JSON.stringify(data);
  const chunks = [];
  for (let i = 0; i < json.length; i += chunkSz) {
    chunks.push(json.slice(i, i + chunkSz));
  }

  // Dùng putAll() để ghi tất cả một lần (nhanh hơn nhiều lần put riêng lẻ)
  const batch = {};
  chunks.forEach((c, i) => { batch['tl_c' + i + '_' + ver] = c; });
  batch['tl_meta_' + ver] = JSON.stringify({ chunks: chunks.length, rows: data.length });

  try {
    cache.putAll(batch, ttl);
    Logger.log('✅ Cache: ' + chunks.length + ' chunk(s), ' + json.length + ' bytes, ' + data.length + ' rows');
  } catch (e) {
    Logger.log('⚠️ CacheService putAll failed: ' + e.toString());
  }
}

/**
 * Warm-up: rebuild toàn bộ cache (L1 Props + L2 Cache + L0 mem).
 * Chạy qua time-based trigger mỗi 4 phút (chỉ để refresh L2 CacheService).
 * L1 PropertiesService không expire → warm-up chủ yếu là failsafe.
 */
function warmupCache() {
  const ver = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  delete _MEM['idx_' + ver];
  delete _MEM['ext_' + TEACHER_EXT_CONFIG.CACHE_KEY_META];
  delete _MEM['ldr_' + TEACHER_LEADER_CONFIG.CACHE_KEY_META];
  const cache = CacheService.getScriptCache();
  cache.remove('tl_idx_cm_' + ver);
  cache.remove(TEACHER_EXT_CONFIG.CACHE_KEY_META  + '_c');
  cache.remove(TEACHER_LEADER_CONFIG.CACHE_KEY_META + '_c');
  _readSheetAndCache();
  _buildExtIndex();
  _buildLeaderIndex();
  loadUsernameIndex();
  loadExtIndex();
  loadLeaderIndex();
  Logger.log('🔥 Warm-up done at ' + new Date().toISOString());
}

/**
 * Xoá toàn bộ cache ở mọi layer.
 * Gọi sau khi cập nhật dữ liệu trong Google Sheet.
 */
function clearSheetCache() {
  const ver   = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  // L0
  delete _MEM['idx_' + ver];
  delete _MEM['ext_' + TEACHER_EXT_CONFIG.CACHE_KEY_META];
  delete _MEM['ldr_' + TEACHER_LEADER_CONFIG.CACHE_KEY_META];
  // L2
  cache.remove('tl_meta_' + ver);
  cache.remove('tl_idx_cm_' + ver);
  cache.remove(TEACHER_EXT_CONFIG.CACHE_KEY_META   + '_c');
  cache.remove(TEACHER_LEADER_CONFIG.CACHE_KEY_META + '_c');
  // L1
  props.deleteProperty('tl_idx_meta_' + ver);
  props.deleteProperty(TEACHER_EXT_CONFIG.CACHE_KEY_META);
  props.deleteProperty(TEACHER_LEADER_CONFIG.CACHE_KEY_META);
  Logger.log('✅ All cache layers cleared (HR + Ext + Leader)');
}

/**
 * Tạo time-based trigger chạy warmupCache() mỗi 4 phút.
 * Chỉ cần chạy 1 lần trong Apps Script Editor.
 */
function setupWarmupTrigger() {
  // Xoá trigger cũ tránh duplicate
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'warmupCache')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('warmupCache')
    .timeBased()
    .everyMinutes(4)
    .create();

  Logger.log('✅ Warm-up trigger đã được tạo (mỗi 4 phút)');
}

/** Xoá warm-up trigger */
function removeWarmupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'warmupCache')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('✅ Warm-up trigger đã xoá');
}

/**
 * Lấy sheet nhân sự theo SHEET_GID.
 */
function getTeacherSheet() {
  const ss = SpreadsheetApp.openById(TEACHER_LOOKUP_CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();

  // Tìm theo gid
  for (const sheet of sheets) {
    if (sheet.getSheetId() === TEACHER_LOOKUP_CONFIG.SHEET_GID) {
      return sheet;
    }
  }

  // Fallback: sheet đầu tiên
  Logger.log('⚠️ Không tìm thấy sheet gid=' + TEACHER_LOOKUP_CONFIG.SHEET_GID + ', dùng sheet đầu tiên');
  return ss.getSheets()[0];
}

function teacherJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// TEST FUNCTIONS (chạy thẳng trong Editor)
// ==========================================

/** Test tra cứu GV có sẵn trong data mẫu */
function testLookupExisting() {
  const result = findTeacherByUsername('maimonmen17102003');
  Logger.log(JSON.stringify(result, null, 2));
}

/** Test GV không tồn tại */
function testLookupNotFound() {
  const result = findTeacherByUsername('khongtontai_xyz');
  Logger.log(result === null ? '✅ null – đúng ý' : '❌ Unexpected: ' + JSON.stringify(result));
}

/** Test doGet như gọi Web App thật */
function testDoGet() {
  const fakeEvent = { parameter: { username: 'huy183605' } };
  const response = doGet(fakeEvent);
  Logger.log(response.getContent());
}

/** Test sinh nhật tháng hiện tại – chỉ GV đang làm việc (default) */
function testBirthdayThisMonth() {
  const list = getTeachersBirthdayInMonth(null, true);
  Logger.log('🎂 Sinh nhật tháng ' + (new Date().getMonth() + 1) + ' (đang làm): ' + list.length + ' GV');
  Logger.log(JSON.stringify(list, null, 2));
}

/** Test sinh nhật tháng 12 – tất cả kể cả đã nghỉ */
function testBirthdayMonth12() {
  const list = getTeachersBirthdayInMonth(12, false);
  Logger.log('🎂 Sinh nhật tháng 12 (tất cả): ' + list.length + ' GV');
  Logger.log(JSON.stringify(list, null, 2));
}

/** Test lấy danh sách GV đang làm việc */
function testListActive() {
  const list = getTeachersByStatus('Đang làm việc');
  Logger.log('👩‍🏫 GV đang làm: ' + list.length);
  Logger.log(JSON.stringify(list.slice(0, 3), null, 2));
}

/** Test lấy danh sách GV đã nghỉ */
function testListOffboard() {
  const list = getTeachersByStatus('Đã nghỉ');
  Logger.log('🚪 GV đã nghỉ: ' + list.length);
}

/** Benchmark tốc độ từng layer cache */
function benchmarkCache() {
  const ver   = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();

  // Test L1 PropertiesService
  let t = Date.now();
  const metaP = props.getProperty('tl_idx_meta_' + ver);
  Logger.log('L1 Props meta read: ' + (Date.now() - t) + 'ms → ' + (metaP ? 'HIT' : 'MISS'));

  // Test L2 CacheService
  t = Date.now();
  const metaC = cache.get('tl_idx_cm_' + ver);
  Logger.log('L2 Cache meta read: ' + (Date.now() - t) + 'ms → ' + (metaC ? 'HIT' : 'MISS'));

  // Test full lookup (sẽ dùng layer nhanh nhất có sẵn)
  t = Date.now();
  const result = findTeacherByUsername('maimonmen17102003');
  Logger.log('Full lookup: ' + (Date.now() - t) + 'ms → ' + (result ? result.hoVaTen : 'not found'));

  // Test L0 (same execution - chắc chắn hit)
  t = Date.now();
  findTeacherByUsername('huy183605');
  Logger.log('L0 mem lookup: ' + (Date.now() - t) + 'ms (should be ~0ms)');
}

/** Xem trạng thái tất cả cache layer */
function diagCache() {
  const ver   = TEACHER_LOOKUP_CONFIG.CACHE_VERSION;
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const metaP = props.getProperty('tl_idx_meta_' + ver);
  const metaC = cache.get('tl_idx_cm_' + ver);
  const metaD = cache.get('tl_meta_' + ver);
  Logger.log('L0 mem    : ' + (_MEM['idx_' + ver] ? '✅ HIT' : '❌ MISS'));
  Logger.log('L1 Props  : ' + (metaP ? '✅ HIT ' + metaP : '❌ MISS'));
  Logger.log('L2 Idx    : ' + (metaC ? '✅ HIT ' + metaC : '❌ MISS'));
  Logger.log('L2 Data   : ' + (metaD ? '✅ HIT ' + metaD : '❌ MISS'));
}

/** Xóa cache + rebuild ngay (dùng sau khi cập nhật Sheet) */
function testClearCache() {
  clearSheetCache();
  warmupCache();
}

/** Test doGet với action=birthday */
function testDoGetBirthday() {
  const fakeEvent = { parameter: { action: 'birthday' } };
  const response  = doGet(fakeEvent);
  Logger.log(response.getContent());
}

/**
 * Dump header + 5 dòng đầu của sheet leader để verify LEADER_COLUMNS.
 * Chạy 1 lần sau khi deploy, kiểm tra log rồi chỉnh LEADER_COLUMNS nếu cần.
 */
function diagLeaderSheet() {
  const ss    = SpreadsheetApp.openById(TEACHER_LEADER_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheets().find(s => s.getSheetId() === TEACHER_LEADER_CONFIG.SHEET_GID)
                || ss.getSheets()[0];
  // Header row
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('HEADER: ' + JSON.stringify(header));
  // 5 dòng data đầu
  const rows = sheet.getRange(TEACHER_LEADER_CONFIG.DATA_START_ROW, 1,
                               Math.min(5, sheet.getLastRow()), sheet.getLastColumn()).getValues();
  rows.forEach((r, i) => Logger.log('Row ' + (i + 1) + ': ' + JSON.stringify(r)));
  // Thống kê index hiện tại
  const index = loadLeaderIndex();
  Logger.log('Leader index keys (' + Object.keys(index).length + '): ' + Object.keys(index).slice(0, 10).join(', '));
}

/** Test tìm leader theo cơ sở */
function testLeaderLookup() {
  const index = loadLeaderIndex();
  Logger.log('Total cơ sở: ' + Object.keys(index).length);
  Logger.log(JSON.stringify(index, null, 2));
}

/** Test full lookup 1 GV – xem có trường leader không */
function testLookupWithLeader() {
  const result = findTeacherByUsername('maimonmen17102003');
  Logger.log(JSON.stringify(result, null, 2));
  if (result) {
    Logger.log('chiNhanhLamViec: ' + result.chiNhanhLamViec);
    Logger.log('leader: ' + JSON.stringify(result.leader));
  }
}

/** In danh sách tất cả username có trong sheet (debug) */
function listAllUsernames() {
  const data           = loadSheetData();
  const usernameColIdx = TEACHER_LOOKUP_CONFIG.USERNAME_COL - 1;
  const usernames      = data
    .map(r => String(r[usernameColIdx] || '').trim())
    .filter(u => u.length > 0);
  Logger.log('Tổng: ' + usernames.length + ' giáo viên');
  Logger.log(usernames.join('\n'));
}
