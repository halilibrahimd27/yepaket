import '../../core/network/api_client.dart';
import '../../core/network/api_config.dart';
import '../dummy/dummy_data.dart';
import '../models/models.dart';

abstract interface class AuthRepository {
  Future<void> signInWithEmail(String email, String password);
  Future<void> signInWithProvider(String provider);
  Future<void> signOut();
}

class DummyAuthRepository implements AuthRepository {
  @override
  Future<void> signInWithEmail(String email, String password) =>
      Future<void>.delayed(const Duration(milliseconds: 650));

  @override
  Future<void> signInWithProvider(String provider) =>
      Future<void>.delayed(const Duration(milliseconds: 700));

  @override
  Future<void> signOut() =>
      Future<void>.delayed(const Duration(milliseconds: 250));
}

class RemoteAuthRepository implements AuthRepository {
  RemoteAuthRepository(this._client);
  final ApiClient _client;

  @override
  Future<void> signInWithEmail(String email, String password) async {
    final response = await _client.post(
      ApiEndpoints.login,
      data: {
        'email': email,
        'password': password,
        'device_id': 'replace_with_real_device_id',
      },
    );
    _storeAccessToken(response);
  }

  @override
  Future<void> signInWithProvider(String provider) async {
    final response = await _client.post(
      ApiEndpoints.oauth(provider),
      data: {
        'id_token': 'provider_id_token',
        'authorization_code': 'provider_authorization_code',
        'device_id': 'replace_with_real_device_id',
        'platform': 'mobile',
      },
    );
    _storeAccessToken(response);
  }

  @override
  Future<void> signOut() async {
    await _client.post('/auth/logout');
    _client.setAccessToken(null);
  }

  void _storeAccessToken(Map<String, dynamic> response) {
    final data = _asMap(response['data']);
    final token = data['access_token'] as String?;
    if (token != null) _client.setAccessToken(token);
  }
}

abstract interface class BagRepository {
  Future<List<SurpriseBag>> nearby({BagCategory category = BagCategory.all});
  Future<SurpriseBag> byId(String id);
}

class DummyBagRepository implements BagRepository {
  @override
  Future<List<SurpriseBag>> nearby({
    BagCategory category = BagCategory.all,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 180));
    if (category == BagCategory.all) return DummyData.bags;
    return DummyData.bags.where((bag) => bag.category == category).toList();
  }

  @override
  Future<SurpriseBag> byId(String id) async =>
      DummyData.bags.firstWhere((bag) => bag.id == id);
}

class RemoteBagRepository implements BagRepository {
  RemoteBagRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<SurpriseBag>> nearby({
    BagCategory category = BagCategory.all,
  }) async {
    final response = await _client.get(
      ApiEndpoints.nearbyBags,
      query: {
        'lat': 40.9877,
        'lng': 29.0277,
        'radius_km': 8,
        if (category != BagCategory.all) 'category': category.name,
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
}

abstract interface class OrderRepository {
  Future<AppOrder> create(SurpriseBag bag, int quantity);
  Future<AppOrder> confirmPickup(AppOrder order);
  Future<AppOrder> cancel(AppOrder order);
}

class DummyOrderRepository implements OrderRepository {
  @override
  Future<AppOrder> create(SurpriseBag bag, int quantity) async {
    await Future<void>.delayed(const Duration(milliseconds: 750));
    return AppOrder(
      id: 'ord_demo_01',
      orderNo: 'YP-2048',
      bag: bag,
      quantity: quantity,
      total: bag.price * quantity,
      status: OrderStatus.pickupPending,
      pickupLabel: bag.pickupLabel,
    );
  }

  @override
  Future<AppOrder> confirmPickup(AppOrder order) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    return order.copyWith(status: OrderStatus.collected);
  }

  @override
  Future<AppOrder> cancel(AppOrder order) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    return order.copyWith(status: OrderStatus.cancelled);
  }
}

class RemoteOrderRepository implements OrderRepository {
  RemoteOrderRepository(this._client);

  final ApiClient _client;

