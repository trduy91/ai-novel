# Sử dụng image Node.js phiên bản 18, loại "slim" để nhẹ hơn
FROM node:18-slim

# Thiết lập thư mục làm việc gốc cho toàn bộ dự án bên trong container
WORKDIR /project

# --- SAO CHÉP CÁC THÀNH PHẦN CỦA DỰ ÁN VÀO CONTAINER ---
# Bây giờ, bối cảnh build là thư mục gốc của dự án, nên các đường dẫn nguồn sẽ khác đi.

# 1. Sao chép file helper.js dùng chung vào thư mục gốc của container
# Nguồn: ./helper.js (từ thư mục gốc của dự án)
# Đích: ./helper.js (bên trong /project)
COPY ./helper.js .

# 2. Sao chép các file package của writer
# Nguồn: ./writer/package*.json (từ thư mục gốc của dự án)
# Đích: ./writer/ (bên trong /project)
COPY ./writer/package*.json ./writer/

# 3. Di chuyển vào thư mục writer để cài đặt dependencies
WORKDIR /project/writer
RUN npm install

# 4. Quay trở lại thư mục gốc của container
WORKDIR /project

# 5. Sao chép toàn bộ mã nguồn của thư mục writer
# Nguồn: ./writer/. (tất cả file trong thư mục writer)
# Đích: ./writer/ (bên trong /project)
COPY ./writer/. ./writer/

# 6. Thiết lập lại thư mục làm việc để chạy lệnh CMD
WORKDIR /project/writer

# 7. Lệnh mặc định sẽ được chạy khi container khởi động
# Bây giờ, khi online-worker.js chạy từ /project/writer,
# lệnh require('../helper.js') sẽ tìm thấy file ở /project/helper.js một cách chính xác.
CMD ["npm", "run", "start:online"]