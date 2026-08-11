# Flutter API bağlantı notları

Mobil uygulama şu anda `AppState` içinde dummy repository'leri kullanır. Gerçek
backend bağlantısında ekranları değiştirmek yerine repository implementasyonları
uzak sürümlerle değiştirilmelidir.

## Ortam seçimi

`lib/core/network/api_config.dart` iki compile-time değişken okur:

- `DUMMY_MODE`: varsayılan `true`
- `API_BASE_URL`: varsayılan `https://api.yepaket.app/v1`

Android emülatörü için local URL `http://10.0.2.2:8080/v1`, iOS simülatörü için
`http://127.0.0.1:8080/v1` olmalıdır.

## Repository geçişi

Uygulama başlatılırken `AppState` bağımlılıklarını enjekte edin:

```dart
final client = ApiClient();
final state = AppState(
  authRepository: RemoteAuthRepository(client),
  bagRepository: RemoteBagRepository(client),
  orderRepository: RemoteOrderRepository(client),
);
```

`RemoteBagRepository` ve `RemoteOrderRepository`, ortak sözleşmedeki response
nesnelerini `SurpriseBag` ve `AppOrder` modellerine çevirmelidir. Auth cevabında
gelen access token `client.setAccessToken(...)` ile eklenir; refresh token iOS
Keychain/Android Keystore tabanlı güvenli depoda tutulmalıdır.

## İstek örnekleri

Yakındaki paketler:

```http
GET /bags/nearby?lat=40.9877&lng=29.0277&radius_km=8&category=bakery
Authorization: Bearer <access_token>
```

Rezervasyon:

```http
POST /orders
Authorization: Bearer <access_token>
Idempotency-Key: 8dbde466-14c9-4d4d-a6bc-84dd25e040e5
Content-Type: application/json

{"bag_id":"bag_01","quantity":1,"payment_method_id":"pm_01"}
```

Teslim onayı:

```http
POST /orders/ord_01/pickup
Authorization: Bearer <access_token>
Content-Type: application/json

{"pickup_nonce":"single_use_nonce","location":{"lat":40.9877,"lng":29.0277}}
```

Sosyal giriş düğmeleri dummy modunda sadece gecikme simüle eder. Gerçekte Apple,
Google ve Microsoft SDK'larından alınan `id_token`/`authorization_code`,
`POST /auth/oauth/{provider}` ucuna gönderilmelidir.

Tam endpoint, payload, WebSocket, hata, güvenlik ve partner paneli tanımları için
`../../docs/API_CONTRACT.md` dosyasını kullanın.
