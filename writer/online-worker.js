// writer/online-worker.js (Phiên bản cuối cùng)
const admin = require('firebase-admin');
const { FIREBASE_SERVICE_ACCOUNT, CHECK_INTERVAL_MINUTES } = require('./config.js');
const { generateText } = require('./gemini.js');
const { claimChapterTask } = require('./firestore-state.js');
const prompts = require('./prompts.js');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT) });
}
const db = admin.firestore();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findNextChapterToDo_Online() {
    const booksSnapshot = await db.collection('books').get();
    for (const bookDoc of booksSnapshot.docs) {
        const bookData = bookDoc.data();
        if (!bookData.chaptersOutline) continue; // Bỏ qua nếu sách chưa có dàn ý

        const writtenChaptersSnapshot = await bookDoc.ref.collection('chapters').get();
        const writtenChapterNumbers = new Set(writtenChaptersSnapshot.docs.map(doc => parseInt(doc.id, 10)));
        
        for (const chapterInfo of bookData.chaptersOutline) {
            if (!writtenChapterNumbers.has(chapterInfo.chapter)) {
                const previousChapterSummary = chapterInfo.chapter > 1 ? bookData.chaptersOutline[chapterInfo.chapter - 2].summary : null;
                return {
                    bookSlug: bookData.slug,
                    bookTitle: bookData.title,
                    genre: bookData.genre,
                    chapterInfo,
                    previousChapterSummary,
                };
            }
        }
    }
    return null;
}

async function startOnlineWorker() {
    console.log("🚀 Online AI Novel Worker đã khởi động. Đọc và ghi trực tiếp từ Firestore.");
    console.log("Nhấn CTRL+C để dừng worker.");

    while (true) {
        try {
            const taskInfo = await findNextChapterToDo_Online();
            if (!taskInfo) {
                console.log(`(Online) Không có chương nào để viết trên Firestore. Kiểm tra lại sau ${CHECK_INTERVAL_MINUTES} phút...`);
                await sleep(CHECK_INTERVAL_MINUTES * 60 * 1000);
                continue;
            }

            const canWork = await claimChapterTask(taskInfo.bookSlug);
            if (!canWork) {
                console.log(`(Online) [${taskInfo.bookSlug}] Không thể đòi quyền viết. Worker khác có thể đang làm việc hoặc đã hết lượt.`);
                await sleep(5000);
                continue;
            }

            const { bookSlug, bookTitle, genre, chapterInfo, previousChapterSummary } = taskInfo;
            console.log(`\n(Online) Đã đòi quyền! Bắt đầu viết [Chương ${chapterInfo.chapter}: ${chapterInfo.title}] (Lưu vào Firestore)...`);
            
            const chapterPrompt = prompts.createChapterContent(bookTitle, genre, chapterInfo.title, chapterInfo.summary, previousChapterSummary);
            const chapterContent = await generateText(chapterPrompt);

            const chapterId = String(chapterInfo.chapter).padStart(2, '0');
            const chapterRef = db.collection('books').doc(bookSlug).collection('chapters').doc(chapterId);

            await chapterRef.set({
                title: chapterInfo.title,
                chapterNumber: chapterInfo.chapter,
                content: chapterContent
            });
            console.log(`✅ (Online) Đã lưu thành công Chương ${chapterId} vào Firestore.`);
            await sleep(2000);

        } catch (error) {
            console.error("\n❌ Gặp lỗi trong worker online.", error);
            await sleep(5 * 60 * 1000);
        }
    }
}

startOnlineWorker();