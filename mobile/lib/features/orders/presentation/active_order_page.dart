import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/app_image.dart';
import '../../../shared/widgets/responsive_content.dart';

class ActiveOrderPage extends StatefulWidget {
  const ActiveOrderPage({super.key});

  @override
  State<ActiveOrderPage> createState() => _ActiveOrderPageState();
}

class _ActiveOrderPageState extends State<ActiveOrderPage> {
  double slider = 0;
  bool completing = false;

  Future<void> complete() async {
    if (completing) return;
    setState(() => completing = true);
    await context.read<AppState>().completePickup();
    if (mounted) context.go('/pickup-complete');
  }

  @override
  Widget build(BuildContext context) {
    final order = context.watch<AppState>().activeOrder;
    if (order == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Aktif sipariş bulunamadı.')),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(order.orderNo),
        actions: [
          IconButton(
            onPressed: () => _share(context),
            icon: const Icon(Icons.ios_share_rounded),
            tooltip: 'Arkadaşına gönder',
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: ResponsiveContent(
          maxWidth: 640,
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.lime,
                  borderRadius: BorderRadius.circular(27),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.schedule_rounded,
                      color: AppColors.forest,
                      size: 29,
                    ),
                    SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Teslim aralığı açık',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: AppColors.forest,
                            ),
                          ),
                          Text(
                            'Mağazaya ulaştığında aşağıdaki alanı kaydır.',
                            style: TextStyle(
                              fontSize: 10,
                              color: AppColors.forest,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 15),
              Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(27),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  children: [
                    AppImage(
                      order.bag.imageAsset,
                      width: double.infinity,
                      height: 205,
                      fit: BoxFit.cover,
                    ),
                    Padding(
                      padding: const EdgeInsets.all(19),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      order.bag.store.toUpperCase(),
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1,
                                        color: AppColors.muted,
                                      ),
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      order.bag.title,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleLarge,
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '${order.total} ₺',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.forest,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 17),
                          const Divider(),
                          const SizedBox(height: 14),
                          _DetailRow(
                            icon: Icons.schedule_rounded,
                            label: 'Teslim zamanı',
                            value: 'Bugün 20:00–20:30',
                          ),
                          const SizedBox(height: 13),
                          _DetailRow(
                            icon: Icons.location_on_outlined,
                            label: 'Adres',
                            value: order.bag.address,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 15),
              OutlinedButton.icon(
                onPressed: () => _share(context),
                icon: const Icon(Icons.person_add_alt_1_rounded),
                label: const Text('Siparişi arkadaşım teslim alsın'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 23),
              const Text(
                'Mağaza personelinin önünde kaydır',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: AppColors.forest,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.forest,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 64,
                      child: Slider(
                        value: slider,
                        onChanged: completing
                            ? null
                            : (value) => setState(() => slider = value),
                        onChangeEnd: (value) {
                          if (value > .92) {
                            complete();
                          } else {
                            setState(() => slider = 0);
                          }
                        },
                        activeColor: AppColors.lime,
                        inactiveColor: Colors.transparent,
                        thumbColor: AppColors.lime,
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'TESLİM ALMAK İÇİN KAYDIR',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          letterSpacing: .5,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    if (completing)
                      const Padding(
                        padding: EdgeInsets.only(right: 14),
                        child: SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.lime,
                          ),
                        ),
                      )
                    else
                      const Padding(
                        padding: EdgeInsets.only(right: 14),
                        child: Icon(
                          Icons.chevron_right_rounded,
                          color: AppColors.lime,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 13),
              TextButton.icon(
                onPressed: () => context.push('/support'),
                icon: const Icon(Icons.help_outline_rounded, size: 18),
                label: const Text('Siparişle ilgili yardım al'),
              ),
              TextButton(
                onPressed: completing ? null : () => _cancelOrder(context),
                child: const Text(
                  'Siparişi iptal et',
                  style: TextStyle(color: Colors.redAccent),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static void _share(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Tek kullanımlık teslim bağlantısı hazırlandı. Demo modunda paylaşılmadı.',
        ),
      ),
    );
  }

  static Future<void> _cancelOrder(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sipariş iptal edilsin mi?'),
        content: const Text(
          'Demo modunda sipariş iptal edilerek geçmiş siparişlere taşınacak.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('İptal et'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await context.read<AppState>().cancelActiveOrder();
    if (context.mounted) context.go('/orders');
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: AppColors.limeSoft,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.forest, size: 19),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 9, color: AppColors.muted),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.45,
                  fontWeight: FontWeight.w900,
                  color: AppColors.forest,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
