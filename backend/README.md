# YePaket API

NestJS + TypeScript ile yazılmış, PostgreSQL/PostGIS üzerinde çalışan pazaryeri
API'si. Sözleşmenin tek kaynağı [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md),
mimari kararlar [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) dosyasındadır.

## Kurulum

```bash
# 1. Altyapı (depo kökünden bir kez)
cd ../infra && cp .env.example .env && docker compose up -d

# 2. API
cd ../backend
cp .env.example .env
npm install              # postinstall Prisma istemcisini üretir
npm run db:migrate:deploy
npm run db:seed
npm run start:dev
```

API `http://localhost:8080/v1` adresinde, Swagger arayüzü
`http://localhost:8080/v1/docs` adresinde çalışır.

### Node kurulu değilse

Tüm komutlar container içinden de çalıştırılabilir:

```bash
docker run --rm -it -v "$PWD:/app" -w /app \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="postgresql://yepaket:yepaket_dev@host.docker.internal:5432/yepaket" \
  node:22-alpine npm run <komut>
```

## Demo hesaplar

Seed sonrası kullanılabilir (şifre: `demo1234`):

| E-posta | Rol |
| --- | --- |
| `demo@yepaket.app` | Tüketici |
| `demo@modafirini.com` | İşletme (Moda Fırını sahibi) |
| `admin@yepaket.app` | Yönetici |

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run start:dev` | Geliştirme sunucusu (hot reload) |
| `npm run build` | Üretim derlemesi → `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Birim testleri |
| `npm run test:e2e` | Uçtan uca testler |
| `npm run db:migrate` | Yeni migration üret ve uygula (geliştirme) |
| `npm run db:migrate:deploy` | Bekleyen migration'ları uygula (üretim/CI) |
| `npm run db:seed` | Demo verisini yükle (tekrar çalıştırılabilir) |
| `npm run db:studio` | Prisma Studio |

## Mimari notlar

**Yanıt zarfı.** Tüm başarılı yanıtlar `{ data, meta }` biçimindedir ve alan
adları otomatik olarak snake_case'e çevrilir
(`ResponseEnvelopeInterceptor`). Modüller camelCase yazar; isimlendirme
sözleşmesi tek noktadan garanti altındadır. Zarf dışında kalması gereken uçlar
`@SkipEnvelope()` ile işaretlenir.

**Hatalar.** Her hata `{ error: { code, message, details, request_id } }`
biçimine indirgenir. İstemciler `message` metnine değil `code` değerine göre
dallanmalıdır; kod listesi `src/common/errors/error-codes.ts` içindedir.

**Para.** Tüm tutarlar tam sayı kuruştur (`...Minor`). Kayan noktalı sayı para
için hiçbir katmanda kullanılmaz. Veritabanı CHECK kısıtları
`total = birim × adet` ve `net = toplam − komisyon` eşitliklerini zorunlu kılar.

**Stok.** Sipariş transaction'ı paket satırını `SELECT ... FOR UPDATE` ile
kilitler; ayrıca `available_quantity >= 0` CHECK kısıtı bir kod hatasının
stoğu negatife düşürmesini engeller.

**Konum.** `stores` tablosunda lat/lng tek gerçek kaynaktır; yakınlık sorguları
`ST_SetSRID(ST_MakePoint(...))::geography` ifadesi üzerine kurulu GiST
indeksini kullanır. Kopya bir geography kolonu tutulmaz.

**Ortam değişkenleri.** Açılışta zod ile doğrulanır; eksik veya geçersiz bir
değer varsa süreç başlamaz. Üretimde sahte ödeme sağlayıcısı ve joker CORS
origin'i şema düzeyinde reddedilir.

## Dizin yapısı

```text
src/
  common/     Hata tipleri, yanıt zarfı, ortak yardımcılar
  config/     Ortam değişkeni şeması ve doğrulama
  database/   Prisma istemcisi (driver adapter ile)
  generated/  Prisma tarafından üretilir — versiyonlanmaz
  health/     Sağlık uçları (/health, /health/live, /health/ready)
  redis/      Redis bağlantıları (istemci, yayıncı, abone)
prisma/
  schema.prisma   Veri modeli
  migrations/     SQL migration'ları
  seed.ts         Demo verisi
```
