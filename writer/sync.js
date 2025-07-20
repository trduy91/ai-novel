// writer/sync.js
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { BOOKS_DIR, slugify } = require("../helper.js"); // Dùng helper chung
const { FIREBASE_SERVICE_ACCOUNT } = require("./config.js");

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.log("Dừng quá trình đồng bộ do thiếu cấu hình Firebase.");
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
});
const db = admin.firestore();
console.log("Firebase Admin initialized.");

async function syncBooksToFirebase() {
  console.log("Starting sync process...");
  if (!fs.existsSync(BOOKS_DIR)) {
    console.log("Books directory not found. Nothing to sync.");
    return;
  }

  const bookSlugs = fs
    .readdirSync(BOOKS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const slug of bookSlugs) {
    const bookDir = path.join(BOOKS_DIR, slug);
    const outlinePath = path.join(bookDir, "outline.json");

    const worldFilePath = path.join(bookDir, "world.json");
    let worldBibleData = null;
    if (fs.existsSync(worldFilePath)) {
      worldBibleData = fs.readFileSync(worldFilePath, "utf-8");
    }

    if (!fs.existsSync(outlinePath)) continue;

    const outline = JSON.parse(fs.readFileSync(outlinePath, "utf-8"));
    const bookRef = db.collection("books").doc(slug);

    // Sync thông tin cơ bản của sách
    console.log(`Syncing book: ${outline.title}...`);
    await bookRef.set(
      {
        title: outline.title,
        genre: outline.genre,
        slug: slug,
        chaptersOutline: outline.chapters,
        worldBible: worldBibleData
      },
      { merge: true }
    ); // Dùng merge để không ghi đè dữ liệu không liên quan

    // Sync từng chương
    for (const chapterInfo of outline.chapters) {
      const chapterFileName = `${String(chapterInfo.chapter).padStart(
        2,
        "0"
      )}-${slugify(chapterInfo.title)}.md`;
      const chapterPath = path.join(bookDir, chapterFileName);

      if (fs.existsSync(chapterPath)) {
        const content = fs.readFileSync(chapterPath, "utf-8");
        const chapterId = String(chapterInfo.chapter).padStart(2, "0");
        const chapterRef = bookRef.collection("chapters").doc(chapterId);

        console.log(`  -> Syncing chapter ${chapterId}: ${chapterInfo.title}`);
        await chapterRef.set({
          title: chapterInfo.title,
          chapterNumber: chapterInfo.chapter,
          content: content, // Lưu toàn bộ nội dung Markdown
        });
      }
    }
  }
  console.log("Sync process completed successfully!");
}

syncBooksToFirebase()
  .then(() => {
    // Đợi một chút để đảm bảo tất cả các hoạt động ghi hoàn tất
    setTimeout(() => process.exit(0), 2000);
  })
  .catch((error) => {
    console.error("An error occurred during sync:", error);
    process.exit(1);
  });
