import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class OrderSuccessPage extends StatelessWidget {
  const OrderSuccessPage({required this.orderId, super.key});

  final String orderId;

  @override
  Widget build(BuildContext context) {
    // Siparişe kimliğiyle bakılır: kullanıcının aynı anda birden çok aktif
    // siparişi olabilir ve `activeOrder` yanlışını gösterebilirdi.
    final order = context.watch<AppState>().orderById(orderId);
    return Scaffold(
      backgroundColor: AppColors.forest,
      body: SafeArea(
        child: ResponsiveContent(
          maxWidth: 560,
          padding: const EdgeInsets.all(22),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  onPressed: () => context.go('/home'),
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                ),
              ),
              const Spacer(),
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 190,
                    height: 190,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.lime.withValues(alpha: .14),
                    ),
                  ),
                  Container(
                    width: 136,
                    height: 136,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.lime,
                    ),
                    child: const Icon(
                      Icons.shopping_bag_rounded,
                      size: 61,
                      color: AppColors.forest,
                    ),
                  ),
                  const Positioned(
                    left: 8,
                    top: 24,
                    child: Icon(
                      Icons.auto_awesome,
                      color: AppColors.lime,
                      size: 25,
                    ),
                  ),
                  const Positioned(
                    right: 3,
                    bottom: 30,
                    child: Icon(
                      Icons.eco_rounded,
                      color: AppColors.lime,
                      size: 28,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 34),
              const Text(
                'Paketin senin!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 43,
                  height: 1,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1.9,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 13),
              Text(
                order == null
                    ? 'Rezervasyonun oluşturuldu.'
                    : '${order.bag.store} seni ${order.pickupLabel.toLowerCase()} bekliyor.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.5,
                  color: Colors.white60,
                ),
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(23),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.eco_rounded, color: AppColors.lime),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Bu siparişle yaklaşık ${2.7 * (order?.quantity ?? 1)} kg CO₂e önlemeye yardım ettin.',
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.45,
                          color: Colors.white70,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Siparişimi görüntüle',
                backgroundColor: AppColors.lime,
                foregroundColor: AppColors.forest,
                onPressed: () => context.go('/active-order'),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => context.go('/home'),
                child: const Text(
                  'Keşfetmeye devam et',
                  style: TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
