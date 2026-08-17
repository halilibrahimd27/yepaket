import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../core/network/api_config.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/brand_logo.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({this.returnTo, super.key});

  /// Giriş öncesi gidilmek istenen ekran.
  ///
  /// Yönlendirici korumalı bir ekrana `?devam=` ekleyerek gönderir; değeri
  /// route builder'ından parametre olarak alıyoruz. `GoRouterState.of(context)`
  /// ile okumak, giriş sonrası ağaç yeniden kurulduğunda "There is no
  /// GoRouterState above the current context" hatası veriyordu.
  final String? returnTo;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  // Alanlar boş başlar: önceden doldurulmuş kimlik bilgileri üretimde
  // kullanıcıyı yanıltır ve mağaza incelemesinde takılma sebebidir.
  // Yalnızca dummy modda (yerel geliştirme) doldurulur.
  final email = TextEditingController(
    text: ApiConfig.dummyMode ? 'demo@yepaket.app' : '',
  );
  final password = TextEditingController(
    text: ApiConfig.dummyMode ? 'demo1234' : '',
  );
  bool loading = false;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> signInEmail() async {
    if (loading) return;
    setState(() => loading = true);

    final result = await context.read<AppState>().signInWithEmail(
      email.text,
      password.text,
    );

    if (!mounted) return;
    // Hata olsa da yükleme kapanır; eskiden buton kilitli kalıyordu (K3).
    setState(() => loading = false);

    switch (result) {
      case Success():
        context.go(_safeReturnTo(widget.returnTo));
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  /// Sosyal giriş.
  ///
  /// Gerçek sağlayıcı SDK'sı bağlanana kadar geliştirme jetonu gönderilir;
  /// sunucu bu jetonu yalnızca OAUTH_ALLOW_MOCK açıkken kabul eder ve bu
  /// bayrak üretimde reddedilir.
  Future<void> signInProvider(String provider) async {
    if (loading) return;
    setState(() => loading = true);

    final idToken = ApiConfig.oauthDevToken.isEmpty
        ? ''
        : 'mock:${provider}_dev:${ApiConfig.oauthDevToken}';

    final result = await context.read<AppState>().signInWithProvider(
      provider,
      idToken,
    );

    if (!mounted) return;
    setState(() => loading = false);

    switch (result) {
      case Success():
        context.go(_safeReturnTo(widget.returnTo));
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: ResponsiveContent(
            maxWidth: 520,
            padding: const EdgeInsets.fromLTRB(22, 28, 22, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Align(
                  alignment: Alignment.centerLeft,
                  child: BrandLogo(),
                ),
                const SizedBox(height: 44),
                Text(
                  'Hoş geldin.',
                  style: Theme.of(context).textTheme.displayMedium,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Bugün hangi iyi paketi kurtarıyoruz?',
                  style: TextStyle(fontSize: 16, color: AppColors.muted),
                ),
                const SizedBox(height: 28),
                _SocialButton(
                  label: 'Apple ile devam et',
                  icon: const Icon(Icons.apple, color: Colors.white, size: 23),
                  background: Colors.black,
                  foreground: Colors.white,
                  onPressed: loading ? null : () => signInProvider('apple'),
                ),
                const SizedBox(height: 11),
                _SocialButton(
                  label: 'Google ile devam et',
                  icon: const Text(
                    'G',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF4285F4),
                    ),
                  ),
                  onPressed: loading ? null : () => signInProvider('google'),
                ),
                const SizedBox(height: 11),
                _SocialButton(
                  label: 'Outlook ile devam et',
                  icon: Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0A64C9),
                      borderRadius: BorderRadius.all(Radius.circular(4)),
                    ),
                    child: const Text(
                      'O',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  onPressed: loading ? null : () => signInProvider('microsoft'),
                ),
                const SizedBox(height: 26),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'veya e-posta ile',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 22),
                TextField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'E-posta',
                    prefixIcon: Icon(Icons.mail_outline_rounded),
                  ),
                ),
                const SizedBox(height: 13),
                TextField(
                  controller: password,
                  obscureText: true,
                  onSubmitted: (_) => signInEmail(),
                  decoration: const InputDecoration(
                    labelText: 'Şifre',
                    prefixIcon: Icon(Icons.lock_outline_rounded),
                  ),
                ),
                const SizedBox(height: 9),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: loading
                        ? null
                        : () => context.push('/sifremi-unuttum'),
                    child: const Text('Şifremi unuttum'),
                  ),
                ),
                const SizedBox(height: 8),
                PrimaryButton(
                  label: 'Giriş yap',
                  loading: loading,
                  onPressed: signInEmail,
                ),
                const SizedBox(height: 18),
                const Text(
                  'Giriş bilgilerin güvenli bağlantı üzerinden doğrulanır.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.5,
                    color: AppColors.muted,
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: loading ? null : () => context.push('/kayit'),
                  child: const Text('Hesabın yok mu? Ücretsiz kayıt ol'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.background = Colors.white,
    this.foreground = AppColors.ink,
  });

  final String label;
  final Widget icon;
  final VoidCallback? onPressed;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 55,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: background,
          foregroundColor: foreground,
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Align(alignment: Alignment.centerLeft, child: icon),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }
}

/// Dönülecek yolu doğrular.
///
/// Yalnızca uygulama içi göreli yollar kabul edilir: dışarıdan gelen mutlak
/// bir URL açık yönlendirme (open redirect) olurdu.
String _safeReturnTo(String? devam) {
  if (devam == null || devam.isEmpty) return '/home';

  final target = Uri.decodeComponent(devam);
  if (!target.startsWith('/') || target.startsWith('//')) return '/home';
  return target;
}
