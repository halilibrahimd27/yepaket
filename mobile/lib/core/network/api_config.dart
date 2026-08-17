import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

abstract final class ApiConfig {
  static const productionBaseUrl = 'https://api.yepaket.app/v1';
  static const stagingBaseUrl = 'https://staging-api.yepaket.app/v1';
  static const localBaseUrl = 'http://10.0.2.2:8080/v1';

  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: productionBaseUrl,
  );

  /// Gerçek zamanlı olay kanalının adresi (Socket.IO namespace).
  ///
  /// `baseUrl` sonundaki `/v1` zaten namespace'in bir parçası olduğu için
  /// doğrudan kullanılır: sunucu tarafında namespace `/v1/realtime`.
  static String get realtimeUrl => '$baseUrl/realtime';

  /// Web uygulamasının kök adresi; yasal metinler ve paylaşım bağlantıları
  /// buradan gider.
  static const webUrl = String.fromEnvironment(
    'WEB_APP_URL',
    defaultValue: 'https://yepaket.app',
  );

  /// Ayarlar ekranında gösterilen sürüm.
  ///
  /// CI, `--dart-define=APP_VERSION=$(git describe)` ile gerçek sürümü
  /// geçirir; destek talebinde hangi sürümün konuşulduğu önemli.
  static const appVersion = String.fromEnvironment(
    'APP_VERSION',
    defaultValue: '1.0.0',
  );

  /// Sahte veriyle çalışma modu.
  ///
  /// Varsayılan **kapalı**: açık bırakılırsa yayına giden derleme sunucuya
  /// hiç bağlanmaz ve kullanıcı uydurma paketler görür. Yerel geliştirme
  /// `--dart-define=DUMMY_MODE=true` ile açıkça ister.
  static const dummyMode = bool.fromEnvironment('DUMMY_MODE');

  /// Harita döşemeleri.
  ///
  /// Varsayılan OpenStreetMap yalnızca geliştirme içindir: OSM'nin genel
  /// sunucuları üretim uygulaması trafiğine kapalıdır (kullanım politikası).
  /// Yayına çıkmadan önce `MAP_TILE_URL` ile ticari bir sağlayıcıya
  /// (MapTiler, Stadia, Mapbox) çevrilmeli.
  static const mapTileUrl = String.fromEnvironment(
    'MAP_TILE_URL',
    defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );

  static const mapUserAgent = String.fromEnvironment(
    'MAP_USER_AGENT',
    defaultValue: 'com.yepaket.yepaket',
  );

  // ---------------------------------------------------------------------------
  // Sosyal giriş
  //
  // Kimlikler derleme değişkeniyle verilir. Boş bırakılan sağlayıcı giriş
  // ekranında **hiç görünmez**: dokunulduğunda mutlaka hata verecek bir
  // butonu göstermek kullanıcıyı uygulamanın bozuk olduğuna ikna eder.
  // ---------------------------------------------------------------------------

  /// iOS için Google istemci kimliği (Android'de google-services.json yeterli).
  static const googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
  );

  /// Sunucu tarafı Google istemci kimliği — kimlik jetonunun `aud` alanı
  /// buna eşit olmalı; sunucu doğrulaması bunu kontrol ediyor.
  static const googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );

  /// Google girişi bu derlemede kullanılabilir mi?
  ///
  /// Android'de yapılandırma `google-services.json` üzerinden gelir; o dosya
  /// varsa Firebase de kurulmuş demektir.
  static bool get googleSignInConfigured =>
      googleServerClientId.isNotEmpty || googleIosClientId.isNotEmpty;

  /// Geliştirme sırasında sosyal girişi taklit etmek için kullanılan e-posta.
  ///
  /// Yalnızca dummy modda anlamlıdır; sunucu sahte jetonu üretimde reddeder.
  static const oauthDevToken = String.fromEnvironment('OAUTH_DEV_EMAIL');

  /// Sunucunun beklediği platform değeri (`DevicePlatform` enum'ı).
  ///
  /// `kIsWeb` kontrolü önce gelmeli: `dart:io`'daki `Platform` web'de
  /// erişildiğinde istisna fırlatır ve uygulama açılışta çökerdi.
  static String get platform {
    if (kIsWeb) return 'WEB';
    if (Platform.isIOS) return 'IOS';
    if (Platform.isAndroid) return 'ANDROID';
    return 'WEB';
  }
}

abstract final class ApiEndpoints {
  static const login = '/auth/login';
  static const register = '/auth/register';
  static const requestPasswordReset = '/auth/password-reset/request';
  static const confirmPasswordReset = '/auth/password-reset/confirm';
  static const refresh = '/auth/refresh';
  static const me = '/auth/me';
  static const notificationPreferences = '/auth/me/notification-preferences';
  static const changePassword = '/auth/change-password';
  static const sessions = '/auth/sessions';
  static String session(String id) => '/auth/sessions/$id';
  static const logoutAll = '/auth/logout-all';
  static String oauth(String provider) => '/auth/oauth/$provider';

  static const nearbyBags = '/bags/nearby';
  static const bags = '/bags';
  static String bag(String id) => '/bags/$id';
  static String favorite(String id) => '/bags/$id/favorite';

  static const orders = '/orders';
  static String order(String id) => '/orders/$id';
  static String cancelOrder(String id) => '/orders/$id/cancel';
  static String pickup(String id) => '/orders/$id/pickup';
  static String sharePickup(String id) => '/orders/$id/share-pickup';
  static String rating(String id) => '/orders/$id/rating';

  static String pickupNonce(String id) => '/orders/$id/pickup-nonce';
  static const logout = '/auth/logout';

  static const notifications = '/notifications';
  static const unreadCount = '/notifications/unread-count';
  static String markRead(String id) => '/notifications/$id/read';
  static const pushToken = '/devices/push-token';
  static const impact = '/impact/me';
  static const communityImpact = '/impact/community';
  static const favorites = '/favorites';
  static const supportTickets = '/support/tickets';
  static String store(String id) => '/stores/$id';

  static const waitlist = '/waitlist';
  static String waitlistCount(String feature) => '/waitlist/$feature/count';
}
