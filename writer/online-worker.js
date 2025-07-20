// writer/online-worker.js (Phiên bản "Web Service" hoàn chỉnh, linh hoạt và an toàn)

// --- PHẦN 1: IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
const express = require('express');
const admin = require('firebase-admin');
const { FIREBASE_SERVICE_ACCOUNT, CHECK_INTERVAL_MINUTES } = require('./config.js');
const { generateText } = require('./ai-provider.js');
const { claimChapterTask } = require('./firestore-state.js');
const prompts = require('./prompts.js');
// helper.js vẫn cần cho các hàm khác như slugify, extractJsonFromString, ...
const { extractJsonFromString, formatWorldBibleForPrompt } = require('../helper.js'); 
const { updateWorldBibleFromFirestore } = require('./bible-manager.js');


// --- PHẦN 2: KHỞI TẠO CÁC DỊCH VỤ & HẰNG SỐ ---

// Khởi tạo Firebase Admin một lần duy nhất
if (!admin.apps.length) {
    if (!FIREBASE_SERVICE_ACCOUNT) {
        throw new Error("Không thể khởi tạo online-worker.js do thiếu cấu hình Firebase.");
    }
    admin.initializeApp({
        credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT)
    });
}
const db = admin.firestore();

// Các hằng số điều khiển hoạt động của worker
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// --- PHẦN 3: LOGIC CỐT LÕI CỦA WORKER ---

/**
 * Tìm chương tiếp theo cần viết VÀ ĐÒI QUYỀN VIẾT THÀNH CÔNG.
 * Đây là hàm tìm việc thông minh, có khả năng bỏ qua các truyện đã đạt giới hạn.
 * @returns {Promise<object|null>} - Trả về một đối tượng công việc đã được "khóa", hoặc null.
 */
async function findAndClaimNextChapterToDo_Online() {
    const booksSnapshot = await db.collection('books').get();

    for (const bookDoc of booksSnapshot.docs) {
        const bookData = bookDoc.data();
        const bookSlug = bookData.slug;

        // Bỏ qua nếu sách không có dàn ý
        if (!bookData.chaptersOutline || bookData.chaptersOutline.length === 0) continue;

        const writtenChaptersSnapshot = await bookDoc.ref.collection('chapters').get();
        const writtenChapterNumbers = new Set(writtenChaptersSnapshot.docs.map(doc => parseInt(doc.id, 10)));
        
        for (const chapterInfo of bookData.chaptersOutline) {
          if (!chapterInfo || typeof chapterInfo.chapter !== 'number') continue;

            if (!writtenChapterNumbers.has(chapterInfo.chapter)) {
                // Đã tìm thấy một chương còn thiếu (ứng cử viên).
                // Thử đòi quyền ngay lập tức.
                const wasClaimed = await claimChapterTask(bookSlug);
                
                if (wasClaimed) {
                    // Đòi quyền THÀNH CÔNG! Đây chính là công việc của chúng ta.
                    console.log(`[${bookSlug}] Found a missing chapter AND successfully claimed the task.`);
                    let previousChapterSummary = null;
                    const prevChapterIndex = chapterInfo.chapter - 2;

                    // Chỉ lấy tóm tắt nếu:
                    // 1. Đây không phải là chương đầu tiên.
                    // 2. Chỉ số của chương trước đó hợp lệ (lớn hơn hoặc bằng 0).
                    // 3. Phần tử chương trước đó trong dàn ý thực sự tồn tại.
                    if (chapterInfo.chapter > 1 && prevChapterIndex >= 0 && bookData.chaptersOutline[prevChapterIndex]) {
                        previousChapterSummary = bookData.chaptersOutline[prevChapterIndex].summary;
                    }
                    
                    // Trả về task đã được "khóa"
                    return {
                        bookSlug,
                        bookTitle: bookData.title,
                        genre: bookData.genre,
                        chapterInfo,
                        previousChapterSummary,
                    };
                } else {
                    // Đòi quyền THẤT BẠI.
                    // Dừng kiểm tra các chương khác của truyện này và chuyển sang truyện tiếp theo.
                    console.log(`(Online) [${bookSlug}] Found a missing chapter but could not claim task. Moving to the next book.`);
                    break; // Thoát khỏi vòng lặp `for (const chapterInfo...)`
                }
            }
        }
    }
    
    // Nếu quét hết tất cả các truyện mà không tìm được và đòi quyền thành công
    return null;
}

