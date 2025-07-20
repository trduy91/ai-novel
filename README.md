# AI Novelist - Trợ lý Viết tiểu thuyết AI

**AI Novelist** là một hệ sinh thái phần mềm hoàn chỉnh, sử dụng sức mạnh của Google Gemini API để tự động hóa toàn bộ quá trình sáng tác một cuốn tiểu thuyết, từ việc lên ý tưởng, tạo dàn ý, viết nội dung từng chương, cho đến việc xuất bản ra một trang web công khai.

Hệ thống được thiết kế theo kiến trúc microservices, bao gồm một "Writer" (nhà văn) để sản xuất nội dung và một "Publisher" (nhà xuất bản) để trình bày nội dung đó.

*(Sơ đồ kiến trúc dự án)*

---

## ✨ Tính năng nổi bật

*   **Sáng tạo theo yêu cầu:** Người dùng chỉ cần cung cấp thể loại và từ khóa, AI sẽ đề xuất các tựa đề hấp dẫn.
*   **Dàn ý thông minh:** Tự động tạo ra một dàn ý chi tiết (10-15 chương) cho câu chuyện, người dùng có quyền chấp nhận hoặc yêu cầu tạo lại.
*   **Worker tự động:**
    *   **Worker Online:** Chạy 24/7 trên cloud, tự động tìm và viết các chương còn thiếu, lưu thẳng vào cơ sở dữ liệu.
    *   **Worker Offline:** Chạy ở máy local, cho phép phát triển và xem trước các chương mới một cách nhanh chóng.
*   **Chống xung đột:** Sử dụng Firestore Transactions để đảm bảo hai worker không bao giờ viết trùng lặp một chương.
*   **Trang web xuất bản:** Một trang web riêng (Publisher) hiển thị các truyện đã hoàn thành, giao diện thân thiện, hỗ trợ chuyển chương bằng phím tắt.
*   **Đồng bộ hóa hai chiều:** Dễ dàng đẩy dữ liệu từ local lên cloud (`sync`) và tải dữ liệu từ cloud về local (`sync:down`).
*   **Kiến trúc đám mây:** Sẵn sàng để deploy lên các nền tảng hiện đại như Vercel và Koyeb/Fly.io.

---

## 🛠️ Kiến trúc hệ thống

Dự án được cấu trúc dưới dạng monorepo với các thành phần chính:

*   **`/writer`**: Ứng dụng Node.js chịu trách nhiệm cho tất cả các logic sáng tác.
    *   `main.js`: Giao diện dòng lệnh (CLI) để người dùng tương tác, tạo truyện, tạo dàn ý.
    *   `worker.js`: Worker offline, đọc/ghi file cục bộ, đồng bộ trạng thái online.
    *   `online-worker.js`: Worker online, đọc/ghi thẳng vào Firestore, được thiết kế để deploy.
    *   `sync.js` / `sync-down.js`: Các script để đồng bộ dữ liệu hai chiều.
    *   `firestore-state.js`: Module quản lý trạng thái và khóa (locking) chung cho cả hai worker.
*   **`/publisher`**: Ứng dụng Node.js/Express.js, đóng vai trò là web server để hiển thị truyện.
*   **`/books`**: Thư mục cục bộ chứa các file Markdown của truyện (được tạo bởi worker offline).
*   **`/helper.js`**: Thư viện tiện ích dùng chung cho cả hai dự án.
*   **Firebase (Firestore)**: Đóng vai trò là cơ sở dữ liệu trung tâm (Single Source of Truth), lưu trữ dàn ý, nội dung chương và trạng thái.

---

## 🚀 Bắt đầu

### Điều kiện tiên quyết

