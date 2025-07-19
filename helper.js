// helper.js
const path = require('path');

/**
 * Hằng số định nghĩa đường dẫn đến thư mục chứa các sách.
 * __dirname là đường dẫn đến thư mục chứa file hiện tại (tức là thư mục gốc của dự án).
 */
const BOOKS_DIR = path.join(__dirname, 'books');

/**
 * Helper function để tạo slug-friendly từ tựa đề, hỗ trợ tiếng Việt.
 * Ví dụ: "Chuyến Đi Bão Táp" -> "chuyen-di-bao-tap"
 * @param {string} text Chuỗi đầu vào.
 * @returns {string} Chuỗi đã được slugify.
 */
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// Xuất các hàm và hằng số để các file khác có thể sử dụng
module.exports = {
  BOOKS_DIR,
  slugify,
};