/**
 * Hàm chính chứa vòng lặp vô tận của worker.
 */
async function startOnlineWorker() {
    console.log("🚀 Online AI Novel Worker logic has started (running as a Web Service).");
    while (true) {
        try {
            // Bước 1: Tìm và đòi quyền trong cùng một hàm
            const taskInfo = await findAndClaimNextChapterToDo_Online();

            if (!taskInfo) {
                console.log(`(Online) No available tasks found. Checking again in ${CHECK_INTERVAL_MINUTES} minutes...`);
                await sleep(CHECK_INTERVAL_MINUTES * 60 * 1000);
                continue;
            }
            
            // Bước 2: Nếu đến được đây, taskInfo đã được khóa. Chỉ cần làm việc.
            const { bookSlug, bookTitle, genre, chapterInfo, previousChapterSummary } = taskInfo;
            console.log(`\n(Online) Task claimed! Writing [Chapter ${chapterInfo.chapter}: ${chapterInfo.title}] for "${bookTitle}"...`);

            // Đọc World Bible từ Firestore
            const bookDoc = await db.collection('books').doc(bookSlug).get();
            let worldBibleContent = null;
            if (bookDoc.exists && bookDoc.data().worldBible) {
                try {
                    const worldBibleJSON = JSON.parse(bookDoc.data().worldBible);
                    worldBibleContent = formatWorldBibleForPrompt(worldBibleJSON);
                } catch (e) {
                    worldBibleContent = bookDoc.data().worldBible; // Fallback
                }
            }

            // Gọi AI để tạo nội dung
            const chapterPrompt = prompts.createChapterContent(bookTitle, genre, chapterInfo.title, chapterInfo.summary, previousChapterSummary, worldBibleContent);
            
            const chapterContent = await generateText(chapterPrompt);

            // Lưu kết quả thẳng vào Firestore
            const chapterId = String(chapterInfo.chapter).padStart(2, '0');
            const chapterRef = db.collection('books').doc(bookSlug).collection('chapters').doc(chapterId);

            await chapterRef.set({
                title: chapterInfo.title,
                chapterNumber: chapterInfo.chapter,
                content: chapterContent // Lưu nội dung thô trực tiếp từ AI
            });

            console.log(`✅ (Online) Saved Chapter ${chapterId} to Firestore.`);

            // BƯỚC 3: TỰ ĐỘNG CẬP NHẬT WORLD BIBLE (chạy ngầm)
            updateWorldBibleFromFirestore(bookSlug);

            await sleep(2000);

        } catch (error) {
            console.error("\n❌ An error occurred in the online worker loop.", error);
            await sleep(5 * 60 * 1000); // Nếu có lỗi, chờ 5 phút rồi thử lại
        }
    }
}


// --- PHẦN 4: WEB SERVER GIẢ ĐỂ TƯƠNG THÍCH VỚI HOSTING MIỄN PHÍ ---
const app = express();
const PORT = process.env.PORT || 3001; 

// Endpoint gốc (/) dùng để kiểm tra sức khỏe (health check)
app.get('/', (req, res) => {
  res.status(200).send(`AI Novel Worker is alive and running. Timestamp: ${new Date().toISOString()}`);
});

// Endpoint để xem trạng thái (tùy chọn, hữu ích để gỡ lỗi)
app.get('/status', (req, res) => {
    res.json({
        status: "running",
        message: "Worker logic is active in a background loop."
    });
});

// Khởi động server giả. Sau khi server sẵn sàng, worker chính mới bắt đầu chạy.
app.listen(PORT, () => {
  console.log(`Dummy server listening on port ${PORT} for platform health checks.`);
  startOnlineWorker(); // Kích hoạt vòng lặp vô tận của worker
});