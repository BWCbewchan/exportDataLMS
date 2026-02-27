/**
 * getToken.js
 * Tự động lấy Firebase idToken từ email/password trong .env
 * Token được cache vào .token_cache.json, tái sử dụng cho đến khi hết hạn (1 giờ)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const FIREBASE_API_KEY = 'AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const CACHE_FILE = path.join(__dirname, '.token_cache.json');

// Đọc token từ cache nếu còn hợp lệ
function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const now = Date.now();
    // Còn ít nhất 5 phút thì tái sử dụng
    if (data.token && data.expiresAt && data.expiresAt - now > 5 * 60 * 1000) {
      return data.token;
    }
  } catch (_) {}
  return null;
}

// Ghi token vào cache
function writeCache(token, expiresInSeconds) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ token, expiresAt }, null, 2));
}

// Lấy token mới từ Firebase
async function fetchNewToken() {
  const email = process.env.LMS_EMAIL;
  const password = process.env.LMS_PASSWORD;

  if (!email || !password) {
    console.error('❌ Lỗi: Thiếu LMS_EMAIL hoặc LMS_PASSWORD trong file .env');
    console.log('💡 Thêm vào file .env:');
    console.log('   LMS_EMAIL=your_email@mindx.com.vn');
    console.log('   LMS_PASSWORD=your_password');
    process.exit(1);
  }

  console.log(`🔐 Đang đăng nhập với tài khoản ${email}...`);

  const response = await fetch(FIREBASE_AUTH_URL, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://base.mindx.edu.vn',
      'x-client-version': 'Chrome/JsCore/9.23.0/FirebaseCore-web',
      'x-firebase-gmpid': '1:469103925618:web:06ab79fed8c9edcad2a5eb',
    },
    body: JSON.stringify({
      returnSecureToken: true,
      email,
      password,
      clientType: 'CLIENT_TYPE_WEB',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err?.error?.message || response.statusText;
    console.error(`❌ Đăng nhập thất bại: ${message}`);
    if (message === 'INVALID_PASSWORD' || message === 'EMAIL_NOT_FOUND') {
      console.log('💡 Kiểm tra lại LMS_EMAIL và LMS_PASSWORD trong file .env');
    }
    process.exit(1);
  }

  const data = await response.json();
  const idToken = data.idToken;
  const expiresIn = parseInt(data.expiresIn, 10) || 3600;

  writeCache(idToken, expiresIn);
  console.log(`✅ Đăng nhập thành công! Token hợp lệ trong ${expiresIn / 60} phút.`);
  return idToken;
}

/**
 * Lấy token hợp lệ (từ cache hoặc đăng nhập mới)
 * @returns {Promise<string>} Firebase idToken
 */
async function getToken() {
  const cached = readCache();
  if (cached) {
    console.log('🔑 Dùng token đã cache (còn hợp lệ).');
    return cached;
  }
  return fetchNewToken();
}

module.exports = { getToken };
