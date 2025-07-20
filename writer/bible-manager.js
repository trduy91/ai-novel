/**
 * TÁI SỬ DỤNG: Tự động cập nhật file world.json dựa trên toàn bộ nội dung đã viết.
 * Hàm này sẽ chạy ở chế độ nền mà không cần tương tác người dùng.
 * @param {string} bookSlug - Slug của truyện cần cập nhật.
 * @returns {Promise<void>}
 */
async function autoUpdateWorldBible(bookSlug) {
  console.log(`\n[Auto-Update] Starting to update World Bible for "${bookSlug}"...`);
  
  const bookDir = path.join(BOOKS_DIR, bookSlug);
  
  // 1. Thu thập dữ liệu
  const outlinePath = path.join(bookDir, 'outline.json');
  if (!fs.existsSync(outlinePath)) return; // Không thể làm gì nếu không có dàn ý
  const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf-8'));
  
  const writtenChapters = outline.chapters.filter(chap => 
    fs.existsSync(path.join(bookDir, `${String(chap.chapter).padStart(2, '0')}-${slugify(chap.title)}.md`))
  );
  if (writtenChapters.length === 0) return; // Không có gì để phân tích

  const allChaptersContent = writtenChapters.map(chap => 
    `\n\n--- CONTENT OF CHAPTER ${chap.chapter}: ${chap.title} ---\n\n` + 
    fs.readFileSync(path.join(bookDir, `${String(chap.chapter).padStart(2, '0')}-${slugify(chap.title)}.md`), 'utf-8')
  ).join('');

  const worldFilePath = path.join(bookDir, 'world.json');
  const existingWorldBible = fs.existsSync(worldFilePath) ? fs.readFileSync(worldFilePath, 'utf-8') : null;

  // 2. Tạo prompt và gọi AI
  const biblePrompt = prompts.generateWorldBible(outline.title, JSON.stringify(outline), allChaptersContent, existingWorldBible);
  
  try {
    const response = await generateText(biblePrompt);
    const jsonString = extractJsonFromString(response);
    if (!jsonString) {
      console.error(`[Auto-Update] Failed to extract JSON from AI response for "${bookSlug}".`);
      return;
    }
    const newWorldBibleJSON = JSON.parse(jsonString);

    // 3. Lưu lại file local một cách âm thầm
    fs.writeFileSync(worldFilePath, JSON.stringify(newWorldBibleJSON, null, 2));
    console.log(`✅ [Auto-Update] Successfully updated local world.json for "${bookSlug}".`);

    // 4. Đồng bộ lên Firestore một cách âm thầm
    const { FIREBASE_SERVICE_ACCOUNT } = require('./config.js');
    if (FIREBASE_SERVICE_ACCOUNT) {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT) });
        }
        const db = admin.firestore();
        const bookRef = db.collection('books').doc(bookSlug);
        await bookRef.set({ worldBible: JSON.stringify(newWorldBibleJSON, null, 2) }, { merge: true });
        console.log(`✅ [Auto-Update] Successfully synced updated World Bible to Firestore for "${bookSlug}".`);
    }

  } catch (e) {
    console.error(`[Auto-Update] An error occurred while updating World Bible for "${bookSlug}":`, e);
  }
}

/**
 * TÁI SỬ DỤNG (ONLINE): Tự động cập nhật world.json trên Firestore.
 */
async function autoUpdateWorldBible_Online(bookSlug) {
  console.log(`\n[Auto-Update-Online] Starting to update World Bible for "${bookSlug}"...`);
  
  try {
    const bookRef = db.collection('books').doc(bookSlug);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists || !bookDoc.data().chaptersOutline) return;

    const bookData = bookDoc.data();
    
    const chaptersSnapshot = await bookRef.collection('chapters').orderBy('chapterNumber').get();
    if (chaptersSnapshot.empty) return;

    const allChaptersContent = chaptersSnapshot.docs
        .map(doc => `\n\n--- CONTENT OF CHAPTER ${doc.data().chapterNumber}: ${doc.data().title} ---\n\n` + doc.data().content)
        .join('');

    const existingWorldBible = bookData.worldBible || null;
    
    const biblePrompt = prompts.generateWorldBible(bookData.title, JSON.stringify({ chapters: bookData.chaptersOutline }), allChaptersContent, existingWorldBible);
    
    const response = await generateText(biblePrompt);
    const jsonString = extractJsonFromString(response);
    if (!jsonString) {
      console.error(`[Auto-Update-Online] Failed to extract JSON from AI response for "${bookSlug}".`);
      return;
    }

    // Lưu lại thẳng vào document của sách trên Firestore
    await bookRef.set({ worldBible: jsonString }, { merge: true });
    console.log(`✅ [Auto-Update-Online] Successfully updated World Bible in Firestore for "${bookSlug}".`);

  } catch (e) {
    console.error(`[Auto-Update-Online] An error occurred while updating World Bible for "${bookSlug}":`, e);
  }
}

module.exports = {
  autoUpdateWorldBible,
  autoUpdateWorldBible_Online
}