import '../../core/network/api_client.dart';
import '../../core/network/api_config.dart';
import '../dummy/dummy_data.dart';
import '../models/models.dart';

// ---------------------------------------------------------------------------
// Kimlik
// ---------------------------------------------------------------------------

abstract interface class AuthRepository {
  Future<AppUser> signInWithEmail(String email, String password);

  /// Yeni hesap oluşturur ve oturumu açar.
  Future<AppUser> register({
    required String name,
    required String email,
    required String password,
  });

  /// Şifre sıfırlama bağlantısı ister.
  ///
  /// Adres kayıtlı olmasa da başarıyla döner: sunucu kullanıcı sayımını
  /// engellemek için aynı yanıtı verir.
  Future<void> requestPasswordReset(String email);

  /// E-postadaki jetonla yeni şifreyi kaydeder.
  Future<void> confirmPasswordReset(String token, String newPassword);

  Future<AppUser> signInWithProvider(
    String provider, {
    required String idToken,
  });
  Future<AppUser?> currentUser();
  Future<void> signOut();
  Future<bool> get hasSession;
}

class DummyAuthRepository implements AuthRepository {
  AppUser? _user;

  @override
  Future<AppUser> signInWithEmail(String email, String password) async {
    await Future<void>.delayed(const Duration(milliseconds: 650));
    return _user = AppUser(
      id: 'demo-user',
      name: 'Eylül Kaya',
      email: email,
      role: 'CONSUMER',
    );
  }

  @override
  Future<AppUser> signInWithProvider(
    String provider, {
    required String idToken,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    return _user = const AppUser(
      id: 'demo-user',
      name: 'Eylül Kaya',
      email: 'demo@yepaket.app',
      role: 'CONSUMER',
    );
  }

  @override
  Future<AppUser> register({
    required String name,
    required String email,
    required String password,
  }) async {
    _user = AppUser(
      id: 'demo-user',
      name: name,
      email: email,
      role: 'CONSUMER',
    );
    return _user!;
  }

  @override
  Future<void> requestPasswordReset(String email) async {}

  @override
  Future<void> confirmPasswordReset(String token, String newPassword) async {}

  @override
  Future<AppUser?> currentUser() async => _user;

  @override
  Future<void> signOut() async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    _user = null;
  }

  @override
  Future<bool> get hasSession async => _user != null;
}

class RemoteAuthRepository implements AuthRepository {
  RemoteAuthRepository(this._client);
  final ApiClient _client;

  /// Sunucunun beklediği cihaz gövdesi. Cihaz kimliği kalıcıdır.
  Future<Map<String, dynamic>> _device() async => {
    'deviceId': await _client.deviceId(),
    'platform': ApiConfig.platform,
  };

  @override
  Future<AppUser> signInWithEmail(String email, String password) async {
    final response = await _client.post(
      ApiEndpoints.login,
      data: {'email': email, 'password': password, 'device': await _device()},
    );

    return _handleAuthResponse(response);
  }

  @override
  Future<AppUser> signInWithProvider(
    String provider, {
    required String idToken,
  }) async {
    final response = await _client.post(
      ApiEndpoints.oauth(provider),
      data: {'idToken': idToken, 'device': await _device()},
    );

    return _handleAuthResponse(response);
  }

