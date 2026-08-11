import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/app_image.dart';
import '../../../shared/widgets/primary_button.dart';

class BagDetailPage extends StatelessWidget {
  const BagDetailPage({required this.bagId, super.key});
  final String bagId;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final bag = state.bagById(bagId);
    final favorite = state.favoriteIds.contains(bag.id);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 310,
            pinned: true,
            backgroundColor: AppColors.forest,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  AppImage(bag.imageAsset),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0x55000000),
                          Colors.transparent,
                          Color(0xAA0B3B2E),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 26,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          bag.store,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          bag.title,
                          style: const TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -1.1,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: IconButton.filled(
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: .92),
                    foregroundColor: favorite
                        ? AppColors.danger
                        : AppColors.forest,
                  ),
                  onPressed: () => state.toggleFavorite(bag.id),
                  icon: Icon(
                    favorite
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                  ),
                ),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 20, 18, 110),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  bag.category.label,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.1,
                                    color: AppColors.muted,
                                  ),
                                ),
                                const SizedBox(height: 7),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.star_rounded,
                                      color: Color(0xFFF6B91C),
                                      size: 19,
                                    ),
                                    Text(
                                      ' ${bag.rating} (${bag.reviewCount})',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.forest,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 15,
                              vertical: 11,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.limeSoft,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${bag.originalPrice} ₺',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.muted,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                                Text(
                                  '${bag.price} ₺',
                                  style: const TextStyle(
                                    fontSize: 25,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.forest,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      _InfoTile(
                        icon: Icons.schedule_rounded,
                        title: 'Teslim zamanı',
                        value: bag.pickupLabel,
                        accent: true,
                      ),
                      const SizedBox(height: 10),
                      _InfoTile(
                        icon: Icons.location_on_outlined,
                        title: 'Adres',
                        value: bag.address,
                      ),
                      const SizedBox(height: 28),
                      Text(
                        'Pakette neler olabilir?',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 9),
                      Text(
                        bag.description,
                        style: const TextStyle(
                          fontSize: 15,
                          height: 1.6,
                          color: AppColors.muted,
                        ),
                      ),
                      const SizedBox(height: 13),
                      const Row(
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            size: 16,
                            color: AppColors.muted,
                          ),
                          SizedBox(width: 7),
                          Expanded(
                            child: Text(
                              'Tam içerik işletmenin o gün kalan ürünlerine göre değişir.',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.muted,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      Text(
                        'Topluluk deneyimi',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 14),
                      _RatingBar(
                        label: 'Yemek kalitesi',
                        value: .96,
                        score: '4.9',
                      ),
                      const SizedBox(height: 12),
                      _RatingBar(
                        label: 'Teslim deneyimi',
                        value: .92,
                        score: '4.7',
                      ),
                      const SizedBox(height: 28),
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: AppColors.line),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.eco_rounded, color: AppColors.limeDark),
                            SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Bu paketi kurtarmak yaklaşık 2,7 kg CO₂e salımını önlemeye yardımcı olur.',
                                style: TextStyle(
                                  fontSize: 12,
                                  height: 1.5,
                                  color: AppColors.forest,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Color(0x17000000),
                blurRadius: 22,
                offset: Offset(0, -8),
              ),
            ],
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: PrimaryButton(
              label: 'Rezerve et · ${bag.price} ₺',
              onPressed: () => context.push('/checkout/${bag.id}'),
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.value,
    this.accent = false,
  });
  final IconData icon;
  final String title;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: accent ? AppColors.lime : Colors.white,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: accent ? Colors.transparent : AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: accent
                  ? Colors.white.withValues(alpha: .65)
                  : AppColors.limeSoft,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.forest, size: 21),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 10, color: AppColors.muted),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.35,
                    fontWeight: FontWeight.w900,
                    color: AppColors.forest,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.forest),
        ],
      ),
    );
  }
}

class _RatingBar extends StatelessWidget {
  const _RatingBar({
    required this.label,
    required this.value,
    required this.score,
  });
  final String label;
  final double value;
  final String score;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: AppColors.muted,
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: value,
              minHeight: 7,
              color: AppColors.forest,
              backgroundColor: AppColors.line,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          score,
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: AppColors.forest,
          ),
        ),
      ],
    );
  }
}
