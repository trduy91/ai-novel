// writer/bible-manager.js
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { BOOKS_DIR, slugify, extractJsonFromString, formatWorldBibleForPrompt } = require('../helper.js');
const { FIREBASE_SERVICE_ACCOUNT } = require('./config.js');
const { generateText } = require('./ai-provider.js');
const prompts = require('./prompts.js');

/**
 * Khởi tạo Firebase Admin một cách an toàn, chỉ một lần duy nhất.
 */
function initializeFirebase() {
    if (!admin.apps.length && FIREBASE_SERVICE_ACCOUNT) {
        admin.initializeApp({ credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT) });
    }
}

/**
 * Cập nhật World Bible từ các file cục bộ và tự động đồng bộ lên Firestore.
 * Dành cho worker offline và các chức năng trong main.js.
 * @param {string} bookSlug - Slug của truyện cần cập nhật.
 */
async function updateWorldBibleFromLocal(bookSlug) {
    console.log(`\n[BibleManager-Local] Starting to update World Bible for "${bookSlug}"...`);
    
    const bookDir = path.join(BOOKS_DIR, bookSlug);
    const outlinePath = path.join(bookDir, 'outline.json');
    if (!fs.existsSync(outlinePath)) {
        console.error(`[BibleManager-Local] Cannot update Bible, outline.json not found for "${bookSlug}".`);
        return;
    }
    const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf-8'));

    const writtenChapters = outline.chapters.filter(chap => 
        fs.existsSync(path.join(bookDir, `${String(chap.chapter).padStart(2, '0')}-${slugify(chap.title)}.md`))
    );
    if (writtenChapters.length === 0) {
        console.log(`[BibleManager-Local] No written chapters found for "${bookSlug}". Skipping Bible update.`);
        return;
    }

    const allChaptersContent = writtenChapters.map(chap => 
        `\n\n--- CONTENT OF CHAPTER ${chap.chapter}: ${chap.title} ---\n\n` + 
        fs.readFileSync(path.join(bookDir, `${String(chap.chapter).padStart(2, '0')}-${slugify(chap.title)}.md`), 'utf-8')
    ).join('');

    let existingWorldBible = null;
    const worldFilePath = path.join(bookDir, 'world.json');
    if (fs.existsSync(worldFilePath)) {
        try {
            const worldBibleJSON = JSON.parse(fs.readFileSync(worldFilePath, 'utf-8'));
            existingWorldBible = formatWorldBibleForPrompt(worldBibleJSON);
        } catch (e) {
            console.error(`[BibleManager-Local] Could not parse existing world.json for "${bookSlug}". Using raw content as fallback.`, e);
            existingWorldBible = fs.readFileSync(worldFilePath, 'utf-8');
        }
    }

    const biblePrompt = prompts.generateWorldBible(outline.title, JSON.stringify(outline), allChaptersContent, existingWorldBible);
    
    try {
        const response = await generateText(biblePrompt);
        const jsonString = extractJsonFromString(response);
        if (!jsonString) {
            console.error(`[BibleManager-Local] Failed to extract JSON for "${bookSlug}" from AI response.`);
            return;
        }
        const newWorldBibleJSON = JSON.parse(jsonString);

        // Lưu file local
        fs.writeFileSync(worldFilePath, JSON.stringify(newWorldBibleJSON, null, 2));
        console.log(`✅ [BibleManager-Local] Updated local world.json for "${bookSlug}".`);

        // Đồng bộ lên Firestore
        initializeFirebase();
        if (admin.apps.length) {
            const db = admin.firestore();
            const bookRef = db.collection('books').doc(bookSlug);
            await bookRef.set({ worldBible: JSON.stringify(newWorldBibleJSON, null, 2) }, { merge: true });
            console.log(`✅ [BibleManager-Local] Synced updated World Bible to Firestore for "${bookSlug}".`);
        }
    } catch (e) {
        console.error(`[BibleManager-Local] Error during AI call or file saving for "${bookSlug}":`, e);
    }
}

/**
 * Cập nhật World Bible hoàn toàn trên Firestore.
 * Dành cho worker online.
 * @param {string} bookSlug - Slug của truyện cần cập nhật.
 */
async function updateWorldBibleFromFirestore(bookSlug) {
    console.log(`\n[BibleManager-Online] Starting to update World Bible for "${bookSlug}"...`);
    
    try {
        initializeFirebase();
        const db = admin.firestore();
        const bookRef = db.collection('books').doc(bookSlug);
        const bookDoc = await bookRef.get();
        if (!bookDoc.exists || !bookDoc.data().chaptersOutline) {
            console.error(`[BibleManager-Online] Cannot update Bible, book doc or outline not found in Firestore for "${bookSlug}".`);
            return;
        }

        const bookData = bookDoc.data();
        
        const chaptersSnapshot = await bookRef.collection('chapters').orderBy('chapterNumber').get();
        if (chaptersSnapshot.empty) {
            console.log(`[BibleManager-Online] No written chapters found in Firestore for "${bookSlug}". Skipping Bible update.`);
            return;
        }

        const allChaptersContent = chaptersSnapshot.docs
            .map(doc => `\n\n--- CONTENT OF CHAPTER ${doc.data().chapterNumber}: ${doc.data().title} ---\n\n` + doc.data().content)
            .join('');

        let existingWorldBible = null;
        if (bookData.worldBible) {
            try {
                const worldBibleJSON = JSON.parse(bookData.worldBible);
                existingWorldBible = formatWorldBibleForPrompt(worldBibleJSON);
            } catch (e) {
                console.error(`[BibleManager-Online] Could not parse existing worldBible from Firestore for "${bookSlug}". Using raw content.`, e);
                existingWorldBible = bookData.worldBible;
            }
        }
        
        const biblePrompt = prompts.generateWorldBible(bookData.title, JSON.stringify({ chapters: bookData.chaptersOutline }), allChaptersContent, existingWorldBible);
        
        const response = await generateText(biblePrompt);
        const jsonString = extractJsonFromString(response);
        if (!jsonString) {
            console.error(`[BibleManager-Online] Failed to extract JSON for "${bookSlug}" from AI response.`);
            return;
        }

        await bookRef.set({ worldBible: jsonString }, { merge: true });
        console.log(`✅ [BibleManager-Online] Updated World Bible in Firestore for "${bookSlug}".`);

    } catch (e) {
        console.error(`[BibleManager-Online] Error updating World Bible for "${bookSlug}":`, e);
    }
}

module.exports = {
    updateWorldBibleFromLocal,
    updateWorldBibleFromFirestore
};