  @override
  Future<AppUser> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await _client.post(
      ApiEndpoints.register,
      data: {
        'name': name,
        'email': email,
        'password': password,
        'device': await _device(),
      },
    );
    return _handleAuthResponse(response);
  }

  @override
  Future<void> requestPasswordReset(String email) async {
    await _client.post(
      ApiEndpoints.requestPasswordReset,
      data: {'email': email},
    );
  }

  @override
  Future<void> confirmPasswordReset(String token, String newPassword) async {
    await _client.post(
      ApiEndpoints.confirmPasswordReset,
      data: {'token': token, 'newPassword': newPassword},
    );
  }

  @override
  Future<AppUser?> currentUser() async {
    if (!await _client.hasSession) return null;
    final response = await _client.get(ApiEndpoints.me);
    return _parseUser(_asMap(response['data']));
  }

  @override
  Future<void> signOut() async {
    try {
      await _client.post(ApiEndpoints.logout);
    } finally {
      // Sunucu tarafı çıkış başarısız olsa da yerel oturum kapatılmalı.
      await _client.clearTokens();
    }
  }

  @override
  Future<bool> get hasSession => _client.hasSession;

  Future<AppUser> _handleAuthResponse(Map<String, dynamic> response) async {
    final data = _asMap(response['data']);

    await _client.saveTokens(
      accessToken: data['access_token'] as String? ?? '',
      refreshToken: data['refresh_token'] as String? ?? '',
    );

    return _parseUser(_asMap(data['user']));
  }
}

// ---------------------------------------------------------------------------
// Paketler
// ---------------------------------------------------------------------------

abstract interface class BagRepository {
  Future<List<SurpriseBag>> nearby({
    BagCategory category = BagCategory.all,
    BagSort sort = BagSort.relevance,
    double? latitude,
    double? longitude,
    String? query,
  });
  Future<SurpriseBag> byId(String id);
  Future<bool> toggleFavorite(String bagId, {required bool isFavorite});
  Future<List<SurpriseBag>> favorites();
}

class DummyBagRepository implements BagRepository {
  final Set<String> _favorites = <String>{DummyData.bags[2].id};

  @override
  Future<List<SurpriseBag>> nearby({
    BagCategory category = BagCategory.all,
    BagSort sort = BagSort.relevance,
    double? latitude,
    double? longitude,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 180));

    final all = DummyData.bags
        .map((bag) => bag.copyWith(isFavorite: _favorites.contains(bag.id)))
        .where((bag) => category == BagCategory.all || bag.category == category)
        .where(
          (bag) =>
              query == null ||
              query.trim().isEmpty ||
              bag.title.toLowerCase().contains(query.toLowerCase()) ||
              bag.store.toLowerCase().contains(query.toLowerCase()),
        )
        .toList();

    // Sunucudaki sıralamanın yerel karşılığı: dummy modda da aynı davranış
    // görülmeli, aksi hâlde sıralama hatası ancak üretimde fark edilir.
    switch (sort) {
      case BagSort.distance:
        all.sort(
          (a, b) => (a.distanceKm ?? 1e9).compareTo(b.distanceKm ?? 1e9),
        );
      case BagSort.price:
        all.sort((a, b) => a.priceMinor.compareTo(b.priceMinor));
      case BagSort.rating:
        all.sort((a, b) => b.rating.compareTo(a.rating));
      case BagSort.pickupTime:
        all.sort((a, b) => a.pickupStartsAt.compareTo(b.pickupStartsAt));
      case BagSort.relevance:
        break;
    }

    return all;
  }

  @override
  Future<SurpriseBag> byId(String id) async {
    final bag = DummyData.bags.firstWhere(
      (item) => item.id == id,
      orElse: () => throw StateError('Paket bulunamadı: $id'),
    );
    return bag.copyWith(isFavorite: _favorites.contains(bag.id));
  }

  @override
  Future<bool> toggleFavorite(String bagId, {required bool isFavorite}) async {
    final bag = DummyData.bags.firstWhere((item) => item.id == bagId);
    if (isFavorite) {
      _favorites.add(bag.storeId);
      _favorites.add(bagId);
    } else {
      _favorites.remove(bag.storeId);
      _favorites.remove(bagId);
    }
    return isFavorite;
  }

  @override
  Future<List<SurpriseBag>> favorites() async =>
      DummyData.bags.where((bag) => _favorites.contains(bag.id)).toList();
}

class RemoteBagRepository implements BagRepository {
  RemoteBagRepository(this._client);
  final ApiClient _client;

