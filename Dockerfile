# Stage 1: Build
FROM registry.tigerbrokers.net/mirrors/node:23.11.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Node.js
FROM registry.tigerbrokers.net/mirrors/node:23.11.0-alpine AS server
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev --prefix ./server && npm cache clean --force

ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "server/index.js"]