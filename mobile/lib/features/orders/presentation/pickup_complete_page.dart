import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class PickupCompletePage extends StatelessWidget {
  const PickupCompletePage({super.key});

  @override
  Widget build(BuildContext context) {
    final order = context.read<AppState>().activeOrder;
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
                '${order?.bag.store ?? 'İşletme'} paketini çöpe gitmekten kurtardın.',
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
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _MiniImpact(value: '2,7 kg', label: 'CO₂e'),
                    _MiniImpact(value: '281 ₺', label: 'tasarruf'),
                    _MiniImpact(value: '+1', label: 'paket'),
                  ],
                ),
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Deneyimini değerlendir',
                onPressed: () => context.go('/rating'),
              ),
              const SizedBox(height: 9),
              OutlinedButton.icon(
                onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Paylaşım kartı hazırlandı.')),
                ),
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