  @override
  Future<List<SurpriseBag>> nearby({
    BagCategory category = BagCategory.all,
    BagSort sort = BagSort.relevance,
    double? latitude,
    double? longitude,
    String? query,
  }) async {
    final response = await _client.get(
      ApiEndpoints.nearbyBags,
      query: {
        'lat': ?latitude,
        'lng': ?longitude,
        'sort': sort.apiValue,
        // Yarıçap yalnızca konum varsa anlamlı; yoksa sunucu şehir
        // genelinde arar.
        if (latitude != null) 'radiusKm': 25,
        if (category != BagCategory.all) 'category': category.apiValue,
        if (query != null && query.isNotEmpty) 'q': query,
        'limit': 50,
      },
    );

    final data = response['data'];
    if (data is! List) return const [];

    return data
        .whereType<Map>()
        .map((item) => _parseBag(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<SurpriseBag> byId(String id) async {
    final response = await _client.get(ApiEndpoints.bag(id));
    return _parseBag(_asMap(response['data']));
  }

  @override
  Future<bool> toggleFavorite(String bagId, {required bool isFavorite}) async {
    if (isFavorite) {
      await _client.post(ApiEndpoints.favorite(bagId));
    } else {
      await _client.delete(ApiEndpoints.favorite(bagId));
    }
    return isFavorite;
  }

  @override
  Future<List<SurpriseBag>> favorites() async {
    final response = await _client.get(ApiEndpoints.favorites);
    final data = response['data'];
    if (data is! List) return const [];

    // Favoriler işletme bazlı döner; her işletmenin yayındaki paketleri
    // düzleştirilir.
    return data.whereType<Map>().expand((entry) {
      final bags = Map<String, dynamic>.from(entry)['bags'];
      if (bags is! List) return const <SurpriseBag>[];
      return bags.whereType<Map>().map(
        (bag) => _parseBag(Map<String, dynamic>.from(bag)),
      );
    }).toList();
  }
}

// ---------------------------------------------------------------------------
// Siparişler
// ---------------------------------------------------------------------------

abstract interface class OrderRepository {
  /// [idempotencyKey] kullanıcı eylemi başına bir kez üretilmeli; ağ
  /// tekrarında aynı anahtar ikinci sipariş oluşturmaz.
  Future<AppOrder> create(
    SurpriseBag bag,
    int quantity, {
    required String idempotencyKey,
  });
  Future<AppOrder> confirmPayment(String orderId);
  Future<PickupNonce> requestPickupNonce(String orderId);
  Future<AppOrder> confirmPickup(AppOrder order, String nonce);
  Future<AppOrder> cancel(AppOrder order, {String? reason});
  Future<List<AppOrder>> list();
  Future<void> rate(
    String orderId,
    int overall, {
    List<String> tags,
    String? comment,
  });
}

class DummyOrderRepository implements OrderRepository {
  final List<AppOrder> _orders = <AppOrder>[];

  @override
  Future<AppOrder> create(
    SurpriseBag bag,
    int quantity, {
    required String idempotencyKey,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 750));
    final order = AppOrder(
      id: 'ord_demo_${_orders.length + 1}',
      orderNo: 'YP-${(2048 + _orders.length)}',
      bag: bag,
      quantity: quantity,
      totalMinor: bag.priceMinor * quantity,
      status: OrderStatus.pickupPending,
      pickupStartsAt: bag.pickupStartsAt,
      pickupEndsAt: bag.pickupEndsAt,
      pickupCode: '123456',
    );
    _orders.insert(0, order);
    return order;
  }

  @override
  Future<AppOrder> confirmPayment(String orderId) async =>
      _orders.firstWhere((order) => order.id == orderId);

  @override
  Future<PickupNonce> requestPickupNonce(String orderId) async => PickupNonce(
    nonce: 'demo-nonce',
    expiresAt: DateTime.now().add(const Duration(minutes: 10)),
  );

  @override
  Future<AppOrder> confirmPickup(AppOrder order, String nonce) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    return order.copyWith(status: OrderStatus.collected);
  }

  @override
  Future<AppOrder> cancel(AppOrder order, {String? reason}) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    return order.copyWith(status: OrderStatus.cancelled);
  }

