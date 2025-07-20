// writer/sync-down.js
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { BOOKS_DIR, slugify } = require('../helper.js');
const { FIREBASE_SERVICE_ACCOUNT } = require('./config.js');

// Khởi tạo Firebase
if (!admin.apps.length) {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Không thể khởi tạo sync-down.js do thiếu cấu hình Firebase.");
  }
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT)
  });
}
const db = admin.firestore();
console.log('Firebase Admin initialized for Sync Down.');

/**
 * Đồng bộ dữ liệu từ Firestore về thư mục books cục bộ.
 * Chỉ tạo ra các file và thư mục còn thiếu, không ghi đè.
 */
async function syncDownFromFirebase() {
  console.log('Starting sync down from Firestore to local...');
  const booksSnapshot = await db.collection('books').get();

  if (booksSnapshot.empty) {
    console.log('No books found in Firestore. Nothing to sync down.');
    return;
  }

  // Đảm bảo thư mục books gốc tồn tại
  if (!fs.existsSync(BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR);
  }

  for (const bookDoc of booksSnapshot.docs) {
    const bookData = bookDoc.data();
    const slug = bookData.slug;
    console.log(`\nChecking book: ${bookData.title}...`);

    const bookDir = path.join(BOOKS_DIR, slug);

    // 1. Tạo thư mục sách cục bộ nếu chưa có
    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
      console.log(`  -> Created missing local directory: ${slug}`);
    }

    // 2. Tạo file outline.json cục bộ nếu chưa có (dựa trên dữ liệu từ Firestore)
    const outlinePath = path.join(bookDir, 'outline.json');
    if (!fs.existsSync(outlinePath) && bookData.chaptersOutline) {
      const localOutline = {
        title: bookData.title,
        genre: bookData.genre,
        chapters: bookData.chaptersOutline
      };
      fs.writeFileSync(outlinePath, JSON.stringify(localOutline, null, 2));
      console.log(`  -> Created missing local outline.json.`);
    }

    // 3. Lấy tất cả các chương đã viết từ sub-collection trên Firestore
    const chaptersSnapshot = await bookDoc.ref.collection('chapters').get();
    if (chaptersSnapshot.empty) {
      console.log('  -> No written chapters found in Firestore for this book.');
      continue;
    }

    for (const chapterDoc of chaptersSnapshot.docs) {
      const chapterData = chapterDoc.data();
      
      // Tạo tên file cục bộ dự kiến
      const chapterFileName = `${String(chapterData.chapterNumber).padStart(2, '0')}-${slugify(chapterData.title)}.md`;
      const localFilePath = path.join(bookDir, chapterFileName);

      // --- ĐIỀU KIỆN CỐT LÕI: Chỉ ghi file nếu nó chưa tồn tại ở local ---
      if (!fs.existsSync(localFilePath)) {
        console.log(`  -> Syncing down new chapter: ${chapterFileName}`);
        
        // Tạo lại nội dung file markdown với tiêu đề
        const fileContent = `# Chương ${chapterData.chapterNumber}: ${chapterData.title}\n\n${chapterData.content}`;
        
        fs.writeFileSync(localFilePath, fileContent);
      }
    }
  }

  console.log('\nSync down process completed successfully!');
}

syncDownFromFirebase().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('An error occurred during the sync down process:', error);
  process.exit(1);
});