// prompts.js

const prompts = {
  createTitle: (genre, keywords) => `
    Hãy tạo 5 tựa đề tiểu thuyết hấp dẫn thuộc thể loại "${genre}".
    Nếu có thể, hãy lồng ghép các từ khóa sau: "${keywords}".
    Chỉ trả về danh sách các tựa đề, mỗi tựa đề trên một dòng, không giải thích gì thêm.
  `,

  createOutline: (title, genre) => `
    Bạn là 1 nhà văn nổi tiếng chuyên viết truyện thuộc thể loại "${genre}".
    Dựa vào tựa đề tiểu thuyết "${title}", ở thể loại sở trường của bạn, hãy tạo một dàn ý chi tiết cho một cuốn tiểu thuyết khoảng 500-700 chương.
    Trả về dưới dạng JSON với cấu trúc sau:
    {
      "title": "${title}",
      "genre": "${genre}",
      "chapters": [
        { "chapter": 1, "title": "Tựa đề chương 1", "summary": "Tóm tắt ngắn gọn nội dung chính của chương 1." },
        { "chapter": 2, "title": "Tựa đề chương 2", "summary": "Tóm tắt ngắn gọn nội dung chính của chương 2." }
      ]
    }
    Mỗi object trong chapters chỉ tương ứng với 1 chương, không thực hiện viết gộp.
    Chỉ trả về đối tượng JSON, không có bất kỳ văn bản nào khác bao quanh.
  `,

  createChapterContent: (
    bookTitle,
    genre,
    chapterTitle,
    chapterSummary,
    previousChapterSummary = null,
    worldBible = null
  ) => `
    Bạn là một nhà văn tài năng. Hãy viết nội dung chi tiết cho chương có tựa đề "${chapterTitle}" của cuốn tiểu thuyết "${bookTitle}" thuộc thể loại "${genre}".
    
    ${
      worldBible
        ? `
      BỐI CẢNH VÀ NHÂN VẬT QUAN TRỌNG (GHI NHỚ VÀ TUÂN THỦ NGHIÊM NGẶT):
      ---
      ${worldBible}
      ---
      `
        : ""
    }

    Tóm tắt nội dung chính của chương này là: "${chapterSummary}".
    ${
      previousChapterSummary
        ? `Để có sự liền mạch, đây là tóm tắt của chương trước: "${previousChapterSummary}"`
        : ""
    }
    YÊU CẦU QUAN TRỌNG VỀ ĐỊNH DẠNG:
    1.  **KHÔNG** viết bất kỳ lời dẫn, lời chào, hay câu bình luận nào. Ví dụ: không viết "Đây là chương bạn yêu cầu:" hay "Hy vọng bạn thích chương này.".
    2.  **BẮT ĐẦU NGAY LẬP TỨC** bằng nội dung của chương truyện. Dòng đầu tiên của câu trả lời phải là dòng đầu tiên của chương.
    3.  Viết với giọng văn lôi cuốn, tập trung vào việc phát triển nhân vật, xây dựng không khí và thúc đẩy cốt truyện.
    4.  Hãy viết với giọng văn lôi cuốn, tập trung vào việc phát triển nhân vật, xây dựng không khí và thúc đẩy cốt truyện. Độ dài khoảng 2000-3000 từ.
  `,

  generateWorldBible: (
    bookTitle,
    outline,
    existingChaptersContent,
    existingWorldBible = null
  ) => `
Bạn là một người ghi chép và phân tích văn học cực kỳ tỉ mỉ. Nhiệm vụ của bạn là đọc toàn bộ tài liệu của một cuốn tiểu thuyết đang viết dở và tạo ra một file hồ sơ (World Bible) ở định dạng JSON.

Tựa đề truyện: "${bookTitle}"

Dàn ý tổng thể của truyện:
---
${outline}
---

Nội dung các chương đã được viết:
---
${existingChaptersContent}
---

${
  existingWorldBible
    ? `
Hồ sơ World Bible hiện tại (để tham khảo và bổ sung):
---
${existingWorldBible}
---
`
    : ""
}

YÊU CẦU:
1.  Đọc và phân tích kỹ lưỡng tất cả các tài liệu trên.
2.  Xác định tất cả các thực thể quan trọng bao gồm:
    *   **Nhân vật (characters):** Tên, mô tả ngắn gọn về ngoại hình, tính cách, và vai trò của họ dựa trên những gì đã xuất hiện.
    *   **Địa danh (places):** Tên các thành phố, làng mạc, khu rừng, tòa nhà... và mô tả chúng.
    *   **Hệ thống/Luật lệ (lore):** Các sự kiện lịch sử, các khái niệm ma thuật, các vật phẩm đặc biệt, hoặc các quy tắc của thế giới đã được đề cập.
3.  Tổng hợp tất cả thông tin này vào một đối tượng JSON duy nhất.
4.  Sử dụng cấu trúc sau, ĐẶC BIỆT LƯU Ý: phải tuân thủ nghiêm ngặt định dạng "key": "value".:
    {
      "characters": [ { "name": "...", "description": "..." } ],
      "places": [ { "name": "...", "description": "..." } ],
      "lore": [
         { "item": "Vật phẩm 1", "description": "Mô tả chi tiết về vật phẩm 1" },
         { "concept": "Khái niệm 1", "description": "Mô tả chi tiết về khái niệm 1" }
       ]
    }
5.  **CHỈ TRẢ VỀ ĐỐI TƯỢNG JSON.** Không có bất kỳ lời dẫn, giải thích hay markdown nào khác bao quanh nó.
`,
  reworkChapterContent: (chapterTitle, originalContent, instructions) => `
  Bạn là một biên tập viên văn học tài năng. Nhiệm vụ của bạn là đọc và viết lại một chương truyện đã có dựa trên những chỉ dẫn cụ thể.
  
  Tựa đề chương: "${chapterTitle}"
  
  Nội dung chương gốc cần viết lại:
  ---
  ${originalContent}
  ---
  
  Chỉ dẫn của tác giả để viết lại chương này: "${instructions}"
  
  YÊU CẦU:
  1.  Hãy viết lại toàn bộ chương, lồng ghép một cách tự nhiên các yêu cầu trong chỉ dẫn. Đừng chỉ thêm thắt một vài câu.
  2.  Giữ lại những yếu tố tốt của chương gốc nếu không có chỉ dẫn nào yêu cầu thay đổi chúng.
  3.  **KHÔNG** viết bất kỳ lời dẫn hay bình luận nào. Bắt đầu ngay lập tức bằng nội dung của chương đã được viết lại.
  `,
};

module.exports = prompts;