  @override
  Future<List<AppOrder>> list() async => List.unmodifiable(_orders);

  @override
  Future<void> rate(
    String orderId,
    int overall, {
    List<String> tags = const [],
    String? comment,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
  }
}

class RemoteOrderRepository implements OrderRepository {
  RemoteOrderRepository(this._client);
  final ApiClient _client;

  @override
  Future<AppOrder> create(
    SurpriseBag bag,
    int quantity, {
    required String idempotencyKey,
  }) async {
    final response = await _client.post(
      ApiEndpoints.orders,
      data: {'bagId': bag.id, 'quantity': quantity},
      idempotencyKey: idempotencyKey,
    );

    return _parseOrder(_asMap(response['data']), fallbackBag: bag);
  }

  /// 3D Secure sonrası ödemeyi tamamlar.
  ///
  /// Sunucu bu ucu idempotent uygular; kullanıcı ödeme ekranından döndükten
  /// sonra tekrar çağrılması sorun yaratmaz.
  @override
  Future<AppOrder> confirmPayment(String orderId) async {
    final response = await _client.post(
      '${ApiEndpoints.order(orderId)}/payment-callback',
      data: {'status': 'success'},
    );

    // Bu uç zarf dışında yanıt döner; güncel durumu ayrıca çekiyoruz.
    if (response.isNotEmpty) {
      final detail = await _client.get(ApiEndpoints.order(orderId));
      return _parseOrder(_asMap(detail['data']));
    }

    final detail = await _client.get(ApiEndpoints.order(orderId));
    return _parseOrder(_asMap(detail['data']));
  }

  @override
  Future<PickupNonce> requestPickupNonce(String orderId) async {
    final response = await _client.post(ApiEndpoints.pickupNonce(orderId));
    final data = _asMap(response['data']);

    return PickupNonce(
      nonce: data['nonce'] as String? ?? '',
      expiresAt:
          DateTime.tryParse(data['expires_at']?.toString() ?? '')?.toLocal() ??
          DateTime.now().add(const Duration(minutes: 10)),
    );
  }

  @override
  Future<AppOrder> confirmPickup(AppOrder order, String nonce) async {
    final response = await _client.post(
      ApiEndpoints.pickup(order.id),
      data: {'pickupNonce': nonce},
      // Teslim onayı için anahtar sipariş başına sabit: ağ tekrarında
      // ikinci kez işlenmesin.
      idempotencyKey: 'pickup_${order.id}',
    );

    return _parseOrder(_asMap(response['data']), fallbackBag: order.bag);
  }

  @override
  Future<AppOrder> cancel(AppOrder order, {String? reason}) async {
    final response = await _client.post(
      ApiEndpoints.cancelOrder(order.id),
      data: {'reason': reason ?? 'user_requested'},
      idempotencyKey: 'cancel_${order.id}',
    );

    return _parseOrder(_asMap(response['data']), fallbackBag: order.bag);
  }

