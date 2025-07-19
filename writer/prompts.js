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

  createChapterContent: (bookTitle, genre, chapterTitle, chapterSummary, previousChapterSummary = null) => `
    Bạn là một nhà văn tài năng. Hãy viết nội dung chi tiết cho chương có tựa đề "${chapterTitle}" của cuốn tiểu thuyết "${bookTitle}" thuộc thể loại "${genre}".
    Tóm tắt nội dung chính của chương này là: "${chapterSummary}".
    ${previousChapterSummary ? `Để có sự liền mạch, đây là tóm tắt của chương trước: "${previousChapterSummary}"` : ''}

    Hãy viết với giọng văn lôi cuốn, tập trung vào việc phát triển nhân vật, xây dựng không khí và thúc đẩy cốt truyện. Độ dài khoảng 2000-3000 từ.
  `
};

module.exports = prompts;