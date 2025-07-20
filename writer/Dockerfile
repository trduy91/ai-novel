# Sử dụng image Node.js phiên bản 18, loại "slim" để nhẹ hơn
FROM node:18-slim

# Thiết lập thư mục làm việc gốc cho toàn bộ dự án bên trong container
WORKDIR /project

# --- SAO CHÉP CÁC THÀNH PHẦN CỦA DỰ ÁN VÀO CONTAINER ---
# Bối cảnh build là thư mục gốc của dự án.

# 1. Sao chép các file/thư mục cần thiết từ gốc dự án vào gốc container
# Sao chép file helper.js dùng chung
COPY helper.js .
# Sao chép toàn bộ thư mục 'writer'
COPY writer/ ./writer/

# 2. Di chuyển vào thư mục writer bên trong container để thực hiện các lệnh tiếp theo
WORKDIR /project/writer

# 3. Cài đặt các dependencies của writer
# npm sẽ đọc file package.json trong thư mục làm việc hiện tại (/project/writer)
RUN npm install

# 4. Lệnh mặc định sẽ được chạy khi container khởi động
# Lệnh này sẽ được thực thi từ thư mục làm việc hiện tại (/project/writer)
CMD ["npm", "run", "start:online"]