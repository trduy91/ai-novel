// publisher/server.js (Đã cập nhật với logic Hybrid)
const express = require("express");
const path = require("path");
const fs = require("fs");
const showdown = require("showdown");
const admin = require("firebase-admin");

const app = express();
const port = 3000;

// --- CẤU HÌNH ---
const { BOOKS_DIR, slugify } = require("../helper.js");

// --- LOGIC HYBRID ĐỌC CẤU HÌNH FIREBASE ---
let serviceAccount;
// ƯU TIÊN 1: Biến môi trường trên Vercel
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  console.log("Publisher: Found Firebase config in environment variables.");
  const serviceAccountString = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    "base64"
  ).toString("utf-8");
  serviceAccount = JSON.parse(serviceAccountString);
}
// ƯU TIÊN 2: File .json ở local
else {
  try {
    console.log(
      "Publisher: Found Firebase config in local serviceAccountKey.json file."
    );
    serviceAccount = require("./serviceAccountKey.json");
  } catch (error) {
    throw new Error(
      "FATAL ERROR: Firebase config not found. Publisher cannot start."
    );
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const converter = new showdown.Converter();

// --- ROUTES ---

// 1. Trang chủ: ĐỌC TỪ FIREBASE
app.get("/", async (req, res) => {
  try {
    const booksSnapshot = await db.collection("books").get();
    const books = booksSnapshot.docs.map((doc) => doc.data());
    res.render("index", { books, title: "Tất cả truyện" });
  } catch (error) {
    console.error("Lỗi khi đọc danh sách truyện từ Firebase:", error);
    res.status(500).render("index", { books: [], title: "Lỗi" });
  }
});

// 2. Trang sách: ĐỌC TỪ FIREBASE
app.get("/book/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const bookRef = db.collection("books").doc(slug);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists) {
      return res.status(404).send("Không tìm thấy truyện này.");
    }

    const chaptersSnapshot = await bookRef
      .collection("chapters")
      .orderBy("chapterNumber")
      .get();
    const chapters = chaptersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        title: data.title,
        fileName: `${doc.id}-${slugify(data.title)}.md`,
      };
    });

    res.render("book", { book: bookDoc.data(), chapters });
  } catch (error) {
    console.error(error);
    res.status(500).send("Lỗi máy chủ khi đọc thông tin truyện.");
  }
});

// 3. Trang chương: LOGIC HYBRID
app.get("/book/:slug/:chapterFile", async (req, res) => {
  const { slug, chapterFile } = req.params;
  const localChapterPath = path.join(BOOKS_DIR, slug, chapterFile);
  let markdownContent;
  let source = "";

  // Ưu tiên đọc file cục bộ trước
  if (fs.existsSync(localChapterPath)) {
    markdownContent = fs.readFileSync(localChapterPath, "utf-8");
    source = "từ file cục bộ";
  } else {
    // Nếu không có, fallback về Firebase
    try {
      const chapterId = chapterFile.split("-")[0];
      const chapterDoc = await db
        .collection("books")
        .doc(slug)
        .collection("chapters")
        .doc(chapterId)
        .get();
      if (chapterDoc.exists) {
        markdownContent = chapterDoc.data().content;
        source = "từ Firebase";
      } else {
        return res
          .status(404)
          .send("Không tìm thấy chương này ở cả cục bộ và Firebase.");
      }
    } catch (e) {
      console.error("Lỗi khi đọc chương từ Firebase:", e);
      return res.status(500).send("Lỗi máy chủ.");
    }
  }

  // Cả hai nguồn đều trả về markdown, nên xử lý chung ở đây
  const htmlContent = converter.makeHtml(markdownContent);

  const bookDoc = await db.collection("books").doc(slug).get();
  if (!bookDoc.exists) return res.status(404).send("Truyện không tồn tại.");
  const bookData = bookDoc.data();

  const chapterNumber = parseInt(chapterFile.split("-")[0], 10);

  // Logic tìm prev/next chap (giữ nguyên nhưng logic đọc chương khác)
  // Note: Logic này cần cải tiến để check sự tồn tại của chương prev/next
  let prevChapterLink = null,
    nextChapterLink = null;
  const chaptersSnapshot = await db
    .collection("books")
    .doc(slug)
    .collection("chapters")
    .orderBy("chapterNumber")
    .get();
  const allChapters = chaptersSnapshot.docs.map((doc) => doc.data());
  const currentIndex = allChapters.findIndex(
    (c) => c.chapterNumber === chapterNumber
  );

  if (currentIndex > 0) {
    const prev = allChapters[currentIndex - 1];
    prevChapterLink = `/book/${slug}/${String(prev.chapterNumber).padStart(
      2,
      "0"
    )}-${slugify(prev.title)}.md`;
  }
  if (currentIndex < allChapters.length - 1) {
    const next = allChapters[currentIndex + 1];
    nextChapterLink = `/book/${slug}/${String(next.chapterNumber).padStart(
      2,
      "0"
    )}-${slugify(next.title)}.md`;
  }

  res.render("chapter", {
    book: bookData,
    chapterTitle: allChapters[currentIndex].title,
    content: htmlContent,
    prevChapterLink,
    nextChapterLink,
    source, // Truyền nguồn dữ liệu để hiển thị
  });
});

// Chạy server ở local, Vercel sẽ bỏ qua phần này
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`📚 Publisher đang chạy tại http://localhost:${port}`);
  });
}

// Xuất app để Vercel có thể sử dụng
module.exports = app;
