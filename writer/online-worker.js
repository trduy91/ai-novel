// writer/online-worker.js (Phiên bản "Web Service" hoàn chỉnh cho Koyeb/Heroku/...)

// --- PHẦN 1: IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
const express = require("express"); // Thêm express để tạo server giả
const admin = require("firebase-admin");
const { FIREBASE_SERVICE_ACCOUNT, CHECK_INTERVAL_MINUTES } = require("./config.js");
const { generateText } = require("./gemini.js");
const { claimChapterTask } = require("./firestore-state.js");
const prompts = require("./prompts.js");

// --- PHẦN 2: KHỞI TẠO CÁC DỊCH VỤ & HẰNG SỐ ---

// Khởi tạo Firebase Admin một lần duy nhất
if (!admin.apps.length) {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    throw new Error(
      "Không thể khởi tạo online-worker.js do thiếu cấu hình Firebase."
    );
  }
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  });
}
const db = admin.firestore();

// Các hằng số điều khiển hoạt động của worker
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- PHẦN 3: LOGIC CỐT LÕI CỦA WORKER ---

/**
 * Tìm chương tiếp theo cần viết bằng cách so sánh dàn ý và các chương đã viết trên Firestore.
 * @returns {Promise<object|null>} - Trả về một đối tượng công việc hoặc null.
 */
async function findNextChapterToDo_Online() {
  const booksSnapshot = await db.collection("books").get();
  for (const bookDoc of booksSnapshot.docs) {
    const bookData = bookDoc.data();
    // Bỏ qua nếu sách chưa có dàn ý được đồng bộ lên
    if (!bookData.chaptersOutline || bookData.chaptersOutline.length === 0)
      continue;

    const writtenChaptersSnapshot = await bookDoc.ref
      .collection("chapters")
      .get();
    const writtenChapterNumbers = new Set(
      writtenChaptersSnapshot.docs.map((doc) => parseInt(doc.id, 10))
    );

    for (const chapterInfo of bookData.chaptersOutline) {
      if (!writtenChapterNumbers.has(chapterInfo.chapter)) {
        // Đã tìm thấy chương còn thiếu!
        const previousChapterSummary =
          chapterInfo.chapter > 1
            ? bookData.chaptersOutline[chapterInfo.chapter - 2].summary
            : null;

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
  return null; // Không tìm thấy việc gì để làm trên toàn bộ cơ sở dữ liệu
}

/**
 * Hàm chính chứa vòng lặp vô tận của worker.
 */
async function startOnlineWorker() {
  console.log(
    "🚀 Online AI Novel Worker logic has started (running as a Web Service)."
  );
  while (true) {
    try {
      // Bước 1: Tìm một công việc để làm
      const taskInfo = await findNextChapterToDo_Online();

      if (!taskInfo) {
        console.log(
          `(Online) No tasks found. Checking again in ${CHECK_INTERVAL_MINUTES} minutes...`
        );
        await sleep(CHECK_INTERVAL_MINUTES * 60 * 1000);
        continue;
      }

      // Bước 2: Đòi quyền thực hiện công việc một cách an toàn
      const canWork = await claimChapterTask(taskInfo.bookSlug);

      if (!canWork) {
        console.log(
          `(Online) [${taskInfo.bookSlug}] Could not claim task. It might be locked by another worker or the daily limit is reached.`
        );
        await sleep(5000); // Chờ một chút trước khi tìm việc mới để tránh spam
        continue;
      }

      // Bước 3: Nếu đòi quyền thành công, bắt đầu làm việc
      const {
        bookSlug,
        bookTitle,
        genre,
        chapterInfo,
        previousChapterSummary,
      } = taskInfo;
      console.log(
        `\n(Online) Task claimed! Writing [Chapter ${chapterInfo.chapter}: ${chapterInfo.title}] for "${bookTitle}"...`
      );

      // Gọi AI để tạo nội dung
      const chapterPrompt = prompts.createChapterContent(
        bookTitle,
        genre,
        chapterInfo.title,
        chapterInfo.summary,
        previousChapterSummary
      );
      const chapterContent = await generateText(chapterPrompt);

      // Lưu kết quả thẳng vào Firestore
      const chapterId = String(chapterInfo.chapter).padStart(2, "0");
      const chapterRef = db
        .collection("books")
        .doc(bookSlug)
        .collection("chapters")
        .doc(chapterId);

      await chapterRef.set({
        title: chapterInfo.title,
        chapterNumber: chapterInfo.chapter,
        content: chapterContent, // Lưu nội dung đã được làm sạch
      });
      console.log(`✅ (Online) Saved Chapter ${chapterId} to Firestore.`);
      await sleep(2000); // Nghỉ một chút giữa các lần làm việc
    } catch (error) {
      console.error("\n❌ An error occurred in the online worker loop.", error);
      await sleep(5 * 60 * 1000); // Nếu có lỗi, chờ 5 phút rồi thử lại
    }
  }
}

// --- PHẦN 4: WEB SERVER GIẢ ĐỂ "ĐÁNH LỪA" KOYEB ---
const app = express();
// Koyeb sẽ tự động cung cấp biến PORT. Nếu chạy local để test, dùng port 3001.
const PORT = process.env.PORT || 3001;

// Endpoint gốc (/) dùng để Koyeb kiểm tra sức khỏe (health check)
app.get("/", (req, res) => {
  res
    .status(200)
    .send(
      `AI Novel Worker is alive and running. Timestamp: ${new Date().toISOString()}`
    );
});

// Endpoint để xem trạng thái (tùy chọn, hữu ích để gỡ lỗi)
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    message: "Worker logic is active in a background loop.",
  });
});

// Khởi động server giả. Sau khi server sẵn sàng, worker chính mới bắt đầu chạy.
app.listen(PORT, () => {
  console.log(
    `Dummy server listening on port ${PORT} for platform health checks.`
  );
  startOnlineWorker(); // Kích hoạt vòng lặp vô tận của worker
});
