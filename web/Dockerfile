# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Derleme aşaması
#
# Alpine (musl) KULLANILMAZ. vinext'in çalışma zamanı `workerd` ikilisine
# dayanır ve workerd yalnızca glibc ile derlenmiştir; Alpine üzerinde
# "Error loading shared library ld-linux-x86-64.so.2" ile açılmaz.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* değişkenleri derleme sırasında istemci paketine gömülür;
# çalışma zamanında değiştirilemezler. Bu yüzden build argümanı olarak
# geçilmeleri gerekir.
ARG NEXT_PUBLIC_API_BASE_URL=https://api.yepaket.app/v1
ARG NEXT_PUBLIC_SITE_URL=https://yepaket.app
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NODE_ENV=production

RUN npm run build

# Derleme bağımlılıkları çıkarılır; çalışma imajı küçülür.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Çalışma aşaması
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

# dumb-init PID 1 olarak sinyalleri iletir; SIGTERM'de sunucu düzgün kapanır.
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 nodejs \
    && useradd -u 1001 -g nodejs -m -s /usr/sbin/nologin nextjs

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
# `vinext build` çıktısı dist/ altına yazılır; .vinext yalnızca geliştirme
# önbelleğidir ve çalışma imajında işe yaramaz.
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
