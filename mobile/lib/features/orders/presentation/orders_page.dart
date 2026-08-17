import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/app_image.dart';
import '../../../shared/widgets/responsive_content.dart';

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  @override
  void initState() {
    super.initState();
    // Sayfa açılışında sunucudan tazelenir. Eskiden yalnızca uygulama
    // açılışında doldurulan önbellek çiziliyordu: başka bir cihazdan
    // yapılan iptal ya da ödeme onayı burada hiç görünmüyordu.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().refreshOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final completed = state.pastOrders;

    // Ödemesi tamamlanmamış siparişler hiçbir bölümde görünmüyordu:
    // kullanıcı parasının ne olduğunu göremiyordu.
    final pending = state.orders
        .where((order) => order.status == OrderStatus.paymentPending)
        .toList();

    final active = state.orders
        .where(
          (order) =>
              order.status.isActive &&
              order.status != OrderStatus.paymentPending,
        )
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Siparişlerim')),
      body: RefreshIndicator(
        onRefresh: state.refreshOrders,
        child: ResponsiveContent(
          maxWidth: 720,
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (pending.isNotEmpty) ...[
                Text(
                  'Ödeme bekleyen',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Ödemesi tamamlanmazsa rezervasyon otomatik olarak düşer.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.muted),
                ),
                const SizedBox(height: 11),
                ...pending.map(
                  (order) => Padding(
                    padding: const EdgeInsets.only(bottom: 11),
                    child: _OrderTile(
                      order: order,
                      onTap: () => context.push('/checkout/${order.bag.id}'),
                    ),
                  ),
                ),
                const SizedBox(height: 25),
              ],
              if (active.isNotEmpty) ...[
                Text('Aktif', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 11),
                ...active.map(
                  (order) => Padding(
                    padding: const EdgeInsets.only(bottom: 11),
                    child: _OrderTile(
                      order: order,
                      active: true,
                      onTap: () => context.push('/active-order'),
                    ),
                  ),
                ),
                const SizedBox(height: 25),
              ],
              Text('Geçmiş', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 11),
              if (completed.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(23),
                  ),
                  child: const Text(
                    'Tamamlanan siparişin henüz yok.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted),
                  ),
                )
              else
                ...completed.map(
                  (order) => Padding(
                    padding: const EdgeInsets.only(bottom: 11),
                    child: _OrderTile(
                      order: order,
                      // Yalnızca TESLİM ALINMIŞ sipariş değerlendirilebilir.
                      // Eskiden iptal edilen ve iade edilen siparişler de
                      // değerlendirme ekranına götürülüyordu; sunucu bunları
                      // reddediyor ve kullanıcı anlamsız bir hata alıyordu.
                      onTap: order.status == OrderStatus.collected
                          ? () => context.push('/rating/${order.id}')
                          : null,
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

class _OrderTile extends StatelessWidget {
  const _OrderTile({
    required this.order,
    required this.onTap,
    this.active = false,
  });
  final AppOrder order;

  /// `null` ise satır tıklanabilir görünmez.
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(23),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(23),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(17),
                child: AppImage(
                  order.bag.imageAsset,
                  width: 74,
                  height: 74,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.bag.store,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.orderNo,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      // Durum okunmadan sabit metin yazmak, iptal edilen
                      // siparişi "Teslim edildi" gösteriyordu (K4).
                      active ? order.pickupLabel : order.status.label,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: active
                            ? AppColors.limeDark
                            : order.status == OrderStatus.collected
                            ? AppColors.limeDark
                            : AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                order.totalLabel,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  color: AppColors.forest,
                ),
              ),
              const Icon(Icons.chevron_right_rounded, size: 19),
            ],
          ),
        ),
      ),
    );
  }
}
