# Stage 1: Build
FROM registry.tigerbrokers.net/mirrors/node:23.11.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM registry.tigerbrokers.net/mirrors/nginx:latest

# 删除默认配置
RUN rm -rf /usr/share/nginx/html/*

# 拷贝构建好的静态资源
COPY --from=builder /app/dist /usr/share/nginx/html

# 覆盖默认 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]