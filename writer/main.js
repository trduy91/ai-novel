// main.js
const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { generateText } = require("./gemini");
const prompts = require("./prompts");
const { canGenerate, recordGeneration } = require("./state");
const { slugify, BOOKS_DIR } = require("../helper");

/**
 * Hàm chính để viết các chương, kiểm tra file đã tồn tại và giới hạn hàng ngày.
 * @param {string} bookDir - Đường dẫn thư mục của sách.
 * @param {object} outlineJSON - Đối tượng dàn ý đã được parse.
 */
async function writeChapters(bookDir, outlineJSON) {
  console.log("\nBắt đầu/Tiếp tục quá trình viết chương...");
  const { title: bookTitle, genre, chapters } = outlineJSON;
  const bookSlug = path.basename(bookDir); // Lấy slug từ đường dẫn thư mục

  for (const chapterInfo of chapters) {
    const chapterFileName = `${String(chapterInfo.chapter).padStart(
      2,
      "0"
    )}-${slugify(chapterInfo.title)}.md`;
    const chapterFilePath = path.join(bookDir, chapterFileName);

    // --- LOGIC QUAN TRỌNG: KIỂM TRA NẾU CHƯƠNG ĐÃ TỒN TẠI ---
    if (fs.existsSync(chapterFilePath)) {
      console.log(`Chương ${chapterInfo.chapter} đã tồn tại, bỏ qua.`);
      continue;
    }

    // Kiểm tra giới hạn hàng ngày trước khi tạo chương mới
    // if (!canGenerate(bookSlug)) {
    //   console.log(`Đã đạt giới hạn cho truyện "${bookSlug}" hôm nay.`);
    //   break; // Dừng lại nếu đã đạt giới hạn
    // }

    console.log(
      `\nChuẩn bị viết Chương ${chapterInfo.chapter}: ${chapterInfo.title}...`
    );

    const previousChapterSummary =
      chapterInfo.chapter > 1
        ? chapters[chapterInfo.chapter - 2].summary
        : null;

    const chapterPrompt = prompts.createChapterContent(
      bookTitle,
      genre,
      chapterInfo.title,
      chapterInfo.summary,
      previousChapterSummary
    );

    try {
      const chapterContent = await generateText(chapterPrompt);
      fs.writeFileSync(
        chapterFilePath,
        `# Chương ${chapterInfo.chapter}: ${chapterInfo.title}\n\n${chapterContent}`
      );
      console.log(
        `Đã viết và lưu thành công Chương ${chapterInfo.chapter} vào file ${chapterFileName}`
      );
      recordGeneration(bookSlug); // Ghi nhận đã tạo 1 chương
    } catch (error) {
      console.error(
        `Gặp lỗi khi tạo nội dung chương ${chapterInfo.chapter}. Sẽ thử lại vào lần chạy sau.`
      );
      break; // Dừng vòng lặp nếu có lỗi API
    }
  }
}

/**
 * Luồng công việc cho phép người dùng chọn một chương và yêu cầu AI viết lại.
 */