  @override
  Future<List<AppOrder>> list() async {
    final response = await _client.get(ApiEndpoints.orders);
    final data = response['data'];
    if (data is! List) return const [];

    return data
        .whereType<Map>()
        .map((item) => _parseOrder(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<void> rate(
    String orderId,
    int overall, {
    List<String> tags = const [],
    String? comment,
  }) async {
    await _client.post(
      ApiEndpoints.rating(orderId),
      data: {
        'overall': overall,
        if (tags.isNotEmpty) 'tags': tags,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Ayrıştırma
// ---------------------------------------------------------------------------

/// Yanıt zarfının (`{data, meta}`) gövdesini nesne olarak açar.
Map<String, dynamic> _data(Map<String, dynamic> response) =>
    _asMap(response['data']);

/// Yanıt zarfının gövdesini liste olarak açar.
List<Map<String, dynamic>> _list(Map<String, dynamic> response) {
  final data = response['data'];
  if (data is! List) return const [];
  return data.whereType<Map>().map(Map<String, dynamic>.from).toList();
}

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

int _minor(Object? value) => ((value as num?) ?? 0).toInt();

AppUser _parseUser(Map<String, dynamic> json) => AppUser(
  id: json['id'] as String? ?? '',
  name: json['name'] as String? ?? 'YePaket kullanıcısı',
  email: json['email'] as String? ?? '',
  role: json['role'] as String? ?? 'CONSUMER',
  avatarUrl: json['avatar_url'] as String?,
);

SurpriseBag _parseBag(Map<String, dynamic> json) {
  final store = _asMap(json['store']);
  final rating = _asMap(json['rating']);
  final pickupWindow = _asMap(json['pickup_window']);
  final images = json['image_urls'];

  final categoryName = json['category'] as String? ?? 'market';
  final category = BagCategory.values.firstWhere(
    (item) => item.apiValue == categoryName,
    orElse: () => BagCategory.market,
  );

  final distanceMeters = json['distance_meters'] as num?;

  return SurpriseBag(
    id: json['id'] as String? ?? '',
    storeId: store['id'] as String? ?? '',
    store: store['name'] as String? ?? 'YePaket işletmesi',
    title: json['title'] as String? ?? 'Sürpriz paket',
    category: category,
    imageAsset: images is List && images.isNotEmpty
        ? images.first.toString()
        : 'assets/images/bag-market.jpg',
    // Konum verilmediyse mesafe bilinmiyor demektir; 0 göstermek
    // "hemen yanınızda" anlamına gelirdi.
    distanceKm: distanceMeters == null ? null : distanceMeters / 1000,
    pickupStartsAt:
        DateTime.tryParse(
          pickupWindow['starts_at']?.toString() ?? '',
        )?.toLocal() ??
        DateTime.now(),
    pickupEndsAt:
        DateTime.tryParse(
          pickupWindow['ends_at']?.toString() ?? '',
        )?.toLocal() ??
        DateTime.now().add(const Duration(hours: 1)),
    rating: ((rating['overall'] as num?) ?? 0).toDouble(),
    reviewCount: (rating['count'] as num?)?.toInt() ?? 0,
    // Kuruş hassasiyeti korunur; yuvarlama yalnızca gösterimde yapılır.
    originalPriceMinor: _minor(_asMap(json['original_value'])['amount_minor']),
    priceMinor: _minor(_asMap(json['sale_price'])['amount_minor']),
    availableQuantity: (json['available_quantity'] as num?)?.toInt() ?? 0,
    description:
        json['description'] as String? ?? 'Günlük ürünlerden sürpriz seçki.',
    address: store['address'] as String? ?? 'Adres işletmeden alınacak.',
    isFavorite: json['is_favorite'] as bool? ?? false,
  );
}

AppOrder _parseOrder(Map<String, dynamic> json, {SurpriseBag? fallbackBag}) {
  final bagJson = _asMap(json['bag']);
  final bag = bagJson.isNotEmpty ? _parseBag(bagJson) : fallbackBag;
  final pickupWindow = _asMap(json['pickup_window']);

  return AppOrder(
    id: json['id'] as String? ?? '',
    orderNo: json['order_no'] as String? ?? 'YP-—',
    bag: bag ?? DummyData.bags.first,
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    totalMinor: _minor(_asMap(json['total'])['amount_minor']),
    status: _parseStatus(json['status']),
    pickupStartsAt:
        DateTime.tryParse(
          pickupWindow['starts_at']?.toString() ?? '',
        )?.toLocal() ??
        DateTime.now(),
    pickupEndsAt:
        DateTime.tryParse(
          pickupWindow['ends_at']?.toString() ?? '',
        )?.toLocal() ??
        DateTime.now().add(const Duration(hours: 1)),
    pickupCode: json['pickup_code'] as String? ?? '',
    paymentRedirectUrl: _asMap(json['payment'])['redirect_url'] as String?,
    collectedAt: DateTime.tryParse(
      json['collected_at']?.toString() ?? '',
    )?.toLocal(),
  );
}

/// Sunucu durumları snake_case gelir: `pickup_pending` -> [OrderStatus.pickupPending].
OrderStatus _parseStatus(Object? value) {
  switch (value?.toString()) {
    case 'payment_pending':
      return OrderStatus.paymentPending;
    case 'paid':
      return OrderStatus.paid;
    case 'pickup_pending':
      return OrderStatus.pickupPending;
    case 'collected':
      return OrderStatus.collected;
    case 'cancelled':
      return OrderStatus.cancelled;
    case 'refunded':
      return OrderStatus.refunded;
    case 'no_show':
      return OrderStatus.noShow;
    default:
      return OrderStatus.pickupPending;
  }
}

// =============================================================================
// Hesap: bildirimler, etki, destek
// =============================================================================

abstract interface class AccountRepository {
  Future<UserImpact> impact();
  Future<List<AppNotification>> notifications();
  Future<int> unreadCount();
  Future<void> markNotificationRead(String id);
  Future<void> markAllNotificationsRead();
  Future<SupportTicket> createTicket({
    required String name,
    required String email,
    required String subject,
    required String message,
    String? category,
    String? orderId,
  });
  Future<List<SupportTicket>> tickets();
  Future<void> registerPushToken(String token);

  /// Yayına alınmamış bir özellik için haber listesine katılır.
  Future<int> joinWaitlist(String feature, String email, {String? city});

  /// Özelliğin toplam ilgi sayısı.
  Future<int> waitlistCount(String feature);

  Future<NotificationPreferences> notificationPreferences();
  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  );
}

class DummyAccountRepository implements AccountRepository {
  final _tickets = <SupportTicket>[];
  final _notifications = <AppNotification>[];

  @override
  Future<UserImpact> impact() async => UserImpact.empty;

  @override
  Future<List<AppNotification>> notifications() async =>
      List.unmodifiable(_notifications);

  @override
  Future<int> unreadCount() async =>
      _notifications.where((item) => !item.isRead).length;

  @override
  Future<void> markNotificationRead(String id) async {
    final index = _notifications.indexWhere((item) => item.id == id);
    if (index >= 0) {
      _notifications[index] = _notifications[index].copyWith(isRead: true);
    }
  }

  @override
  Future<void> markAllNotificationsRead() async {
    for (var i = 0; i < _notifications.length; i++) {
      _notifications[i] = _notifications[i].copyWith(isRead: true);
    }
  }

  @override
  Future<SupportTicket> createTicket({
    required String name,
    required String email,
    required String subject,
    required String message,
    String? category,
    String? orderId,
  }) async {
    final ticket = SupportTicket(
      id: 'ticket_${_tickets.length + 1}',
      ticketNo: 'YP-${1000 + _tickets.length}',
      subject: subject,
      status: 'open',
      createdAt: DateTime.now(),
    );
    _tickets.insert(0, ticket);
    return ticket;
  }

  @override
  Future<List<SupportTicket>> tickets() async => List.unmodifiable(_tickets);

  @override
  Future<void> registerPushToken(String token) async {}

  int _waitlist = 0;

  @override
  Future<int> joinWaitlist(
    String feature,
    String email, {
    String? city,
  }) async => ++_waitlist;

  @override
  Future<int> waitlistCount(String feature) async => _waitlist;

  NotificationPreferences _prefs = const NotificationPreferences();

  @override
  Future<NotificationPreferences> notificationPreferences() async => _prefs;

  @override
  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  ) async {
    _prefs = preferences;
    return _prefs;
  }
}

class RemoteAccountRepository implements AccountRepository {
  RemoteAccountRepository(this._client);
  final ApiClient _client;

  @override
  Future<UserImpact> impact() async {
    final response = await _client.get(ApiEndpoints.impact);
    return _impactFromJson(_data(response));
  }

  @override
  Future<List<AppNotification>> notifications() async {
    final response = await _client.get(
      ApiEndpoints.notifications,
      query: {'limit': 50},
    );
    return _list(response).map(_notificationFromJson).toList();
  }

  @override
  Future<int> unreadCount() async {
    final response = await _client.get(ApiEndpoints.unreadCount);
    final value = _data(response)['count'];
    return value is num ? value.toInt() : 0;
  }

  @override
  Future<void> markNotificationRead(String id) =>
      _client.patch(ApiEndpoints.markRead(id));

  @override
  Future<void> markAllNotificationsRead() =>
      _client.post('${ApiEndpoints.notifications}/read-all');

  @override
  Future<SupportTicket> createTicket({
    required String name,
    required String email,
    required String subject,
    required String message,
    String? category,
    String? orderId,
  }) async {
    final response = await _client.post(
      ApiEndpoints.supportTickets,
      data: {
        'name': name,
        'email': email,
        'subject': subject,
        'message': message,
        'category': ?category,
        'orderId': ?orderId,
      },
    );
    return _ticketFromJson(_data(response));
  }

  @override
  Future<List<SupportTicket>> tickets() async {
    final response = await _client.get(ApiEndpoints.supportTickets);
    return _list(response).map(_ticketFromJson).toList();
  }

  @override
  Future<void> registerPushToken(String token) async {
    await _client.post(
      ApiEndpoints.pushToken,
      data: {
        'token': token,
        'platform': ApiConfig.platform,
        'deviceId': await _client.deviceId(),
      },
    );
  }

  @override
  Future<int> joinWaitlist(String feature, String email, {String? city}) async {
    final response = await _client.post(
      ApiEndpoints.waitlist,
      data: {'feature': feature, 'email': email, 'city': ?city},
    );
    return (_data(response)['position'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<int> waitlistCount(String feature) async {
    final response = await _client.get(ApiEndpoints.waitlistCount(feature));
    return (_data(response)['total'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<NotificationPreferences> notificationPreferences() async {
    final response = await _client.get(ApiEndpoints.notificationPreferences);
    return NotificationPreferences.fromJson(_data(response));
  }

  @override
  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  ) async {
    final response = await _client.patch(
      ApiEndpoints.notificationPreferences,
      data: {
        'bagAvailable': preferences.bagAvailable,
        'orderUpdates': preferences.orderUpdates,
        'impactDigest': preferences.impactDigest,
        'campaigns': preferences.campaigns,
      },
    );
    return NotificationPreferences.fromJson(_data(response));
  }
}

UserImpact _impactFromJson(Map<String, dynamic> json) {
  final money = json['money_saved'];
  return UserImpact(
    savedBags: (json['saved_bags'] as num?)?.toInt() ?? 0,
    moneySavedMinor: money is Map
        ? (money['amount_minor'] as num?)?.toInt() ?? 0
        : 0,
    co2Kg: (json['co2e_kg'] as num?)?.toDouble() ?? 0,
    waterLiters: (json['water_liters'] as num?)?.toInt() ?? 0,
  );
}

AppNotification _notificationFromJson(Map<String, dynamic> json) =>
    AppNotification(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      type: json['type']?.toString() ?? 'system',
      isRead: json['read_at'] != null || json['is_read'] == true,
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '')?.toLocal() ??
          DateTime.now(),
    );

SupportTicket _ticketFromJson(Map<String, dynamic> json) => SupportTicket(
  id: json['id']?.toString() ?? '',
  ticketNo: json['ticket_no']?.toString() ?? '',
  subject: json['subject']?.toString() ?? '',
  status: json['status']?.toString() ?? 'open',
  createdAt:
      DateTime.tryParse(json['created_at']?.toString() ?? '')?.toLocal() ??
      DateTime.now(),
);