  @override
  Future<AppOrder> create(SurpriseBag bag, int quantity) async {
    final response = await _client.post(
      ApiEndpoints.orders,
      data: {
        'bag_id': bag.id,
        'quantity': quantity,
        'payment_method_id': 'pm_mobile_default',
      },
      idempotencyKey: 'mobile_${DateTime.now().microsecondsSinceEpoch}',
    );
    return _parseOrder(_asMap(response['data']), bag, quantity);
  }

  @override
  Future<AppOrder> confirmPickup(AppOrder order) async {
    final response = await _client.post(
      ApiEndpoints.pickup(order.id),
      data: {'pickup_nonce': 'replace_with_server_nonce'},
      idempotencyKey: 'pickup_${order.id}',
    );
    final data = _asMap(response['data']);
    return order.copyWith(
      status: _parseStatus(data['status'], OrderStatus.collected),
    );
  }

  @override
  Future<AppOrder> cancel(AppOrder order) async {
    final response = await _client.post(
      ApiEndpoints.cancelOrder(order.id),
      data: {'reason': 'user_requested'},
      idempotencyKey: 'cancel_${order.id}',
    );
    final data = _asMap(response['data']);
    return order.copyWith(
      status: _parseStatus(data['status'], OrderStatus.cancelled),
    );
  }
}

SurpriseBag _parseBag(Map<String, dynamic> json) {
  final store = _asMap(json['store']);
  final rating = _asMap(json['rating']);
  final originalValue = _asMap(json['original_value']);
  final salePrice = _asMap(json['sale_price']);
  final pickupWindow = _asMap(json['pickup_window']);
  final images = json['image_urls'];
  final categoryName = json['category'] as String? ?? 'market';
  final category = BagCategory.values.firstWhere(
    (item) => item.name == categoryName,
    orElse: () => BagCategory.market,
  );

  return SurpriseBag(
    id: json['id'] as String? ?? 'unknown',
    store: store['name'] as String? ?? 'YePaket işletmesi',
    title: json['title'] as String? ?? 'Sürpriz paket',
    category: category,
    imageAsset: images is List && images.isNotEmpty
        ? images.first.toString()
        : 'assets/images/bag-market.jpg',
    distanceKm: ((json['distance_meters'] as num?) ?? 0) / 1000,
    pickupLabel: _pickupLabel(pickupWindow),
    rating: ((rating['overall'] as num?) ?? 0).toDouble(),
    reviewCount: (rating['count'] as num?)?.toInt() ?? 0,
    originalPrice: _minorToMajor(originalValue['amount_minor']),
    price: _minorToMajor(salePrice['amount_minor']),
    availableQuantity: (json['available_quantity'] as num?)?.toInt() ?? 0,
    description:
        json['description'] as String? ?? 'Günlük ürünlerden sürpriz seçki.',
    address: store['address'] as String? ?? 'Adres işletmeden alınacak.',
  );
}

AppOrder _parseOrder(Map<String, dynamic> json, SurpriseBag bag, int quantity) {
  final total = _asMap(json['total']);
  return AppOrder(
    id: json['id'] as String? ?? 'unknown_order',
    orderNo: json['order_no'] as String? ?? 'YP-—',
    bag: bag,
    quantity: quantity,
    total: _minorToMajor(total['amount_minor']),
    status: _parseStatus(json['status'], OrderStatus.pickupPending),
    pickupLabel: _pickupLabel(_asMap(json['pickup_window'])),
  );
}

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

int _minorToMajor(Object? value) => (((value as num?) ?? 0) / 100).round();

String _pickupLabel(Map<String, dynamic> window) {
  DateTime? parse(Object? value) => DateTime.tryParse(value?.toString() ?? '');
  final start = parse(window['starts_at'])?.toLocal();
  final end = parse(window['ends_at'])?.toLocal();
  if (start == null || end == null) return 'Teslim saati açıklanacak';
  String time(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  return 'Bugün ${time(start)}–${time(end)}';
}

OrderStatus _parseStatus(Object? value, OrderStatus fallback) {
  final normalized = value?.toString().replaceAll(
    'pickup_pending',
    'pickupPending',
  );
  return OrderStatus.values.firstWhere(
    (status) => status.name == normalized,
    orElse: () => fallback,
  );
}
