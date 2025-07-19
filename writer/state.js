// writer/state.js (PHIÊN BẢN NÂNG CẤP)
const fs = require('fs');
const path = require('path');

// Di chuyển file state vào thư mục writer để nó không nằm ở thư mục gốc
const STATE_FILE = path.join(__dirname, 'generation_state.json');
const MAX_CHAPTERS_PER_DAY = 30; // Giới hạn không đổi: 3 chương/ngày/truyện

/**
 * Tải toàn bộ đối tượng trạng thái từ file JSON.
 * @returns {object} Trạng thái của tất cả các sách.
 */
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {}; // Trả về đối tượng rỗng nếu file không tồn tại
  }
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Lỗi đọc hoặc phân tích file state, sẽ tạo lại file mới.", e);
    return {}; // Trả về rỗng nếu file bị lỗi
  }
}

/**
 * Lưu toàn bộ đối tượng trạng thái vào file JSON.
 * @param {object} state Trạng thái của tất cả các sách.
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Kiểm tra xem có thể tạo chương cho MỘT TRUYỆN CỤ THỂ hay không.
 * @param {string} bookSlug Slug của truyện cần kiểm tra.
 * @returns {boolean} True nếu có thể tạo, False nếu không.
 */
function canGenerate(bookSlug) {
  const fullState = loadState();
  const bookState = fullState[bookSlug];
  const today = new Date().toISOString().split('T')[0];

  // Nếu truyện này chưa từng được ghi nhận trạng thái -> có thể tạo
  if (!bookState) {
    return true;
  }

  // Nếu ngày ghi nhận là ngày cũ -> có thể tạo (reset bộ đếm)
  if (bookState.date !== today) {
    return true;
  }

  // Nếu cùng ngày, kiểm tra bộ đếm
  if (bookState.count < MAX_CHAPTERS_PER_DAY) {
    return true;
  }

  // Nếu không thỏa mãn các điều kiện trên -> đã đạt giới hạn
  // console.log(`Đã đạt giới hạn ${MAX_CHAPTERS_PER_DAY} chương cho truyện "${bookSlug}" hôm nay.`);
  return false;
}

/**
 * Ghi nhận rằng một chương đã được tạo cho MỘT TRUYỆN CỤ THỂ.
 * @param {string} bookSlug Slug của truyện vừa được tạo chương.
 */
function recordGeneration(bookSlug) {
  const fullState = loadState();
  const bookState = fullState[bookSlug];
  const today = new Date().toISOString().split('T')[0];

  if (!bookState || bookState.date !== today) {
    // Nếu là lần đầu ghi nhận cho truyện này, hoặc là ngày mới
    fullState[bookSlug] = {
      date: today,
      count: 1
    };
  } else {
    // Nếu vẫn trong ngày, tăng bộ đếm
    fullState[bookSlug].count++;
  }
  
  saveState(fullState);
  console.log(`Số chương đã tạo cho "${bookSlug}" hôm nay: ${fullState[bookSlug].count}/${MAX_CHAPTERS_PER_DAY}`);
}

module.exports = { canGenerate, recordGeneration };