# YePaket

İşletmelerde gün sonunda kalan yenilebilir ürünleri uygun fiyatlı sürpriz
paketlere dönüştürerek gıda israfını azaltan pazaryeri.

Bu depo ürünün tamamını barındıran monorepo'dur: backend API, web
istemcisi, mobil istemci, ortak sözleşme dokümanları ve yerel geliştirme
altyapısı tek yerde versiyonlanır.

**Yayına almak için:** [docs/TESLIM.md](docs/TESLIM.md) — ne teslim edildiği,
sizden ne gerektiği ve adım adım kurulum.

## Depo yapısı

```text
backend/    NestJS + TypeScript API (PostgreSQL/PostGIS, Redis, iyzico)
web/        Tanıtım sitesi + MyStore işletme paneli (React 19 RSC, vinext, Tailwind v4)
mobile/     Flutter iOS/Android tüketici uygulaması
docs/       API sözleşmesi, mimari ve yol haritası — üç istemcinin tek kaynağı
infra/      Docker Compose — yerel geliştirme ve üretim yığını (TLS dâhil)
```

## Hızlı başlangıç

Gereksinimler: Docker (zorunlu), Node 22+ ve Flutter 3.11+ (yalnızca ilgili
istemci üzerinde çalışacaksanız).

```bash
# 1. Altyapıyı ayağa kaldır (PostgreSQL + PostGIS, Redis, Mailpit)
cd infra && cp .env.example .env && docker compose up -d

# 2. Backend
cd ../backend && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run start:dev

# 3. Web
cd ../web && npm install && npm run dev

# 4. Mobil
cd ../mobile && flutter pub get && flutter run
```

Servis adresleri ve varsayılan portlar için [infra/README.md](infra/README.md)
dosyasına bakın.

## Üretim

```bash
cd infra
cp .env.prod.example .env.prod    # sırları doldurun (dosyadaki yorumlar anlatır)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Yığın: PostgreSQL + PostGIS · Redis · API · web · Caddy (Let's Encrypt ile
otomatik TLS). Migration'lar açılışta uygulanır. Ayrıntı:
[docs/TESLIM.md](docs/TESLIM.md).

## Testler

```bash
cd backend && npm test && npm run test:e2e   # 20 birim + 76 uçtan uca
cd ../web   && npm run lint && npm test
cd ../mobile && flutter analyze && flutter test   # 21 test
```

## Dokümanlar

| Doküman | İçerik |
| --- | --- |
| [docs/TESLIM.md](docs/TESLIM.md) | **Teslim ve yayına alma rehberi — buradan başlayın** |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Backend ↔ istemci sözleşmesi — çalışan uygulamadan üretilir |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Sistem mimarisi, veri akışları, teknoloji kararları |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Yayına çıkış yol haritası ve ilerleme durumu |
| [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) | Her şeyi yerelde çalıştırma (Docker ile, kurulum gerektirmeden) |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Yayına çıkış için gereken hesaplar, anahtarlar ve yasal maddeler |
| [web/README.md](web/README.md) | Web istemcisi ayrıntıları |
| [mobile/README.md](mobile/README.md) | Mobil istemci ayrıntıları |

## Teknoloji kararları

| Katman | Seçim | Gerekçe |
| --- | --- | --- |
| API | NestJS + TypeScript | Web ile tek dil; olgun modül/DI yapısı, güçlü ekosistem |
| Veritabanı | PostgreSQL 17 + PostGIS | Coğrafi yakınlık sorguları ve satır kilidiyle atomik stok rezervasyonu |
| Cache / kuyruk | Redis 7 | Oturum, rate limit, idempotency kaydı ve arka plan işleri |
| Ödeme | iyzico | Türkiye pazarı, 3D Secure ve alt üye işyeri (pazaryeri) modeli |
| Web | React 19 RSC + vinext | Cloudflare Workers üzerinde sunucu tarafı render |
| Mobil | Flutter | Tek kod tabanından iOS + Android |

Ödeme sağlayıcısı `PaymentProvider` arayüzünün arkasında soyutlanmıştır;
sağlayıcı değişimi tek modülü etkiler.

## Lisans

Tüm hakları saklıdır. Bu depo özel bir ürünün kaynak kodunu içerir.
