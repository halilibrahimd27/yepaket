import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// Şifre sıfırlama isteği.
///
/// Sunucu, adresin kayıtlı olup olmadığını bilerek sızdırmaz; bu ekran da
/// aynı davranışı sürdürür ve her durumda aynı onay mesajını gösterir.
/// Aksi hâlde bu ekran "hangi e-postalar kayıtlı" sorusunun cevabı olurdu.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  bool _loading = false;
  bool _sent = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _loading = true);

    final result = await context.read<AppState>().requestPasswordReset(
      _emailController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _loading = false);

    switch (result) {
      case Success():
        setState(() => _sent = true);
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go('/login'),
        ),
        title: const Text('Şifremi unuttum'),
      ),
      body: ResponsiveContent(
        maxWidth: 460,
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
        child: _sent ? _sentView(context) : _formView(context),
      ),
    );
  }

  Widget _formView(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        children: [
          Container(
            width: 82,
            height: 82,
            decoration: const BoxDecoration(
              color: AppColors.limeSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_reset_rounded,
              color: AppColors.forest,
              size: 36,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Sıfırlama bağlantısı gönderelim',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Hesabına bağlı e-posta adresini yaz; şifreni yenilemen için '
            'bir bağlantı göndereceğiz.',
            style: TextStyle(color: AppColors.muted, height: 1.5),
          ),
          const SizedBox(height: 24),

          TextFormField(
            controller: _emailController,
            enabled: !_loading,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
            decoration: const InputDecoration(
              labelText: 'E-posta',
              prefixIcon: Icon(Icons.mail_outline_rounded),
            ),
            validator: (value) {
              final email = (value ?? '').trim();
              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
                return 'Geçerli bir e-posta adresi gir.';
              }
              return null;
            },
          ),
          const SizedBox(height: 22),

          PrimaryButton(
            label: 'Bağlantı gönder',
            loading: _loading,
            onPressed: _loading ? null : _submit,
          ),
          const SizedBox(height: 10),

          TextButton(
            onPressed: _loading ? null : () => context.go('/login'),
            child: const Text('Girişe dön'),
          ),

          const SizedBox(height: 20),
          const Text(
            'Sosyal hesapla (Google, Apple, Microsoft) giriş yaptıysan şifren '
            'yoktur; doğrudan o hesapla giriş yapabilirsin.',
            style: TextStyle(fontSize: 11, height: 1.5, color: AppColors.muted),
          ),
        ],
      ),
    );
  }

  Widget _sentView(BuildContext context) {
    return ListView(
      children: [
        Container(
          width: 82,
          height: 82,
          decoration: const BoxDecoration(
            color: AppColors.limeSoft,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.mark_email_read_rounded,
            color: AppColors.forest,
            size: 36,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'Posta kutunu kontrol et',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 8),
        Text(
          '${_emailController.text.trim()} adresi kayıtlıysa şifre sıfırlama '
          'bağlantısı gönderildi. Bağlantı 30 dakika geçerli.',
          style: const TextStyle(color: AppColors.muted, height: 1.5),
        ),
        const SizedBox(height: 24),
        const Text(
          'E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne '
          'bakmayı unutma.',
          style: TextStyle(fontSize: 12, height: 1.5, color: AppColors.muted),
        ),
        const SizedBox(height: 28),
        PrimaryButton(
          label: 'Girişe dön',
          onPressed: () => context.go('/login'),
        ),
        TextButton(
          onPressed: () => setState(() => _sent = false),
          child: const Text('Başka bir adres dene'),
        ),
      ],
    );
  }
}
