// writer/config.js (File mới)

// --- Cấu hình cho Gemini ---
// Ở local, chúng ta sẽ dùng dotenv để tiện lợi
require('dotenv').config({ path: '../.env' }); // Chỉ định đường dẫn tới file .env ở gốc
const MAX_CHAPTERS_PER_DAY = process.env.MAX_CHAPTERS_PER_DAY || 30
const CHECK_INTERVAL_MINUTES = process.env.CHECK_INTERVAL_MINUTES || 10;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("⚠️  Cảnh báo: Không tìm thấy GEMINI_API_KEY trong file .env. Các chức năng liên quan đến AI có thể sẽ lỗi.");
}

// --- Cấu hình cho Firebase (LOGIC HYBRID) ---
let FIREBASE_SERVICE_ACCOUNT;

// ƯU TIÊN 1: Kiểm tra biến môi trường (dành cho Vercel/Fly.io)
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  console.log("Found Firebase config in environment variables (for production).");
  const serviceAccountString = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    'base64'
  ).toString('utf-8');
  FIREBASE_SERVICE_ACCOUNT = JSON.parse(serviceAccountString);
} 
// ƯU TIÊN 2: Nếu không có, tìm file .json ở local (dành cho phát triển)
else {
  try {
    console.log("Found Firebase config in local serviceAccountKey.json file (for development).");
    FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
  } catch (error) {
    console.error("❌ Lỗi: Không tìm thấy biến môi trường FIREBASE_SERVICE_ACCOUNT_BASE64 và cũng không thể đọc file ./serviceAccountKey.json.");
    console.error("Vui lòng đảm bảo một trong hai nguồn cấu hình này tồn tại.");
    FIREBASE_SERVICE_ACCOUNT = null; // Gán là null để các tiến trình sau có thể kiểm tra và báo lỗi
  }
}

module.exports = {
  GEMINI_API_KEY,
  FIREBASE_SERVICE_ACCOUNT,
  MAX_CHAPTERS_PER_DAY,
  CHECK_INTERVAL_MINUTES
};