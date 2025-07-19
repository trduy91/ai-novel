// worker.js
const fs = require('fs');
const path = require('path');
const { generateText } = require('./gemini');
const { BOOKS_DIR, slugify } = require('../helper');
const prompts = require('./prompts');
const { canGenerate, recordGeneration } = require('./state');

// Thời gian chờ giữa các lần kiểm tra (tính bằng phút).
// Worker sẽ kiểm tra lại sau mỗi 10 phút nếu không có gì để làm.
const CHECK_INTERVAL_MINUTES = 10;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tìm kiếm trong tất cả các sách để tìm chương tiếp theo cần viết.
 * @returns {object|null} - Trả về một đối tượng chứa thông tin công việc, hoặc null nếu không có gì để làm.
 */
function findNextChapterToDo() {
    if (!fs.existsSync(BOOKS_DIR)) {
        return null;
    }

    const existingBooks = fs.readdirSync(BOOKS_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const bookSlug of existingBooks) {
        if (!canGenerate(bookSlug)) {
            console.log(`Truyện "${bookSlug}" đã đạt giới hạn hôm nay, bỏ qua.`);
            continue; // Bỏ qua truyện này và kiểm tra truyện tiếp theo
        }
        const bookDir = path.join(BOOKS_DIR, bookSlug);
        const outlinePath = path.join(bookDir, 'outline.json');

        if (!fs.existsSync(outlinePath)) {
            continue; // Bỏ qua sách không có dàn ý
        }

        const outlineJSON = JSON.parse(fs.readFileSync(outlinePath, 'utf-8'));
        const { chapters } = outlineJSON;

        for (const chapterInfo of chapters) {
            const chapterFileName = `${String(chapterInfo.chapter).padStart(2, '0')}-${slugify(chapterInfo.title)}.md`;
            const chapterFilePath = path.join(bookDir, chapterFileName);

            if (!fs.existsSync(chapterFilePath)) {
                // ĐÃ TÌM THẤY VIỆC CẦN LÀM!
                const previousChapterSummary = chapterInfo.chapter > 1 
                    ? chapters[chapterInfo.chapter - 2].summary 
                    : null;
                
                return {
                    bookSlug,
                    bookDir,
                    outline: outlineJSON,
                    chapterInfo,
                    previousChapterSummary,
                };
            }
        }
    }
    
    // Nếu quét hết mà không tìm thấy gì
    return null;
}


/**
 * Hàm chính của worker, chạy trong một vòng lặp vô tận.
 */
async function startWorker() {
    console.log("🚀 AI Novel Worker đã khởi động. Sẽ tự động tìm và viết các chương dang dở.");
    console.log("Nhấn CTRL+C để dừng worker.");

    while (true) {
        try {            
            
            // 1. Tìm một chương để viết
            const task = findNextChapterToDo();

            if (!task) {
                console.log(`Tất cả các sách đã hoàn thành. Sẽ kiểm tra lại sau ${CHECK_INTERVAL_MINUTES} phút...`);
                await sleep(CHECK_INTERVAL_MINUTES * 60 * 1000);
                continue;
            }

            // 2. Nếu có việc và còn lượt -> Thực hiện
            const { bookSlug, bookDir, outline, chapterInfo, previousChapterSummary } = task;
            const { title: bookTitle, genre } = outline;
            
            console.log(`\nFound task: Bắt đầu viết [Chương ${chapterInfo.chapter}: ${chapterInfo.title}] cho sách "${bookTitle}"...`);
            
            const chapterPrompt = prompts.createChapterContent(
                bookTitle, genre, chapterInfo.title, chapterInfo.summary, previousChapterSummary
            );

            const chapterContent = await generateText(chapterPrompt);
            
            const chapterFileName = `${String(chapterInfo.chapter).padStart(2, '0')}-${slugify(chapterInfo.title)}.md`;
            const chapterFilePath = path.join(bookDir, chapterFileName);
            
            fs.writeFileSync(chapterFilePath, `# Chương ${chapterInfo.chapter}: ${chapterInfo.title}\n\n${chapterContent}`);
            
            console.log(`✅ Đã viết và lưu thành công Chương ${chapterInfo.chapter}.`);
            
            // Ghi nhận đã tạo 1 chương và ngay lập tức tìm việc tiếp theo
            recordGeneration(bookSlug);
            await sleep(2000); // Ngủ 2 giây để tránh spam API quá nhanh

        } catch (error) {
            console.error("\n❌ Gặp lỗi trong quá trình xử lý. Worker sẽ tạm dừng và thử lại sau ít phút.", error);
            await sleep(5 * 60 * 1000); // Chờ 5 phút nếu có lỗi
        }
    }
}

// Bắt sự kiện CTRL+C để thoát một cách duyên dáng
process.on('SIGINT', () => {
    console.log("\n🛑 Đã nhận được tín hiệu dừng. Tạm biệt!");
    process.exit(0);
});

startWorker();