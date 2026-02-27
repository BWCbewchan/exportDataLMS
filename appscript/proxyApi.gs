/**
 * PROXY API - LMS GraphQL Web App Proxy
 * 
 * ⚠️ QUAN TRỌNG: Phải thêm vào SHEETS-BOUND PROJECT (không phải standalone project)
 * vì chỉ Sheets-bound project mới dùng IP được phép truy cập lms-api.mindx.vn.
 * 
 * CÁCH TRIỂN KHAI ĐÚNG:
 * 1. Mở Google Sheets đang chứa các script (allClassesSession4And8.gs, teacherCompliance.gs...)
 * 2. Extensions > Apps Script (mở project Sheets hiện tại)
 * 3. Tạo file mới tên "proxyApi" → paste toàn bộ code này vào → Ctrl+S
 * 4. Deploy > New deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Nhấn Deploy → Copy URL → dán vào .env.local:
 *    LMS_PROXY_URL=https://script.google.com/macros/s/SCRIPT_ID/exec
 * 
 * Mỗi khi sửa code: Deploy > Manage deployments > ✏️ Edit > New version > Deploy
 * 
 * API:
 *   GET  → Health check: { status: "ok" }
 *   POST → { operationName, query, variables } → trả về JSON của LMS
 */

// ==========================================
// CẤU HÌNH - CẬP NHẬT NẾU ĐỔI TÀI KHOẢN
// ==========================================

const PROXY_CONFIG = {
  FIREBASE_URL: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
  FIREBASE_KEY: 'AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4',
  EMAIL: 'anhpnh@mindx.com.vn',
  PASSWORD: 'Hoanganh@123',
  LMS_API: 'https://lms-api.mindx.vn/',
  CACHE_KEY: 'lms_firebase_token',
  CACHE_SECONDS: 3000 // 50 phút (token hết hạn sau 60 phút)
};

// ==========================================
// ENTRY POINT
// ==========================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { operationName, query, variables } = body;

    if (!query) {
      return jsonResponse({ error: 'Missing query', status: 400 });
    }

    const token = getProxyToken();
    const result = callLmsApi(token, operationName, query, variables);

    // Token hết hạn → xoá cache, thử lại 1 lần
    if (result.code === 401) {
      CacheService.getScriptCache().remove(PROXY_CONFIG.CACHE_KEY);
      const newToken = getProxyToken();
      const retry = callLmsApi(newToken, operationName, query, variables);
      if (retry.code === 200) return jsonResponse(JSON.parse(retry.text));
      return jsonResponse({ error: 'Auth retry failed: ' + retry.code, status: retry.code });
    }

    if (result.code !== 200) {
      return jsonResponse({ error: 'LMS API returned ' + result.code, status: result.code, body: result.text.slice(0, 300) });
    }

    return jsonResponse(JSON.parse(result.text));

  } catch (err) {
    Logger.log('❌ Proxy error: ' + err.toString());
    return jsonResponse({ error: err.toString(), status: 500 });
  }
}

function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'LMS Proxy is running', timestamp: new Date().toISOString() });
}

// ==========================================
// LMS API CALL
// ==========================================

function callLmsApi(token, operationName, query, variables) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000]; // ms

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      Utilities.sleep(RETRY_DELAYS[attempt - 1]);
      Logger.log('🔄 Retry lần ' + attempt + ' cho ' + operationName);
    }

    const response = UrlFetchApp.fetch(PROXY_CONFIG.LMS_API, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'accept': '*/*',
        'accept-language': 'vi,en;q=0.9',
        'authorization': token,
        'cache-control': 'no-cache',
        'content-language': 'vi',
        'origin': 'https://lms.mindx.edu.vn',
        'pragma': 'no-cache',
        'referer': 'https://lms.mindx.edu.vn/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      payload: JSON.stringify({ operationName, query, variables }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const text = response.getContentText();

    // Retry khi 502/503/504
    if (code === 502 || code === 503 || code === 504) {
      Logger.log('⚠️ LMS API ' + code + ' (attempt ' + (attempt + 1) + '/' + MAX_RETRIES + ')');
      if (attempt < MAX_RETRIES - 1) continue;
    }

    return { code, text };
  }
}

// ==========================================
// FIREBASE AUTH (tự đứng, dùng CacheService)
// ==========================================

function getProxyToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PROXY_CONFIG.CACHE_KEY);
  if (cached) return cached;

  const response = UrlFetchApp.fetch(
    PROXY_CONFIG.FIREBASE_URL + '?key=' + PROXY_CONFIG.FIREBASE_KEY,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'accept': '*/*',
        'origin': 'https://base.mindx.edu.vn',
        'x-client-version': 'Chrome/JsCore/9.23.0/FirebaseCore-web',
        'x-firebase-gmpid': '1:469103925618:web:06ab79fed8c9edcad2a5eb'
      },
      payload: JSON.stringify({
        returnSecureToken: true,
        email: PROXY_CONFIG.EMAIL,
        password: PROXY_CONFIG.PASSWORD,
        clientType: 'CLIENT_TYPE_WEB'
      }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Firebase auth failed: ' + response.getContentText().slice(0, 200));
  }

  const data = JSON.parse(response.getContentText());
  cache.put(PROXY_CONFIG.CACHE_KEY, data.idToken, PROXY_CONFIG.CACHE_SECONDS);
  return data.idToken;
}

// ==========================================
// HELPERS
// ==========================================

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// TEST (chạy thẳng trong Apps Script Editor)
// ==========================================

function testProxy() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        operationName: 'GetClasses',
        query: `query GetClasses($search: String, $statusIn: [String], $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
          classes(payload: {
            filter_textSearch: $search,
            status_in: $statusIn,
            pageIndex: $pageIndex,
            itemsPerPage: $itemsPerPage,
            orderBy: $orderBy
          }) {
            data { id name status centre { name } }
            pagination { total }
          }
        }`,
        variables: {
          search: '',
          statusIn: ['RUNNING'],
          pageIndex: 0,
          itemsPerPage: 3,
          orderBy: 'createdAt_desc'
        }
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log('Result: ' + result.getContent());
}
