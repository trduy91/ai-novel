# Sử dụng image Node.js phiên bản 18, loại "slim" để nhẹ hơn
FROM node:18-slim

# Thiết lập thư mục làm việc gốc cho toàn bộ dự án bên trong container
WORKDIR /project

# --- SAO CHÉP CÁC THÀNH PHẦN CỦA DỰ ÁN VÀO CONTAINER ---

# 1. Sao chép file helper.js dùng chung vào thư mục gốc của container
# Nguồn: ../helper.js (từ vị trí Dockerfile đi ra ngoài)
# Đích: ./helper.js (bên trong /project)
COPY ../helper.js .

# 2. Sao chép các file package của writer vào thư mục /project/writer/
# Điều này giúp tận dụng cache của Docker
WORKDIR /project/writer
COPY package*.json ./

# 3. Cài đặt dependencies cho writer
RUN npm install

# 4. Sao chép toàn bộ mã nguồn còn lại của thư mục writer vào /project/writer/
COPY . .

# 5. Quay trở lại thư mục làm việc chính của writer để chạy lệnh
WORKDIR /project/writer

# 6. Lệnh mặc định sẽ được chạy khi container khởi động
# Bây giờ, khi online-worker.js chạy từ /project/writer,
# lệnh require('../helper.js') sẽ tìm thấy file ở /project/helper.js một cách chính xác.
CMD ["npm", "run", "start:online"]