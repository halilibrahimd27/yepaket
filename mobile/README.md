# YePaket Mobile

YePaket'in Flutter ile geliştirilen responsive iOS/Android tüketici
uygulamasıdır. Varsayılan olarak tamamen dummy veriyle çalışır; gerçek backend
için repository arayüzleri ve Dio istemcisi hazırdır.

## Ekranlar ve akışlar

- 3 adımlı onboarding
- E-posta, Apple, Google ve Microsoft/Outlook dummy giriş
- Yakındaki paketleri keşfetme, kategori ve arama arayüzü
- Harita/liste görünümü ve filtreler
- Favoriler ve cihazda kalıcı favori durumu
- Paket detayı, adet seçimi, ödeme yöntemi ve rezervasyon
- Sipariş başarı, aktif teslim, arkadaşına teslim bağlantısı ve kaydırarak onay
- Sipariş iptal/iade demosu, geçmiş siparişler ve değerlendirme
- Etki/tasarruf profili, bildirimler, ayarlar ve destek
- Kargoyla gelen fazla stok kolileri
- Telefon ve tablet düzenleri

## Çalıştırma

```bash
flutter pub get
flutter run --dart-define=DUMMY_MODE=true
```

Android emülatöründe yerel backend kullanmak için:

```bash
flutter run \
  --dart-define=DUMMY_MODE=false \
  --dart-define=API_BASE_URL=http://10.0.2.2:8080/v1
```

Fiziksel cihazda `API_BASE_URL` bilgisini bilgisayarın yerel IP adresiyle
değiştirin. Production varsayılanı `https://api.yepaket.app/v1` değeridir.

Harita geliştirme ve hafif demo kullanımında OpenStreetMap standart döşeme
sunucusunu kullanır. Production harita sağlayıcısı derleme sırasında kod
değiştirmeden ayarlanabilir:

```bash
flutter run \
  --dart-define=MAP_TILE_URL=https://harita-saglayiciniz/{z}/{x}/{y}.png \
  --dart-define=MAP_USER_AGENT=com.sirketiniz.uygulama
```

## Mimari

```text
lib/
  app/                 MaterialApp ve router kurulumu
  core/                tema, API config, Dio istemcisi
  data/                modeller, dummy veriler, repository'ler, AppState
  features/            ekran bazlı modüller
  shared/widgets/      ortak responsive bileşenler
```

Backend sözleşmesinin tek kaynağı
[`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md), mobil bağlantı
notları ise [`docs/API_USAGE.md`](docs/API_USAGE.md) dosyasındadır.

## Doğrulama

```bash
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug
```

Gıda fotoğrafları Unsplash'ten (Iñigo De la Maza, Peace Creative, Sunira
Moses, Sandy Ravaloniaina ve Filiz Elaerts); YePaket görsel kimliği bu proje
için OpenAI ImageGen ile üretilmiştir.
