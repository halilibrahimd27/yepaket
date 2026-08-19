# YePaket — teslim dokümanı

Bu belge, kodu teslim alan ekip içindir. Üç soruyu yanıtlar:

1. **Ne teslim edildi?** — çalışan hâliyle neyin var olduğu
2. **Yayına çıkmak için ne gerekiyor?** — sizin sağlamanız gerekenler
3. **Nasıl yayına alınır?** — adım adım kurulum

---

## 1. Ne teslim edildi

### Üç istemci, tek backend

| Bileşen | Teknoloji | Durum |
|---|---|---|
| **backend/** | NestJS 11 + TypeScript, PostgreSQL 17 + PostGIS, Redis 7 | 82 uç nokta, 76 uçtan uca + 20 birim testi |
| **web/** | React 19 RSC + vinext (Vite), Tailwind v4 | Tanıtım sitesi + işletme paneli, gerçek API'ye bağlı |
| **mobile/** | Flutter 3.44 | iOS + Android tüketici uygulaması, gerçek API'ye bağlı |
| **infra/** | Docker Compose | Yerel geliştirme + üretim yığını (TLS dâhil) |

Tüm testler geçiyor. `flutter analyze` ve `eslint` temiz.

### Kapsanan iş akışları

**Tüketici:** Kayıt · e-posta veya sosyal giriş · şifre sıfırlama · konuma göre
paket keşfi · harita · kategori ve sıralama filtreleri · favoriler · sipariş ·
3D Secure ödeme · teslim kodu ve tek kullanımlık nonce ile teslim alma ·
iptal ve iade · değerlendirme · çevresel etki takibi · bildirimler ve
bildirim tercihleri · destek talebi · hesap kapatma (KVKK)

**İşletme:** Ön kayıt başvurusu · panel · paket yayınlama ve tekrar eden
şablonlar · stok ve sipariş takibi · teslim onayı · hakediş özeti ve geçmişi ·
mağaza profili ve görsel yükleme · çok kullanıcılı erişim (sahip/yönetici/personel)

**Yönetim:** Başvuru inceleme ve onay (onayda işletme otomatik oluşur) ·
işletme durumu ve komisyon oranı · hakediş üretme ve ödendi işaretleme ·
destek talepleri · denetim kaydı · sistem geneli özet

### Kritik davranışlar — nasıl korunuyor

Bunlar sessizce bozulduğunda para veya güven kaybettiren yerler. Her biri
testle sabitlendi:

| Davranış | Nasıl sağlanıyor | Test |
|---|---|---|
| Aşırı satış olmaz | `SELECT ... FOR UPDATE` satır kilidi + veritabanı CHECK kısıtı | 10 eşzamanlı istek / 3 stok → tam 3 sipariş |
| Çift tahsilat olmaz | Veritabanı destekli idempotency (Redis'te değil) | Aynı anahtar → aynı yanıt, ikinci sipariş yok |
| Para hesabı şaşmaz | Her tutar tam sayı **kuruş**; 32 CHECK kısıtı toplamları doğrular | Komisyon ve net tutar sipariş anında dondurulur |
| Çalınan jeton kullanılamaz | Yenileme jetonu her kullanımda döner; tekrar sunulursa tüm oturumlar kapanır | Jeton hırsızlığı senaryosu |
| İptal edilen oturum anında kesilir | Redis kara listesi; erişim jetonu süresini beklemez | Şifre sıfırlama sonrası eski jeton 401 |
| Teslim doğrulaması atlanamaz | Sunucu saatine göre aralık kontrolü + tek kullanımlık nonce | Erken teslim ve tekrar kullanım reddedilir |
| Başkasının verisi sızmaz | Var olmayan gibi davranılır (404, 403 değil) | Başkasının siparişi → 404 |
| Olay kaybolmaz | Outbox deseni: aynı transaction'da yazılır, ayrı süreç yayınlar | Stok değişimi outbox'a düşer |

Ayrıntılı gerekçeler kodun içinde yorum olarak yazılıdır.

### Bilinçli olarak yapılmayanlar

Bunlar eksik değil, **kapsam dışı** bırakılan kararlardır:

- **"Kargoyla kurtar" (fazla stok kolisi):** Ekran var ama arkasında sipariş
  akışı yok — çalışan bir **bekleme listesi**ne dönüştürüldü. Sahte ürün ve
  fiyat göstermek yerine ilgi topluyor. Tam özellik ayrı bir e-ticaret
  altyapısı (adres defteri, kargo entegrasyonu, ayrı stok) gerektirir.
- **Çoklu dil:** Uygulama yalnızca Türkçe. Altyapı (`intl`,
  `flutter_localizations`) kurulu; yeni dil eklemek metin dosyası çıkarmayı
  gerektirir.
- **Görsel depolama:** Yüklenen görseller sunucudaki diske yazılıyor
  (`MEDIA_ROOT`). Tek sunucuda sorunsuz; birden fazla sunucuya çıkarken S3
  benzeri bir nesne deposuna taşınmalı. `MediaService` tek noktadan
  değiştirilecek şekilde yazıldı.
- **Analitik:** Kullanıcı davranışı izleme aracı bağlanmadı.

---

## 2. Yayına çıkmadan önce sizden gerekenler

Her madde: **ne**, **nereden**, **olmazsa ne olur**.

### 2.1 Zorunlu — bunlar olmadan yayına çıkılamaz

#### Şirket bilgileri (yasal metinler için)

- **Ne:** Ticari unvan, merkez adresi, MERSİS no, vergi dairesi ve numarası,
  ticaret sicil numarası, telefon
- **Nereye:** [`web/app/legal-data.ts`](../web/app/legal-data.ts) — tek dosya,
  köşeli parantezli yer tutucular doldurulacak
- **Olmazsa:** Gizlilik ve kullanım koşulları sayfalarında `[Şirket Ticari
  Unvanı A.Ş.]` yazar. Mesafeli satış mevzuatı satıcı bilgilerinin
  görünmesini zorunlu kılar; eksikse idari yaptırım riski vardır.

> ⚠️ **Yasal metinler taslaktır.** `web/app/gizlilik` ve `web/app/kosullar`
> altındaki metinler ürünün gerçek işleyişine göre yazıldı ve KVKK ile
> Mesafeli Sözleşmeler Yönetmeliği'nin ilgili maddelerine dayanıyor. Ancak
> **yayına çıkmadan önce bir avukat tarafından incelenmelidir.** Bu metinler
> hukuki görüş değildir.

#### iyzico canlı anahtarları

- **Ne:** `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`
- **Nereden:** iyzico Merchant Panel → Ayarlar → API Anahtarları
  (canlı hesap; şirket kuruluşu ve sözleşme gerekir)
- **Olmazsa:** Uygulama **açılmaz**. `PAYMENT_PROVIDER=mock` üretimde bilerek
  reddedilir — sahte ödeme sağlayıcısıyla yayına çıkmak, para almadan sipariş
  oluşturmak demektir.
- **Webhook:** iyzico panelinde bildirim adresi olarak
  `https://api.yepaket.app/v1/payments/webhook` tanımlanmalı.

#### SMTP hesabı

- **Ne:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- **Nereden:** Amazon SES, Postmark, Resend, SendGrid veya kurumsal e-posta
- **Olmazsa:** Kullanıcı **şifresini sıfırlayamaz**. Sipariş onayı ve destek
  yanıtları gitmez. Bu kritik bir bağımlılıktır.
- **Ek olarak:** Gönderen alan adı için **SPF, DKIM ve DMARC** DNS kayıtları
  tanımlanmalı; yoksa e-postalar gereksiz (spam) klasörüne düşer.

#### Alan adları ve DNS

- **Ne:** `yepaket.app` ve `api.yepaket.app` için A (ve varsa AAAA) kayıtları
  sunucuyu göstermeli
- **Olmazsa:** Caddy Let's Encrypt sertifikası alamaz, site HTTPS ile açılmaz.

#### Sunucu

- **Asgari:** 2 vCPU, 4 GB RAM, 40 GB SSD, Docker kurulu Linux
- **Önerilen:** 4 vCPU, 8 GB RAM — PostgreSQL, Redis, API ve web aynı makinede
- **Portlar:** 80 ve 443 dışarıdan erişilebilir olmalı

### 2.2 Mobil uygulama mağazaları için

#### Apple

- Apple Developer Program üyeliği (yıllık $99)
- Bundle ID: `com.yepaket.yepaket`
- "Sign in with Apple" etkinleştirilecek (uygulamada Apple girişi olduğu için
  App Store kuralı gereği zorunlu)
- Uygulama gizlilik bildirimi (App Privacy) — hangi verilerin toplandığı
- Ekran görüntüleri ve tanıtım metni

#### Google

- Google Play Console hesabı (tek seferlik $25)
- Uygulama imzalama anahtarı (`upload-keystore.jks`) — **kaybedilirse
  güncelleme yayınlanamaz**, güvenli yedekleyin
- Veri güvenliği formu

#### Firebase (push bildirimi)

- **Ne:** `google-services.json` (Android), `GoogleService-Info.plist` (iOS),
  servis hesabı JSON'u (`FCM_SERVICE_ACCOUNT_JSON`)
- **Nereden:** Firebase Console → Proje ayarları
- **Olmazsa:** Push gönderilmez; bildirimler yalnızca uygulama içinde görünür.
  Uygulama hata vermez — bu bilinçli bir davranıştır.

#### Sosyal giriş istemci kimlikleri

- `GOOGLE_CLIENT_IDS` — web, iOS ve Android kimliklerinin tümü (virgülle)
- `APPLE_CLIENT_IDS`, `MICROSOFT_CLIENT_IDS`
- **Olmazsa:** O sağlayıcıyla giriş denemeleri reddedilir. E-posta ile giriş
  çalışmaya devam eder.

### 2.3 Harita döşemesi — önemli uyarı

Uygulama şu an **OpenStreetMap'in genel döşeme sunucusunu** kullanıyor.
OSM Kullanım Politikası bunu üretim uygulamaları için **yasaklar**.

- **Yapılacak:** MapTiler, Stadia Maps veya Mapbox'tan hesap alın ve
  `MAP_TILE_URL` ile derleyin:
  ```bash
  flutter build appbundle --dart-define=MAP_TILE_URL=https://.../{z}/{x}/{y}.png?key=ANAHTAR
  ```
- **Olmazsa:** OSM IP adresinizi engelleyebilir; harita ekranı boş kalır.

---

## 3. Yayına alma

### 3.1 Sunucu hazırlığı

```bash
# Docker ve Compose kurulu değilse
curl -fsSL https://get.docker.com | sh

git clone <depo-adresi> yepaket
cd yepaket/infra
cp .env.prod.example .env.prod
chmod 600 .env.prod
```

### 3.2 Sırları üretin

```bash
# Her biri ayrı ve en az 32 karakter olmalı
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 32   # REDIS_PASSWORD
```

`.env.prod` dosyasındaki boş alanları doldurun. Dosyadaki yorumlar her
değişkenin ne işe yaradığını açıklar.

### 3.3 Ayağa kaldırın

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Sırayla olan: PostgreSQL ve Redis sağlıklı olmayı bekler → `api-migrate`
şemayı uygular ve çıkar → API ve web açılır → Caddy TLS sertifikasını alır.

İlk açılışta sertifika alımı 1–2 dakika sürebilir.

### 3.4 Doğrulayın

```bash
curl https://api.yepaket.app/health/ready     # {"status":"ok", ...}
curl -I https://yepaket.app                    # HTTP/2 200

docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
```

### 3.5 İlk yönetici hesabı

Uygulamada yönetici kaydı ucu **bilerek yoktur**: açık bir uç, herkesin
yönetici olmasına izin verirdi. İlk yöneticiyi veritabanından yükseltin:

```bash
# 1. Uygulamadan normal kullanıcı olarak kayıt olun
# 2. Rolü yükseltin
docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres \
  psql -U yepaket -d yepaket \
  -c "UPDATE users SET role = 'ADMIN' WHERE email = 'yonetici@sirketiniz.com';"
# 3. Çıkış yapıp yeniden giriş yapın (rol jetona gömülüdür)
```

### 3.6 Mobil derlemeleri

```bash
cd mobile

# Android
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.yepaket.app/v1 \
  --dart-define=WEB_APP_URL=https://yepaket.app \
  --dart-define=MAP_TILE_URL=https://.../{z}/{x}/{y}.png?key=ANAHTAR \
  --dart-define=APP_VERSION=1.0.0

# iOS
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://api.yepaket.app/v1 \
  --dart-define=WEB_APP_URL=https://yepaket.app \
  --dart-define=MAP_TILE_URL=https://.../{z}/{x}/{y}.png?key=ANAHTAR \
  --dart-define=APP_VERSION=1.0.0
```

> `DUMMY_MODE` varsayılan olarak **kapalıdır**. Açık bırakılan bir derleme
> sunucuya hiç bağlanmaz ve kullanıcıya uydurma paketler gösterir.

---

## 4. İşletim

### Güncelleme

```bash
cd yepaket && git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

Migration'lar `api-migrate` servisiyle otomatik uygulanır.

### Yedekleme

Veritabanı yedeği **günlük** alınmalı ve **başka bir makinede** saklanmalı:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U yepaket yepaket | gzip > yepaket-$(date +%F).sql.gz
```

Yüklenen görseller `media` Docker biriminde tutulur; bu birim de yedeklenmeli.

> Yedeği düzenli olarak **geri yüklemeyi deneyin**. Test edilmemiş yedek,
> yedek değildir.

### İzleme

- `GET /health/ready` — veritabanı ve Redis bağlantısını kontrol eder;
  izleme aracınızı buna bağlayın
- `GET /health/live` — yalnızca sürecin ayakta olduğunu söyler
  (Kubernetes liveness probe için)
- Loglar JSON biçimindedir; log toplama aracına doğrudan verilebilir

### Sır rotasyonu

`JWT_ACCESS_SECRET` veya `JWT_REFRESH_SECRET` değiştirildiğinde **tüm
kullanıcıların oturumu kapanır**. Bu bilinçlidir: sızmış bir imza anahtarıyla
saldırgan istediği kullanıcı adına jeton üretebilir. Sızma şüphesinde
tereddüt etmeden değiştirin.

---

## 5. Yayın öncesi kontrol listesi

Yayına çıkmadan önce her maddeyi işaretleyin:

**Yapılandırma**
- [ ] `.env.prod` tüm zorunlu alanlar dolu, `chmod 600` uygulanmış
- [ ] `JWT_*` sırları rastgele üretilmiş ve birbirinden farklı
- [ ] `PAYMENT_PROVIDER=iyzico` ve canlı anahtarlar girilmiş
- [ ] `CORS_ORIGINS` yalnızca gerçek alan adlarını içeriyor (`*` değil)
- [ ] `SWAGGER_ENABLED` ayarlanmamış (üretimde varsayılan kapalı)

**Yasal**
- [ ] `web/app/legal-data.ts` şirket bilgileriyle doldurulmuş
- [ ] Gizlilik ve kullanım koşulları avukat tarafından incelenmiş
- [ ] `/gizlilik` ve `/kosullar` sayfaları açılıyor

**Altyapı**
- [ ] DNS kayıtları sunucuyu gösteriyor, HTTPS çalışıyor
- [ ] `GET /health/ready` 200 dönüyor
- [ ] Günlük veritabanı yedeği kurulmuş ve geri yükleme denenmiş
- [ ] SPF, DKIM, DMARC kayıtları tanımlı

**Uçtan uca**
- [ ] Kayıt → giriş → şifre sıfırlama e-postası geliyor
- [ ] Gerçek kartla sipariş → 3D Secure → teslim → değerlendirme
- [ ] İptal → iade kartta görünüyor
- [ ] İşletme paneli: paket yayınlama → sipariş görme → teslim onayı
- [ ] Push bildirimi cihaza ulaşıyor

**Mobil**
- [ ] `MAP_TILE_URL` ticari sağlayıcıya çevrilmiş
- [ ] Android imzalama anahtarı güvenli yedeklenmiş
- [ ] Mağaza gizlilik formları doldurulmuş

---

## 6. Nereye bakmalı

| Konu | Dosya |
|---|---|
| API uçlarının tamamı | [`docs/API_CONTRACT.md`](API_CONTRACT.md), [`backend/openapi.json`](../backend/openapi.json) |
| Mimari kararlar ve gerekçeleri | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) |
| Yerelde çalıştırma | [`docs/LOCAL_DEV.md`](LOCAL_DEV.md) |
| Veri modeli | [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) |
| Üretim yığını | [`infra/docker-compose.prod.yml`](../infra/docker-compose.prod.yml) |
| TLS ve güvenlik başlıkları | [`infra/caddy/Caddyfile`](../infra/caddy/Caddyfile) |

Kodun içindeki yorumlar **ne** yaptığını değil **neden** öyle yapıldığını
anlatır. Bir yeri değiştirmeden önce üstündeki yorumu okuyun; çoğu, daha önce
denenip başarısız olmuş bir yaklaşımı kayda geçiriyor.
