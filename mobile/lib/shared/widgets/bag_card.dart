import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models/models.dart';
import '../../data/state/app_state.dart';
import 'app_image.dart';

class BagCard extends StatelessWidget {
  const BagCard({required this.bag, this.compact = false, super.key});

  final SurpriseBag bag;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final isFavorite = context.select<AppState, bool>(
      (state) => state.favoriteIds.contains(bag.id),
    );
    return Semantics(
      button: true,
      label: '${bag.store}, ${bag.title}, ${bag.price} lira',
      child: InkWell(
        onTap: () => context.push('/bag/${bag.id}'),
        borderRadius: BorderRadius.circular(26),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: AppColors.line),
          ),
          child: compact
              ? _compact(context, isFavorite)
              : _regular(context, isFavorite),
        ),
      ),
    );
  }

  Widget _regular(BuildContext context, bool isFavorite) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: 1.5,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(25),
                ),
                child: AppImage(bag.imageAsset),
              ),
              Positioned(
                top: 12,
                right: 12,
                child: _favoriteButton(context, isFavorite),
              ),
              Positioned(
                left: 12,
                bottom: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.lime,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'SON ${bag.availableQuantity} PAKET',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: AppColors.forest,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 15, 16, 17),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      bag.store.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.1,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.star_rounded,
                    color: Color(0xFFF6B91C),
                    size: 17,
                  ),
                  Text(
                    ' ${bag.rating}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              Text(
                bag.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 11),
              Row(
                children: [
                  const Icon(
                    Icons.schedule_rounded,
                    size: 15,
                    color: AppColors.muted,
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      bag.pickupLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 13),
              Row(
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
                  const SizedBox(width: 3),
                  Text(
                    '${bag.price} ₺',
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.7,
                      color: AppColors.forest,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${bag.distanceKm.toStringAsFixed(bag.distanceKm < 1 ? 2 : 1)} km',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.muted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _compact(BuildContext context, bool isFavorite) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final dense =
            constraints.hasBoundedHeight && constraints.maxHeight < 125;
        final imageSize = dense
            ? (constraints.maxHeight - 20).clamp(68.0, 98.0)
            : 98.0;
        return Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(dense ? 15 : 18),
                child: AppImage(
                  bag.imageAsset,
                  width: imageSize,
                  height: imageSize,
                  fit: BoxFit.cover,
                ),
              ),
              SizedBox(width: dense ? 10 : 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      bag.store.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: dense ? 8 : 9,
                        height: 1.1,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .9,
                        color: AppColors.muted,
                      ),
                    ),
                    SizedBox(height: dense ? 2 : 3),
                    Text(
                      bag.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: dense ? 15 : null,
                        height: dense ? 1.15 : null,
                      ),
                    ),
                    SizedBox(height: dense ? 3 : 8),
                    Text(
                      bag.pickupLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: dense ? 9 : 10,
                        height: 1.1,
                        color: AppColors.muted,
                      ),
                    ),
                    SizedBox(height: dense ? 1 : 5),
                    Text(
                      '${bag.price} ₺',
                      style: TextStyle(
                        fontSize: dense ? 17 : 18,
                        height: 1.1,
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                  ],
                ),
              ),
              _favoriteButton(context, isFavorite, compact: dense),
            ],
          ),
        );
      },
    );
  }

  Widget _favoriteButton(
    BuildContext context,
    bool isFavorite, {
    bool compact = false,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: .92),
      shape: const CircleBorder(),
      child: IconButton(
        onPressed: () => context.read<AppState>().toggleFavorite(bag.id),
        icon: Icon(
          isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        ),
        iconSize: compact ? 20 : null,
        visualDensity: compact ? VisualDensity.compact : null,
        color: isFavorite ? AppColors.danger : AppColors.forest,
        tooltip: isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle',
      ),
    );
  }
}
