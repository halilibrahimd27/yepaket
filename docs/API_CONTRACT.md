# YePaket API sözleşmesi

> Bu doküman **çalışan uygulamadan üretilmiştir** (`openapi.json`), elle
> yazılmamıştır. Uçlar değiştiğinde `backend/openapi.json` yeniden üretilip
> buradaki tablolar güncellenmelidir.
>
> Canlı ve gezilebilir sürüm: `GET /v1/docs` (Swagger UI — üretimde kapalı).

**Taban adres:** `https://api.yepaket.app/v1`
**Sürümleme:** yol üzerinde (`/v1`). Kırıcı değişiklikler `/v2` altında yayınlanır.
**Toplam:** 82 belgelenmiş uç + 1 gizli webhook (`POST /v1/payments/webhook`)

---

## 1. Ortak kurallar

### 1.1 Yanıt zarfı

Başarılı yanıtlar sabit bir zarf içinde döner. Bu, listelerin sonradan
sayfalama bilgisi kazanmasını kırıcı değişiklik olmaktan çıkarır.

```json
{
  "data": { "id": "...", "order_no": "YP-001042" },
  "meta": { "request_id": "01JQ...", "page": 1, "per_page": 20, "total": 57 }
}
```

`meta` yalnızca anlamlı olduğunda alan taşır; tekil kayıtlarda genellikle
sadece `request_id` bulunur.

Sağlık kontrolü uçları (`/health*`) zarf kullanmaz: yük dengeleyiciler ve
Kubernetes ham yanıt bekler.

### 1.2 Alan adlandırma

İstek gövdeleri **camelCase**, yanıtlar **snake_case** kullanır. Dönüşüm
sunucuda otomatik yapılır.

```
İstek:  { "bagId": "...", "idempotencyKey": "..." }
Yanıt:  { "bag_id": "...", "created_at": "..." }
```

### 1.3 Para

Tüm parasal alanlar **tam sayı kuruş**tur ve adı `_minor` ile biter.
Hiçbir katmanda kayan noktalı sayı kullanılmaz.

```json
{ "price": { "amount_minor": 13900, "currency": "TRY" } }
```

`13900` = 139,00 ₺. İstemci gösterirken 100'e böler.

### 1.4 Zaman

Tüm zaman damgaları **UTC** ve ISO 8601'dir: `2026-08-17T17:00:00.000Z`.
İstemci `Europe/Istanbul`a çevirerek gösterir. Teslim aralıkları da bu
kurala uyar — sunucu yerel saat göndermez.

