# 基础镜像：Node 22 + Chromium + ffmpeg（Remotion 渲染要 Chromium）
FROM node:22-slim AS base

# 系统依赖：Chromium 运行库 + ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    REMOTION_CHROME_PATH=/usr/bin/chromium

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

# ---------- builder ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 数据卷：用户上传 / config / 渲染产物都挂这里
RUN mkdir -p /data/uploads /data/output /data/config
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "server.js"]
