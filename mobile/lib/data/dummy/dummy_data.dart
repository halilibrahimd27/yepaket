import '../models/models.dart';

/// Geliştirme ve çevrimdışı demo verisi.
///
/// Teslim aralıkları çalışma anına göre üretilir: sabit tarih yazılsaydı
/// veri bir gün sonra "süresi geçmiş" görünür ve keşif listesi boşalırdı.
abstract final class DummyData {
  static DateTime _at(int hour, int minute, {int dayOffset = 0}) {
    final now = DateTime.now();
    var moment = DateTime(
      now.year,
      now.month,
      now.day + dayOffset,
      hour,
      minute,
    );
    if (dayOffset == 0 && moment.isBefore(now)) {
      moment = moment.add(const Duration(days: 1));
    }
    return moment;
  }

  static List<SurpriseBag> get bags => [
    SurpriseBag(
      id: 'bag_istanbul_firin_01',
      storeId: 'store_moda_firini',
      store: 'Moda Fırını',
      title: 'Günün Fırın Paketi',
      category: BagCategory.bakery,
      imageAsset: 'assets/images/bag-bakery.jpg',
      distanceKm: .26,
      pickupStartsAt: _at(20, 0),
      pickupEndsAt: _at(20, 30),
      rating: 4.8,
      reviewCount: 186,
      originalPriceMinor: 42000,
      priceMinor: 13900,
      availableQuantity: 3,
      description:
          'Gün içinde hazırlanan kruvasan, ekşi mayalı ekmek ve tatlılardan oluşan sürpriz paket.',
      address: 'Caferağa Mah. Moda Cad. No:44, Kadıköy/İstanbul',
    ),
    SurpriseBag(
      id: 'bag_besiktas_market_02',
      storeId: 'store_mahalle_manavi',
      store: 'Mahalle Manavı',
      title: 'Taze Sebze & Meyve',
      category: BagCategory.market,
      imageAsset: 'assets/images/bag-market.jpg',
      distanceKm: 6.28,
      pickupStartsAt: _at(19, 30),
      pickupEndsAt: _at(21, 0),
      rating: 4.6,
      reviewCount: 94,
      originalPriceMinor: 35000,
      priceMinor: 10900,
      availableQuantity: 5,
      description:
          'Görünümü kusursuz olmayabilir ama lezzeti yerinde mevsim sebze ve meyveleri.',
      address: 'Sinanpaşa Mah. Şair Nedim Cad. No:18, Beşiktaş/İstanbul',
    ),
    SurpriseBag(
      id: 'bag_karakoy_cafe_03',
      storeId: 'store_kok_kahve',
      store: 'Kök Kahve',
      title: 'Kahve Yanı Sürprizi',
      category: BagCategory.cafe,
      imageAsset: 'assets/images/bag-croissant.jpg',
      distanceKm: 5.98,
      pickupStartsAt: _at(21, 0),
      pickupEndsAt: _at(21, 30),
      rating: 4.9,
      reviewCount: 241,
      originalPriceMinor: 39000,
      priceMinor: 12900,
      availableQuantity: 2,
      description:
          'Kapanışa doğru tezgahta kalan günlük kruvasan, sandviç ve tatlı seçenekleri.',
      address:
          'Kemankeş Karamustafapaşa Mah. Mumhane Cad. No:7, Beyoğlu/İstanbul',
      isFavorite: true,
    ),
    SurpriseBag(
      id: 'bag_bakirkoy_patisserie_04',
      storeId: 'store_mimoza',
      store: 'Mimoza Pastanesi',
      title: 'Tatlı Kurtarma Paketi',
      category: BagCategory.bakery,
      imageAsset: 'assets/images/bag-pastries.jpg',
      distanceKm: 13.15,
      pickupStartsAt: _at(20, 30, dayOffset: 1),
      pickupEndsAt: _at(21, 30, dayOffset: 1),
      rating: 4.7,
      reviewCount: 132,
      originalPriceMinor: 48000,
      priceMinor: 14900,
      availableQuantity: 4,
      description:
          'Günlük üretimden kalan kek, kurabiye ve porsiyon tatlılardan seçki.',
      address: 'Zeytinlik Mah. Yakut Sok. No:12, Bakırköy/İstanbul',
    ),
  ];
}