### 1.5 Hatalar

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Bu paketten yalnızca 2 adet kaldı.",
    "details": { "available": 2, "requested": 5 },
    "request_id": "01JQ..."
  }
}
```

`message` **kullanıcıya doğrudan gösterilebilir** Türkçe metindir.
`code` istemcinin dallanma yapması içindir; sabittir ve çevrilmez.

| Kod | HTTP | Anlamı |
|---|---|---|
| `VALIDATION_FAILED` | 400 / 422 | Girdi doğrulaması başarısız |
| `UNAUTHENTICATED` | 401 | Jeton yok veya geçersiz |
| `TOKEN_EXPIRED` | 401 | Erişim jetonunun süresi doldu — yenile |
| `SESSION_REVOKED` | 401 | Oturum iptal edildi — yeniden giriş gerekir |
| `INVALID_CREDENTIALS` | 401 | E-posta veya şifre hatalı |
| `REFRESH_TOKEN_REUSED` | 401 | Kullanılmış yenileme jetonu sunuldu (hırsızlık sinyali) |
| `FORBIDDEN` | 403 | Yetki yok |
| `NOT_FOUND` | 404 | Kayıt yok veya erişim hakkı yok |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | `Idempotency-Key` başlığı eksik |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | Aynı anahtar farklı gövdeyle kullanıldı |
| `INSUFFICIENT_STOCK` | 422 | Stok yetersiz |
| `RATE_LIMITED` | 429 | Hız sınırı aşıldı |

**Varlık gizleme:** Başkasına ait bir kaydı istemek 403 değil **404**
döndürür. 403, kaydın var olduğunu doğrulardı.

### 1.6 Kimlik doğrulama

```
Authorization: Bearer <access_token>
```

- **Erişim jetonu:** JWT, 15 dakika. Yenilenmez, yeniden alınır.
- **Yenileme jetonu:** opak rastgele veri, 60 gün, **her kullanımda döner**.
  Sunucuda yalnızca HMAC özeti saklanır.
- Kullanılmış bir yenileme jetonu ikinci kez sunulursa kullanıcının **tüm
  cihazlardaki** oturumları kapatılır (`REFRESH_TOKEN_REUSED`). Yalnızca o
  cihazı kapatmak yeterli olmazdı: jetonu kimin çaldığı bilinmediği için
  meşru oturum da şüphelidir.
- Oturum iptal edildiğinde (çıkış, şifre değişimi/sıfırlaması) elde bulunan
  erişim jetonu **anında** geçersizleşir — süresi dolmasını beklemez.

### 1.7 Idempotency

Para hareketi içeren uçlar (`POST /v1/orders`) `Idempotency-Key` başlığı
ister.

```
Idempotency-Key: 7f3c9e21-...
```

- Aynı anahtar + aynı gövde → **ilk isteğin yanıtı** döner, ikinci sipariş
  oluşmaz.
- Aynı anahtar + farklı gövde → `409 IDEMPOTENCY_KEY_CONFLICT`.
- Anahtar **kullanıcı eylemi başına bir kez** üretilmeli ve tekrar
  denemelerde aynı kalmalıdır. Her istekte yeni anahtar üretmek korumayı
  tamamen etkisiz kılar.
- Kayıtlar veritabanında tutulur (Redis'te değil): bellek baskısı altında
  kaybolmamalıdır.

### 1.8 Hız sınırları

| Uç | Sınır |
|---|---|
| Genel | 120 istek / dakika / IP (`RATE_LIMIT_PER_MINUTE`) |
| `POST /v1/auth/login`, `/register`, `/oauth/*` | 8 / dakika |
| `POST /v1/auth/password-reset/request` | 3 / dakika |
| `POST /v1/auth/password-reset/confirm` | 10 / dakika |
| `POST /v1/support/tickets` | 3 / dakika |
| `POST /v1/waitlist` | 5 / dakika |

Aşıldığında `429` ve `Retry-After` başlığı döner.

### 1.9 Sayfalama

Liste uçları `page` (1'den başlar) ve `limit` (varsayılan 20, **en fazla 50**)
sorgu parametrelerini kabul eder. Toplam sayı `meta.total` içinde döner.

Tanımsız bir sorgu parametresi göndermek `400` döndürür (`forbidNonWhitelisted`):
`per_page` gibi yanlış adlandırılmış bir alan sessizce yok sayılmaz.

---

## 2. Uç noktalar

🔒 = giriş gerektirir.

### Sağlık kontrolü

|  | Uç nokta | Ne yapar |
|---|---|---|
| — | `GET /health` | Genel sağlık özeti (readiness ile aynı kontroller) |
| — | `GET /health/live` | Süreç ayakta mı (liveness) |
| — | `GET /health/ready` | Bağımlılıkların hazır olup olmadığını kontrol eder |

### Kimlik ve hesap

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `POST /v1/auth/change-password` | Şifre değiştirir |
| — | `POST /v1/auth/login` | E-posta ve şifre ile giriş yapar |
| 🔒 | `POST /v1/auth/logout` | Yalnızca mevcut oturumu kapatır |
| 🔒 | `POST /v1/auth/logout-all` | Tüm cihazlardaki oturumları kapatır |
| 🔒 | `GET /v1/auth/me` | Oturum açmış kullanıcının profili |
| 🔒 | `PATCH /v1/auth/me` | Profil bilgilerini günceller |
| 🔒 | `DELETE /v1/auth/me` | Hesabı kapatır (KVKK) |
| 🔒 | `GET /v1/auth/me/notification-preferences` | Bildirim tercihlerini döndürür |
| 🔒 | `PATCH /v1/auth/me/notification-preferences` | Bildirim tercihlerini günceller |
| — | `POST /v1/auth/oauth/{provider}` | Sosyal giriş |
| — | `POST /v1/auth/password-reset/confirm` | Jetonla yeni şifreyi kaydeder |
| — | `POST /v1/auth/password-reset/request` | Şifre sıfırlama bağlantısı gönderir |
| — | `POST /v1/auth/refresh` | Erişim jetonunu yeniler |
| — | `POST /v1/auth/register` | E-posta ve şifre ile yeni hesap oluşturur |
| 🔒 | `GET /v1/auth/sessions` | Açık oturumları listeler (cihaz yönetimi) |
| 🔒 | `DELETE /v1/auth/sessions/{id}` | Belirli bir oturumu kapatır |

### Paket keşfi

|  | Uç nokta | Ne yapar |
|---|---|---|
| — | `GET /v1/bags` | Paketleri listeler (nearby ile aynı filtreler) |
| — | `GET /v1/bags/nearby` | Yakındaki paketleri listeler |
| — | `GET /v1/bags/{id}` | Paket detayı |
| 🔒 | `POST /v1/bags/{id}/favorite` | Paketi favorilere ekler |
| 🔒 | `DELETE /v1/bags/{id}/favorite` | Paketi favorilerden çıkarır |

### İşletme profilleri

|  | Uç nokta | Ne yapar |
|---|---|---|
| — | `GET /v1/stores/{id}` | İşletme profili |
| — | `GET /v1/stores/{id}/bags` | İşletmenin yayındaki paketleri |
| 🔒 | `POST /v1/stores/{id}/favorite` | İşletmeyi favorilere ekler |
| 🔒 | `DELETE /v1/stores/{id}/favorite` | İşletmeyi favorilerden çıkarır |

### Favoriler

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `GET /v1/favorites` | Favori işletmeler ve varsa bugünkü paketleri |

### Sipariş, ödeme ve teslim

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `POST /v1/orders` | Sipariş oluşturur ve ödemeyi başlatır |
| 🔒 | `GET /v1/orders` | Kullanıcının siparişleri |
| 🔒 | `GET /v1/orders/{id}` | Sipariş detayı |
| 🔒 | `POST /v1/orders/{id}/cancel` | Siparişi iptal eder |
| — | `POST /v1/orders/{id}/payment-callback` | Ödeme sağlayıcısı dönüş ucu (3D Secure sonrası) |
| 🔒 | `POST /v1/orders/{id}/pickup` | Teslim alındığını onaylar |
| 🔒 | `POST /v1/orders/{id}/pickup-nonce` | Teslim doğrulaması için tek kullanımlık kod üretir |
| 🔒 | `POST /v1/orders/{id}/rating` | Siparişi değerlendirir |
| 🔒 | `POST /v1/orders/{id}/share-pickup` | Arkadaşa teslim bağlantısı üretir |

### Bildirimler

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `GET /v1/notifications` | Bildirimleri listeler |
| 🔒 | `POST /v1/notifications/read-all` | Tümünü okundu işaretler |
| 🔒 | `GET /v1/notifications/unread-count` | Okunmamış bildirim sayısı (rozet için) |
| 🔒 | `PATCH /v1/notifications/{id}/read` | Bildirimi okundu işaretler |

### Cihazlar

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `POST /v1/devices/push-token` | Push bildirim jetonunu kaydeder |

### Etki

|  | Uç nokta | Ne yapar |
|---|---|---|
| — | `GET /v1/impact/community` | Topluluk toplam etkisi (tanıtım sayfası için) |
| 🔒 | `GET /v1/impact/me` | Kullanıcının çevresel etkisi |

### Destek

|  | Uç nokta | Ne yapar |
|---|---|---|
| — | `POST /v1/support/tickets` | Destek talebi oluşturur |
| 🔒 | `GET /v1/support/tickets` | Kullanıcının destek talepleri |
| 🔒 | `GET /v1/support/tickets/{id}` | Destek talebi detayı |

### Bekleme listesi

|  | Uç nokta | Ne yapar |
|---|---|---|
| — | `POST /v1/waitlist` | Bekleme listesine katılır |
| — | `GET /v1/waitlist/{feature}/count` | Özelliğin bekleme listesi sayısı |

### Medya

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `POST /v1/media/images` | Paket veya mağaza görseli yükler |

### İşletme paneli

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `GET /v1/partner/bags` | İşletmenin paketleri (satılan adet dahil) |
| 🔒 | `POST /v1/partner/bags` | Yeni sürpriz paket yayınlar |
| 🔒 | `PATCH /v1/partner/bags/{id}` | Paketi günceller |
| 🔒 | `DELETE /v1/partner/bags/{id}` | Paketi siler |
| 🔒 | `POST /v1/partner/bags/{id}/pause` | Paketi yayından kaldırır |
| 🔒 | `POST /v1/partner/bags/{id}/publish` | Paketi yayına alır |
| 🔒 | `POST /v1/partner/bags/{id}/toggle` | Paketi yayına alır veya kaldırır |
| 🔒 | `GET /v1/partner/dashboard` | Panel özeti |
| 🔒 | `GET /v1/partner/orders` | İşletmenin siparişleri |
| 🔒 | `POST /v1/partner/orders/{id}/confirm-pickup` | Teslim kodunu doğrulayarak siparişi tamamlar |
| 🔒 | `GET /v1/partner/payouts` | Hakediş geçmişi |
| 🔒 | `GET /v1/partner/payouts/summary` | Dönem hakediş özeti |
| 🔒 | `GET /v1/partner/store` | Mağaza profili |
| 🔒 | `PATCH /v1/partner/store` | Mağaza profilini günceller |
| 🔒 | `GET /v1/partner/stores` | Kullanıcının yönetebildiği işletmeler |
| 🔒 | `GET /v1/partner/templates` | Tekrar eden paket şablonları |
| 🔒 | `POST /v1/partner/templates` | Tekrar eden paket şablonu oluşturur |
| 🔒 | `POST /v1/partner/templates/{id}/toggle` | Şablonu etkinleştirir veya durdurur |
| — | `POST /v1/partners/applications` | İşletme ön kayıt başvurusu |

### Yönetim

|  | Uç nokta | Ne yapar |
|---|---|---|
| 🔒 | `GET /v1/admin/applications` | İşletme başvuruları |
| 🔒 | `POST /v1/admin/applications/{id}/review` | Başvuruyu değerlendirir |
| 🔒 | `GET /v1/admin/audit-log` | Denetim kaydı |
| 🔒 | `GET /v1/admin/overview` | Sistem geneli özet |
| 🔒 | `POST /v1/admin/payouts/{id}/mark-paid` | Hakedişi ödendi olarak işaretler |
| 🔒 | `GET /v1/admin/stores` | İşletmeler |
| 🔒 | `PATCH /v1/admin/stores/{id}/commission` | Komisyon oranını değiştirir |
| 🔒 | `PATCH /v1/admin/stores/{id}/payout-details` | Hakediş bilgilerini günceller (IBAN, vergi) |
| 🔒 | `POST /v1/admin/stores/{id}/payouts/generate` | Verilen dönem için hakediş kaydı üretir |
| 🔒 | `PATCH /v1/admin/stores/{id}/status` | İşletme durumunu değiştirir |
| 🔒 | `GET /v1/admin/support/tickets` | Destek talepleri |
| 🔒 | `PATCH /v1/admin/support/tickets/{id}` | Destek talebi durumunu günceller |

---

## 3. Önemli akışlar

### 3.1 Sipariş ve ödeme

```
1. POST /v1/orders                     (Idempotency-Key ile)
   → Stok satır kilidiyle düşülür, sipariş PAYMENT_PENDING olur
   → payment_redirect_url döner (3D Secure sayfası)

2. Kullanıcı sağlayıcının sayfasında ödemeyi tamamlar

3. Sağlayıcı → POST /v1/payments/webhook   (sunucudan sunucuya)
   ve/veya
   Kullanıcı → POST /v1/orders/{id}/payment-callback

   → Sipariş PAID → PICKUP_PENDING olur, teslim kodu üretilir
```

**Stok güvenliği:** Sipariş oluşturma `SELECT ... FOR UPDATE` ile paketi
kilitler. 10 eşzamanlı istek 3 stoğa geldiğinde tam olarak 3 sipariş oluşur,
7'si `INSUFFICIENT_STOCK` alır. Ayrıca veritabanı seviyesinde
`available_quantity >= 0` CHECK kısıtı vardır.

**Ödeme onaylanmazsa:** `reservation_expires_at` dolduğunda (varsayılan
15 dakika, `ORDER_RESERVATION_TTL_MINUTES`) zamanlanmış iş rezervasyonu geri
verir ve stok serbest kalır.

**Webhook ucu Swagger'da görünmez** (`@ApiExcludeController`): yalnızca ödeme
sağlayıcısı çağırır ve imza doğrulanmadan hiçbir işlem yapılmaz. Hız
sınırından muaftır — sağlayıcı yeniden deneme yaparken engellenmemelidir.

### 3.2 Teslim

```
1. POST /v1/orders/{id}/pickup-nonce   → tek kullanımlık nonce (kısa ömürlü)
2. POST /v1/orders/{id}/pickup         → nonce ile teslim onayı
```

Sunucu teslim aralığını **kendi saatine göre** doğrular; istemcinin
gönderdiği zamana güvenilmez. Nonce hash'lenmiş saklanır ve bir kez
kullanılır.

Alternatif olarak mağaza personeli `POST /v1/partner/orders/{id}/confirm-pickup`
ile kullanıcının gösterdiği 6 haneli kodu doğrulayabilir.

### 3.3 İptal ve iade

`POST /v1/orders/{id}/cancel` — teslim aralığının başlangıcına
`FREE_CANCEL_WINDOW_MINUTES` (varsayılan **120 dakika**) veya daha fazla
varsa iptal edilebilir ve ödeme iade edilir. Pencere kapandıktan sonra `422`
döner: işletme o ürünü ayırmıştır. İptal stoğu geri verir ve paket satışa
yeniden açılır.

### 3.4 Şifre sıfırlama

```
1. POST /v1/auth/password-reset/request  { email }
   → Adres kayıtlı olsun olmasın aynı yanıt (kullanıcı sayımı engellenir)
   → Kayıtlıysa e-posta gider; bağlantı 30 dakika geçerli

2. POST /v1/auth/password-reset/confirm  { token, newPassword }
   → Jeton tek kullanımlıktır
   → Kullanıcının TÜM oturumları kapatılır (erişim jetonları dahil)
```

### 3.5 İşletme başvurusundan yayına

```
1. POST /v1/partners/applications       (herkese açık form)
2. GET  /v1/admin/applications          (yönetici inceler)
3. POST /v1/admin/applications/{id}/review  → onaylanırsa Store oluşur
4. PATCH /v1/admin/stores/{id}/payout-details  → IBAN, vergi bilgileri
   → payout_ready true olmadan hakediş üretilemez
5. İşletme POST /v1/partner/bags ile paket yayınlar
```

---

## 4. Gerçek zamanlı olaylar

WebSocket: `wss://api.yepaket.app/v1/realtime` (Socket.IO namespace)

Bağlanırken erişim jetonu `auth.token` alanında ya da `Authorization: Bearer`
başlığında gönderilir. Jeton geçersizse bağlantı reddedilir.

Bağlantı kurulduğunda sunucu `connected` olayını `{ userId }` ile gönderir.
Jeton geçersizse `error` olayı `{ code: "UNAUTHENTICATED" }` ile döner.

| Olay | Kime gider | Ne zaman | Yük |
|---|---|---|---|
| `bag.stock.updated` | Herkese | Stok değiştiğinde | `{ bagId, availableQuantity }` |
| `bag.available` | `store:{id}` odası | Yeni paket yayına girdiğinde | `{ bagId, storeId }` |
| `order.status.updated` | `user:{id}` odası | Sipariş durumu değiştiğinde | `{ orderId, userId, status }` |

Yönlendirme yüke göre yapılır: `userId` varsa yalnızca o kullanıcıya,
`storeId` varsa işletme odasına, ikisi de yoksa herkese yayınlanır.

Olaylar **outbox deseni** ile yayınlanır: iş transaction'ı içinde
`outbox_events` tablosuna yazılır, ayrı bir süreç `FOR UPDATE SKIP LOCKED`
ile okuyup Redis pub/sub'a taşır. Böylece "veritabanı yazıldı ama olay
yayınlanmadı" durumu oluşmaz.

Yayın sırasında hata alan olaylar `last_error` ile işaretlenir; 10 dakikada
bir çalışan bakım görevi bunları (5 denemeye kadar) yeniden kuyruğa alır.
Eşiği aşanlar için hata kaydı düşülür ve elle inceleme beklenir.

`order.status.updated` ve `bag.available` ayrıca **kalıcı bildirim** üretir:
o anda bağlı olmayan kullanıcı bildirimi sonradan görebilmelidir.

---

## 5. Sözleşmeyi yeniden üretme

```bash
cd backend
npm run openapi        # backend/openapi.json dosyasını yeniden üretir
```

Şema, uygulamanın **çalışan hâlinden** üretilir (`scripts/generate-openapi.ts`)
ve üretimdekiyle aynı `configureApp` yapılandırmasını kullanır. Belgelenen ile
çalışan böylece ayrışamaz.

`openapi.json` dosyası Postman, Insomnia veya istemci kodu üreticilerine
doğrudan verilebilir.
