import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/responsive_content.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool packageAlerts = true;
  bool orderAlerts = true;
  bool impactNews = false;

  @override
  Widget build(BuildContext context) {
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
                const _SettingsTile(
                  icon: Icons.person_outline_rounded,
                  title: 'Kişisel bilgiler',
                  subtitle: 'Sefa GÜR · sefa@example.com',
                ),
                const _SettingsTile(
                  icon: Icons.location_on_outlined,
                  title: 'Konumlarım',
                  subtitle: 'Kadıköy, İstanbul',
                ),
                const _SettingsTile(
                  icon: Icons.credit_card_rounded,
                  title: 'Ödeme yöntemleri',
                  subtitle: 'Visa •••• 4242',
                ),
              ],
            ),
            const SizedBox(height: 22),
            _Section(
              title: 'Bildirimler',
              children: [
                SwitchListTile(
                  value: packageAlerts,
                  onChanged: (value) => setState(() => packageAlerts = value),
                  title: const Text(
                    'Favori paket uyarıları',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  secondary: const Icon(Icons.favorite_border_rounded),
                ),
                SwitchListTile(
                  value: orderAlerts,
                  onChanged: (value) => setState(() => orderAlerts = value),
                  title: const Text(
                    'Sipariş hatırlatmaları',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  secondary: const Icon(Icons.notifications_none_rounded),
                ),
                SwitchListTile(
                  value: impactNews,
                  onChanged: (value) => setState(() => impactNews = value),
                  title: const Text(
                    'Etki haberleri',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  secondary: const Icon(Icons.eco_outlined),
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
                const _SettingsTile(
                  icon: Icons.privacy_tip_outlined,
                  title: 'Gizlilik ve koşullar',
                  subtitle: 'Sürüm 1.0.0',
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
