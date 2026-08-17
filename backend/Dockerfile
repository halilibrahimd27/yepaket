# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Derleme aşaması
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Bağımlılık ve yapılandırma katmanı önce: kaynak değiştiğinde npm ci
# tekrar çalışmasın.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# tsconfig, npm ci'den ÖNCE kopyalanmalı. postinstall içindeki
# `prisma generate` modül biçimini tsconfig'ten okur; dosya yoksa ESM
# varsayıp `import.meta.url` üretir, tsc bunu CommonJS'e derleyince Node
# çalışma zamanında "exports is not defined" hatası verir.
COPY tsconfig*.json nest-cli.json ./

# postinstall `prisma generate` çalıştırır. Prisma 7 yapılandırmayı
# prisma.config.ts'ten okur ve `env('DATABASE_URL')` derleme ortamında
# tanımsızdır; istemci üretimi veritabanına bağlanmadığı için sahte bir
# değer yeterlidir.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci

COPY src ./src

RUN npm run build \
    && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Çalışma aşaması
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

# dumb-init, PID 1 olarak sinyalleri doğru iletir; SIGTERM'de Nest'in
# graceful shutdown kancaları çalışabilsin.
RUN apk add --no-cache dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -u 1001 -S nodejs -G nodejs

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    MEDIA_ROOT=/app/media

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
# Migration'lar imajın içinde taşınır: dağıtım sırasında
# `npm run db:migrate:deploy` aynı sürümü uygular.
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Yüklenen görseller için yazılabilir dizin. Üretimde kalıcı bir birim
# (volume) bağlanmalı, aksi hâlde konteyner yenilendiğinde görseller kaybolur.
RUN mkdir -p /app/media && chown -R nodejs:nodejs /app/media
VOLUME ["/app/media"]

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
