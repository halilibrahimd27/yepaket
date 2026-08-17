import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../network/api_config.dart';

/// Sosyal giriş sağlayıcıları.
///
/// Sunucu, sağlayıcının imzaladığı **kimlik jetonunu** (id token) JWKS ile
/// doğruluyor. Bu yüzden istemcinin görevi yalnızca gerçek jetonu almak;
/// jetonu biz üretmiyoruz.
///
/// Eskiden buradan `mock:google_dev:...` biçiminde uydurma bir dize
/// gönderiliyordu. Sunucu bunu yalnızca `OAUTH_ALLOW_MOCK` açıkken kabul
/// ediyor ve bu bayrak üretimde reddediliyor — yani üretim derlemesinde üç
/// sosyal giriş butonu da her zaman hata veriyordu.
enum SocialProvider {
  google('google', 'Google'),
  apple('apple', 'Apple');

  const SocialProvider(this.apiValue, this.label);

  /// Sunucudaki yol parametresi (`POST /auth/oauth/{provider}`).
  final String apiValue;
  final String label;
}

/// Girişimin sonucu.
sealed class SocialSignInResult {
  const SocialSignInResult();
}

/// Sağlayıcıdan geçerli bir kimlik jetonu alındı.
class SocialToken extends SocialSignInResult {
  const SocialToken(this.idToken);
  final String idToken;
}

/// Kullanıcı pencereyi kapattı. Hata gösterilmez.
class SocialCancelled extends SocialSignInResult {
  const SocialCancelled();
}

class SocialFailure extends SocialSignInResult {
  const SocialFailure(this.message);
  final String message;
}

/// Sosyal giriş.
class SocialSignIn {
  /// Bu derlemede kullanılabilecek sağlayıcılar.
  ///
  /// Yapılandırması olmayan sağlayıcı **listelenmez**: dokunulduğunda mutlaka
  /// hata verecek bir butonu göstermek, kullanıcıyı uygulamanın bozuk olduğuna
  /// ikna eder.
  static List<SocialProvider> get available {
    if (kIsWeb) return const [];

    return [
      // Google, istemci kimliği tanımlıysa. Android'de kimlik
      // google-services.json'dan gelir; iOS'ta derleme değişkeniyle verilir.
      if (ApiConfig.googleSignInConfigured) SocialProvider.google,
      // Apple ile giriş yalnızca Apple platformlarında yerel olarak çalışır.
      // Android'de web akışı gerekir ve ayrı bir yönlendirme adresi ister;
      // ihtiyaç doğana kadar kapsam dışı.
      if (Platform.isIOS || Platform.isMacOS) SocialProvider.apple,
    ];
  }

  /// Seçilen sağlayıcıdan kimlik jetonu alır.
  Future<SocialSignInResult> signIn(SocialProvider provider) async {
    try {
      return switch (provider) {
        SocialProvider.google => await _google(),
        SocialProvider.apple => await _apple(),
      };
    } catch (error) {
      if (kDebugMode) debugPrint('[sosyal giriş] $error');
      return SocialFailure(
        '${provider.label} ile giriş yapılamadı. Lütfen tekrar dene.',
      );
    }
  }

  Future<SocialSignInResult> _google() async {
    final google = GoogleSignIn.instance;

    await google.initialize(
      // Android istemci kimliği google-services.json'dan okunur; iOS ve
      // sunucu kimlikleri derleme değişkeniyle verilir.
      clientId: ApiConfig.googleIosClientId.isEmpty
          ? null
          : ApiConfig.googleIosClientId,
      serverClientId: ApiConfig.googleServerClientId.isEmpty
          ? null
          : ApiConfig.googleServerClientId,
    );

    final account = await google.authenticate();
    final idToken = account.authentication.idToken;

    if (idToken == null || idToken.isEmpty) {
      return const SocialFailure(
        'Google kimlik bilgisi alınamadı. Lütfen tekrar dene.',
      );
    }

    return SocialToken(idToken);
  }

  Future<SocialSignInResult> _apple() async {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: const [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );

    final idToken = credential.identityToken;

    if (idToken == null || idToken.isEmpty) {
      return const SocialFailure(
        'Apple kimlik bilgisi alınamadı. Lütfen tekrar dene.',
      );
    }

    return SocialToken(idToken);
  }
}