async function reworkChapter() {
  console.log("\n[✏️ Chỉnh sửa/Viết lại một chương]");
  
  // 1. Chọn truyện
  const bookSlugs = fs.readdirSync(BOOKS_DIR).filter(f => fs.statSync(path.join(BOOKS_DIR, f)).isDirectory());
  if (bookSlugs.length === 0) {
    console.log("Không có truyện nào để chỉnh sửa.");
    return;
  }
  const { selectedBook } = await inquirer.prompt([{ type: 'list', name: 'selectedBook', message: 'Chọn truyện bạn muốn chỉnh sửa:', choices: bookSlugs }]);
  const bookDir = path.join(BOOKS_DIR, selectedBook);
  const outline = JSON.parse(fs.readFileSync(path.join(bookDir, 'outline.json'), 'utf-8'));

  // 2. Chọn chương đã được viết
  const writtenChapters = outline.chapters.filter(chap => {
    const chapterFileName = `${String(chap.chapter).padStart(2, '0')}-${slugify(chap.title)}.md`;
    return fs.existsSync(path.join(bookDir, chapterFileName));
  }).map(chap => ({ name: `Chương ${chap.chapter}: ${chap.title}`, value: chap }));

  if (writtenChapters.length === 0) {
    console.log("Truyện này chưa có chương nào được viết. Hãy chạy worker trước.");
    return;
  }
  const { selectedChapterInfo } = await inquirer.prompt([{ type: 'list', name: 'selectedChapterInfo', message: 'Chọn chương bạn muốn viết lại:', choices: writtenChapters }]);

  // 3. Đọc nội dung gốc và yêu cầu chỉ dẫn
  const originalFileName = `${String(selectedChapterInfo.chapter).padStart(2, '0')}-${slugify(selectedChapterInfo.title)}.md`;
  const originalFilePath = path.join(bookDir, originalFileName);
  const originalContent = fs.readFileSync(originalFilePath, 'utf-8');

  console.log("\n--- NỘI DUNG CHƯƠNG HIỆN TẠI ---");
  console.log(originalContent);
  console.log("---------------------------------");

  const { instructions } = await inquirer.prompt([{ type: 'input', name: 'instructions', message: "Hãy đưa ra chỉ dẫn để viết lại (ví dụ: 'thêm yếu tố hài hước', 'làm cho đoạn kết kịch tính hơn'):" }]);
  if (!instructions) {
    console.log("Đã hủy bỏ.");
    return;
  }

  // 4. Gọi AI và hiển thị kết quả
  console.log("\nĐang yêu cầu AI viết lại chương...");
  const reworkPrompt = prompts.reworkChapterContent(selectedChapterInfo.title, originalContent, instructions);
  const rawReworkedContent = await generateText(reworkPrompt);
  const reworkedContent = cleanChapterContent(rawReworkedContent);

  console.log("\n--- PHIÊN BẢN ĐÃ VIẾT LẠI ---");
  console.log(reworkedContent);
  console.log("-------------------------------");

  // 5. Hỏi để lưu lại
  const { shouldSave } = await inquirer.prompt([{ type: 'confirm', name: 'shouldSave', message: 'Bạn có muốn lưu phiên bản mới này không? (Nó sẽ được lưu thành một file riêng, không ghi đè file cũ)', default: true }]);

  if (shouldSave) {
    const timestamp = new Date().getTime();
    const newFileName = originalFileName.replace('.md', `_v${timestamp}.md`);
    const newFilePath = path.join(bookDir, newFileName);
    fs.writeFileSync(newFilePath, `# Chương ${selectedChapterInfo.chapter}: ${selectedChapterInfo.title} (v${timestamp})\n\n${reworkedContent}`);
    console.log(`Đã lưu phiên bản mới thành công tại: ${newFilePath}`);
    console.log("Bạn có thể xóa file cũ và đổi tên file mới nếu muốn sử dụng nó làm phiên bản chính.");
  } else {
    console.log("Đã hủy lưu.");
  }
}

/**
 * TÁI SỬ DỤNG: Hàm tạo, hiển thị và yêu cầu người dùng xác nhận dàn ý.
 * @param {string} title - Tựa đề sách.
 * @param {string} genre - Thể loại sách.
 * @returns {Promise<object|null>} - Trả về đối tượng dàn ý nếu được chấp nhận, hoặc null nếu bị hủy.
 */
async function generateAndConfirmOutline(title, genre) {
  const REGENERATE_OUTLINE = 'regenerate';
  const ACCEPT_OUTLINE = 'accept';
  const CANCEL_CREATION = 'cancel';

  while (true) {
    console.log("\nĐang tạo dàn ý cho câu chuyện...");
    let parsedOutline;
    try {
      const outlinePrompt = prompts.createOutline(title, genre);
      const outlineResponse = await generateText(outlinePrompt);
      const cleanResponse = outlineResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedOutline = JSON.parse(cleanResponse);
    } catch (e) {
      console.error("Lỗi khi tạo hoặc phân tích dàn ý từ AI. Đang thử lại...", e);
      continue; // Thử lại nếu có lỗi
    }

    console.log("\n--- DÀN Ý ĐỀ XUẤT ---");
    console.log(JSON.stringify(parsedOutline, null, 2));
    console.log("----------------------");

    const { userAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'userAction',
        message: 'Bạn có chấp nhận dàn ý này không?',
        choices: [
          { name: '✅ Đồng ý, sử dụng dàn ý này', value: ACCEPT_OUTLINE },
          { name: '🔄 Không, tạo lại dàn ý khác', value: REGENERATE_OUTLINE },
          { name: '❌ Hủy bỏ', value: CANCEL_CREATION }
        ]
      }
    ]);

    if (userAction === ACCEPT_OUTLINE) {
      return parsedOutline; // Thành công, trả về dàn ý
    }

    if (userAction === CANCEL_CREATION) {
      return null; // Người dùng hủy, trả về null
    }
    // Nếu chọn 'regenerate', vòng lặp sẽ tự động chạy lại
  }
}

