import 'package:dio/dio.dart';

import 'api_config.dart';

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
            ),
          );

  final Dio _dio;
  String? _accessToken;

  void setAccessToken(String? token) {
    _accessToken = token;
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      path,
      queryParameters: query,
      options: Options(headers: _headers),
    );
    return response.data ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    String? idempotencyKey,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      path,
      data: data,
      options: Options(
        headers: {..._headers, 'Idempotency-Key': ?idempotencyKey},
      ),
    );
    return response.data ?? <String, dynamic>{};
  }

  Map<String, String> get _headers => {
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };
}
