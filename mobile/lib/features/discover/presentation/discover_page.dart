import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../data/models/models.dart';
import '../../../core/location/location_service.dart';
import '../../../data/state/app_state.dart';
import '../../home/presentation/main_shell_page.dart';
import '../../../shared/widgets/bag_card.dart';
import '../../../shared/widgets/responsive_content.dart';

class DiscoverPage extends StatelessWidget {
  const DiscoverPage({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return SafeArea(
      bottom: false,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: ResponsiveContent(
              maxWidth: 900,
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: const BoxDecoration(
                          color: AppColors.forest,
                          borderRadius: BorderRadius.all(Radius.circular(15)),
                        ),
                        child: const Icon(
                          Icons.location_on_rounded,
                          color: AppColors.lime,
                          size: 21,
                        ),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        // Sabit "Kadıköy, İstanbul" yazıyordu; artık gerçek
                        // konumdan (ya da izin durumundan) geliyor.
                        child: GestureDetector(
                          onTap: () => _handleLocationTap(context, state),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Konumun',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.muted,
                                ),
                              ),
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      state.locationLabel,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.forest,
                                      ),
                                    ),
                                  ),
                                  if (!state.hasLocation) ...[
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.my_location_rounded,
                                      size: 14,
                                      color: AppColors.forest,
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      _NotificationBell(
                        unread: state.unreadNotificationCount,
                        onPressed: () => context.push('/notifications'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 26),
                  Text(
                    'Merhaba ${state.user?.name.split(' ').first ?? 'misafir'} 👋',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 5),
                  const Text(
                    'Bugün ne kurtarıyoruz?',
                    style: TextStyle(fontSize: 15, color: AppColors.muted),
                  ),
                  const SizedBox(height: 21),
                  TextField(
                    readOnly: true,
                    // Keşif ekranındaki alan yalnızca bir giriş noktası;
                    // asıl arama harita/liste sekmesinde yapılıyor.
                    onTap: () => MainShellPage.goToTab(context, 1),
                    decoration: const InputDecoration(
                      hintText: 'Paket veya işletme ara',
                      prefixIcon: Icon(Icons.search_rounded),
                      suffixIcon: Icon(Icons.tune_rounded),
                    ),
                  ),
                  if (state.activeOrder != null &&
                      state.activeOrder!.status.isActive) ...[
                    const SizedBox(height: 16),
                    _ActiveOrderBanner(
                      order: state.activeOrder!,
                      onTap: () => context.push('/active-order'),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 47,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: BagCategory.values.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final category = BagCategory.values[index];
                        return ChoiceChip(
                          selected: state.selectedCategory == category,
                          onSelected: (_) => state.selectCategory(category),
                          label: Text(category.label),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 28),
                  _SectionHeader(
                    title: 'Sana özel',
                    action: 'Tümünü gör',
                    onTap: () => MainShellPage.goToTab(context, 1),
                  ),
                  const SizedBox(height: 13),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            sliver: SliverLayoutBuilder(
              builder: (context, constraints) {
                final crossAxisCount = constraints.crossAxisExtent >= 760
                    ? 3
                    : constraints.crossAxisExtent >= 540
                    ? 2
                    : 1;
                return SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 14,
                    childAspectRatio: crossAxisCount == 1 ? .88 : .74,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => BagCard(bag: state.filteredBags[index]),
                    childCount: state.filteredBags.length,
                  ),
                );
              },
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
          SliverToBoxAdapter(
            child: ResponsiveContent(
              maxWidth: 900,
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.forest,
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Her paket bir fark.',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 7),
                          Text(
                            // Sabit "1.204 kg" yazıyordu; sunucuda
                            // /impact/community ucu baştan beri vardı.
                            state.communityImpact == null
                                ? 'Topluluk her gün gıdayı çöpten kurtarıyor.'
                                : 'Topluluk şimdiye kadar '
                                      '${state.communityImpact!.co2Label} '
                                      'CO₂e önledi.',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white60,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 55,
                      height: 55,
                      decoration: const BoxDecoration(
                        color: AppColors.lime,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.eco_rounded,
                        color: AppColors.forest,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 28)),
        ],
      ),
    );
  }
}

class _ActiveOrderBanner extends StatelessWidget {
  const _ActiveOrderBanner({required this.order, required this.onTap});
  final AppOrder order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.lime,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.shopping_bag_rounded, color: AppColors.forest),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Yaklaşan teslimin var',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                    // Sabit metin yerine gerçek sipariş bilgisi (O1).
                    Text(
                      '${order.bag.store} · ${order.pickupLabel}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.forest,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_rounded, color: AppColors.forest),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.action,
    required this.onTap,
  });
  final String title;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        TextButton(onPressed: onTap, child: Text(action)),
      ],
    );
  }
}

/// Konum çubuğuna dokunulduğunda ne olacağı.
///
/// Konum yoksa izin istenir. Kullanıcı daha önce kalıcı olarak reddettiyse
/// izin penceresi bir daha açılmaz; bu durumda sistem ayarlarına yönlendirmek
/// tek çözümdür — aksi hâlde dokunuş hiçbir şey yapmıyor gibi görünürdü.
Future<void> _handleLocationTap(BuildContext context, AppState state) async {
  if (state.hasLocation) {
    // Konum zaten var; kullanıcı tazelemek istiyor olabilir.
    await state.requestLocation();
    return;
  }

  final outcome = await state.requestLocation();
  if (!context.mounted) return;

  switch (outcome) {
    case LocationOutcome.granted:
      return;

    case LocationOutcome.deniedForever:
      final open = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Konum izni kapalı'),
          content: const Text(
            'Yakınındaki paketleri ve mesafeleri gösterebilmek için konum '
            'iznine ihtiyacımız var. Ayarlardan açabilirsin.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Şimdi değil'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Ayarları aç'),
            ),
          ],
        ),
      );
      if (open == true) await state.openLocationSettings();

    case LocationOutcome.serviceDisabled:
      if (context.mounted) {
        showInfoSnack(
          context,
          'Cihazının konum servisi kapalı. Açtıktan sonra tekrar dene.',
        );
      }

    case LocationOutcome.denied:
    case LocationOutcome.failed:
      if (context.mounted) {
        showInfoSnack(
          context,
          'Konum alınamadı. Şehir genelindeki paketleri gösteriyoruz.',
        );
      }
  }
}

/// Okunmamış sayısını rozetle gösteren bildirim zili.
///
/// Sunucu `/notifications/unread-count` ucunu özellikle rozet için sunuyordu
/// ama hiçbir ekran çağırmıyordu: kullanıcı bildirimler sayfasını açmadan
/// yeni bir şey olduğunu anlayamıyordu.
class _NotificationBell extends StatelessWidget {
  const _NotificationBell({required this.unread, required this.onPressed});

  final int unread;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton.filledTonal(
          onPressed: onPressed,
          tooltip: 'Bildirimler',
          icon: const Icon(Icons.notifications_none_rounded),
        ),
        if (unread > 0)
          Positioned(
            right: 2,
            top: 2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              constraints: const BoxConstraints(minWidth: 18),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.cream, width: 1.5),
              ),
              child: Text(
                unread > 9 ? '9+' : '$unread',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
