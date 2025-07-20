// writer/worker.js (Phiên bản cuối cùng, dùng state online)
const fs = require('fs');
const path = require('path');
const { generateText } = require('./gemini.js');
const prompts = require('./prompts.js');
const { claimChapterTask } = require('./firestore-state.js'); 
const { BOOKS_DIR, slugify } = require('../helper.js');
const { CHECK_INTERVAL_MINUTES } = require('./config.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findNextChapterToDo_Offline() {
    if (!fs.existsSync(BOOKS_DIR)) return null;
    const bookSlugs = fs.readdirSync(BOOKS_DIR).filter(f => fs.statSync(path.join(BOOKS_DIR, f)).isDirectory());

    for (const bookSlug of bookSlugs) {
        const bookDir = path.join(BOOKS_DIR, bookSlug);
        const outlinePath = path.join(bookDir, 'outline.json');
        if (!fs.existsSync(outlinePath)) continue;

        const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf-8'));
        for (const chapterInfo of outline.chapters) {
            const chapterFilePath = path.join(bookDir, `${String(chapterInfo.chapter).padStart(2, '0')}-${slugify(chapterInfo.title)}.md`);
            if (!fs.existsSync(chapterFilePath)) {
                const previousChapterSummary = chapterInfo.chapter > 1 ? outline.chapters[chapterInfo.chapter - 2].summary : null;
                return { bookSlug, bookDir, outline, chapterInfo, previousChapterSummary };
            }
        }
    }
    return null;
}

async function startOfflineWorker() {
    console.log("🚀 Offline AI Worker đã khởi động (State được quản lý bởi Firestore).");
    console.log("Nhấn CTRL+C để dừng worker.");

    while (true) {
        try {
            const taskInfo = await findNextChapterToDo_Offline();
            if (!taskInfo) {
                console.log(`(Offline) Không tìm thấy chương nào để viết ở local. Kiểm tra lại sau ${CHECK_INTERVAL_MINUTES} phút...`);
                await sleep(CHECK_INTERVAL_MINUTES * 60 * 1000);
                continue;
            }

            const canWork = await claimChapterTask(taskInfo.bookSlug);
            if (!canWork) {
                console.log(`(Offline) [${taskInfo.bookSlug}] Không thể đòi quyền viết. Worker khác có thể đang làm việc hoặc đã hết lượt.`);
                await sleep(5000); // Chờ một chút trước khi thử lại
                continue;
            }

            const { bookDir, outline, chapterInfo, previousChapterSummary } = taskInfo;
            console.log(`\n(Offline) Đã đòi quyền! Bắt đầu viết [Chương ${chapterInfo.chapter}: ${chapterInfo.title}] (Lưu vào file local)...`);
            
            const chapterPrompt = prompts.createChapterContent(outline.title, outline.genre, chapterInfo.title, chapterInfo.summary, previousChapterSummary);
            const chapterContent = await generateText(chapterPrompt);

            const chapterFileName = `${String(chapterInfo.chapter).padStart(2, '0')}-${slugify(chapterInfo.title)}.md`;
            fs.writeFileSync(path.join(bookDir, chapterFileName), `# Chương ${chapterInfo.chapter}: ${chapterInfo.title}\n\n${chapterContent}`);
            
            console.log(`✅ (Offline) Đã viết và lưu thành công Chương ${chapterInfo.chapter} vào file.`);
            await sleep(2000);

        } catch (error) {
            console.error("\n❌ Gặp lỗi trong worker offline.", error);
            await sleep(5 * 60 * 1000);
        }
    }
}

startOfflineWorker();