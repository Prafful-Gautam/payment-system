# ---------- Build stage ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Install deps
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# Build TypeScript
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:18-alpine

WORKDIR /app
ENV NODE_ENV=production

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Built app
COPY --from=builder /app/dist ./dist

# Non‑root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "dist/server.js"]