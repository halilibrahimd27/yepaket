import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Push bildirimi altyapısı.
///
/// **Firebase yapılandırması olmadan da çalışır.** `google-services.json` /
/// `GoogleService-Info.plist` dosyaları eklenmemişse `Firebase.initializeApp`
/// istisna fırlatır; bu istisna yakalanır ve push sessizce devre dışı kalır.
/// Uygulamanın geri kalanı etkilenmez — bildirimler yalnızca uygulama içinde
/// görünür.
///
/// Bu bilinçli bir karardır: müşteri Firebase hesabını açana kadar
/// geliştirme ve test derlemelerinin çalışmaya devam etmesi gerekiyor.
class PushService {
  bool _available = false;

  /// Firebase hazır ve izin alınmış mı?
  bool get isAvailable => _available;

  /// Firebase'i başlatır ve kullanıcıdan bildirim izni ister.
  ///
  /// Dönen değer, jeton alınabilecek durumda olup olmadığımızı söyler.
  Future<bool> initialize() async {
    if (kIsWeb) {
      // Web derlemesi yalnızca tarayıcıdan doğrulama içindir; push
      // yapılandırması ayrı bir servis worker gerektirir.
      return false;
    }

    try {
      await Firebase.initializeApp();
    } catch (error) {
      // En yaygın sebep: yapılandırma dosyası eklenmemiş.
      _log('Firebase başlatılamadı, push devre dışı: $error');
      return false;
    }

    try {
      final settings = await FirebaseMessaging.instance.requestPermission();

      // iOS'ta kullanıcı reddedebilir; Android 13+ için de izin gerekir.
      _available =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;

      if (!_available) {
        _log('Bildirim izni verilmedi: ${settings.authorizationStatus}');
      }

      return _available;
    } catch (error) {
      _log('Bildirim izni istenemedi: $error');
      return false;
    }
  }

  /// Cihazın FCM jetonunu döndürür; alınamazsa `null`.
  Future<String?> token() async {
    if (!_available) return null;

    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (error) {
      _log('Jeton alınamadı: $error');
      return null;
    }
  }

  /// Jeton yenilendiğinde tetiklenir.
  ///
  /// FCM jetonu uygulama yeniden kurulduğunda, veri temizlendiğinde veya
  /// belirli aralıklarla değişir. Yenilenen jeton sunucuya bildirilmezse
  /// bildirimler sessizce kesilir — ve bu kesinti fark edilmez.
  Stream<String> get onTokenRefresh {
    if (!_available) return const Stream<String>.empty();
    return FirebaseMessaging.instance.onTokenRefresh;
  }

  /// Uygulama açıkken gelen bildirimler.
  Stream<RemoteMessage> get onMessage {
    if (!_available) return const Stream<RemoteMessage>.empty();
    return FirebaseMessaging.onMessage;
  }

  /// Bildirime dokunarak uygulama açıldığında tetiklenir.
  Stream<RemoteMessage> get onMessageOpenedApp {
    if (!_available) return const Stream<RemoteMessage>.empty();
    return FirebaseMessaging.onMessageOpenedApp;
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[push] $message');
  }
}
