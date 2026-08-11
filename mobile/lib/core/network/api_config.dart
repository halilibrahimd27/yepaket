abstract final class ApiConfig {
  static const productionBaseUrl = 'https://api.yepaket.app/v1';
  static const stagingBaseUrl = 'https://staging-api.yepaket.app/v1';
  static const localBaseUrl = 'http://10.0.2.2:8080/v1';

  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: productionBaseUrl,
  );

  static const dummyMode = bool.fromEnvironment(
    'DUMMY_MODE',
    defaultValue: true,
  );

  /// Defaults to OpenStreetMap for development and light demo traffic.
  /// Override this at build time when using a production tile provider.
  static const mapTileUrl = String.fromEnvironment(
    'MAP_TILE_URL',
    defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );

  static const mapUserAgent = String.fromEnvironment(
    'MAP_USER_AGENT',
    defaultValue: 'com.yepaket.yepaket',
  );
}

abstract final class ApiEndpoints {
  static const login = '/auth/login';
  static const refresh = '/auth/refresh';
  static const me = '/auth/me';
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

  static const notifications = '/notifications';
  static const impact = '/impact/me';
  static const supportTickets = '/support/tickets';
}
