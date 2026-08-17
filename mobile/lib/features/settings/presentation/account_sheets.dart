import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';

/// Ayarlar ekranından açılan hesap işlemleri.
///
/// Bu akışların uçları sunucuda baştan beri hazırdı ama hiçbir istemci
/// çağırmıyordu: kullanıcı adını değiştiremiyor, şifresini yenileyemiyor,
/// cihazlarını göremiyor ve hesabını kapatamıyordu.

Future<void> showProfileSheet(BuildContext context) async {
  final state = context.read<AppState>();
  final user = state.user;
  if (user == null) return;

  final nameController = TextEditingController(text: user.name);
  final phoneController = TextEditingController(text: user.phone ?? '');
  final formKey = GlobalKey<FormState>();

  await _sheet(
    context,
    title: 'Kişisel bilgiler',
    builder: (sheetContext, setBusy, busy) => Form(
      key: formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextFormField(
            controller: nameController,
            enabled: !busy,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Ad Soyad'),
            validator: (value) =>
                (value ?? '').trim().length < 2 ? 'Adını yazar mısın?' : null,
          ),
          const SizedBox(height: 13),
          TextFormField(
            controller: phoneController,
            enabled: !busy,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Telefon (isteğe bağlı)',
              helperText: 'İşletme seni teslim konusunda arayabilsin diye.',
              helperMaxLines: 2,
            ),
            validator: (value) {
              final phone = (value ?? '').trim();
              if (phone.isEmpty) return null;
              // Sunucudaki desenin aynısı.
              return RegExp(r'^[0-9+\s()-]{10,20}$').hasMatch(phone)
                  ? null
                  : 'Telefon numarası geçersiz.';
            },
          ),
          const SizedBox(height: 20),
          TextField(
            enabled: false,
            controller: TextEditingController(text: user.email),
            decoration: const InputDecoration(
              labelText: 'E-posta',
              helperText: 'E-posta adresi değiştirilemez.',
            ),
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: 'Kaydet',
            loading: busy,
            onPressed: busy
                ? null
                : () async {
                    if (!(formKey.currentState?.validate() ?? false)) return;
                    setBusy(true);

                    final result = await state.updateProfile(
                      name: nameController.text.trim(),
                      phone: phoneController.text.trim().isEmpty
                          ? null
                          : phoneController.text.trim(),
                    );

                    if (!sheetContext.mounted) return;
                    setBusy(false);

                    switch (result) {
                      case Success():
                        Navigator.pop(sheetContext);
                        if (context.mounted) {
                          showInfoSnack(context, 'Bilgilerin güncellendi.');
                        }
                      case Failure(message: final message):
                        showErrorSnack(sheetContext, message);
                    }
                  },
          ),
        ],
      ),
    ),
  );

  nameController.dispose();
  phoneController.dispose();
}

Future<void> showChangePasswordSheet(BuildContext context) async {
  final state = context.read<AppState>();
  final currentController = TextEditingController();
  final newController = TextEditingController();
  final formKey = GlobalKey<FormState>();

  await _sheet(
    context,
    title: 'Şifre değiştir',
    builder: (sheetContext, setBusy, busy) => Form(
      key: formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Şifreni değiştirdiğinde diğer cihazlardaki oturumların kapanır; '
            'bu cihazda açık kalırsın.',
            style: TextStyle(fontSize: 12, height: 1.5, color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: currentController,
            enabled: !busy,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Mevcut şifren'),
            validator: (value) =>
                (value ?? '').isEmpty ? 'Mevcut şifreni gir.' : null,
          ),
          const SizedBox(height: 13),
          TextFormField(
            controller: newController,
            enabled: !busy,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Yeni şifre',
              helperText: 'En az 8 karakter, bir harf ve bir rakam.',
              helperMaxLines: 2,
            ),
            validator: (value) {
              final password = value ?? '';
              if (password.length < 8) return 'Şifre en az 8 karakter olmalı.';
              if (!RegExp(
                r'(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d)',
              ).hasMatch(password)) {
                return 'Şifre en az bir harf ve bir rakam içermeli.';
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: 'Şifreyi güncelle',
            loading: busy,
            onPressed: busy
                ? null
                : () async {
                    if (!(formKey.currentState?.validate() ?? false)) return;
                    setBusy(true);

                    final result = await state.changePassword(
                      currentController.text,
                      newController.text,
                    );

                    if (!sheetContext.mounted) return;
                    setBusy(false);

                    switch (result) {
                      case Success():
                        Navigator.pop(sheetContext);
                        if (context.mounted) {
                          showInfoSnack(context, 'Şifren güncellendi.');
                        }
                      case Failure(message: final message):
                        showErrorSnack(sheetContext, message);
                    }
                  },
          ),
        ],
      ),
    ),
  );

  currentController.dispose();
  newController.dispose();
}