/**
 * Luồng công việc để tạo một cuốn tiểu thuyết hoàn toàn mới.
 */
async function startNewNovel() {
  console.log("\nBắt đầu tạo một tiểu thuyết mới...");

  // 1. Lấy thông tin từ người dùng
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "genre",
      message:
        "Nhập thể loại tiểu thuyết (ví dụ: Khoa học viễn tưởng, Lãng mạn):",
    },
    {
      type: "input",
      name: "keywords",
      message: "Nhập một vài từ khóa (không bắt buộc):",
    },
  ]);
  const { genre, keywords } = answers;

  // --- VÒNG LẶP TẠO TỰA ĐỀ ---
  let selectedTitle;
  const REGENERATE_TITLES = "_REGENERATE_TITLES_";

  while (true) {
    console.log("\nĐang tạo danh sách tựa đề sách...");
    const titlePrompt = prompts.createTitle(genre, keywords);
    const titleResponse = await generateText(titlePrompt);
    const titles = titleResponse
      .trim()
      .split("\n")
      .map((t) => t.replace(/^(\d+\.\s*|-\s*|\*\s*)/, "").trim());

    const { chosenTitle } = await inquirer.prompt([
      {
        type: "list",
        name: "chosenTitle",
        message: "Chọn một tựa đề bạn thích hoặc tạo lại:",
        choices: [
          ...titles,
          new inquirer.Separator(),
          { name: "🔄 Tạo lại danh sách khác", value: REGENERATE_TITLES },
        ],
      },
    ]);

    if (chosenTitle !== REGENERATE_TITLES) {
      selectedTitle = chosenTitle;
      break; // Thoát vòng lặp khi người dùng đã chọn được tựa đề
    }
    // Nếu không, vòng lặp sẽ tự động chạy lại
  }

  console.log(`Bạn đã chọn: "${selectedTitle}"`);
  const bookSlug = slugify(selectedTitle);
  const bookDir = path.join(BOOKS_DIR, bookSlug);
  if (fs.existsSync(bookDir)) {
    console.log(
      "Thư mục cho truyện này đã tồn tại. Vui lòng chọn một tựa đề khác."
    );
    return;
  }
  fs.mkdirSync(bookDir, { recursive: true });

  const outlineJSON = await generateAndConfirmOutline(selectedTitle, genre);

  // Kiểm tra nếu người dùng đã hủy bỏ
  if (!outlineJSON) {
    console.log("Đã hủy tạo truyện. Xóa thư mục tạm...");
    fs.rmSync(bookDir, { recursive: true, force: true });
    return;
  }


  fs.writeFileSync(
    path.join(bookDir, "outline.json"),
    JSON.stringify(outlineJSON, null, 2)
  );
  console.log("Đã lưu dàn ý vào file outline.json");
  // Hỏi người dùng trước khi bắt đầu viết
  const { startWritingNow } = await inquirer.prompt([
    {
      type: "confirm", // Dạng câu hỏi Yes/No
      name: "startWritingNow",
      message:
        "Bạn có muốn bắt đầu viết các chương đầu tiên ngay bây giờ không?",
      default: true, // Mặc định là 'Yes'
    },
  ]);

  if (startWritingNow) {
    // Nếu người dùng đồng ý, bắt đầu viết
    await writeChapters(bookDir, outlineJSON);
  } else {
    // Nếu không, chỉ cần thông báo và kết thúc
    console.log(
      "\nOK! Dàn ý đã được lưu. Bạn có thể chạy lại chương trình và chọn 'Tiếp tục' để bắt đầu viết bất cứ lúc nào."
    );
  }

}

