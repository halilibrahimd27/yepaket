# Yerel geliştirme

Makinenizde Node veya Flutter kurulu olması gerekmez — her şey Docker'dan
çalıştırılabilir. Kurulu olanlar için doğrudan komutlar da verilmiştir.

## Servisler ve adresler

| Ne | Adres | Nasıl |
| --- | --- | --- |
| Backend API | http://localhost:8080/v1 | `backend/` |
| API dokümanı (Swagger) | http://localhost:8080/v1/docs | |
| Web (tanıtım + MyStore) | http://localhost:3000 | `web/` |
| Mobil uygulama (tarayıcıda) | http://localhost:5050 | `mobile/`, web hedefi |
| PostgreSQL | localhost:5432 | `infra/` |
| Redis | localhost:6379 | `infra/` |
| Mailpit (e-posta kutusu) | http://localhost:8025 | `infra/` |

> Port 5000 macOS'ta AirPlay Receiver tarafından kullanıldığı için mobil
> önizleme 5050'de yayınlanır.

## 1. Altyapı

```bash
cd infra && cp .env.example .env && docker compose up -d
```

## 2. Backend

```bash
cd backend && cp .env.example .env
npm install && npm run db:migrate:deploy && npm run db:seed && npm run start:dev
```

Node kurulu değilse:

```bash
cd backend
docker run --rm -it -p 8080:8080 -v "$PWD:/app" -w /app \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="postgresql://yepaket:yepaket_dev@host.docker.internal:5432/yepaket" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  -e JWT_ACCESS_SECRET="gelistirme_icin_en_az_otuz_iki_karakterlik_gizli_anahtar" \
  -e JWT_REFRESH_SECRET="gelistirme_icin_farkli_ve_en_az_otuz_iki_karakterlik_anahtar" \
  -e OAUTH_ALLOW_MOCK=true \
  node:22-alpine sh -c "npm install && npx nest build && node dist/main.js"
```

Demo hesaplar (şifre `demo1234`): `demo@yepaket.app` (tüketici),
`demo@modafirini.com` (işletme), `admin@yepaket.app` (yönetici).

Sosyal girişi gerçek sağlayıcı olmadan denemek için `OAUTH_ALLOW_MOCK=true`
iken `idToken` alanına `mock:<hesap-id>:<e-posta>` gönderin.

## 3. Web

```bash
cd web && npm install && npm run dev
```

Konteynerden çalıştırmak için **glibc tabanlı** imaj gerekir; Cloudflare
`workerd` çalışma zamanı Alpine'ın musl libc'siyle çalışmaz:

```bash
cd web
docker run --rm -it --name yepaket-web -p 3000:3000 -v "$PWD:/app" -w /app \
  -e DEV_SERVER_HOST=0.0.0.0 \
  node:22 sh -c "rm -f .vinext/dev/lock.json; npm install && npx vinext dev --port 3000"
```

`DEV_SERVER_HOST` verildiğinde sunucu tüm arayüzleri dinler ve Vite'ın
`allowedHosts` koruması gevşetilir (yalnızca geliştirme için).

> Konteyner beklenmedik şekilde sonlanırsa `.vinext/dev/lock.json` dosyası
> ölü bir PID'yi işaret eder ve sonraki başlatma "sunucu zaten çalışıyor"
> diyerek çıkar. Yukarıdaki komut bu dosyayı başlangıçta siler.

## 4. Mobil

Cihaz/emülatörde:

```bash
cd mobile && flutter pub get && flutter run
```

Tarayıcıda önizleme (Flutter kurulu değilse de çalışır):

```bash
cd mobile
docker volume create yepaket-pub-cache
docker run --rm -v "$PWD:/app" -v yepaket-pub-cache:/root/.pub-cache -w /app \
  ghcr.io/cirruslabs/flutter:stable \
  sh -c "git config --global --add safe.directory '*'; flutter pub get && flutter build web --release"

docker run -d --name yepaket-mobile -p 5050:5000 -v "$PWD/build/web:/site:ro" -w /site \
  python:3.12-alpine python -m http.server 5000 --bind 0.0.0.0
```

> **Pub önbelleği volume'ü önemlidir.** Önbellek konteyner içinde kalırsa her
> çalıştırmada silinir; `.dart_tool/package_config.json` var olmayan yolları
> gösterir ve derleme "No such file or directory" hatalarıyla düşer. Aynı
> sebeple `flutter test` Flutter'ın kendi kaynaklarında hata verebilir.

Mobil uygulamanın web hedefi yalnızca geliştirme önizlemesi içindir; ürün
iOS ve Android olarak dağıtılır.

## Gerçek backend'e bağlanma

Her iki istemci de varsayılan olarak yerel dummy veriyle çalışır.

```bash
# Web
cd web && cp .env.example .env.local   # NEXT_PUBLIC_API_MODE=remote

# Mobil (Android emülatörü)
flutter run --dart-define=DUMMY_MODE=false \
            --dart-define=API_BASE_URL=http://10.0.2.2:8080/v1
```

## Sık karşılaşılan sorunlar

| Belirti | Sebep ve çözüm |
| --- | --- |
| `docker pull` → "authentication required" | Docker Desktop'ta bozuk Hub kimliği. `docker logout` çözer. |
| PostGIS konteyneri arm64'te başlamıyor | Resmi `postgis/postgis` imajının arm64 yapısı yok. Compose çok mimarili `imresamu/postgis` kullanır. |
| Web'de 403 | Vite `allowedHosts` koruması. `DEV_SERVER_HOST` verilmeden konteynerden erişilmez. |
| Flutter derlemesi paket bulamıyor | Pub önbelleği volume'ü bağlanmamış; yukarıdaki komutu kullanın. |
