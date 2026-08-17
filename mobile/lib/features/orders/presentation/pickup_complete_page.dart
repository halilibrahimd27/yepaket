import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// Teslim sonrası kutlama ekranı.
///
/// Sipariş kimliği yol parametresinden gelir: teslim alındıktan sonra sipariş
/// artık "aktif" sayılmadığı için `activeOrder` üzerinden bulunamıyordu ve
/// ekran her zaman "İşletme" yazıyordu.
class PickupCompletePage extends StatelessWidget {
  const PickupCompletePage({required this.orderId, super.key});

  final String orderId;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final order = state.orderById(orderId);

    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Teslim alındı')),
        body: AsyncContent(
          isLoading: false,
          error: null,
          isEmpty: true,
          emptyTitle: 'Sipariş bulunamadı',
          emptyMessage: 'Siparişlerin sayfasından takip edebilirsin.',
          emptyIcon: Icons.receipt_long_outlined,
          onRetry: () => context.go('/orders'),
          builder: (_) => const SizedBox.shrink(),
        ),
      );
    }

    // Etki değerleri bu siparişten hesaplanır; eskiden sabit "2,7 kg / 281 ₺"
    // yazıyordu ve her sipariş için aynı görünüyordu (O1).
    final impact = order.impact;

    return Scaffold(
      body: SafeArea(
        child: ResponsiveContent(
          maxWidth: 560,
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 28),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  onPressed: () => context.go('/home'),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              const Spacer(),
              Container(
                width: 170,
                height: 170,
                decoration: BoxDecoration(
                  color: AppColors.limeSoft,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: const Icon(
                  Icons.shopping_bag_rounded,
                  color: AppColors.forest,
                  size: 79,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                'Sen bir kahramansın!',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displayMedium,
              ),
              const SizedBox(height: 13),
              Text(
                '${order.bag.store} paketini çöpe gitmekten kurtardın.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.5,
                  color: AppColors.muted,
                ),
              ),
              const SizedBox(height: 25),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.forest,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _MiniImpact(value: impact.co2Label, label: 'CO₂e'),
                    _MiniImpact(
                      value: Formats.money(impact.moneySavedMinor),
                      label: 'tasarruf',
                    ),
                    _MiniImpact(value: '+${order.quantity}', label: 'paket'),
                  ],
                ),
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Deneyimini değerlendir',
                onPressed: () => context.go('/rating/${order.id}'),
              ),
              const SizedBox(height: 9),
              OutlinedButton.icon(
                onPressed: () => _share(context, order, impact),
                icon: const Icon(Icons.ios_share_rounded),
                label: const Text('Başarımı paylaş'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _share(
    BuildContext context,
    AppOrder order,
    UserImpact impact,
  ) async {
    final text =
        'YePaket ile ${order.bag.store} işletmesinden ${order.quantity} paket '
        'kurtardım. ${impact.co2Label} CO₂e tasarrufu ve '
        '${Formats.money(impact.moneySavedMinor)} cebimde kaldı! 🌱';

    await SharePlus.instance.share(ShareParams(text: text));
  }
}

class _MiniImpact extends StatelessWidget {
  const _MiniImpact({required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: const TextStyle(
          fontSize: 19,
          fontWeight: FontWeight.w900,
          color: AppColors.lime,
        ),
      ),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white54)),
    ],
  );
}
