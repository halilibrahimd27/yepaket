import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_config.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/responsive_content.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().refreshNotificationPreferences();
    });
  }

  /// Tercihi günceller; sunucu reddederse anahtar eski hâline döner.
  Future<void> _update(NotificationPreferences next) async {
    final result = await context.read<AppState>().updateNotificationPreferences(
      next,
    );

    if (!mounted) return;
    if (result case Failure(message: final message)) {
      showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final user = state.user;
    final prefs = state.notificationPreferences;
    return Scaffold(
      appBar: AppBar(title: const Text('Ayarlar')),
      body: ResponsiveContent(
        maxWidth: 680,
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        child: ListView(
          children: [
            _Section(
              title: 'Hesap',
              children: [
                _SettingsTile(
                  icon: Icons.person_outline_rounded,
                  title: 'Kişisel bilgiler',
                  subtitle: user == null
                      ? 'Giriş yapılmadı'
                      : '${user.name} · ${user.email}',
                ),
                _SettingsTile(
                  icon: Icons.lock_outline_rounded,
                  title: 'Şifre değiştir',
                  subtitle: 'Tüm cihazlardaki oturumlar kapanır',
                  onTap: () => context.push('/sifremi-unuttum'),
                ),
                // Kart bilgisi uygulamada saklanmıyor: ödeme, sağlayıcının
                // 3D Secure sayfasında alınıyor. Eskiden burada uydurma bir
                // kart ("Visa •••• 4242") yazıyordu.
                const _SettingsTile(
                  icon: Icons.credit_card_rounded,
                  title: 'Ödeme',
                  subtitle: 'Kart bilgin uygulamada saklanmaz',
                ),
              ],
            ),
            const SizedBox(height: 22),
            _Section(
              title: 'Bildirimler',
              children: [
                SwitchListTile(
                  value: prefs.bagAvailable,
                  onChanged: user == null
                      ? null
                      : (value) => _update(prefs.copyWith(bagAvailable: value)),
                  title: const Text(
                    'Favori paket uyarıları',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'Favori işletmen yeni paket yayınladığında',
                    style: TextStyle(fontSize: 11),
                  ),
                  secondary: const Icon(Icons.favorite_border_rounded),
                ),
                SwitchListTile(
                  value: prefs.orderUpdates,
                  onChanged: user == null
                      ? null
                      : (value) => _update(prefs.copyWith(orderUpdates: value)),
                  title: const Text(
                    'Sipariş hatırlatmaları',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'Teslim saati yaklaştığında hatırlatırız',
                    style: TextStyle(fontSize: 11),
                  ),
                  secondary: const Icon(Icons.notifications_none_rounded),
                ),
                SwitchListTile(
                  value: prefs.impactDigest,
                  onChanged: user == null
                      ? null
                      : (value) => _update(prefs.copyWith(impactDigest: value)),
                  title: const Text(
                    'Etki özeti',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  secondary: const Icon(Icons.eco_outlined),
                ),
                SwitchListTile(
                  value: prefs.campaigns,
                  onChanged: user == null
                      ? null
                      : (value) => _update(prefs.copyWith(campaigns: value)),
                  title: const Text(
                    'Kampanya ve duyurular',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  secondary: const Icon(Icons.campaign_outlined),
                ),
              ],
            ),
            const SizedBox(height: 22),
            _Section(
              title: 'Uygulama',
              children: [
                const _SettingsTile(
                  icon: Icons.language_rounded,
                  title: 'Dil',
                  subtitle: 'Türkçe',
                ),
                _SettingsTile(
                  icon: Icons.help_outline_rounded,
                  title: 'Yardım merkezi',
                  subtitle: 'SSS ve destek',
                  onTap: () => context.push('/support'),
                ),
                _SettingsTile(
                  icon: Icons.privacy_tip_outlined,
                  title: 'Gizlilik ve koşullar',
                  subtitle: 'Kullanım koşulları, KVKK aydınlatma metni',
                  onTap: () => _openLegal(context),
                ),
                const _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  title: 'Sürüm',
                  subtitle: ApiConfig.appVersion,
                ),
              ],
            ),
            const SizedBox(height: 22),
            OutlinedButton.icon(
              onPressed: () async {
                await context.read<AppState>().signOut();
                if (context.mounted) context.go('/login');
              },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Çıkış yap'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(left: 5, bottom: 9),
        child: Text(title, style: Theme.of(context).textTheme.titleMedium),
      ),
      Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(23),
        ),
        child: Column(children: children),
      ),
    ],
  );
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => ListTile(
    onTap: onTap,
    leading: Icon(icon, color: AppColors.forest),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
    subtitle: Text(
      subtitle,
      style: const TextStyle(fontSize: 10, color: AppColors.muted),
    ),
    trailing: const Icon(Icons.chevron_right_rounded, size: 19),
  );
}

/// Yasal metin seçeneklerini gösterir.
///
/// Uygulama içinde tutmak yerine web'e yönlendiriyoruz: metinler hukuk
/// tarafından güncellendiğinde uygulama sürümü beklemeden yayına girsin.
///
/// Eskiden tek bir `/yasal` adresi açılıyordu; web tarafında böyle bir sayfa
/// yok — metinler `/gizlilik` ve `/kosullar` altında.
Future<void> _openLegal(BuildContext context) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: AppColors.cream,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 16),
          Text('Yasal metinler', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Gizlilik ve KVKK aydınlatma metni'),
            onTap: () => Navigator.pop(sheetContext, '/gizlilik'),
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text('Kullanım koşulları'),
            onTap: () => Navigator.pop(sheetContext, '/kosullar'),
          ),
          ListTile(
            leading: const Icon(Icons.replay_outlined),
            title: const Text('İptal ve iade koşulları'),
            onTap: () => Navigator.pop(sheetContext, '/kosullar#7'),
          ),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );

  if (choice == null || !context.mounted) return;

  final url = Uri.parse('${ApiConfig.webUrl}$choice');
  final opened = await launchUrl(url, mode: LaunchMode.externalApplication);

  if (!opened && context.mounted) {
    showErrorSnack(context, 'Sayfa açılamadı: $url');
  }
}
