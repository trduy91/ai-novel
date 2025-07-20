// writer/firestore-state.js
const admin = require('firebase-admin');
const { FIREBASE_SERVICE_ACCOUNT, MAX_CHAPTERS_PER_DAY } = require('./config.js');

// Khởi tạo một lần duy nhất nếu chưa có
if (!admin.apps.length) {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Không thể khởi tạo firestore-state.js do thiếu cấu hình Firebase.");
  }
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT)
  });
}

const db = admin.firestore();
const stateCollection = db.collection('generationStates');

/**
 * Cố gắng "đòi" quyền viết chương tiếp theo một cách an toàn (atomic).
 * Đây là hàm cốt lõi để ngăn chặn race condition.
 * @param {string} bookSlug - Slug của truyện cần đòi quyền.
 * @returns {Promise<boolean>} - True nếu đòi thành công, False nếu thất bại.
 */
async function claimChapterTask(bookSlug) {
  const stateRef = stateCollection.doc(bookSlug);
  const today = new Date().toISOString().split('T')[0];

  try {
    const wasClaimed = await db.runTransaction(async (transaction) => {
      const stateDoc = await transaction.get(stateRef);

      // Trường hợp chưa có state hoặc là ngày mới -> có thể đòi
      if (!stateDoc.exists || stateDoc.data().date !== today) {
        transaction.set(stateRef, { date: today, count: 1 });
        console.log(`[${bookSlug}] Task claimed successfully (new day/first time).`);
        return true;
      }

      const currentState = stateDoc.data();
      // Trường hợp còn lượt trong ngày -> có thể đòi
      if (currentState.count < MAX_CHAPTERS_PER_DAY) {
        const newCount = currentState.count + 1;
        transaction.update(stateRef, { count: newCount });
        console.log(`[${bookSlug}] Task claimed successfully. Count is now ${newCount}.`);
        return true;
      }
      
      // Hết lượt, không thể đòi
      return false;
    });
    return wasClaimed;
  } catch (e) {
    console.error(`[${bookSlug}] Transaction to claim task failed: `, e);
    return false;
  }
}

// Các hàm này vẫn hữu ích cho các script khác như main.js
async function canGenerate(bookSlug) {
  const stateDoc = await stateCollection.doc(bookSlug).get();
  const today = new Date().toISOString().split('T')[0];
  if (!stateDoc.exists) return true;
  const bookState = stateDoc.data();
  if (bookState.date !== today) return true;
  return bookState.count < MAX_CHAPTERS_PER_DAY;
}

async function recordGeneration(bookSlug) {
  await claimChapterTask(bookSlug); // Ghi nhận cũng chính là đòi quyền
}


module.exports = {
  claimChapterTask,
  canGenerate,
  recordGeneration
};