/**
 * Luồng công việc để tiếp tục một cuốn tiểu thuyết đã có.
 * @param {string} bookSlug - Tên thư mục của sách.
 */
async function continueNovel(bookSlug) {
  console.log(`\nTiếp tục viết tiểu thuyết: "${bookSlug}"`);
  const bookDir = path.join(BOOKS_DIR, bookSlug);
  const outlinePath = path.join(bookDir, "outline.json");
  let outlineJSON;
  if (fs.existsSync(outlinePath)) {
    // Trường hợp bình thường: file tồn tại
    const outlineData = fs.readFileSync(outlinePath, 'utf-8');
    outlineJSON = JSON.parse(outlineData);
  } else {
    // --- TRƯỜNG HỢP LỖI: File không tồn tại ---
    console.warn(`⚠️ Cảnh báo: Không tìm thấy file 'outline.json' cho truyện "${bookSlug}".`);
    const { shouldRegenerate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldRegenerate',
        message: 'Bạn có muốn tạo lại dàn ý cho truyện này không?',
        default: false
      }
    ]);

    if (!shouldRegenerate) {
      console.log("Hủy bỏ thao tác. Vui lòng kiểm tra lại thư mục sách.");
      return;
    }

    // Vì outline cũ đã mất, chúng ta phải hỏi lại thể loại
    const { genre } = await inquirer.prompt([
      {
        type: 'input',
        name: 'genre',
        message: `Vui lòng nhập lại thể loại cho truyện "${bookSlug}":`
      }
    ]);

    // Lấy lại tựa đề từ slug (đây là cách tốt nhất có thể)
    const reconstructedTitle = bookSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    console.log(`Sử dụng tựa đề tạm thời: "${reconstructedTitle}"`);
    
    const newOutline = await generateAndConfirmOutline(reconstructedTitle, genre);

    if (!newOutline) {
      console.log("Đã hủy tạo dàn ý mới.");
      return;
    }
    
    // Lưu dàn ý mới và gán nó để tiếp tục
    fs.writeFileSync(outlinePath, JSON.stringify(newOutline, null, 2));
    console.log("Đã tạo và lưu dàn ý mới thành công!");
    outlineJSON = newOutline;
  }
  await writeChapters(bookDir, outlineJSON);
}

/**
 * Hàm khởi động chính của ứng dụng
 */
async function main() {
  console.log("Chào mừng đến với Trợ lý viết tiểu thuyết AI!");

  // Kiểm tra và tạo thư mục 'books' nếu chưa có
  if (!fs.existsSync(BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR);
  }

  const existingBooks = fs
    .readdirSync(BOOKS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  let choice;

  if (existingBooks.length > 0) {
    // Nếu có sách cũ, cho người dùng lựa chọn
    const { userAction } = await inquirer.prompt([
      {
        type: "list",
        name: "userAction",
        message: "Bạn muốn làm gì?",
        choices: [
          { name: "Tiếp tục viết một truyện dang dở", value: "continue" },
          { name: "Tạo một tiểu thuyết mới", value: "new" },
          { name: '✏️  Chỉnh sửa/Viết lại một chương', value: 'rework' }, 
          new inquirer.Separator(),
          { name: "Thoát", value: "exit" },
        ],
      },
    ]);
    choice = userAction;

    if (choice === "continue") {
      const { selectedBook } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedBook",
          message: "Chọn tiểu thuyết để tiếp tục:",
          choices: existingBooks,
        },
      ]);
      await continueNovel(selectedBook);
    } else if (choice === "new") {
      await startNewNovel();
    } else if (choice === 'rework') {
      await reworkChapter();
    } else {
      console.log("Tạm biệt!");
      return;
    }
  } else {
    // Nếu không có sách nào, chỉ có lựa chọn tạo mới
    console.log("Chưa có dự án tiểu thuyết nào. Hãy bắt đầu tạo một cái mới!");
    await startNewNovel();
  }

  console.log(
    "\nHoàn thành phiên làm việc! Kiểm tra thư mục 'books' để xem kết quả."
  );
}

main().catch(console.error);
