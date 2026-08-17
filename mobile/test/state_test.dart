import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:yepaket/core/network/api_exception.dart';
import 'package:yepaket/data/models/models.dart';
import 'package:yepaket/data/repositories/repositories.dart';
import 'package:yepaket/data/state/app_state.dart';

/// Hata yollarını sınamak için: istenen çağrıda [ApiException] fırlatır.
class _FailingBagRepository implements BagRepository {
  _FailingBagRepository(this._error);
  final ApiException _error;

  @override
  Future<List<SurpriseBag>> nearby({
    BagCategory category = BagCategory.all,
    BagSort sort = BagSort.relevance,
    double? latitude,
    double? longitude,
    String? query,
  }) async => throw _error;

  @override
  Future<SurpriseBag> byId(String id) async => throw _error;

  @override
  Future<bool> toggleFavorite(String bagId, {required bool isFavorite}) async =>
      throw _error;

  @override
  Future<List<SurpriseBag>> favorites() async => throw _error;
}

/// Sipariş oluşturmayı sayan sahte depo — idempotency anahtarını kaydeder.
class _RecordingOrderRepository extends DummyOrderRepository {
  final keys = <String>[];

  @override
  Future<AppOrder> create(
    SurpriseBag bag,
    int quantity, {
    required String idempotencyKey,
  }) {
    keys.add(idempotencyKey);
    return super.create(bag, quantity, idempotencyKey: idempotencyKey);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('Katalog hataları', () {
    test('ağ hatası sessizce yutulmaz, kullanıcıya mesaj kalır', () async {
      final state = AppState(
        bagRepository: _FailingBagRepository(
          const ApiException(
            statusCode: 0,
            code: 'NETWORK_ERROR',
            message: 'Bağlantı kurulamadı.',
          ),
        ),
      );

      await state.refreshBags();

      // Boş liste + hata mesajı: kullanıcı neden boş gördüğünü bilmeli.
      expect(state.bags, isEmpty);
      expect(state.bagsError, isNotNull);
      expect(state.isLoadingBags, isFalse);
    });

    test('bilinmeyen paket kimliği çökme yerine null döner', () async {
      final state = AppState();
      await state.initialize();

      // Eskiden `firstWhere` kullanılıyordu ve derin bağlantıdan gelen
      // bilinmeyen kimlik uygulamayı çökertiyordu (K1).
      expect(state.bagById('olmayan-paket'), isNull);
    });
  });

  group('Sıralama ve filtreler', () {
    test('fiyata göre sıralama artan gider', () async {
      final state = AppState();
      await state.initialize();
      await state.selectSort(BagSort.price);

      final prices = state.filteredBags.map((bag) => bag.priceMinor).toList();
      expect(prices, equals([...prices]..sort()));
    });

    test('filtreleri temizlemek varsayılana döner', () async {
      final state = AppState();
      await state.initialize();

      await state.selectCategory(BagCategory.cafe);
      await state.selectSort(BagSort.price);
      await state.search('kahve');

      await state.clearFilters();

      expect(state.selectedCategory, BagCategory.all);
      expect(state.selectedSort, BagSort.relevance);
      expect(state.searchQuery, isEmpty);
    });
  });

  group('Sipariş', () {
    test('idempotency anahtarı çağırandan gelir ve aynen iletilir', () async {
      final orders = _RecordingOrderRepository();
      final state = AppState(orderRepository: orders);
      await state.initialize();

      final bag = state.filteredBags.first;
      const key = 'order_test_key';

      await state.createOrder(bag, 1, idempotencyKey: key);
      await state.createOrder(bag, 1, idempotencyKey: key);

      // Aynı anahtar iki kez gitmeli: tekrar denemede sunucu ikinci siparişi
      // oluşturmaz. Anahtarı istemci her seferinde yenilerse koruma çalışmaz.
      expect(orders.keys, equals([key, key]));
    });

    test('sipariş oluşturunca listeye eklenir', () async {
      final state = AppState();
      await state.initialize();

      final bag = state.filteredBags.first;
      final result = await state.createOrder(bag, 2, idempotencyKey: 'k1');

      expect(result, isA<Success<AppOrder>>());
      expect(state.orders, hasLength(1));
      expect(state.orders.first.quantity, 2);
      expect(state.orderById(state.orders.first.id), isNotNull);
    });
  });

  group('Etki hesabı', () {
    test('yalnızca teslim alınmış siparişler sayılır', () async {
      final state = AppState();
      await state.initialize();

      final bag = state.filteredBags.first;
      await state.createOrder(bag, 1, idempotencyKey: 'k2');

      // Henüz teslim alınmadı.
      expect(state.impact.savedBags, 0);

      final order = state.orders.first;
      final nonce = await state.requestPickupNonce(order.id);
      expect(nonce, isA<Success<PickupNonce>>());

      await state.completePickup(
        order,
        (nonce as Success<PickupNonce>).value.nonce,
      );

      expect(state.impact.savedBags, 1);
      expect(state.impact.moneySavedMinor, greaterThan(0));
    });

    test('CO₂ katsayısı sunucudaki ile aynı (paket başına 2,7 kg)', () {
      final order = _fakeOrder;
      expect(order.impact.co2Kg, closeTo(2.7 * order.quantity, 0.01));
      expect(order.impact.waterLiters, 810 * order.quantity);
    });
  });

  group('Kurtarıcı seviyesi', () {
    test('sıfır pakette ilerleme sıfırdır', () {
      const impact = UserImpact.empty;
      // Eskiden çubuk sabit %72 doluydu ve sıfır paketle bile dolu
      // görünüyordu (O1).
      expect(impact.level, RescuerLevel.yeni);
      expect(impact.levelProgress, 0);
      expect(impact.bagsToNextLevel, 5);
    });

    test('eşiğe ulaşınca seviye atlanır', () {
      const impact = UserImpact(
        savedBags: 5,
        moneySavedMinor: 0,
        co2Kg: 0,
        waterLiters: 0,
      );
      expect(impact.level, RescuerLevel.yesil);
      expect(impact.levelProgress, 0);
      expect(impact.bagsToNextLevel, 10);
    });

    test('ara değerde ilerleme oransal', () {
      const impact = UserImpact(
        savedBags: 10,
        moneySavedMinor: 0,
        co2Kg: 0,
        waterLiters: 0,
      );
      // 5 -> 15 aralığının yarısı.
      expect(impact.levelProgress, closeTo(0.5, 0.01));
    });

    test('en üst seviyede ilerleme tamdır ve sonraki yoktur', () {
      const impact = UserImpact(
        savedBags: 250,
        moneySavedMinor: 0,
        co2Kg: 0,
        waterLiters: 0,
      );
      expect(impact.level, RescuerLevel.efsane);
      expect(impact.level.next, isNull);
      expect(impact.levelProgress, 1);
      expect(impact.bagsToNextLevel, 0);
    });
  });

  group('Biçimlendirme', () {
    test('para Türkçe biçimde ve kuruş doğru gösterilir', () {
      // Kuruşu doğrudan bölmek "139.0 ₺" gibi bir çıktı veriyordu (O2).
      expect(Formats.money(13900), contains('139'));
      expect(Formats.money(13950), contains('139,50'));
    });

    test('göreli zaman Türkçe', () {
      final now = DateTime.now();
      expect(Formats.relative(now), 'az önce');
      expect(
        Formats.relative(now.subtract(const Duration(minutes: 12))),
        '12 dk önce',
      );
      expect(
        Formats.relative(now.subtract(const Duration(days: 1, hours: 2))),
        'dün',
      );
    });
  });
}

/// Etki katsayılarını sunucudan bağımsız doğrulamak için sabit sipariş.
final _fakeOrder = AppOrder(
  id: 'ord_test',
  orderNo: 'YP-000001',
  bag: SurpriseBag(
    id: 'bag_test',
    storeId: 'store_test',
    store: 'Test İşletme',
    title: 'Test Paketi',
    category: BagCategory.bakery,
    imageAsset: 'assets/images/bag-bakery.jpg',
    distanceKm: 1.2,
    pickupStartsAt: DateTime.now(),
    pickupEndsAt: DateTime.now().add(const Duration(minutes: 30)),
    rating: 4.5,
    reviewCount: 10,
    originalPriceMinor: 40000,
    priceMinor: 13900,
    availableQuantity: 3,
    description: 'Test',
    address: 'Test adres',
  ),
  quantity: 2,
  totalMinor: 27800,
  status: OrderStatus.collected,
  pickupStartsAt: DateTime.now(),
  pickupEndsAt: DateTime.now().add(const Duration(minutes: 30)),
  pickupCode: '123456',
);