/// Açık oturumlar (cihaz yönetimi).
Future<void> showSessionsSheet(BuildContext context) async {
  final state = context.read<AppState>();

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.cream,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (sheetContext) => _SessionsView(state: state),
  );
}

class _SessionsView extends StatefulWidget {
  const _SessionsView({required this.state});
  final AppState state;

  @override
  State<_SessionsView> createState() => _SessionsViewState();
}

class _SessionsViewState extends State<_SessionsView> {
  List<UserSession>? _sessions;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await widget.state.sessions();
    if (!mounted) return;

    setState(() {
      switch (result) {
        case Success(value: final list):
          _sessions = list;
          _error = null;
        case Failure(message: final message):
          _error = message;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Cihazlarım',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Hesabına açık olan oturumlar. Tanımadığın bir cihaz görürsen '
              'hemen kapat ve şifreni değiştir.',
              style: TextStyle(
                fontSize: 12,
                height: 1.5,
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 18),

            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger))
            else if (_sessions == null)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(color: AppColors.forest),
                ),
              )
            else
              ..._sessions!.map(
                (session) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(switch (session.platform.toUpperCase()) {
                    'IOS' => Icons.phone_iphone_rounded,
                    'ANDROID' => Icons.phone_android_rounded,
                    _ => Icons.computer_rounded,
                  }, color: AppColors.forest),
                  title: Text(
                    session.platformLabel +
                        (session.isCurrent ? ' · bu cihaz' : ''),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(
                    'Son kullanım: ${session.lastUsedLabel}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: session.isCurrent
                      ? null
                      : TextButton(
                          onPressed: _busy
                              ? null
                              : () async {
                                  setState(() => _busy = true);
                                  await widget.state.revokeSession(session.id);
                                  if (!mounted) return;
                                  setState(() => _busy = false);
                                  await _load();
                                },
                          child: const Text('Kapat'),
                        ),
                ),
              ),

            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _busy
                  ? null
                  : () async {
                      final confirmed = await _confirm(
                        context,
                        title: 'Tüm cihazlardan çık',
                        message:
                            'Bu cihaz dahil tüm oturumlar kapatılacak ve '
                            'yeniden giriş yapman gerekecek.',
                        action: 'Çıkış yap',
                      );
                      if (confirmed != true || !context.mounted) return;

                      await widget.state.logoutEverywhere();
                      if (context.mounted) context.go('/login');
                    },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Tüm cihazlardan çık'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hesap kapatma (KVKK).
Future<void> confirmDeleteAccount(BuildContext context) async {
  final state = context.read<AppState>();

  final confirmed = await _confirm(
    context,
    title: 'Hesabını kapat',
    message:
        'Kişisel bilgilerin anonimleştirilecek ve bu işlem geri alınamayacak.\n\n'
        'Sipariş ve fatura kayıtların vergi mevzuatı gereği saklanır ama '
        'artık kimliğinle ilişkilendirilemez.',
    action: 'Hesabımı kapat',
    destructive: true,
  );

  if (confirmed != true || !context.mounted) return;

  final result = await state.deleteAccount();
  if (!context.mounted) return;

  switch (result) {
    case Success():
      context.go('/login');
    case Failure(message: final message):
      showErrorSnack(context, message);
  }
}

// -----------------------------------------------------------------------------

Future<bool?> _confirm(
  BuildContext context, {
  required String title,
  required String message,
  required String action,
  bool destructive = false,
}) {
  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Vazgeç'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
              : null,
          child: Text(action),
        ),
      ],
    ),
  );
}

/// Form içeren alt sayfaların ortak kabuğu.
Future<void> _sheet(
  BuildContext context, {
  required String title,
  required Widget Function(
    BuildContext context,
    void Function(bool) setBusy,
    bool busy,
  )
  builder,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.cream,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (sheetContext) => _BusyScope(
      builder: (scopeContext, isBusy, setBusy) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          22,
          20,
          MediaQuery.viewInsetsOf(scopeContext).bottom + 24,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(scopeContext).textTheme.headlineMedium,
              ),
              const SizedBox(height: 18),
              builder(scopeContext, setBusy, isBusy),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Alt sayfa içinde "meşgul" durumunu taşır.
class _BusyScope extends StatefulWidget {
  const _BusyScope({required this.builder});

  final Widget Function(BuildContext, bool, void Function(bool)) builder;

  @override
  State<_BusyScope> createState() => _BusyScopeState();
}

class _BusyScopeState extends State<_BusyScope> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) =>
      widget.builder(context, _busy, (value) => setState(() => _busy = value));
}
