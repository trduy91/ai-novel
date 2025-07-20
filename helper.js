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

/**
 * Trích xuất một chuỗi JSON (bắt đầu bằng { và kết thúc bằng }) từ một khối văn bản lớn hơn.
 * Cực kỳ hữu ích khi AI thêm văn bản thừa trước hoặc sau đối tượng JSON.
 * @param {string} text - Văn bản thô từ AI.
 * @returns {string|null} - Chuỗi JSON được trích xuất, hoặc null nếu không tìm thấy.
 */
const extractJsonFromString = (text) => {
  if (!text) return null;
  
  // Regex này tìm khối văn bản đầu tiên nằm giữa dấu { và } cuối cùng tương ứng.
  // Cờ 's' (dotAll) cho phép '.' khớp với cả ký tự xuống dòng.
  const jsonRegex = /{[^]*}/;
  const match = text.match(jsonRegex);
  
  if (match && match) {
    return match;
  }
  
  // Fallback cho trường hợp có markdown backticks
  const markdownJsonRegex = /```json\s*({[^]*})\s*```/;
  const markdownMatch = text.match(markdownJsonRegex);

  if (markdownMatch && markdownMatch) {
    return markdownMatch;
  }

  return null;
};

/**
 * Định dạng đối tượng JSON của World Bible thành một chuỗi văn bản dễ đọc cho AI.
 * @param {object} worldBibleJson - Đối tượng World Bible đã được parse.
 * @returns {string} - Một chuỗi văn bản đã được định dạng.
 */
const formatWorldBibleForPrompt = (worldBibleJson) => {
  if (!worldBibleJson) return '';

  let formattedString = '';

  // Định dạng phần Characters
  if (worldBibleJson.characters && worldBibleJson.characters.length > 0) {
    formattedString += 'NHÂN VẬT QUAN TRỌNG:\n';
    worldBibleJson.characters.forEach(char => {
      formattedString += `- ${char.name}: ${char.description}\n`;
    });
    formattedString += '\n';
  }

  // Định dạng phần Places
  if (worldBibleJson.places && worldBibleJson.places.length > 0) {
    formattedString += 'ĐỊA DANH QUAN TRỌNG:\n';
    worldBibleJson.places.forEach(place => {
      formattedString += `- ${place.name}: ${place.description}\n`;
    });
    formattedString += '\n';
  }

  // Định dạng phần Lore (với cấu trúc mới là mảng các object)
  if (worldBibleJson.lore && worldBibleJson.lore.length > 0) {
    formattedString += 'CÁC YẾU TỐ/LUẬT LỆ QUAN TRỌNG (LORE):\n';
    worldBibleJson.lore.forEach(l => {
      // Lấy key đầu tiên (ví dụ: 'item' hoặc 'concept') và giá trị của nó
      const key = Object.keys(l)[0];
      const name = l[key];
      const description = l.description;
      formattedString += `- ${name} (${key}): ${description}\n`;
    });
  }

  return formattedString.trim();
};

// Xuất các hàm và hằng số để các file khác có thể sử dụng
module.exports = {
  BOOKS_DIR,
  slugify,
  extractJsonFromString,
  formatWorldBibleForPrompt
};