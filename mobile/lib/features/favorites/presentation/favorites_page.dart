import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/bag_card.dart';
import '../../../shared/widgets/responsive_content.dart';

class FavoritesPage extends StatelessWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final favorites = context.watch<AppState>().favoriteBags;
    return SafeArea(
      bottom: false,
      child: ResponsiveContent(
        maxWidth: 820,
        padding: const EdgeInsets.fromLTRB(18, 22, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Favorilerin',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: () => context.push('/notifications'),
                  tooltip: 'Bildirimler',
                  icon: const Icon(Icons.notifications_active_outlined),
                ),
              ],
            ),
            const SizedBox(height: 7),
            const Text(
              'Yeniden satışa çıktıklarında sana haber veririz.',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: favorites.isEmpty
                  ? const _EmptyFavorites()
                  : ListView.separated(
                      itemCount: favorites.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 13),
                      itemBuilder: (context, index) =>
                          BagCard(bag: favorites[index], compact: true),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyFavorites extends StatelessWidget {
  const _EmptyFavorites();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 90,
            height: 90,
            decoration: const BoxDecoration(
              color: AppColors.limeSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.favorite_border_rounded,
              color: AppColors.forest,
              size: 37,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Henüz favorin yok',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Beğendiğin paketlerde kalbe dokun.',
            style: TextStyle(color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}
