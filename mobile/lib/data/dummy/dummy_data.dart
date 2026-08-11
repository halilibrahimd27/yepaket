import '../models/models.dart';

abstract final class DummyData {
  static const bags = <SurpriseBag>[
    SurpriseBag(
      id: 'bag_istanbul_firin_01',
      store: 'Moda Fırını',
      title: 'Günün Fırın Paketi',
      category: BagCategory.bakery,
      imageAsset: 'assets/images/bag-bakery.jpg',
      distanceKm: .85,
      pickupLabel: 'Bugün 20:00–20:30',
      rating: 4.8,
      reviewCount: 186,
      originalPrice: 420,
      price: 139,
      availableQuantity: 3,
      description:
          'Gün içinde hazırlanan kruvasan, ekşi mayalı ekmek ve tatlılardan oluşan sürpriz paket.',
      address: 'Caferağa Mah. Moda Cad. No:44, Kadıköy',
    ),
    SurpriseBag(
      id: 'bag_besiktas_market_02',
      store: 'Mahalle Manavı',
      title: 'Taze Sebze & Meyve',
      category: BagCategory.market,
      imageAsset: 'assets/images/bag-market.jpg',
      distanceKm: 1.2,
      pickupLabel: 'Bugün 19:30–21:00',
      rating: 4.6,
      reviewCount: 94,
      originalPrice: 350,
      price: 109,
      availableQuantity: 5,
      description:
          'Görünümü kusursuz olmayabilir ama lezzeti yerinde mevsim sebze ve meyveleri.',
      address: 'Sinanpaşa Mah. Şair Nedim Cad. No:18, Beşiktaş',
    ),
    SurpriseBag(
      id: 'bag_karakoy_cafe_03',
      store: 'Kök Kahve',
      title: 'Kahve Yanı Sürprizi',
      category: BagCategory.cafe,
      imageAsset: 'assets/images/bag-croissant.jpg',
      distanceKm: 2.4,
      pickupLabel: 'Bugün 21:00–21:30',
      rating: 4.9,
      reviewCount: 241,
      originalPrice: 390,
      price: 129,
      availableQuantity: 2,
      description:
          'Kapanışa doğru tezgahta kalan günlük kruvasan, sandviç ve tatlı seçenekleri.',
      address: 'Kemankeş Karamustafapaşa Mah. No:7, Karaköy',
    ),
    SurpriseBag(
      id: 'bag_bakirkoy_patisserie_04',
      store: 'Mimoza Pastanesi',
      title: 'Tatlı Kurtarma Paketi',
      category: BagCategory.bakery,
      imageAsset: 'assets/images/bag-pastries.jpg',
      distanceKm: 3.1,
      pickupLabel: 'Yarın 20:30–21:30',
      rating: 4.7,
      reviewCount: 132,
      originalPrice: 480,
      price: 149,
      availableQuantity: 4,
      description:
          'Günlük üretimden kalan kek, kurabiye ve porsiyon tatlılardan seçki.',
      address: 'Zeytinlik Mah. Yakut Sok. No:12, Bakırköy',
    ),
  ];

  static const impact = UserImpact(
    savedBags: 12,
    moneySaved: 1280,
    co2Kg: 32.4,
    waterLiters: 9720,
  );
}
