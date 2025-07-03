FROM registry.tigerbrokers.net/mirrors/node:23.11.0-alpine AS server
WORKDIR /app
COPY dist ./dist
COPY server ./server
COPY package*.json ./

ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "server/index.js"]