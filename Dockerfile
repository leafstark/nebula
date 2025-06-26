FROM registry.tigerbrokers.net/mirrors/node:23.11.0-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Serve with Node.js
FROM registry.tigerbrokers.net/mirrors/node:23.11.0-alpine AS server
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# 仅在 server 目录下安装生产依赖（如果 server 有独立依赖）
RUN npm i -g pnpm && pnpm install --frozen-lockfile --prod --filter ./server

ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "server/index.js"]