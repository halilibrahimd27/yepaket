# YePaket API Contract v1

Bu belge web ve Flutter istemcilerinin beklediği backend sözleşmesidir. Mevcut
arayüz `dummy` modunda yerel veri kullanır. Backend hazır olduğunda base URL
değiştirilerek aynı modeller kullanılacaktır.

## Base URLs

| Ortam | URL |
| --- | --- |
| Local | `http://localhost:8080/v1` |
| Staging | `https://staging-api.yepaket.app/v1` |
| Production | `https://api.yepaket.app/v1` |

Tüm cevaplar JSON'dur. Kimlik doğrulanan istekler
`Authorization: Bearer <access_token>` başlığı kullanır. Tarihler ISO-8601 UTC,
fiyatlar tam sayı kuruş (`amount_minor`) olarak taşınır.

## Standart cevap şekli

```json
{
  "data": {},
  "meta": { "request_id": "req_01J...", "timestamp": "2026-08-10T17:20:00Z" }
}
```

```json
{
  "error": {
    "code": "BAG_SOLD_OUT",
    "message": "Bu paket tükendi.",
    "details": {},
    "request_id": "req_01J..."
  }
}
```

## Auth

### `POST /auth/login`

```json
{ "email": "demo@yepaket.app", "password": "secret", "device_id": "device_uuid" }
```

### `POST /auth/oauth/{google|apple|microsoft}`

Mobil sosyal giriş sağlayıcısından alınan token backend'e gönderilir.

```json
{
  "id_token": "provider_id_token",
  "authorization_code": "optional_code",
  "device_id": "device_uuid",
  "platform": "ios"
}
```

Başarılı auth cevabı:

```json
{
  "data": {
    "access_token": "jwt",
    "refresh_token": "opaque_refresh_token",
    "expires_in": 900,
    "user": {
      "id": "usr_01",
      "name": "Eylül Kaya",
      "email": "eylul@example.com",
      "avatar_url": null,
      "role": "consumer"
    }
  }
}
```

Diğer auth uçları: `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`,
`PATCH /auth/me`, `DELETE /auth/me`.

## Discovery & Bags

### `GET /bags/nearby`

Query:

```text
lat=40.9877&lng=29.0277&radius_km=8&date=today&category=bakery
&pickup_from=18:00&pickup_to=23:00&sort=distance&page=1&limit=20
```

`sort`: `relevance`, `distance`, `price`, `rating`, `pickup_time`.

```json
{
  "data": [
    {
      "id": "bag_istanbul_firin_01",
      "store": {
        "id": "store_01",
        "name": "Moda Fırını",
        "logo_url": "https://cdn.yepaket.app/stores/store_01/logo.webp",
        "location": { "lat": 40.9877, "lng": 29.0277 },
        "address": "Caferağa Mah. Moda Cad. No:44, Kadıköy"
      },
      "title": "Günün Fırın Paketi",
      "category": "bakery",
      "description": "Günlük ürünlerden sürpriz seçki.",
      "image_urls": ["https://cdn.yepaket.app/bags/bag_01/cover.webp"],
      "original_value": { "amount_minor": 42000, "currency": "TRY" },
      "sale_price": { "amount_minor": 13900, "currency": "TRY" },
      "available_quantity": 3,
      "pickup_window": {
        "starts_at": "2026-08-10T17:00:00Z",
        "ends_at": "2026-08-10T17:30:00Z"
      },
      "rating": { "overall": 4.8, "food_quality": 4.9, "pickup": 4.7, "count": 186 },
      "distance_meters": 850,
      "is_favorite": false,
      "status": "available"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "next_cursor": "cursor" }
}
```

Uçlar: `GET /bags`, `GET /bags/{id}`, `POST /bags/{id}/favorite`,
`DELETE /bags/{id}/favorite`, `GET /favorites`.

## Orders & Payment

### `POST /orders`

Idempotency için `Idempotency-Key` başlığı zorunludur.

```json
{
  "bag_id": "bag_istanbul_firin_01",
  "quantity": 1,
  "payment_method_id": "pm_01"
}
```

```json
{
  "data": {
    "id": "ord_01",
    "order_no": "YP-1048",
    "status": "paid",
    "total": { "amount_minor": 13900, "currency": "TRY" },
    "pickup_window": {
      "starts_at": "2026-08-10T17:00:00Z",
      "ends_at": "2026-08-10T17:30:00Z"
    },
    "pickup": { "available": false, "available_at": "2026-08-10T17:00:00Z" }
  }
}
```

Sipariş durumları:

```text
payment_pending -> paid -> pickup_pending -> collected
                    |            |
                    +-> cancelled +-> no_show
                    +-> refunded
```

### `POST /orders/{id}/pickup`

Slider tamamlandığında çağrılır. Backend zaman aralığını, sipariş sahibini ve
tek kullanımlık nonce'ı doğrular.

```json
{ "pickup_nonce": "nonce_from_active_order", "location": { "lat": 40.9877, "lng": 29.0277 } }
```

Diğer uçlar: `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel`,
`POST /orders/{id}/share-pickup`, `POST /orders/{id}/rating`.

## Partner / MyStore

- `POST /partners/applications`
- `GET /partner/dashboard?date=2026-08-10`
- `GET /partner/bags`
- `POST /partner/bags`
- `PATCH /partner/bags/{id}`
- `POST /partner/bags/{id}/publish`
- `POST /partner/bags/{id}/pause`
- `GET /partner/orders`
- `POST /partner/orders/{id}/confirm-pickup`
- `GET /partner/payouts`
- `GET /partner/reports/impact`
- `GET /partner/store`
- `PATCH /partner/store`

### `POST /partner/bags`

```json
{
  "title": "Günün Fırın Paketi",
  "category": "bakery",
  "description": "Kruvasan, ekmek ve tatlılardan sürpriz seçki.",
  "original_value_minor": 42000,
  "sale_price_minor": 13900,
  "currency": "TRY",
  "quantity": 8,
  "pickup_starts_at": "2026-08-10T17:00:00Z",
  "pickup_ends_at": "2026-08-10T17:30:00Z",
  "publish_mode": "once"
}
```

## Notifications, Impact, Support

- `GET /notifications`
- `PATCH /notifications/{id}/read`
- `PUT /devices/push-token`
- `GET /impact/me`
- `GET /impact/community`
- `POST /support/tickets`
- `GET /support/tickets/{id}`

## Realtime events

WebSocket/SSE kanalı: `wss://api.yepaket.app/v1/realtime?token=<jwt>`

Beklenen olaylar:

```text
bag.stock.updated
bag.available
order.status.updated
order.pickup.window_opened
partner.order.created
partner.payout.paid
notification.created
```

## Güvenlik ve backend notları

- OAuth secret ve provider doğrulaması yalnızca backend'de yapılır.
- Ödeme kartı verisi YePaket sunucusundan geçmez; PSP tokenı saklanır.
- Sipariş oluşturma, iptal ve pickup uçları idempotent olmalıdır.
- Stok rezervasyonu transaction/row lock ile atomik yapılmalıdır.
- Pickup nonce tek kullanımlı, kısa ömürlü ve sunucu saatine bağlı olmalıdır.
- Konum yalnızca kullanıcı izniyle ve gerekli hassasiyette tutulmalıdır.
- Tüm partner işlemleri tenant/store yetkisiyle sınırlandırılmalıdır.

