// gemini.js
// require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cấu hình model để đảm bảo output là text
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", // Dùng model "flash" để nhanh và tiết kiệm hơn
  generationConfig: { responseMimeType: "text/plain" }
});

/**
 * Gửi một prompt đến Gemini và trả về kết quả.
 * @param {string} prompt - Prompt để gửi cho AI.
 * @returns {Promise<string>} - Kết quả từ AI.
 */
async function generateText(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    throw error;
  }
}

module.exports = { generateText };