import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/brand_logo.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// E-posta ile hesap oluşturma.
///
/// Sunucu kuralları burada da uygulanır (en az 8 karakter, harf + rakam):
/// kullanıcıyı ağ turu beklettikten sonra reddetmek yerine anında uyarmak
/// daha az sinir bozucu.
class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscure = true;
  bool _acceptedTerms = false;
  bool _loading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    if (!_acceptedTerms) {
      showErrorSnack(context, 'Devam etmek için sözleşmeleri onaylaman gerekiyor.');
      return;
    }

    setState(() => _loading = true);

    final result = await context.read<AppState>().register(
      name: _nameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (!mounted) return;
    setState(() => _loading = false);

    switch (result) {
      case Success():
        context.go('/home');
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
        title: const Text('Hesap oluştur'),
      ),
      body: ResponsiveContent(
        maxWidth: 460,
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Center(child: BrandLogo(size: 56)),
              const SizedBox(height: 20),
              Text(
                'Kurtarmaya başla',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                'Hesabın olsun, sürpriz paketleri kaçırma.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.5),
              ),
              const SizedBox(height: 28),

              TextFormField(
                controller: _nameController,
                enabled: !_loading,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Ad Soyad',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                validator: (value) => (value ?? '').trim().length < 2
                    ? 'Adını yazar mısın?'
                    : null,
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _emailController,
                enabled: !_loading,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
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
              const SizedBox(height: 14),

              TextFormField(
                controller: _passwordController,
                enabled: !_loading,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Şifre',
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
                  // Sunucudaki kuralın aynısı; burada tutmak kullanıcıyı
                  // gereksiz bir ağ turundan kurtarır.
                  if (password.length < 8) {
                    return 'Şifre en az 8 karakter olmalı.';
                  }
                  if (!RegExp(r'(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d)').hasMatch(password)) {
                    return 'Şifre en az bir harf ve bir rakam içermeli.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 18),

              CheckboxListTile(
                value: _acceptedTerms,
                onChanged: _loading
                    ? null
                    : (value) => setState(() => _acceptedTerms = value ?? false),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'Kullanım Koşulları ve Gizlilik Politikası’nı okudum, kabul ediyorum.',
                  style: TextStyle(fontSize: 12, height: 1.45),
                ),
              ),
              const SizedBox(height: 12),

              PrimaryButton(
                label: 'Hesap oluştur',
                loading: _loading,
                onPressed: _loading ? null : _submit,
              ),
              const SizedBox(height: 12),

              TextButton(
                onPressed: _loading ? null : () => context.go('/login'),
                child: const Text('Zaten hesabın var mı? Giriş yap'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
