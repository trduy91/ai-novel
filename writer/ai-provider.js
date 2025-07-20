// writer/ai-provider.js (Quản lý chuỗi fallback nhiều cấp)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

require('dotenv').config({ path: '../.env' });

// --- ĐỊNH NGHĨA CHUỖI FALLBACK ---
// Đây là danh sách các model sẽ được thử theo thứ tự.
// Chúng ta sẽ lặp qua mảng này.
const AI_CANDIDATES = [
    {
        provider: 'gemini',
        modelName: 'gemini-2.0-flash', // Chất lượng cao nhất, thử đầu tiên
        // Có thể thêm các cấu hình riêng cho từng model ở đây
    },
    {
        provider: 'gemini',
        modelName: 'gemini-2.0-flash-lite', // Cân bằng, lựa chọn thứ hai
    },
    {
        provider: 'gemini',
        modelName: 'gemini-1.5-flash', 
    },
    {
        provider: 'groq',
        modelName: 'llama3-8b-8192', // Dự phòng cuối cùng
    }
];

// --- KHỞI TẠO CÁC CLIENT CỦA NHÀ CUNG CẤP ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

let geminiClient;
if (GEMINI_API_KEY) {
    try {
        geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log("✅ Gemini client configured successfully.");
    } catch (error) {
        console.warn(`⚠️  Cảnh báo: Lỗi khi khởi tạo Gemini Client. ${error.message}`);
    }
} else {
    console.warn("⚠️  Cảnh báo: Không tìm thấy GEMINI_API_KEY.");
}

let groqClient;
if (GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: GROQ_API_KEY });
    console.log("✅ Groq client configured successfully.");
} else {
    console.warn("⚠️  Cảnh báo: Không tìm thấy GROQ_API_KEY.");
}


// --- HÀM TẠO VĂN BẢN CHÍNH ---

/**
 * Gửi prompt đến một ứng cử viên AI cụ thể.
 * @param {object} candidate - Đối tượng ứng cử viên từ mảng AI_CANDIDATES.
 * @param {string} prompt - Prompt để gửi.
 * @returns {Promise<string>} - Nội dung văn bản được tạo ra.
 * @throws {Error} - Ném lỗi nếu thất bại, để vòng lặp bên ngoài có thể bắt được.
 */
async function tryCandidate(candidate, prompt) {
    console.log(`\n--> Attempting model: [${candidate.provider}] ${candidate.modelName}`);

    if (candidate.provider === 'gemini') {
        if (!geminiClient) throw new Error("Gemini client is not configured.");
        
        const model = geminiClient.getGenerativeModel({ model: candidate.modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();

    } else if (candidate.provider === 'groq') {
        if (!groqClient) throw new Error("Groq client is not configured.");

        const chatCompletion = await groqClient.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: candidate.modelName
        });
        return chatCompletion.choices[0]?.message?.content || "";

    } else {
        throw new Error(`Unknown provider: ${candidate.provider}`);
    }
}


/**
 * Hàm chính để tạo văn bản, tự động thử qua chuỗi fallback.
 * @param {string} prompt - Prompt để gửi cho AI.
 * @returns {Promise<string>} - Kết quả từ AI, hoặc chuỗi báo lỗi.
 */
async function generateText(prompt) {
    for (const candidate of AI_CANDIDATES) {
        try {
            // Thử chạy ứng cử viên hiện tại
            const result = await tryCandidate(candidate, prompt);
            
            // Nếu không có lỗi, nghĩa là đã thành công!
            console.log(`✅ Success with model: [${candidate.provider}] ${candidate.modelName}`);
            return result; 

        } catch (error) {
            // Nếu có lỗi, in ra cảnh báo và tiếp tục vòng lặp để thử ứng cử viên tiếp theo
            console.warn(`--! Model [${candidate.provider}] ${candidate.modelName} failed. Reason: ${error.message}`);
            // Có thể thêm logic kiểm tra lỗi quota ở đây nếu muốn
            const errorMessage = error.toString().toLowerCase();
            if (!errorMessage.includes('quota') && !errorMessage.includes('limit') && !errorMessage.includes('429')) {
               // Nếu không phải lỗi quota, có thể chờ một chút trước khi thử model tiếp theo
               await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // Nếu vòng lặp kết thúc mà không có kết quả, nghĩa là tất cả đều thất bại
    console.error("\n❌ All AI provider candidates failed.");
    return "[Lỗi AI: Tất cả các nhà cung cấp trong chuỗi fallback đều thất bại.]";
}

module.exports = { generateText };