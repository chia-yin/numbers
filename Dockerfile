# Stage 1: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY public/ ./public/
COPY prompts/ ./prompts/
COPY config/ ./config/
COPY package.json ./
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
