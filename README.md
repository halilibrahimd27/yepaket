# YePaket

İşletmelerde gün sonunda kalan yenilebilir ürünleri uygun fiyatlı sürpriz
paketlere dönüştürerek gıda israfını azaltan pazaryeri.

Bu depo ürünün tamamını barındıran monorepo'dur: backend API, web
istemcisi, mobil istemci, ortak sözleşme dokümanları ve yerel geliştirme
altyapısı tek yerde versiyonlanır.

## Depo yapısı

```text
backend/    NestJS + TypeScript API (PostgreSQL/PostGIS, Redis, iyzico)
web/        Tanıtım sitesi + MyStore işletme paneli (React 19 RSC, vinext, Tailwind v4)
mobile/     Flutter iOS/Android tüketici uygulaması
docs/       API sözleşmesi, mimari ve yol haritası — üç istemcinin tek kaynağı
infra/      Yerel geliştirme için Docker Compose servisleri
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

## Dokümanlar

| Doküman | İçerik |
| --- | --- |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Backend ↔ istemci sözleşmesi — **tek kaynak** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Sistem mimarisi, veri akışları, teknoloji kararları |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Yayına çıkış yol haritası ve ilerleme durumu |
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
