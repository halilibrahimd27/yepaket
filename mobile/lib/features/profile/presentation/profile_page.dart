import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/network/api_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/app_image.dart';
import '../../../shared/widgets/responsive_content.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final impact = state.impact;
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        child: ResponsiveContent(
          maxWidth: 760,
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 30),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: AppColors.lime,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      state.user?.initials ?? 'YP',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          state.user?.name ?? 'Misafir',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: AppColors.forest,
                          ),
                        ),
                        Text(
                          state.user?.email ?? '',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton.filledTonal(
                    onPressed: () => context.push('/settings'),
                    icon: const Icon(Icons.settings_outlined),
                    tooltip: 'Ayarlar',
                  ),
                ],
              ),
              const SizedBox(height: 26),
              if (state.activeOrder != null &&
                  state.activeOrder!.status.isActive) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Yaklaşan teslim',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/orders'),
                      child: const Text('Tümü'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _OrderCard(
                  order: state.activeOrder!,
                  onTap: () => context.push('/active-order'),
                ),
                const SizedBox(height: 26),
              ],
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Etkin',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const Text(
                          'Kurtardığın her paket gerçek bir fark yaratır.',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.limeSoft,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: const Text(
                      'CANLI ETKİ',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .7,
                        color: AppColors.forest,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 11),
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns = constraints.maxWidth >= 650 ? 4 : 2;
                  return GridView.count(
                    crossAxisCount: columns,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: columns == 4 ? 1.02 : .96,
                    children: [
                      _ImpactCard(
                        index: '01',
                        asset: 'assets/icons/rescued-bag.svg',
                        value: '${impact.savedBags}',
                        label: 'paket kurtarıldı',
                        background: AppColors.limeSoft,
                      ),
                      _ImpactCard(
                        index: '02',
                        asset: 'assets/icons/savings.svg',
                        value: impact.moneySavedLabel,
                        label: 'tasarruf edildi',
                      ),
                      _ImpactCard(
                        index: '03',
                        asset: 'assets/icons/co2-leaf.svg',
                        value: impact.co2Label,
                        label: 'CO₂e önlendi',
                      ),
                      _ImpactCard(
                        index: '04',
                        asset: 'assets/icons/water-drop.svg',
                        value: impact.waterLabel,
                        label: 'su korundu',
                        background: const Color(0xFFE8F4F1),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: AppColors.forest,
                  borderRadius: BorderRadius.circular(27),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            impact.level.label,
                            style: const TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 6),
                          // Sabit metin ve %72'lik sabit çubuk yerine gerçek
                          // ilerleme; sıfır paketle "%72 doldu" göstermek
                          // kullanıcıyı yanıltıyordu (O1).
                          Text(
                            impact.bagsToNextLevel == 0
                                ? 'En üst seviyedesin. Kurtarmaya devam!'
                                : '${impact.bagsToNextLevel} paket daha kurtar, '
                                      '${impact.level.next!.label}\'ye ulaş.',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.white60,
                            ),
                          ),
                          const SizedBox(height: 13),
                          ClipRRect(
                            borderRadius: const BorderRadius.all(
                              Radius.circular(99),
                            ),
                            child: LinearProgressIndicator(
                              value: impact.levelProgress,
                              minHeight: 7,
                              color: AppColors.lime,
                              backgroundColor: Colors.white12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 18),
                    Container(
                      width: 66,
                      height: 66,
                      padding: const EdgeInsets.all(5),
                      decoration: const BoxDecoration(
                        color: Colors.white10,
                        shape: BoxShape.circle,
                      ),
                      child: SvgPicture.asset('assets/icons/co2-leaf.svg'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 26),
              _MenuTile(
                icon: Icons.receipt_long_outlined,
                title: 'Siparişlerim',
                subtitle: 'Aktif ve geçmiş siparişler',
                onTap: () => context.push('/orders'),
              ),
              _MenuTile(
                icon: Icons.inventory_2_outlined,
                title: 'Fazla stok kolileri',
                subtitle: 'Kargoyla gelen sürpriz ürün seçkileri',
                onTap: () => context.push('/parcels'),
              ),
              _MenuTile(
                icon: Icons.notifications_none_rounded,
                title: 'Bildirimler',
                subtitle: 'Paket ve sipariş güncellemeleri',
                onTap: () => context.push('/notifications'),
              ),
              _MenuTile(
                icon: Icons.help_outline_rounded,
                title: 'Yardım merkezi',
                subtitle: 'SSS ve destek talebi',
                onTap: () => context.push('/support'),
              ),
              _MenuTile(
                icon: Icons.person_add_alt_1_rounded,
                title: 'Arkadaşını davet et',
                subtitle: 'Birlikte daha çok paket kurtarın',
                // Eskiden "panoya kopyalandı" diyip hiçbir şey yapmıyordu.
                onTap: () => _invite(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onTap});
  final AppOrder order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(25),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(25),
        child: Padding(
          padding: const EdgeInsets.all(13),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: AppImage(
                  order.bag.imageAsset,
                  width: 78,
                  height: 78,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.limeSoft,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: const Text(
                        'TESLİM BEKLİYOR',
                        style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          color: AppColors.forest,
                        ),
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      order.bag.store,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      order.pickupLabel,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.forest),
            ],
          ),
        ),
      ),
    );
  }
}

class _ImpactCard extends StatelessWidget {
  const _ImpactCard({
    required this.index,
    required this.asset,
    required this.value,
    required this.label,
    this.background = Colors.white,
  });
  final String index;
  final String asset;
  final String value;
  final String label;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(23),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                index,
                style: const TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w900,
                  letterSpacing: .8,
                  color: AppColors.muted,
                ),
              ),
              const Spacer(),
              SvgPicture.asset(asset, width: 48, height: 48),
            ],
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w900,
              color: AppColors.forest,
            ),
          ),
          Text(
            label,
            style: const TextStyle(fontSize: 9, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
        child: ListTile(
          onTap: onTap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(21),
          ),
          leading: Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
              color: AppColors.limeSoft,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.forest, size: 20),
          ),
          title: Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              color: AppColors.forest,
            ),
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(fontSize: 10, color: AppColors.muted),
          ),
          trailing: const Icon(Icons.chevron_right_rounded),
        ),
      ),
    );
  }
}

/// Uygulamayı paylaşır.
Future<void> _invite(BuildContext context) async {
  await SharePlus.instance.share(
    ShareParams(
      text:
          'YePaket ile mahallendeki sürpriz paketleri üçte bir fiyatına '
          'kurtarıyorum. Sen de dene: ${ApiConfig.webUrl}',
      subject: 'YePaket',
    ),
  );
}
