import 'dart:async';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_config.dart';
import 'api_exception.dart';

/// Kalıcı jeton deposu anahtarları.
const _accessTokenKey = 'auth_access_token';
const _refreshTokenKey = 'auth_refresh_token';
const _deviceIdKey = 'device_id';

/// YePaket API istemcisi.
///
/// Sorumlulukları:
/// - Jetonları kalıcı olarak saklamak (uygulama kapanınca oturum kaybolmasın)
/// - Erişim jetonu süresi dolduğunda otomatik yenilemek ve isteği tekrarlamak
/// - Sunucu hatalarını tek biçimli [ApiException]'a çevirmek
///
/// Not: Yenileme jetonu `shared_preferences` içinde tutuluyor. Üretimde
/// `flutter_secure_storage` ile Keychain/Keystore'a taşınmalı; bunun için
/// yalnızca bu sınıftaki üç metodu değiştirmek yeterli.
class ApiClient {
  ApiClient({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: ApiConfig.baseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
              headers: const {'Accept': 'application/json'},
              // 4xx/5xx'i istisna olarak değil yanıt olarak al; hataları
              // tek yerde ApiException'a çeviriyoruz.
              validateStatus: (status) => status != null && status < 500,
            ),
          ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await accessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  String? _cachedAccessToken;
  String? _cachedDeviceId;

  /// Aynı anda birden çok istek 401 alırsa tek yenileme yapılsın.
  Future<bool>? _refreshInFlight;

  // ---------------------------------------------------------------------------
  // Jeton yönetimi
  // ---------------------------------------------------------------------------

  Future<String?> accessToken() async {
    if (_cachedAccessToken != null) return _cachedAccessToken;
    final prefs = await SharedPreferences.getInstance();
    _cachedAccessToken = prefs.getString(_accessTokenKey);
    return _cachedAccessToken;
  }

  Future<String?> refreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshTokenKey);
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _cachedAccessToken = accessToken;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, accessToken);
    await prefs.setString(_refreshTokenKey, refreshToken);
  }

  Future<void> clearTokens() async {
    _cachedAccessToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
  }

  Future<bool> get hasSession async => (await accessToken()) != null;

  /// Cihaz kimliği kalıcıdır: her açılışta yenisi üretilirse sunucuda
  /// gereksiz oturum kaydı birikir ve "cihazlarım" listesi anlamsızlaşır.
  Future<String> deviceId() async {
    if (_cachedDeviceId != null) return _cachedDeviceId!;

    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_deviceIdKey);

    if (id == null) {
      id =
          'mobile-${DateTime.now().microsecondsSinceEpoch}-${identityHashCode(this)}';
      await prefs.setString(_deviceIdKey, id);
    }

    _cachedDeviceId = id;
    return id;
  }

  // ---------------------------------------------------------------------------
  // İstekler
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) => _send(() => _dio.get<dynamic>(path, queryParameters: query));

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    String? idempotencyKey,
  }) => _send(
    () => _dio.post<dynamic>(
      path,
      data: data,
      options: Options(headers: {'Idempotency-Key': ?idempotencyKey}),
    ),
  );

  Future<Map<String, dynamic>> patch(String path, {Object? data}) =>
      _send(() => _dio.patch<dynamic>(path, data: data));

  Future<Map<String, dynamic>> delete(String path) =>
      _send(() => _dio.delete<dynamic>(path));

  /// İsteği gönderir; 401 alınırsa bir kez yenileyip tekrar dener.
  Future<Map<String, dynamic>> _send(
    Future<Response<dynamic>> Function() request, {
    bool allowRetry = true,
  }) async {
    late Response<dynamic> response;

    try {
      response = await request();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }

    final status = response.statusCode ?? 0;

    if (status == 401 && allowRetry) {
      final refreshed = await _refreshSession();
      if (refreshed) {
        return _send(request, allowRetry: false);
      }
    }

    if (status >= 400) {
      throw ApiException.fromResponse(status, response.data);
    }

    final data = response.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  /// Yenileme jetonuyla yeni oturum alır. Eşzamanlı çağrılar tek isteği paylaşır.
  Future<bool> _refreshSession() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _performRefresh() async {
    final token = await refreshToken();
    if (token == null) return false;

    try {
      final response = await _dio.post<dynamic>(
        ApiEndpoints.refresh,
        data: {
          'refreshToken': token,
          'device': {
            'deviceId': await deviceId(),
            'platform': ApiConfig.platform,
          },
        },
        // Yenileme isteği kendi kendini yenilemeye çalışmasın.
        options: Options(headers: {'Authorization': null}),
      );

      if ((response.statusCode ?? 0) >= 400) {
        // Yenileme reddedildi: jeton çalınmış olabilir veya süresi dolmuş.
        // Oturumu temizlemek kullanıcıyı yeniden girişe yönlendirir.
        await clearTokens();
        return false;
      }

      final data = _asMap(_asMap(response.data)['data']);
      final access = data['access_token'] as String?;
      final refresh = data['refresh_token'] as String?;

      if (access == null || refresh == null) {
        await clearTokens();
        return false;
      }

      await saveTokens(accessToken: access, refreshToken: refresh);
      return true;
    } on DioException {
      // Ağ hatası oturumu düşürmemeli; kullanıcı tekrar deneyebilir.
      return false;
    }
  }

  static Map<String, dynamic> _asMap(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }
}
