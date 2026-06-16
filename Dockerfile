# Stage 1: builder — install production dependencies only
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: runner — copy runtime files only
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY public/ ./public/
COPY prompts/ ./prompts/
COPY config/ ./config/
COPY package.json ./

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/" > /dev/null || exit 1

CMD ["node", "src/server.js"]
