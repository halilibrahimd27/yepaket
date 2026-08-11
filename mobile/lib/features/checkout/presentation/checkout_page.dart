import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/app_image.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({required this.bagId, super.key});
  final String bagId;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  int quantity = 1;
  int payment = 0;
  bool loading = false;

  Future<void> confirm() async {
    setState(() => loading = true);
    final state = context.read<AppState>();
    await state.createOrder(state.bagById(widget.bagId), quantity);
    if (mounted) context.go('/order-success');
  }

  @override
  Widget build(BuildContext context) {
    final bag = context.read<AppState>().bagById(widget.bagId);
    final total = bag.price * quantity;
    return Scaffold(
      appBar: AppBar(title: const Text('Sipariş özeti')),
      body: SingleChildScrollView(
        child: ResponsiveContent(
          maxWidth: 660,
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.line),
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(17),
                      child: AppImage(
                        bag.imageAsset,
                        width: 88,
                        height: 88,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            bag.store,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: AppColors.muted,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            bag.title,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 7),
                          Text(
                            bag.pickupLabel,
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${bag.price} ₺',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Text('Adet', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 11),
              Row(
                children: [
                  IconButton.filledTonal(
                    onPressed: quantity > 1
                        ? () => setState(() => quantity--)
                        : null,
                    icon: const Icon(Icons.remove_rounded),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Text(
                      '$quantity',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                  ),
                  IconButton.filled(
                    onPressed: quantity < bag.availableQuantity
                        ? () => setState(() => quantity++)
                        : null,
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              Text(
                'Ödeme yöntemi',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 11),
              _PaymentTile(
                index: 0,
                selected: payment,
                icon: Icons.credit_card_rounded,
                title: '•••• 4242',
                subtitle: 'Visa · Varsayılan',
                onTap: () => setState(() => payment = 0),
              ),
              const SizedBox(height: 9),
              _PaymentTile(
                index: 1,
                selected: payment,
                icon: Icons.apple,
                title: 'Apple Pay',
                subtitle: 'Hızlı ve güvenli ödeme',
                onTap: () => setState(() => payment = 1),
              ),
              const SizedBox(height: 9),
              _PaymentTile(
                index: 2,
                selected: payment,
                icon: Icons.account_balance_wallet_outlined,
                title: 'Yeni kart ekle',
                subtitle: 'Ödeme sağlayıcısında güvenle saklanır',
                onTap: () => setState(() => payment = 2),
              ),
              const SizedBox(height: 26),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    _PriceRow(
                      label: 'Paket',
                      value: '${bag.price * quantity} ₺',
                    ),
                    const SizedBox(height: 11),
                    const _PriceRow(label: 'Hizmet bedeli', value: '0 ₺'),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 15),
                      child: Divider(),
                    ),
                    _PriceRow(label: 'Toplam', value: '$total ₺', strong: true),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 17,
                    color: AppColors.muted,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Siparişini teslim aralığı başlamadan 2 saat öncesine kadar ücretsiz iptal edebilirsin.',
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.5,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
          child: PrimaryButton(
            label: '$total ₺ öde ve rezerve et',
            loading: loading,
            onPressed: confirm,
          ),
        ),
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({
    required this.index,
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final int index;
  final int selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = index == selected;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(21),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(21),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(21),
            border: Border.all(
              color: active ? AppColors.forest : AppColors.line,
              width: active ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppColors.limeSoft,
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
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                active
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                color: active ? AppColors.forest : AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.strong = false,
  });
  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: strong ? 15 : 13,
              fontWeight: strong ? FontWeight.w900 : FontWeight.w500,
              color: strong ? AppColors.forest : AppColors.muted,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: strong ? 21 : 13,
            fontWeight: FontWeight.w900,
            color: AppColors.forest,
          ),
        ),
      ],
    );
  }
}
