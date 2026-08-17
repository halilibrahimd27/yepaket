import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/app_image.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../data/models/models.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/responsive_content.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({required this.bagId, super.key});
  final String bagId;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  int quantity = 1;
  bool loading = false;

  /// Idempotency anahtarı **ekran açılışında bir kez** üretilir.
  ///
  /// Her istekte yeniden üretmek korumayı tamamen etkisiz kılıyordu: ağ
  /// tekrarında ikinci sipariş oluşuyordu (O5).
  late final String _idempotencyKey =
      'order_${DateTime.now().microsecondsSinceEpoch}_${identityHashCode(this)}';

  Future<void> confirm(SurpriseBag bag) async {
    if (loading) return;
    setState(() => loading = true);

    final state = context.read<AppState>();
    final result = await state.createOrder(
      bag,
      quantity,
      idempotencyKey: _idempotencyKey,
    );

    if (!mounted) return;
    // Hata durumunda da yükleme kapanır; eskiden buton sonsuza kadar
    // devre dışı kalıyordu (K3).
    setState(() => loading = false);

    switch (result) {
      case Success(value: final order):
        if (order.paymentRedirectUrl != null) {
          await _openPayment(order);
          if (!mounted) return;
        }
        context.go('/order-success/${order.id}');
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  /// 3D Secure sayfasını açar ve dönüşte ödemeyi tamamlar.
  Future<void> _openPayment(AppOrder order) async {
    final url = Uri.tryParse(order.paymentRedirectUrl ?? '');
    if (url == null) return;

    await launchUrl(url, mode: LaunchMode.externalApplication);

    if (!mounted) return;
    final result = await context.read<AppState>().confirmPayment(order.id);

    if (!mounted) return;
    if (result case Failure(message: final message)) {
      showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bag = context.watch<AppState>().bagById(widget.bagId);

    if (bag == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sipariş özeti')),
        body: AsyncContent(
          isLoading: false,
          error: null,
          isEmpty: true,
          emptyTitle: 'Paket bulunamadı',
          emptyMessage: 'Bu paketin satışı sona ermiş olabilir.',
          emptyIcon: Icons.shopping_bag_outlined,
          onRetry: () => context.go('/home'),
          builder: (_) => const SizedBox.shrink(),
        ),
      );
    }

    final totalMinor = bag.priceMinor * quantity;
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
                      bag.priceLabel,
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
              Text('Ödeme', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 11),
              // Kayıtlı kart ve cüzdan desteği YOK: her ödeme, sağlayıcının
              // 3D Secure sayfasında alınıyor ve kart bilgisi hiçbir zaman
              // uygulamaya veya sunucumuza ulaşmıyor.
              //
              // Eskiden burada uydurma bir kart ("•••• 4242 · Visa ·
              // Varsayılan") ve Apple Pay seçeneği vardı. Seçim hiçbir yere
              // gönderilmiyordu; kullanıcı kayıtlı kartıyla ödediğini sanıp
              // yine kart giriş sayfasına düşüyordu. Ayarlar ekranında aynı
              // sahte kart zaten kaldırılmıştı.
              const _PaymentNotice(),
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
                      value: Formats.money(bag.priceMinor * quantity),
                    ),
                    const SizedBox(height: 11),
                    const _PriceRow(label: 'Hizmet bedeli', value: '0 ₺'),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 15),
                      child: Divider(),
                    ),
                    _PriceRow(
                      label: 'Toplam',
                      value: Formats.money(totalMinor),
                      strong: true,
                    ),
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
            label: '${Formats.money(totalMinor)} öde ve rezerve et',
            loading: loading,
            onPressed: () => confirm(bag),
          ),
        ),
      ),
    );
  }
}

/// Ödemenin nerede alındığını açıklayan bilgi kartı.
///
/// Kullanıcıya "kartım nerede?" sorusunu sordurmamak için: uygulamada kart
/// listesi olmamasının bir eksiklik değil, bilinçli bir güvenlik kararı
/// olduğunu söyler.
class _PaymentNotice extends StatelessWidget {
  const _PaymentNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
              color: AppColors.limeSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_outline_rounded,
              color: AppColors.forest,
              size: 20,
            ),
          ),
          const SizedBox(width: 13),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Güvenli ödeme sayfası',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: AppColors.forest,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Onayladığında bankanın 3D Secure sayfasına yönlendirilirsin. '
                  'Kart bilgin uygulamada saklanmaz.',
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.5,
                    color: AppColors.muted,
                  ),
                ),
              ],
            ),
          ),
        ],
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
