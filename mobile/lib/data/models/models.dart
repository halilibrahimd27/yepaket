import 'package:intl/intl.dart';

/// Para ve tarih biçimleri tek yerde tanımlanır: aynı değerin ekranlar
/// arasında farklı görünmesi (nokta/virgül karışması) kullanıcıda güven
/// kaybı yaratır.
abstract final class Formats {
  static final currency = NumberFormat.currency(
    locale: 'tr_TR',
    symbol: '₺',
    decimalDigits: 0,
  );

  static final currencyWithCents = NumberFormat.currency(
    locale: 'tr_TR',
    symbol: '₺',
    decimalDigits: 2,
  );

  static final decimal = NumberFormat.decimalPattern('tr_TR');
  static final time = DateFormat('HH:mm', 'tr_TR');
  static final dayMonth = DateFormat('d MMMM', 'tr_TR');

  /// Kuruşu Türkçe para biçiminde gösterir. Tam liraysa kuruş gösterilmez.
  static String money(int amountMinor) {
    final value = amountMinor / 100;
    return amountMinor % 100 == 0
        ? currency.format(value)
        : currencyWithCents.format(value);
  }

  /// Ondalık sayıyı Türkçe biçimde (virgüllü) gösterir.
  static String number(num value, {int decimals = 1}) =>
      NumberFormat.decimalPatternDigits(
        locale: 'tr_TR',
        decimalDigits: decimals,
      ).format(value);

  /// Göreli zaman: "az önce", "12 dk önce", "dün", "3 Mart".
  ///
  /// Bildirim listelerinde mutlak saat okumayı zorlaştırır; kullanıcı
  /// "ne kadar önce" bilgisini arar.
  static String relative(DateTime moment) {
    final difference = DateTime.now().difference(moment);

    if (difference.isNegative) return time.format(moment);
    if (difference.inMinutes < 1) return 'az önce';
    if (difference.inMinutes < 60) return '${difference.inMinutes} dk önce';
    if (difference.inHours < 24) return '${difference.inHours} sa önce';
    if (difference.inDays == 1) return 'dün';
    if (difference.inDays < 7) return '${difference.inDays} gün önce';
    return dayMonth.format(moment);
  }
}

/// Sunucunun desteklediği sıralama seçenekleri.
///
/// Değerler sunucudaki `BagSort` ile birebir aynı olmalı; uydurma bir değer
/// gönderilirse istek doğrulamada reddedilir.
enum BagSort {
  relevance('Önerilen', 'relevance'),
  distance('En yakın', 'distance'),
  price('En ucuz', 'price'),
  rating('En beğenilen', 'rating'),
  pickupTime('En erken teslim', 'pickup_time');

  const BagSort(this.label, this.apiValue);
  final String label;
  final String apiValue;
}

enum BagCategory {
  all('Tümü', ''),
  bakery('Fırın', 'bakery'),
  market('Market', 'market'),
  cafe('Kafe', 'cafe'),
  restaurant('Restoran', 'restaurant');

  const BagCategory(this.label, this.apiValue);
  final String label;

  /// Sunucunun beklediği küçük harfli değer.
  final String apiValue;
}

class SurpriseBag {
  const SurpriseBag({
    required this.id,
    required this.storeId,
    required this.store,
    required this.title,
    required this.category,
    required this.imageAsset,
    required this.distanceKm,
    required this.pickupStartsAt,
    required this.pickupEndsAt,
    required this.rating,
    required this.reviewCount,
    required this.originalPriceMinor,
    required this.priceMinor,
    required this.availableQuantity,
    required this.description,
    required this.address,
    this.isFavorite = false,
  });

  final String id;
  final String storeId;
  final String store;
  final String title;
  final BagCategory category;
  final String imageAsset;

  /// Konum bilinmiyorsa `null`. Sıfır göstermek "hemen yanınızda" anlamına
  /// gelirdi ve kullanıcıyı yanıltırdı.
  final double? distanceKm;

  final DateTime pickupStartsAt;
  final DateTime pickupEndsAt;
  final double rating;
  final int reviewCount;

  /// Para alanları kuruş cinsindendir; yuvarlama yalnızca gösterimde yapılır.
  final int originalPriceMinor;
  final int priceMinor;

  final int availableQuantity;
  final String description;
  final String address;
  final bool isFavorite;

  String get priceLabel => Formats.money(priceMinor);
  String get originalPriceLabel => Formats.money(originalPriceMinor);

  int get discountPercent => originalPriceMinor <= 0
      ? 0
      : (100 - (priceMinor * 100 / originalPriceMinor)).round();

  String? get distanceLabel {
    final value = distanceKm;
    if (value == null) return null;
    if (value < 1) return '${(value * 1000).round()} m';
    return '${Formats.number(value)} km';
  }

