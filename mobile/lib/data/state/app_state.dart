import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/location/location_service.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/realtime_client.dart';
import '../../core/notifications/push_service.dart';
import '../models/models.dart';
import '../repositories/repositories.dart';

/// Uzun süren işlemlerin sonucunu taşıyan basit tip.
///
/// İstisna fırlatmak yerine sonuç döndürmek, çağıran ekranın hatayı
/// göstermeyi unutmasını zorlaştırır.
sealed class Result<T> {
  const Result();
}

class Success<T> extends Result<T> {
  const Success(this.value);
  final T value;
}

class Failure<T> extends Result<T> {
  const Failure(this.message, {this.code});
  final String message;
  final String? code;
}

class AppState extends ChangeNotifier {
  AppState({
    AuthRepository? authRepository,
    BagRepository? bagRepository,
    OrderRepository? orderRepository,
    AccountRepository? accountRepository,
    this.realtime,
    this.push,
    LocationService? locationService,
  }) : locationService = locationService ?? LocationService(),
       authRepository = authRepository ?? DummyAuthRepository(),
       bagRepository = bagRepository ?? DummyBagRepository(),
       orderRepository = orderRepository ?? DummyOrderRepository(),
       accountRepository = accountRepository ?? DummyAccountRepository();

  final AuthRepository authRepository;
  final BagRepository bagRepository;
  final OrderRepository orderRepository;
  final AccountRepository accountRepository;

  /// Gerçek zamanlı olay kanalı. Dummy modda `null`.
  final RealtimeClient? realtime;

  /// Push bildirimi altyapısı. Firebase yapılandırması yoksa devre dışı kalır.
  final PushService? push;

  /// Cihaz konumu. İzin verilmezse `null` kalır ve sunucu şehir geneli
  /// sonuç döndürür.
  final LocationService locationService;

  UserLocation? location;
  LocationOutcome? locationOutcome;

  /// Konum çubuğunda gösterilecek metin.
  String get locationLabel {
    final current = location;
    if (current?.label != null) return current!.label!;
    if (current != null) return 'Yakınındakiler';

    return switch (locationOutcome) {
      LocationOutcome.deniedForever => 'Konum izni kapalı',
      LocationOutcome.serviceDisabled => 'Konum servisi kapalı',
      LocationOutcome.denied => 'Konum izni verilmedi',
      _ => 'Tüm işletmeler',
    };
  }

  bool get hasLocation => location != null;

  StreamSubscription<RealtimeEvent>? _realtimeSubscription;
  StreamSubscription<String>? _pushTokenSubscription;
  StreamSubscription<Object?>? _pushMessageSubscription;

  AppUser? user;
  bool onboardingSeen = false;
  bool isLoadingBags = false;
  String? bagsError;

  BagCategory selectedCategory = BagCategory.all;
  BagSort selectedSort = BagSort.relevance;
  String searchQuery = '';

  List<SurpriseBag> bags = <SurpriseBag>[];
  List<SurpriseBag> favoriteBags = <SurpriseBag>[];
  List<AppOrder> orders = <AppOrder>[];
  List<AppNotification> notifications = <AppNotification>[];
  List<SupportTicket> supportTickets = <SupportTicket>[];

  bool isLoadingNotifications = false;
  String? notificationsError;

  NotificationPreferences notificationPreferences =
      const NotificationPreferences();

  bool get isAuthenticated => user != null;

  AppOrder? get activeOrder {
    for (final order in orders) {
      if (order.status.isActive) return order;
    }
    return null;
  }

  List<AppOrder> get pastOrders =>
      orders.where((order) => order.status.isFinished).toList();

