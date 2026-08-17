import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// Yeni şifre belirleme.
///
/// Jeton, e-postadaki derin bağlantıdan (`yepaket://sifre-sifirla?token=...`)
/// veya web bağlantısından gelir. Jetonu tekrar kullanıcıya yazdırmıyoruz;
/// bağlantıda gelmiyorsa akış baştan başlatılır.
class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({required this.token, super.key});

  final String token;

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _obscure = true;
  bool _loading = false;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _loading = true);

    final result = await context.read<AppState>().confirmPasswordReset(
      widget.token,
      _passwordController.text,
    );

    if (!mounted) return;
    setState(() => _loading = false);

    switch (result) {
      case Success():
        showInfoSnack(
          context,
          'Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.',
        );
        context.go('/login');
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.token.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Şifre sıfırlama')),
        body: AsyncContent(
          isLoading: false,
          error: null,
          isEmpty: true,
          emptyTitle: 'Bağlantı geçersiz',
          emptyMessage:
              'Sıfırlama bağlantısı eksik veya bozuk görünüyor. '
              'Yeni bir bağlantı isteyebilirsin.',
          emptyIcon: Icons.link_off_rounded,
          onRetry: () => context.go('/sifremi-unuttum'),
          builder: (_) => const SizedBox.shrink(),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Yeni şifre belirle')),
      body: ResponsiveContent(
        maxWidth: 460,
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
        child: Form(
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
                  Icons.key_rounded,
                  color: AppColors.forest,
                  size: 36,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Yeni şifreni belirle',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                'Şifreni değiştirdiğinde tüm cihazlardaki oturumların '
                'kapatılır.',
                style: TextStyle(color: AppColors.muted, height: 1.5),
              ),
              const SizedBox(height: 24),

              TextFormField(
                controller: _passwordController,
                enabled: !_loading,
                obscureText: _obscure,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Yeni şifre',
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  helperText: 'En az 8 karakter, bir harf ve bir rakam.',
                  helperMaxLines: 2,
                ),
                validator: (value) {
                  final password = value ?? '';
                  if (password.length < 8) {
                    return 'Şifre en az 8 karakter olmalı.';
                  }
                  if (!RegExp(
                    r'(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d)',
                  ).hasMatch(password)) {
                    return 'Şifre en az bir harf ve bir rakam içermeli.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _confirmController,
                enabled: !_loading,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                decoration: const InputDecoration(
                  labelText: 'Şifreyi tekrar gir',
                  prefixIcon: Icon(Icons.lock_outline_rounded),
                ),
                validator: (value) => value == _passwordController.text
                    ? null
                    : 'Şifreler eşleşmiyor.',
              ),
              const SizedBox(height: 22),

              PrimaryButton(
                label: 'Şifreyi güncelle',
                loading: _loading,
                onPressed: _loading ? null : _submit,
              ),
              TextButton(
                onPressed: _loading ? null : () => context.go('/login'),
                child: const Text('Vazgeç'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
