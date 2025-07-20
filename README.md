# AI Novelist - Trợ lý Viết tiểu thuyết AI

**AI Novelist** là một hệ sinh thái phần mềm hoàn chỉnh, sử dụng sức mạnh của Google Gemini API để tự động hóa toàn bộ quá trình sáng tác một cuốn tiểu thuyết, từ việc lên ý tưởng, tạo dàn ý, viết nội dung từng chương, cho đến việc xuất bản ra một trang web công khai.

Hệ thống được thiết kế theo kiến trúc microservices, bao gồm một "Writer" (nhà văn) để sản xuất nội dung và một "Publisher" (nhà xuất bản) để trình bày nội dung đó.

_(Sơ đồ kiến trúc dự án)_

---

## ✨ Tính năng nổi bật

- **Sáng tạo theo yêu cầu:** Người dùng chỉ cần cung cấp thể loại và từ khóa, AI sẽ đề xuất các tựa đề hấp dẫn.
- **Dàn ý thông minh:** Tự động tạo ra một dàn ý chi tiết (10-15 chương) cho câu chuyện, người dùng có quyền chấp nhận hoặc yêu cầu tạo lại.
- **Worker tự động:**
  - **Worker Online:** Chạy 24/7 trên cloud, tự động tìm và viết các chương còn thiếu, lưu thẳng vào cơ sở dữ liệu.
  - **Worker Offline:** Chạy ở máy local, cho phép phát triển và xem trước các chương mới một cách nhanh chóng.
- **Chống xung đột:** Sử dụng Firestore Transactions để đảm bảo hai worker không bao giờ viết trùng lặp một chương.
- **Trang web xuất bản:** Một trang web riêng (Publisher) hiển thị các truyện đã hoàn thành, giao diện thân thiện, hỗ trợ chuyển chương bằng phím tắt.
- **Đồng bộ hóa hai chiều:** Dễ dàng đẩy dữ liệu từ local lên cloud (`sync`) và tải dữ liệu từ cloud về local (`sync:down`).
- **Kiến trúc đám mây:** Sẵn sàng để deploy lên các nền tảng hiện đại như Vercel và Koyeb.

---

## 🛠️ Kiến trúc hệ thống

Dự án được cấu trúc dưới dạng monorepo với các thành phần chính:

- **`/writer`**: Ứng dụng Node.js chịu trách nhiệm cho tất cả các logic sáng tác.
  - `main.js`: Giao diện dòng lệnh (CLI) để người dùng tương tác.
  - `worker.js`: Worker offline, đọc/ghi file cục bộ.
  - `online-worker.js`: Worker online, đọc/ghi thẳng vào Firestore, được thiết kế để deploy.
  - `Dockerfile`: File hướng dẫn build worker online cho các nền tảng cloud.
  - `sync.js` / `sync-down.js`: Các script để đồng bộ dữ liệu hai chiều.
  - `firestore-state.js`: Module quản lý trạng thái và khóa (locking) chung.
- **`/publisher`**: Ứng dụng Node.js/Express.js, đóng vai trò là web server.
- **`/books`**: Thư mục cục bộ chứa các file Markdown.
- **`/helper.js`**: Thư viện tiện ích dùng chung cho cả hai dự án.
- **Firebase (Firestore)**: Cơ sở dữ liệu trung tâm (Single Source of Truth).

---

## 🚀 Bắt đầu

### Điều kiện tiên quyết

1.  **Node.js**: Phiên bản 18+.
2.  **Git**: Hệ thống quản lý phiên bản.
3.  **Tài khoản Google & Firebase**:
    - Tạo một project trên [Firebase Console](https://console.firebase.google.com/).
    - Kích hoạt **Firestore Database**.
    - Tải về một **Service Account Key** (file JSON).
4.  **Google AI API Key**: Lấy từ [Google AI Studio](https://aistudio.google.com/app/apikey).
5.  **Tài khoản GitHub**: Để deploy.
6.  **Tài khoản Vercel & Koyeb**: Để triển khai dự án.

### Cài đặt ở Local

1.  **Clone repository:**

    ```bash
    git clone https://github.com/your-username/ai-novelist.git
    cd ai-novelist
    ```

2.  **Cài đặt dependencies:**

    ```bash
    # Cài đặt cho Writer
    cd writer
    npm install

    # Cài đặt cho Publisher
    cd ../publisher
    npm install

    # Quay về thư mục gốc
    cd ..
    ```

3.  **Thiết lập cấu hình:**
    - **Sao chép `serviceAccountKey.json`**: Đặt file key vào thư mục `writer` và `publisher`.
    - **Tạo file `.env`**: Ở thư mục gốc, tạo file `.env` và điền vào nội dung sau:
      ```.env
      # Key API từ Google AI Studio
      GEMINI_API_KEY="your_gemini_api_key_here"
      ```

---

## 📖 Cách sử dụng

Tất cả các lệnh được chạy từ thư mục `writer` (trừ khi có ghi chú khác).

- **Tạo truyện mới:** `cd writer && node main.js`
- **Chạy Worker Offline:** `npm start`
- **Đồng bộ lên cloud:** `npm run sync`
- **Đồng bộ về local:** `npm run sync:down`
- **Chạy trang Publisher:** `cd publisher && node server.js` (Truy cập `http://localhost:3000`)

---

## ☁️ Hướng dẫn Deploy

### 1. Chuẩn bị Biến môi trường

Trước khi deploy, bạn cần mã hóa file `serviceAccountKey.json` thành chuỗi Base64.

- **Trên macOS/Linux:**
  ```bash
  cat writer/serviceAccountKey.json | base64
  ```
- **Trên Windows (PowerShell):**
  `powershell $jsonPath=".\writer\serviceAccountKey.json";$base64=[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($jsonPath));$base64|Set-Clipboard;Write-Host "Copied!"`
  Sao chép chuỗi Base64 dài này để sử dụng ở các bước sau.

### 2. Deploy Publisher (Web Server) lên Vercel

- Kết nối repository GitHub của bạn với Vercel.
- **Cấu hình Project trên Vercel:**
  - **KHÔNG** đặt "Root Directory".
  - Tạo file `vercel.json` ở thư mục gốc của dự án với nội dung đã được cung cấp để Vercel biết cách build và route.
- **Thiết lập Environment Variables trên Vercel:**
  - `FIREBASE_SERVICE_ACCOUNT_BASE64`: Dán chuỗi Base64 đã tạo ở trên.

### 3. Deploy Writer (Worker Online) lên Koyeb

- Kết nối repository GitHub của bạn với Koyeb.
- **Cấu hình Service trên Koyeb:**
  - **Service type:** `Web Service` (Để sử dụng gói miễn phí).
  - **Deployment method:** `Docker`.
  - **Root directory:** (Để trống).
  - **Dockerfile location:** `writer/Dockerfile`.
  - **Docker build context directory:** `.` (Dấu chấm, nghĩa là thư mục gốc của repo).
  - **Instance:** `Free`.
- **Thiết lập Environment Variables trên Koyeb:**
  - `GEMINI_API_KEY`: Dán API Key của Gemini.
  - `FIREBASE_SERVICE_ACCOUNT_BASE64`: Dán chuỗi Base64.

---

## 🤝 Đóng góp

Chào mừng mọi sự đóng góp! Vui lòng tạo một "Issue" để thảo luận về các thay đổi lớn hoặc tạo một "Pull Request" cho các bản sửa lỗi nhỏ.

---

## 📄 Giấy phép

Dự án này được cấp phép dưới Giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.