  /// Siparişi kimliğine göre bulur; bulunamazsa `null`.
  ///
  /// Teslim sonrası ekranlar `activeOrder` kullanamaz: sipariş teslim
  /// alındığında artık aktif değildir.
  AppOrder? orderById(String id) {
    for (final order in orders) {
      if (order.id == id) return order;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Açılış
  // ---------------------------------------------------------------------------

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    onboardingSeen = prefs.getBool('onboarding_seen') ?? false;

    // Son bilinen konum diskten okunur: GPS ilk sabitlenmesi birkaç saniye
    // sürer ve o süre boyunca liste konumsuz gelirdi.
    location = await locationService.restore();

    if (await authRepository.hasSession) {
      try {
        user = await authRepository.currentUser();
      } on ApiException {
        // Oturum geçersizse kullanıcı girişe yönlendirilecek.
        user = null;
      }
    }

    await refreshBags();
    await refreshCommunityImpact();

    if (isAuthenticated) {
      await Future.wait([
        refreshOrders(),
        refreshFavorites(),
        refreshImpact(),
        refreshNotificationPreferences(),
        refreshUnreadCount(),
      ]);
      await _startRealtime();
      // Oturumu zaten açık kullanıcı için de gerekli: jeton yalnızca giriş
      // anında kaydedilseydi, uygulamayı yeniden kuran veya jetonu yenilenen
      // kullanıcıya bildirim gitmezdi.
      await _registerPushToken();
    }
  }

  // ---------------------------------------------------------------------------
  // Konum
  // ---------------------------------------------------------------------------

  /// Konumu ister ve listeyi yeniler.
  ///
  /// [askIfDenied] false olduğunda sistem izin penceresi gösterilmez; açılışta
  /// kullanıcıyı karşılamadan izin sormamak için kullanılır.
  Future<LocationOutcome> requestLocation({bool askIfDenied = true}) async {
    final (outcome, value) = await locationService.current(
      askIfDenied: askIfDenied,
    );

    locationOutcome = outcome;
    location = value;
    notifyListeners();

    if (value != null) await refreshBags();
    return outcome;
  }

  Future<void> openLocationSettings() => locationService.openSettings();

  // ---------------------------------------------------------------------------
  // Gerçek zamanlı
  // ---------------------------------------------------------------------------

  /// Olay kanalını açar ve favori işletmelere abone olur.
  ///
  /// Bağlantı kurulamazsa sessizce geçilir: canlı güncelleme olmadan da
  /// uygulama çalışır, kullanıcıya hata göstermenin bir faydası olmaz.
  Future<void> _startRealtime() async {
    final client = realtime;
    if (client == null) return;

    await client.connect();

    await _realtimeSubscription?.cancel();
    _realtimeSubscription = client.events.listen(_onRealtimeEvent);

    _syncStoreSubscriptions();
  }

  Future<void> _stopRealtime() async {
    await _realtimeSubscription?.cancel();
    _realtimeSubscription = null;
    await _pushTokenSubscription?.cancel();
    _pushTokenSubscription = null;
    await _pushMessageSubscription?.cancel();
    _pushMessageSubscription = null;
    await realtime?.disconnect();
  }

  /// Favori işletme listesi değiştiğinde abonelikleri günceller.
  void _syncStoreSubscriptions() {
    final client = realtime;
    if (client == null) return;

    final storeIds = <String>{
      for (final bag in favoriteBags) bag.storeId,
    }.toList();

    client.subscribeStores(storeIds);
  }

  // ---------------------------------------------------------------------------
  // Push bildirimi
  // ---------------------------------------------------------------------------

  /// Cihazın push jetonunu sunucuya kaydeder.
  ///
  /// Giriş sonrasında çağrılır: jeton kullanıcıya bağlanır ve o kullanıcıya
  /// bildirim gönderilebilir. Bu çağrı olmadan sunucu kimin hangi cihazda
  /// olduğunu bilemez ve tüm push altyapısı boşa çalışır.
  Future<void> _registerPushToken() async {
    final service = push;
    if (service == null) return;

    final ready = service.isAvailable || await service.initialize();
    if (!ready) return;

    final token = await service.token();
    if (token != null) {
      await _sendPushToken(token);
    }

    // Jeton yenilendiğinde sessizce bildirim kesilmesin.
    await _pushTokenSubscription?.cancel();
    _pushTokenSubscription = service.onTokenRefresh.listen(_sendPushToken);

    // Uygulama açıkken gelen bildirim listeye düşsün: aksi hâlde kullanıcı
    // bildirimler ekranını açana kadar yeni bildirimi hiç görmezdi.
    await _pushMessageSubscription?.cancel();
    _pushMessageSubscription = service.onMessage.listen((_) {
      refreshNotifications();
    });
  }

  Future<void> _sendPushToken(String token) async {
    try {
      await accountRepository.registerPushToken(token);
    } on ApiException {
      // Bildirim ikincil bir yetenek; kaydedilemezse ana akış etkilenmez.
    }
  }

  void _onRealtimeEvent(RealtimeEvent event) {
    switch (event.type) {
      case 'bag.stock.updated':
        _applyStockUpdate(event);

      case 'bag.available':
        // Favori işletme yeni paket yayınladı; liste tazelenir.
        refreshBags();

      case 'order.status.updated':
        // Sipariş durumu sunucuda değişti (ödeme onaylandı, iptal edildi).
        refreshOrders();
    }
  }

  /// Stok değişimini yerel listeye uygular.
  ///
  /// Tüm listeyi yeniden çekmek yerine tek paketi güncellemek, kullanıcı
  /// listeye bakarken kartların yerinin değişmesini önler.
  void _applyStockUpdate(RealtimeEvent event) {
    final bagId = event.bagId;
    final quantity = event.availableQuantity;
    if (bagId == null || quantity == null) return;

    var changed = false;

    List<SurpriseBag> apply(List<SurpriseBag> list) => list.map((bag) {
      if (bag.id != bagId || bag.availableQuantity == quantity) return bag;
      changed = true;
      return bag.copyWith(availableQuantity: quantity);
    }).toList();

    bags = apply(bags);
    favoriteBags = apply(favoriteBags);

    if (changed) notifyListeners();
  }

  Future<void> completeOnboarding() async {
    onboardingSeen = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_seen', true);
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Kimlik
  // ---------------------------------------------------------------------------

  Future<Result<AppUser>> signInWithEmail(String email, String password) async {
    return _guard(() async {
      user = await authRepository.signInWithEmail(email.trim(), password);
      await _afterSignIn();
      return user!;
    });
  }

  /// Yeni hesap oluşturur ve oturumu açar.
  Future<Result<AppUser>> register({
    required String name,
    required String email,
    required String password,
  }) async {
    return _guard(() async {
      user = await authRepository.register(
        name: name.trim(),
        email: email.trim(),
        password: password,
      );
      await _afterSignIn();
      return user!;
    });
  }

  /// Şifre sıfırlama bağlantısı ister.
  Future<Result<void>> requestPasswordReset(String email) =>
      _guard(() => authRepository.requestPasswordReset(email.trim()));

  /// E-postadaki jetonla yeni şifreyi kaydeder.
  Future<Result<void>> confirmPasswordReset(String token, String newPassword) =>
      _guard(() => authRepository.confirmPasswordReset(token, newPassword));

  Future<Result<AppUser>> signInWithProvider(
    String provider,
    String idToken,
  ) async {
    return _guard(() async {
      user = await authRepository.signInWithProvider(
        provider,
        idToken: idToken,
      );
      await refreshBags();
      await Future.wait([refreshOrders(), refreshFavorites(), refreshImpact()]);
      return user!;
    });
  }

  /// Giriş sonrası ortak hazırlık.
  ///
  /// Üç giriş yolunda (e-posta, sosyal, kayıt) aynı adımlar gerekiyor;
  /// tekrarlamak birinin unutulmasına yol açardı.
  Future<void> _afterSignIn() async {
    await refreshBags();
    await Future.wait([
      refreshOrders(),
      refreshFavorites(),
      refreshImpact(),
      refreshNotificationPreferences(),
    ]);
    await _startRealtime();
    await _registerPushToken();
  }

  /// Profil bilgilerini günceller.
  Future<Result<AppUser>> updateProfile({String? name, String? phone}) async {
    return _guard(() async {
      user = await authRepository.updateProfile(name: name, phone: phone);
      notifyListeners();
      return user!;
    });
  }

  /// Oturum içi şifre değişimi.
  ///
  /// Şifre sıfırlamadan farkı: mevcut şifreyi bilmek gerekir ve kullanıcı
  /// bu cihazda oturumda kalır. Diğer cihazlar çıkış yapar.
  Future<Result<void>> changePassword(
    String currentPassword,
    String newPassword,
  ) =>
      _guard(() => authRepository.changePassword(currentPassword, newPassword));

  /// Açık oturumları listeler.
  Future<Result<List<UserSession>>> sessions() =>
      _guard(() => authRepository.sessions());

  /// Belirli bir cihazın oturumunu kapatır.
  Future<Result<void>> revokeSession(String sessionId) =>
      _guard(() => authRepository.revokeSession(sessionId));

  /// Tüm cihazlardan çıkış yapar.
  Future<Result<void>> logoutEverywhere() async {
    final result = await _guard(() => authRepository.logoutEverywhere());
    if (result is Success) await _clearSession();
    return result;
  }

  /// Hesabı kapatır (KVKK). Geri alınamaz.
  Future<Result<void>> deleteAccount() async {
    final result = await _guard(() => authRepository.deleteAccount());
    if (result is Success) await _clearSession();
    return result;
  }

  Future<void> _clearSession() async {
    await _stopRealtime();
    user = null;
    orders = <AppOrder>[];
    favoriteBags = <SurpriseBag>[];
    notifications = <AppNotification>[];
    supportTickets = <SupportTicket>[];
    _serverImpact = null;
    notifyListeners();
  }

  Future<void> signOut() async {
    await _stopRealtime();
    await authRepository.signOut();
    user = null;
    orders = <AppOrder>[];
    favoriteBags = <SurpriseBag>[];
    notifications = <AppNotification>[];
    supportTickets = <SupportTicket>[];
    _serverImpact = null;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Katalog
  // ---------------------------------------------------------------------------

  Future<void> refreshBags() async {
    isLoadingBags = true;
    bagsError = null;
    notifyListeners();

    try {
      bags = await bagRepository.nearby(
        category: selectedCategory,
        sort: selectedSort,
        // Konum verilmezse sunucu mesafe hesaplayamaz ve "en yakın"
        // sıralaması sessizce başka bir ölçüte düşer.
        latitude: location?.latitude,
        longitude: location?.longitude,
        query: searchQuery.isEmpty ? null : searchQuery,
      );

      // Konum çubuğundaki ad, en yakın işletmenin ilçesinden türetilir:
      // ayrı bir ters coğrafi kodlama servisi (ve ek maliyet) gerekmez.
      if (location != null && bags.isNotEmpty) {
        final district = bags.first.district;
        if (district != null && district != location!.label) {
          location = location!.withLabel(district);
          await locationService.setLabel(district);
        }
      }
    } on ApiException catch (error) {
      // Hata sessizce yutulmaz: kullanıcı neden boş liste gördüğünü bilmeli.
      bagsError = error.userMessage;
      bags = <SurpriseBag>[];
    } finally {
      isLoadingBags = false;
      notifyListeners();
    }
  }

  Future<void> selectCategory(BagCategory category) async {
    selectedCategory = category;
    notifyListeners();
    await refreshBags();
  }

  Future<void> selectSort(BagSort sort) async {
    if (sort == selectedSort) return;
    selectedSort = sort;
    notifyListeners();
    await refreshBags();
  }

  /// Tüm filtreleri sıfırlar.
  Future<void> clearFilters() async {
    selectedCategory = BagCategory.all;
    selectedSort = BagSort.relevance;
    searchQuery = '';
    notifyListeners();
    await refreshBags();
  }

  Future<void> search(String query) async {
    searchQuery = query;
    await refreshBags();
  }

  /// Filtre sunucuda uygulanır; bu getter yalnızca yerel görünüm içindir.
  List<SurpriseBag> get filteredBags => bags;

  /// Paketi kimliğine göre bulur; bulunamazsa `null` döner.
  ///
  /// Eskiden `firstWhere` kullanılıyordu ve bilinmeyen kimlikte uygulama
  /// çöküyordu (derin bağlantı, eskimiş liste, uzak moda geçiş).
  SurpriseBag? bagById(String id) {
    for (final bag in bags) {
      if (bag.id == id) return bag;
    }
    for (final bag in favoriteBags) {
      if (bag.id == id) return bag;
    }
    for (final order in orders) {
      if (order.bag.id == id) return order.bag;
    }
    return null;
  }

  /// Listede yoksa sunucudan çeker.
  Future<Result<SurpriseBag>> loadBag(String id) async {
    final cached = bagById(id);
    if (cached != null) return Success(cached);
    return _guard(() => bagRepository.byId(id));
  }

  Future<void> refreshFavorites() async {
    try {
      favoriteBags = await bagRepository.favorites();
      // Abonelikler favori listesini izler: yeni favori eklendiğinde o
      // işletmenin paket yayınlarını canlı almaya başlarız.
      _syncStoreSubscriptions();
    } on ApiException {
      // Favoriler ikincil veri; hatası ana akışı bozmamalı.
    }
    notifyListeners();
  }

  Future<Result<bool>> toggleFavorite(String bagId) async {
    final bag = bagById(bagId);
    final next = !(bag?.isFavorite ?? false);

    // İyimser güncelleme: dokunuş anında geri bildirim verilir, hata
    // durumunda geri alınır.
    _applyFavorite(bagId, next);

    try {
      await bagRepository.toggleFavorite(bagId, isFavorite: next);
      await refreshFavorites();
      return Success(next);
    } on ApiException catch (error) {
      _applyFavorite(bagId, !next);
      return Failure(error.userMessage, code: error.code);
    }
  }

  void _applyFavorite(String bagId, bool value) {
    final storeId = bagById(bagId)?.storeId;

    bags = bags
        .map(
          (bag) => bag.storeId == storeId || bag.id == bagId
              ? bag.copyWith(isFavorite: value)
              : bag,
        )
        .toList();

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Siparişler
  // ---------------------------------------------------------------------------

  Future<void> refreshOrders() async {
    try {
      orders = await orderRepository.list();
    } on ApiException {
      // Sipariş listesi çekilemezse mevcut liste korunur.
    }
    notifyListeners();
  }

  /// Sipariş oluşturur.
  ///
  /// [idempotencyKey] çağıran tarafından **kullanıcı eylemi başına bir kez**
  /// üretilmeli ve tekrar denemelerde aynı kalmalıdır; aksi hâlde ağ
  /// tekrarında ikinci sipariş oluşur.
  Future<Result<AppOrder>> createOrder(
    SurpriseBag bag,
    int quantity, {
    required String idempotencyKey,
  }) async {
    return _guard(() async {
      final order = await orderRepository.create(
        bag,
        quantity,
        idempotencyKey: idempotencyKey,
      );
      orders = [order, ...orders.where((item) => item.id != order.id)];
      notifyListeners();
      return order;
    });
  }

  /// Siparişin sunucudaki güncel durumunu okur.
  ///
  /// `confirmPayment`ten farkı: yan etkisi yok. Ödeme sağlayıcısı henüz
  /// dönmemişse `confirmPayment` siparişi BAŞARISIZ işaretleyip rezervasyonu
  /// serbest bırakır — kullanıcı hâlâ kart bilgisini giriyor olabilir.
  Future<Result<AppOrder>> refreshOrder(String orderId) async {
    return _guard(() async {
      final order = await orderRepository.byId(orderId);
      _replaceOrder(order);
      return order;
    });
  }

  Future<Result<AppOrder>> confirmPayment(String orderId) async {
    return _guard(() async {
      final order = await orderRepository.confirmPayment(orderId);
      _replaceOrder(order);
      return order;
    });
  }

  Future<Result<PickupNonce>> requestPickupNonce(String orderId) =>
      _guard(() => orderRepository.requestPickupNonce(orderId));

  /// Arkadaşa teslim bağlantısı üretir.
  Future<Result<SharedPickup>> sharePickup(String orderId) =>
      _guard(() => orderRepository.sharePickup(orderId));

  Future<Result<AppOrder>> completePickup(AppOrder order, String nonce) async {
    return _guard(() async {
      final updated = await orderRepository.confirmPickup(order, nonce);
      _replaceOrder(updated);
      return updated;
    });
  }

  Future<Result<AppOrder>> cancelOrder(AppOrder order, {String? reason}) async {
    return _guard(() async {
      final updated = await orderRepository.cancel(order, reason: reason);
      _replaceOrder(updated);
      await refreshBags();
      return updated;
    });
  }

  Future<Result<void>> rateOrder(
    String orderId,
    int overall, {
    List<String> tags = const [],
    String? comment,
  }) => _guard(
    () => orderRepository.rate(orderId, overall, tags: tags, comment: comment),
  );

  void _replaceOrder(AppOrder order) {
    orders = orders.map((item) => item.id == order.id ? order : item).toList();
    if (!orders.any((item) => item.id == order.id)) {
      orders = [order, ...orders];
    }
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Etki
  // ---------------------------------------------------------------------------

  UserImpact? _serverImpact;

  /// Topluluk toplam etkisi — tanıtım kartında gösterilir.
  UserImpact? communityImpact;

  /// Sunucudan gelen etki özeti; yoksa yerel siparişlerden hesaplanır.
  ///
  /// Sunucu tüm geçmişi bilir, istemci yalnızca çektiği sayfayı; bu yüzden
  /// sunucu değeri her zaman önceliklidir.
  Future<void> refreshImpact() async {
    try {
      _serverImpact = await accountRepository.impact();
    } on ApiException {
      // Etki ikincil veri; hatası ana akışı bozmamalı.
    }
    notifyListeners();
  }

  /// Topluluk etkisini çeker.
  ///
  /// Giriş gerektirmez: keşif ekranındaki kart giriş yapmamış kullanıcıya da
  /// gösteriliyor. Eskiden bu kartta sabit "1.204 kg" yazıyordu.
  Future<void> refreshCommunityImpact() async {
    try {
      communityImpact = await accountRepository.communityImpact();
    } on ApiException {
      // Kart veri gelmezse gizlenir.
    }
    notifyListeners();
  }

  UserImpact get impact {
    final fromServer = _serverImpact;
    if (fromServer != null) return fromServer;

    final collected = orders.where(
      (order) => order.status == OrderStatus.collected,
    );

    final savedBags = collected.fold(0, (sum, order) => sum + order.quantity);
    final savedMinor = collected.fold(
      0,
      (sum, order) =>
          sum +
          (order.bag.originalPriceMinor * order.quantity - order.totalMinor),
    );

    // Katsayılar tahmindir; sunucudaki hesapla aynı olmalı ki iki ekran
    // farklı rakam göstermesin.
    return UserImpact(
      savedBags: savedBags,
      moneySavedMinor: savedMinor,
      co2Kg: double.parse((savedBags * 2.7).toStringAsFixed(1)),
      waterLiters: savedBags * 810,
    );
  }

  // ---------------------------------------------------------------------------
  // Bildirimler
  // ---------------------------------------------------------------------------

  /// Rozet için okunmamış sayısı.
  ///
  /// Liste çekildiyse ondan sayılır (anında güncellenir); çekilmediyse
  /// sunucudan alınan sayı kullanılır.
  int get unreadNotificationCount => notifications.isNotEmpty
      ? notifications.where((item) => !item.isRead).length
      : (_serverUnreadCount ?? 0);

  /// Okunmamış bildirim sayısını sunucudan alır.
  ///
  /// Tüm listeyi çekmeden yalnızca sayıyı sormak, rozet için tasarlanmış
  /// hafif bir uç. Eskiden hiç çağrılmıyordu ve rozet hiç görünmüyordu.
  Future<void> refreshUnreadCount() async {
    if (!isAuthenticated) return;
    try {
      _serverUnreadCount = await accountRepository.unreadCount();
      notifyListeners();
    } on ApiException {
      // Rozet ikincil; hata gösterilmez.
    }
  }

  int? _serverUnreadCount;

  Future<void> refreshNotifications() async {
    isLoadingNotifications = true;
    notificationsError = null;
    notifyListeners();

    try {
      notifications = await accountRepository.notifications();
    } on ApiException catch (error) {
      notificationsError = error.userMessage;
    } finally {
      isLoadingNotifications = false;
      notifyListeners();
    }
  }

  Future<void> markNotificationRead(String id) async {
    // İyimser: dokunuş anında okundu görünür, hata olursa geri alınır.
    final previous = notifications;
    notifications = notifications
        .map((item) => item.id == id ? item.copyWith(isRead: true) : item)
        .toList();
    notifyListeners();

    try {
      await accountRepository.markNotificationRead(id);
    } on ApiException {
      notifications = previous;
      notifyListeners();
    }
  }

  Future<void> markAllNotificationsRead() async {
    final previous = notifications;
    notifications = notifications
        .map((item) => item.copyWith(isRead: true))
        .toList();
    notifyListeners();

    try {
      await accountRepository.markAllNotificationsRead();
    } on ApiException {
      notifications = previous;
      notifyListeners();
    }
  }

  Future<void> refreshNotificationPreferences() async {
    if (!isAuthenticated) return;
    try {
      notificationPreferences = await accountRepository
          .notificationPreferences();
    } on ApiException {
      // Tercihler okunamazsa varsayılanlar (hepsi açık) gösterilir.
    }
    notifyListeners();
  }

  /// Bildirim tercihini günceller.
  ///
  /// İyimser güncelleme: anahtar anında hareket eder, sunucu reddederse
  /// eski hâline döner.
  Future<Result<void>> updateNotificationPreferences(
    NotificationPreferences next,
  ) async {
    final previous = notificationPreferences;
    notificationPreferences = next;
    notifyListeners();

    try {
      notificationPreferences = await accountRepository
          .updateNotificationPreferences(next);
      notifyListeners();
      return const Success(null);
    } on ApiException catch (error) {
      notificationPreferences = previous;
      notifyListeners();
      return Failure(error.userMessage, code: error.code);
    }
  }

  // ---------------------------------------------------------------------------
  // Destek
  // ---------------------------------------------------------------------------

  Future<Result<SupportTicket>> createSupportTicket({
    required String name,
    required String email,
    required String subject,
    required String message,
    String? category,
    String? orderId,
  }) async {
    return _guard(() async {
      final ticket = await accountRepository.createTicket(
        name: name,
        email: email,
        subject: subject,
        message: message,
        category: category,
        orderId: orderId,
      );
      supportTickets = [ticket, ...supportTickets];
      notifyListeners();
      return ticket;
    });
  }

  Future<void> refreshSupportTickets() async {
    if (!isAuthenticated) return;
    try {
      supportTickets = await accountRepository.tickets();
    } on ApiException {
      // Geçmiş talepler ikincil veri.
    }
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Bekleme listesi
  // ---------------------------------------------------------------------------

  /// Yayına alınmamış bir özellik için haber listesine katılır; sıra döner.
  Future<Result<int>> joinWaitlist(
    String feature,
    String email, {
    String? city,
  }) =>
      _guard(() => accountRepository.joinWaitlist(feature, email, city: city));

  Future<int?> waitlistCount(String feature) async {
    try {
      return await accountRepository.waitlistCount(feature);
    } on ApiException {
      // Sayı gösterilmezse ekran yine çalışır.
      return null;
    }
  }

  @override
  void dispose() {
    _realtimeSubscription?.cancel();
    _pushTokenSubscription?.cancel();
    _pushMessageSubscription?.cancel();
    realtime?.dispose();
    super.dispose();
  }

  /// İstisnayı [Result]'a çevirir; ekranlar `try/catch` yazmak zorunda kalmaz.
  Future<Result<T>> _guard<T>(Future<T> Function() action) async {
    try {
      return Success(await action());
    } on ApiException catch (error) {
      if (error.isUnauthenticated) {
        user = null;
        notifyListeners();
      }
      return Failure(error.userMessage, code: error.code);
    } catch (error) {
      return Failure('Beklenmeyen bir hata oluştu: $error');
    }
  }
}
