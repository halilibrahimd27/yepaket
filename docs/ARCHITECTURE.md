# Mimari

## Sistem görünümü

```text
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│ Flutter app  │      │  Web (RSC)   │      │ MyStore paneli   │
│  (tüketici)  │      │ (tanıtım)    │      │ (aynı web app)   │
└──────┬───────┘      └──────┬───────┘      └────────┬─────────┘
       │  HTTPS/JSON + WSS   │                       │
       └─────────────────────┴───────────┬───────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   NestJS API (v1)   │
                              │  REST + WebSocket   │
                              └──────────┬──────────┘
              ┌──────────────┬───────────┼───────────┬──────────────┐
              │              │           │           │              │
      ┌───────▼──────┐ ┌─────▼────┐ ┌────▼─────┐ ┌───▼────┐ ┌───────▼──────┐
      │ PostgreSQL   │ │  Redis   │ │  iyzico  │ │  SMTP  │ │ Push (FCM/   │
      │  + PostGIS   │ │ cache/   │ │ ödeme +  │ │ e-posta│ │  APNs)       │
      │              │ │ kuyruk   │ │ webhook  │ │        │ │              │
      └──────────────┘ └──────────┘ └──────────┘ └────────┘ └──────────────┘
```

## Katmanlar

Backend, NestJS modül sınırlarını domain'e göre çizer. Her modül kendi
controller (HTTP), service (iş kuralı) ve repository (veri erişimi)
üçlüsünü barındırır; modüller arası erişim yalnızca servis arayüzleri
üzerinden yapılır.

```text
backend/src/
  common/       Guard, interceptor, filter, dto temel sınıfları, hata tipleri
  config/       Ortam değişkeni şeması ve doğrulama (uygulama açılışta doğrular)
  database/     Prisma client, transaction yardımcıları, migration'lar
  modules/
    auth/       Kayıt, giriş, refresh rotasyonu, OAuth doğrulama, oturumlar
    users/      Profil, cihazlar, tercihler, hesap silme (KVKK)
    stores/     İşletme profili, çalışma saatleri, doğrulama durumu
    bags/       Sürpriz paket tanımı, yayın takvimi, stok
    discovery/  Yakınlık/filtre/sıralama sorguları, arama
    orders/     Rezervasyon, stok kilidi, iptal, teslim doğrulama
    payments/   PaymentProvider arayüzü, iyzico uygulaması, webhook, iade
    payouts/    Komisyon hesabı, hakediş dönemleri, ödeme dosyası
    notifications/ Bildirim merkezi, push token, şablonlar
    realtime/   WebSocket gateway, olay yayını
    impact/     CO₂e / su / tasarruf hesapları
    support/    Destek talepleri
    admin/      Moderasyon, işletme onayı, raporlar
```

## Kritik iş kuralları

### Stok rezervasyonu atomiktir

Aynı paketin son adedi için eşzamanlı iki sipariş gelirse yalnızca biri
başarılı olmalıdır. Bu, uygulama katmanında değil veritabanında çözülür:

1. Sipariş transaction'ı `SELECT ... FOR UPDATE` ile paket satırını kilitler.
2. `available_quantity >= quantity` koşulu kilit altında doğrulanır.
3. Stok düşülür, sipariş `payment_pending` durumunda yazılır.
4. Ödeme onayı gelmezse zamanlanmış iş rezervasyonu geri verir.

Ek koruma olarak `available_quantity >= 0` CHECK kısıtı tanımlanır — mantık
hatası veriyi bozamaz.

### Idempotency

`POST /orders`, `POST /orders/{id}/cancel` ve `POST /orders/{id}/pickup`
uçları `Idempotency-Key` başlığı ister. Anahtar + kullanıcı + endpoint üçlüsü
Redis'te 24 saat saklanır; aynı anahtarla gelen ikinci istek ilk isteğin
yanıtını döndürür, yeni kayıt oluşturmaz.

İstemcilerin anahtarı **istek başına değil, kullanıcı eylemi başına** üretmesi
gerekir; aksi halde ağ tekrarında ikinci sipariş oluşur.

### Teslim doğrulama (pickup nonce)

Teslim ekranındaki kaydırma hareketi tek başına yeterli değildir. Sunucu:

- nonce'ı sipariş sahibine bağlar, tek kullanımlıktır ve kısa ömürlüdür,
- teslim zaman aralığını **sunucu saatine** göre doğrular,
- arkadaşa devredilen teslim için ayrı, süreli bir nonce üretir.

### Para birimi

Tüm parasal değerler veritabanında ve API'de tam sayı **kuruş**
(`amount_minor`) olarak taşınır. Kayan noktalı sayı hiçbir katmanda para için
kullanılmaz.

### Konum

Yakınlık sorguları PostGIS `geography` tipi ve GiST indeksi ile yapılır.
Kullanıcı konumu kalıcı olarak saklanmaz; yalnızca istek bağlamında kullanılır.

## Kimlik doğrulama

- Şifreler Argon2id ile saklanır.
- Erişim jetonu kısa ömürlü JWT'dir; yenileme jetonu opaktır, veritabanında
  hash'lenmiş tutulur ve **her kullanımda döner** (rotation). Kullanılmış bir
  yenileme jetonunun tekrar sunulması hırsızlık sinyali sayılır ve o cihazın
  tüm oturumları iptal edilir.
- Sosyal girişte sağlayıcı jetonunun doğrulaması sunucuda yapılır (Apple ve
  Google için JWKS imza doğrulaması). İstemciden gelen kullanıcı bilgisine
  güvenilmez.
- Roller: `consumer`, `partner`, `admin`. Partner uçları ayrıca mağaza
  sahipliğiyle sınırlandırılır — rol tek başına yetki vermez.

## Ödeme

`PaymentProvider` arayüzü `authorize`, `capture`, `refund` ve
`verifyWebhook` işlemlerini tanımlar. iyzico uygulaması bu arayüzü karşılar;
sağlayıcı değişimi yalnızca `payments` modülünü etkiler.

Kart verisi hiçbir zaman YePaket sunucusuna ulaşmaz; istemci sağlayıcının
3D Secure akışına yönlendirilir, sunucu yalnızca sağlayıcı jetonunu saklar.

## Gerçek zamanlı olaylar

WebSocket kanalı JWT ile doğrulanır. Yayınlanan olaylar sözleşmede tanımlıdır
(`bag.stock.updated`, `order.status.updated`, `partner.order.created` …).
Olaylar Redis pub/sub üzerinden dağıtılır; böylece API yatayda ölçeklenebilir.

## Ortamlar

| Ortam | Alan adı | Not |
| --- | --- | --- |
| Local | `http://localhost:8080/v1` | Docker Compose |
| Staging | `https://staging-api.yepaket.app/v1` | Üretim yapılandırmasının aynısı, ayrı veri |
| Production | `https://api.yepaket.app/v1` | |

Uygulama açılışında ortam değişkenleri şemaya göre doğrulanır; eksik veya
geçersiz bir değişken varsa süreç **başlamaz** (sessizce yanlış yapılandırma
ile çalışmaz).
