import 'package:dio/dio.dart';

/// Sunucudan gelen tek biçimli hata.
///
/// İstemci `message` metnine değil `code` değerine göre dallanmalıdır:
/// mesaj metni değişebilir, kod sözleşmenin parçasıdır.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details = const {},
  });

  final String code;
  final String message;
  final int? statusCode;
  final Map<String, dynamic> details;

  /// Ağ bağlantısı kurulamadı — kullanıcıya "tekrar dene" önerilebilir.
  bool get isNetworkError => code == 'NETWORK_ERROR';

  /// Oturum geçersiz; kullanıcı girişe yönlendirilmeli.
  bool get isUnauthenticated =>
      statusCode == 401 ||
      code == 'UNAUTHENTICATED' ||
      code == 'TOKEN_EXPIRED' ||
      code == 'REFRESH_TOKEN_REUSED';

  factory ApiException.fromResponse(int statusCode, Object? body) {
    final error = _asMap(_asMap(body)['error']);

    return ApiException(
      code: error['code'] as String? ?? 'INTERNAL_ERROR',
      message: error['message'] as String? ?? 'Beklenmeyen bir hata oluştu.',
      statusCode: statusCode,
      details: _asMap(error['details']),
    );
  }

  factory ApiException.fromDio(DioException error) {
    // Sunucu yanıt verdiyse gövdedeki hata kodunu kullan.
    final response = error.response;
    if (response != null) {
      return ApiException.fromResponse(response.statusCode ?? 0, response.data);
    }

    final isTimeout =
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout;

    return ApiException(
      code: 'NETWORK_ERROR',
      message: isTimeout
          ? 'Sunucu yanıt vermedi. Bağlantını kontrol edip tekrar dene.'
          : 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',
    );
  }

  /// Kullanıcıya gösterilecek metin.
  String get userMessage => message;

  @override
  String toString() => 'ApiException($code): $message';

  static Map<String, dynamic> _asMap(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }
}
