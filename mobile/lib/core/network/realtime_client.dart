import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'api_config.dart';

/// Sunucudan gelen gerçek zamanlı olay.
class RealtimeEvent {
  const RealtimeEvent(this.type, this.payload);

  final String type;
  final Map<String, dynamic> payload;

  String? get bagId =>
      payload['bagId'] as String? ?? payload['bag_id'] as String?;
  String? get orderId =>
      payload['orderId'] as String? ?? payload['order_id'] as String?;
  String? get storeId =>
      payload['storeId'] as String? ?? payload['store_id'] as String?;

  int? get availableQuantity {
    final value = payload['availableQuantity'] ?? payload['available_quantity'];
    return value is num ? value.toInt() : null;
  }

  String? get status => payload['status'] as String?;
}

/// Gerçek zamanlı olay kanalı (Socket.IO).
///
/// **Neden gerekli:** Stok, kullanıcı ekrana bakarken değişiyor. "SON 3 PAKET"
/// yazan bir kart, paket tükendiğinde de aynı şeyi yazmaya devam ederse
/// kullanıcı ödeme ekranına kadar gidip "stok yetersiz" hatası alır. Sunucu
/// zaten `bag.stock.updated` olayını yayınlıyordu; istemci tarafı bağlı
/// olmadığı için bu olaylar hiçbir yere ulaşmıyordu.
///
/// Bağlantı **isteğe bağlıdır**: kurulamazsa uygulama normal çalışmaya devam
/// eder, yalnızca canlı güncelleme olmaz. Bu yüzden hiçbir hata kullanıcıya
/// gösterilmez.
class RealtimeClient {
  RealtimeClient(this._api);

  final ApiClient _api;

  io.Socket? _socket;
  final _controller = StreamController<RealtimeEvent>.broadcast();

  /// Yeniden bağlanıldığında aboneliklerin geri kurulabilmesi için saklanır.
  List<String> _subscribedStores = const [];

  Stream<RealtimeEvent> get events => _controller.stream;

  bool get isConnected => _socket?.connected ?? false;

  /// Sunucuya bağlanır. Jeton yoksa hiçbir şey yapmaz.
  Future<void> connect() async {
    if (ApiConfig.dummyMode) return;

    final token = await _api.accessToken();
    if (token == null) return;

    // Var olan bağlantı kapatılır: jeton yenilendiğinde eski bağlantı
    // eski jetonu taşımaya devam ederdi.
    await disconnect();

    final socket = io.io(
      ApiConfig.realtimeUrl,
      io.OptionBuilder()
          .setPath('/socket.io')
          .setTransports(['websocket'])
          .setAuth({'token': token})
          // Otomatik yeniden bağlanma açık: mobilde ağ sık kesilir.
          .enableReconnection()
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(30000)
          .build(),
    );

    // Yeniden bağlanmadan ÖNCE jeton tazelenir.
    //
    // `setAuth` bağlantı kurulurken bir kez okunur ve donar. Erişim jetonu
    // 15 dakikada dolduğu için, ağ kesintisinden sonra yapılan yeniden
    // bağlanma denemeleri süresi geçmiş jetonla gidiyor ve sunucu tarafından
    // reddediliyordu — soket bir daha hiç bağlanmıyordu.
    socket.onReconnectAttempt((_) async {
      final fresh = await _api.accessToken();
      if (fresh != null) {
        socket.auth = {'token': fresh};
      }
    });

    socket.onConnect((_) {
      _log('bağlandı');
      // Yeniden bağlanmada abonelikler kaybolur; geri kuruluyor.
      if (_subscribedStores.isNotEmpty) {
        socket.emit('subscribe:stores', {'storeIds': _subscribedStores});
      }
    });

    socket.onDisconnect((_) => _log('bağlantı kapandı'));
    socket.onConnectError((error) => _log('bağlanılamadı: $error'));

    // Sunucu jetonu reddederse yeniden denemenin anlamı yok.
    socket.on('error', (data) {
      _log('sunucu hatası: $data');

      // Jeton süresi dolduysa yenilenmiş jetonla tekrar denenebilir; oturum
      // iptal edildiyse denemenin anlamı yok.
      if (data is Map && data['code'] == 'SESSION_REVOKED') {
        socket.dispose();
        _socket = null;
      }
    });

    for (final type in const [
      'bag.stock.updated',
      'bag.available',
      'order.status.updated',
    ]) {
      socket.on(type, (data) {
        if (_controller.isClosed) return;
        _controller.add(RealtimeEvent(type, _asMap(data)));
      });
    }

    _socket = socket;
    socket.connect();
  }

  /// Favori işletmelerin olaylarına abone olur.
  ///
  /// Sunucu `bag.available` olayını `store:{id}` odasına yayınlar; bu çağrı
  /// yapılmazsa o odada kimse bulunmaz ve olay hiçbir istemciye ulaşmaz.
  void subscribeStores(List<String> storeIds) {
    _subscribedStores = List.unmodifiable(storeIds);
    _socket?.emit('subscribe:stores', {'storeIds': _subscribedStores});
  }

  Future<void> disconnect() async {
    _socket?.dispose();
    _socket = null;
  }

  Future<void> dispose() async {
    await disconnect();
    await _controller.close();
  }

  static Map<String, dynamic> _asMap(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[realtime] $message');
  }
}
