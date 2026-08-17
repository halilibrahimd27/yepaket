import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

/// Dışarıdan gelen bağlantıları uygulama içi yollara çevirir.
///
/// **Neden gerekli:** Şifre sıfırlama e-postası `yepaket://sifre-sifirla?token=…`
/// bağlantısı içeriyor. Şemayı manifest'te kaydetmek işletim sisteminin
/// bağlantıyı uygulamaya iletmesini sağlar; ama iletilen bağlantıyı işleyen
/// bir kod olmazsa uygulama yalnızca açılır ve kullanıcı ana ekranda kalır —
/// yani şifresini yine sıfırlayamaz.
///
/// İki kaynak da dinlenir:
/// - **Soğuk başlatma:** uygulama kapalıyken tıklanan bağlantı (`initialLink`)
/// - **Sıcak başlatma:** uygulama arka plandayken tıklanan bağlantı (`uriLinkStream`)
class DeepLinkHandler {
  DeepLinkHandler(this._router);

  final GoRouter _router;
  final AppLinks _appLinks = AppLinks();

  StreamSubscription<Uri>? _subscription;

  Future<void> start() async {
    if (kIsWeb) return;

    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _handle(initial);
    } catch (error) {
      _log('ilk bağlantı okunamadı: $error');
    }

    _subscription = _appLinks.uriLinkStream.listen(
      _handle,
      onError: (Object error) => _log('bağlantı akışı hatası: $error'),
    );
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }

  void _handle(Uri uri) {
    final target = resolve(uri);
    if (target == null) {
      _log('eşleşmeyen bağlantı: $uri');
      return;
    }

    _log('$uri → $target');
    _router.go(target);
  }

  /// Gelen bağlantıyı uygulama içi yola çevirir; eşleşme yoksa `null`.
  ///
  /// İki biçim desteklenir:
  /// - `yepaket://sifre-sifirla?token=…`  (özel şema — host = yol)
  /// - `https://yepaket.app/sifre-sifirla?token=…` (App Link — path = yol)
  ///
  /// Ayrı bir fonksiyon olmasının nedeni hem test edilebilirlik hem yeniden
  /// kullanım: bildirim listesi de sunucunun gönderdiği derin bağlantıyı
  /// aynı kurallarla çözüyor.
  static String? resolve(Uri uri) {
    // Özel şemada "yepaket://sifre-sifirla" için host 'sifre-sifirla' olur,
    // path boş kalır. https bağlantısında ise tersi geçerlidir.
    final segments = <String>[
      if (uri.scheme != 'http' && uri.scheme != 'https' && uri.host.isNotEmpty)
        uri.host,
      ...uri.pathSegments,
    ].where((segment) => segment.isNotEmpty).toList();

    if (segments.isEmpty) return null;

    final query = uri.query.isEmpty ? '' : '?${uri.query}';

    switch (segments.first) {
      case 'sifre-sifirla':
        return '/sifre-sifirla$query';

      case 'paket':
        // yepaket://paket/<id>
        return segments.length > 1 ? '/bag/${segments[1]}' : null;

      case 'siparis':
      case 'orders':
        // Sunucu bildirimlerde `yepaket://orders/{id}` gönderiyor.
        return '/orders';

      case 'stores':
        // İşletmenin paketleri ana listede görünür.
        return '/home';

      case 'teslim':
        // Paylaşılan teslim bağlantısı: aktif sipariş ekranına götürür.
        return '/active-order';

      default:
        return null;
    }
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[deeplink] $message');
  }
}