  /// "Bugün 20:00–20:30" / "Yarın 20:30–21:30" / "23 Ağustos 20:00–20:30"
  String get pickupLabel {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(
      pickupStartsAt.year,
      pickupStartsAt.month,
      pickupStartsAt.day,
    );
    final difference = day.difference(today).inDays;

    final prefix = switch (difference) {
      0 => 'Bugün',
      1 => 'Yarın',
      _ => Formats.dayMonth.format(pickupStartsAt),
    };

    return '$prefix ${Formats.time.format(pickupStartsAt)}–${Formats.time.format(pickupEndsAt)}';
  }

  bool get isPickupWindowOpen {
    final now = DateTime.now();
    return now.isAfter(pickupStartsAt) && now.isBefore(pickupEndsAt);
  }

  SurpriseBag copyWith({bool? isFavorite, int? availableQuantity}) =>
      SurpriseBag(
        id: id,
        storeId: storeId,
        store: store,
        title: title,
        category: category,
        imageAsset: imageAsset,
        distanceKm: distanceKm,
        pickupStartsAt: pickupStartsAt,
        pickupEndsAt: pickupEndsAt,
        rating: rating,
        reviewCount: reviewCount,
        originalPriceMinor: originalPriceMinor,
        priceMinor: priceMinor,
        availableQuantity: availableQuantity ?? this.availableQuantity,
        description: description,
        address: address,
        isFavorite: isFavorite ?? this.isFavorite,
      );
}

enum OrderStatus {
  paymentPending,
  paid,
  pickupPending,
  collected,
  cancelled,
  refunded,
  noShow;

  /// Kullanıcıya gösterilecek Türkçe etiket.
  String get label => switch (this) {
    OrderStatus.paymentPending => 'Ödeme bekliyor',
    OrderStatus.paid => 'Ödendi',
    OrderStatus.pickupPending => 'Teslim bekliyor',
    OrderStatus.collected => 'Teslim edildi',
    OrderStatus.cancelled => 'İptal edildi',
    OrderStatus.refunded => 'İade edildi',
    OrderStatus.noShow => 'Teslim alınmadı',
  };

  bool get isActive =>
      this == OrderStatus.pickupPending || this == OrderStatus.paid;
  bool get isFinished =>
      this == OrderStatus.collected ||
      this == OrderStatus.cancelled ||
      this == OrderStatus.refunded ||
      this == OrderStatus.noShow;
}

class AppOrder {
  const AppOrder({
    required this.id,
    required this.orderNo,
    required this.bag,
    required this.quantity,
    required this.totalMinor,
    required this.status,
    required this.pickupStartsAt,
    required this.pickupEndsAt,
    required this.pickupCode,
    this.paymentRedirectUrl,
    this.collectedAt,
  });

  final String id;
  final String orderNo;
  final SurpriseBag bag;
  final int quantity;
  final int totalMinor;
  final OrderStatus status;
  final DateTime pickupStartsAt;
  final DateTime pickupEndsAt;

  /// Mağaza personelinin göreceği kısa doğrulama kodu.
  final String pickupCode;

  /// 3D Secure gerekiyorsa sağlayıcının yönlendirme adresi.
  final String? paymentRedirectUrl;

  final DateTime? collectedAt;

  String get totalLabel => Formats.money(totalMinor);

  /// Bu siparişin tek başına yarattığı etki.
  ///
  /// Katsayılar sunucudaki `impact` modülüyle aynı olmalı; iki ekranın farklı
  /// rakam göstermesi güveni sarsar.
  UserImpact get impact => UserImpact(
    savedBags: quantity,
    moneySavedMinor: (bag.originalPriceMinor * quantity) - totalMinor,
    co2Kg: double.parse((quantity * 2.7).toStringAsFixed(1)),
    waterLiters: quantity * 810,
  );

  String get pickupLabel {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(
      pickupStartsAt.year,
      pickupStartsAt.month,
      pickupStartsAt.day,
    );
    final difference = day.difference(today).inDays;

    final prefix = switch (difference) {
      0 => 'Bugün',
      1 => 'Yarın',
      _ => Formats.dayMonth.format(pickupStartsAt),
    };

    return '$prefix ${Formats.time.format(pickupStartsAt)}–${Formats.time.format(pickupEndsAt)}';
  }

  /// Teslim kaydırıcısı yalnızca aralık açıkken etkinleşmeli.
  bool get isPickupAvailable {
    if (status != OrderStatus.pickupPending) return false;
    final now = DateTime.now();
    return now.isAfter(pickupStartsAt) && now.isBefore(pickupEndsAt);
  }

  AppOrder copyWith({OrderStatus? status, DateTime? collectedAt}) => AppOrder(
    id: id,
    orderNo: orderNo,
    bag: bag,
    quantity: quantity,
    totalMinor: totalMinor,
    status: status ?? this.status,
    pickupStartsAt: pickupStartsAt,
    pickupEndsAt: pickupEndsAt,
    pickupCode: pickupCode,
    paymentRedirectUrl: paymentRedirectUrl,
    collectedAt: collectedAt ?? this.collectedAt,
  );
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String? avatarUrl;