1.  **Node.js**: Phiên bản 18 trở lên.
2.  **Tài khoản Google & Firebase**:
    *   Tạo một project trên [Firebase Console](https://console.firebase.google.com/).
    *   Kích hoạt **Firestore Database**.
    *   Tạo và tải về một **Service Account Key** (file JSON).
3.  **Google AI API Key**:
    *   Lấy API Key của bạn từ [Google AI Studio](https://aistudio.google.com/app/apikey).
4.  **Tài khoản GitHub**: Để deploy.
5.  **(Tùy chọn) Tài khoản Vercel & Koyeb**: Để deploy dự án lên cloud.

### Cài đặt ở Local

1.  **Clone repository:**
    ```bash
    git clone https://github.com/your-username/ai-novelist.git
    cd ai-novelist
    ```

2.  **Cài đặt dependencies cho cả hai dự án:**
    ```bash
    # Cài đặt cho Writer
    cd writer
    npm install
    
    # Quay ra và cài đặt cho Publisher
    cd ../publisher
    npm install
    
    # Quay về thư mục gốc
    cd ..
    ```

3.  **Thiết lập cấu hình:**
    *   **Sao chép `serviceAccountKey.json`**: Đặt file key bạn tải từ Firebase vào thư mục `writer` và `publisher`.
    *   **Tạo file `.env`**: Ở thư mục gốc của dự án, tạo một file tên là `.env`.
    *   **Điền thông tin vào `.env`**:
        ```.env
        # Key API từ Google AI Studio
        GEMINI_API_KEY="your_gemini_api_key_here"
        ```

---

## 📖 Cách sử dụng

Tất cả các lệnh được chạy từ thư mục `writer`.

#### 1. Tạo truyện mới
Đây là bước đầu tiên để khởi tạo một câu chuyện. Bạn sẽ được hỏi thể loại, từ khóa, sau đó chọn tựa đề và duyệt dàn ý.
```bash
cd writer
node main.js
```
Hãy làm theo các chỉ dẫn trên màn hình.

#### 2. Chạy Worker Offline
Worker này sẽ tìm các chương còn thiếu ở local và tự động viết chúng.
```bash
# Trong thư mục writer
npm start 
# hoặc
node worker.js
```

#### 3. Đồng bộ hóa
- Đẩy dữ liệu local lên cloud:

```bash
# Trong thư mục writer
npm run sync

```
- Tải dữ liệu từ cloud về local:

```bash
# Trong thư mục writer
npm run sync:down

```

#### 4. Chạy trang Publisher ở Local
```bash
# Trong thư mục publisher
node server.js

```

Sau đó, truy cập http://localhost:3000 trên trình duyệt của bạn.

---

## ☁️ Hướng dẫn Deploy
Hệ thống được thiết kế để deploy lên các nền tảng cloud hiện đại.
### 1. Deploy Publisher (Web Server)
- Nền tảng đề xuất: Vercel
- Cấu hình chính:
  - Kết nối repository GitHub của bạn.
  - Không đặt Root Directory.
  - Tạo file vercel.json ở thư mục gốc để Vercel biết cách build và route.
  - Thiết lập biến môi trường FIREBASE_SERVICE_ACCOUNT_BASE64 trên Vercel.
### 2. Deploy Writer (Worker Online)
- Nền tảng đề xuất: Koyeb (hoặc Fly.io, Google Cloud Run)
- Cấu hình chính:
  - Deploy dưới dạng Web Service (để dùng gói miễn phí).
  - Sử dụng Dockerfile đã được cung cấp trong thư mục writer.
  - Đặt Root Directory thành /writer.
  - Thiết lập các biến môi trường GEMINI_API_KEY và FIREBASE_SERVICE_ACCOUNT_BASE64.

---

## 🤝 Đóng góp
Chào mừng mọi sự đóng góp! Vui lòng tạo một "Issue" để thảo luận về các thay đổi lớn hoặc tạo một "Pull Request" cho các bản sửa lỗi nhỏ.

---

## 📄 Giấy phép
Dự án này được cấp phép dưới Giấy phép MIT. Xem file LICENSE để biết thêm chi tiết.