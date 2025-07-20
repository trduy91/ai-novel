# Bước 1: Chọn một "hệ điều hành" cơ bản có sẵn Node.js
# Dùng phiên bản 18-slim để tối ưu kích thước
FROM node:18-slim

# Bước 2: Thiết lập thư mục làm việc bên trong môi trường ảo (container)
WORKDIR /app

# Bước 3: Sao chép các file quản lý package và cài đặt dependencies
# Tách bước này ra để tận dụng cơ chế cache của Docker, giúp build nhanh hơn ở các lần sau
COPY package*.json ./
RUN npm install

# Bước 4: Sao chép toàn bộ mã nguồn của thư mục 'writer' vào container
COPY . .

# Bước 5: Định nghĩa lệnh sẽ được chạy khi container khởi động
# Chúng ta muốn chạy worker online
CMD ["npm", "run", "start:online"]