  /// Avatar yerine gösterilecek baş harfler.
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'YP';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

class PickupNonce {
  const PickupNonce({required this.nonce, required this.expiresAt});
  final String nonce;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class UserImpact {
  const UserImpact({
    required this.savedBags,
    required this.moneySavedMinor,
    required this.co2Kg,
    required this.waterLiters,
  });

  final int savedBags;
  final int moneySavedMinor;
  final double co2Kg;
  final int waterLiters;

  String get moneySavedLabel => Formats.money(moneySavedMinor);

  /// "8,1 kg" — Türkçe ondalık ayırıcı ve tek basamak.
  String get co2Label => '${Formats.number(co2Kg)} kg';

  String get waterLabel => '${Formats.decimal.format(waterLiters)} L';

  static const empty = UserImpact(
    savedBags: 0,
    moneySavedMinor: 0,
    co2Kg: 0,
    waterLiters: 0,
  );

  /// Kullanıcının bulunduğu seviye.
  RescuerLevel get level => RescuerLevel.forBags(savedBags);

  /// Bir sonraki seviyeye kalan paket sayısı; en üst seviyede 0.
  int get bagsToNextLevel {
    final next = level.next;
    return next == null ? 0 : (next.threshold - savedBags).clamp(0, 9999);
  }

  /// Mevcut seviye içindeki ilerleme (0–1). En üst seviyede 1.
  double get levelProgress {
    final next = level.next;
    if (next == null) return 1;

    final span = next.threshold - level.threshold;
    if (span <= 0) return 1;

    return ((savedBags - level.threshold) / span).clamp(0.0, 1.0);
  }
}

/// Kurtarıcı seviyeleri.
///
/// Eşikler ürün kararıdır; sunucu bu bilgiyi göndermiyor çünkü tamamen
/// `savedBags` sayısından türetiliyor ve iki yerde tutmak tutarsızlık
/// riski yaratırdı.
enum RescuerLevel {
  yeni('Yeni kurtarıcı', 0),
  yesil('Yeşil Seviye', 5),
  gumus('Gümüş Seviye', 15),
  altin('Altın Seviye', 40),
  efsane('Efsane Kurtarıcı', 100);

  const RescuerLevel(this.label, this.threshold);

  final String label;
  final int threshold;

  static RescuerLevel forBags(int savedBags) {
    var current = RescuerLevel.yeni;
    for (final level in RescuerLevel.values) {
      if (savedBags >= level.threshold) current = level;
    }
    return current;
  }

  /// Bir sonraki seviye; en üstteyse `null`.
  RescuerLevel? get next {
    final index = RescuerLevel.values.indexOf(this);
    return index + 1 < RescuerLevel.values.length
        ? RescuerLevel.values[index + 1]
        : null;
  }
}

/// Bildirim tercihleri.
///
/// Sunucudaki `NotificationPreferences` ile birebir aynı; eksik anahtar
/// "açık" sayılır.
class NotificationPreferences {
  const NotificationPreferences({
    this.bagAvailable = true,
    this.orderUpdates = true,
    this.impactDigest = true,
    this.campaigns = true,
  });

  final bool bagAvailable;
  final bool orderUpdates;
  final bool impactDigest;
  final bool campaigns;

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) =>
      NotificationPreferences(
        bagAvailable: json['bag_available'] as bool? ?? true,
        orderUpdates: json['order_updates'] as bool? ?? true,
        impactDigest: json['impact_digest'] as bool? ?? true,
        campaigns: json['campaigns'] as bool? ?? true,
      );

  NotificationPreferences copyWith({
    bool? bagAvailable,
    bool? orderUpdates,
    bool? impactDigest,
    bool? campaigns,
  }) => NotificationPreferences(
    bagAvailable: bagAvailable ?? this.bagAvailable,
    orderUpdates: orderUpdates ?? this.orderUpdates,
    impactDigest: impactDigest ?? this.impactDigest,
    campaigns: campaigns ?? this.campaigns,
  );
}

/// Uygulama içi bildirim.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final String type;
  final bool isRead;
  final DateTime createdAt;

  /// "3 dk önce", "dün" gibi göreli zaman.
  String get timeLabel => Formats.relative(createdAt);

  AppNotification copyWith({bool? isRead}) => AppNotification(
    id: id,
    title: title,
    body: body,
    type: type,
    isRead: isRead ?? this.isRead,
    createdAt: createdAt,
  );
}

/// Destek talebi.
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.ticketNo,
    required this.subject,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String ticketNo;
  final String subject;
  final String status;
  final DateTime createdAt;

  String get statusLabel => switch (status.toLowerCase()) {
    'open' => 'Açık',
    'pending' => 'Yanıt bekliyor',
    'resolved' => 'Çözüldü',
    'closed' => 'Kapatıldı',
    _ => status,
  };
}
