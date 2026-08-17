import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// Sunucunun kabul ettiği etiketler. Serbest metin yerine sabit liste
/// kullanmak, işletme panelinde anlamlı bir dağılım göstermeyi mümkün kılar.
const _ratingTags = [
  'Lezzetli',
  'İyi değer',
  'Kolay teslim',
  'Bol porsiyon',
  'Güler yüzlü',
];

class RatingPage extends StatefulWidget {
  const RatingPage({required this.orderId, super.key});

  final String orderId;

  @override
  State<RatingPage> createState() => _RatingPageState();
}

class _RatingPageState extends State<RatingPage> {
  final _commentController = TextEditingController();
  final _selectedTags = <String>{};

  int _rating = 5;
  bool _submitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);

    final result = await context.read<AppState>().rateOrder(
      widget.orderId,
      _rating,
      tags: _selectedTags.toList(),
      comment: _commentController.text.trim().isEmpty
          ? null
          : _commentController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    switch (result) {
      case Success():
        showInfoSnack(context, 'Değerlendirmen için teşekkürler!');
        context.go('/home');
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = context.watch<AppState>().orderById(widget.orderId);

    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Deneyimini değerlendir')),
        body: AsyncContent(
          isLoading: false,
          error: null,
          isEmpty: true,
          emptyTitle: 'Sipariş bulunamadı',
          emptyMessage: 'Yalnızca teslim aldığın siparişleri puanlayabilirsin.',
          emptyIcon: Icons.receipt_long_outlined,
          onRetry: () => context.go('/orders'),
          builder: (_) => const SizedBox.shrink(),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Deneyimini değerlendir')),
      body: ResponsiveContent(
        maxWidth: 560,
        padding: const EdgeInsets.fromLTRB(22, 30, 22, 28),
        child: Column(
          children: [
            Container(
              width: 82,
              height: 82,
              decoration: const BoxDecoration(
                color: AppColors.limeSoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.storefront_rounded,
                color: AppColors.forest,
                size: 34,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              // İşletme adı siparişten gelir; eskiden "Moda Fırını" sabitti (O1).
              '${order.bag.store} nasıldı?',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 9),
            const Text(
              'Puanın diğer kurtarıcılara yardımcı olur.',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 25),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                5,
                (index) => IconButton(
                  onPressed: _submitting
                      ? null
                      : () => setState(() => _rating = index + 1),
                  icon: Icon(
                    index < _rating
                        ? Icons.star_rounded
                        : Icons.star_border_rounded,
                    color: const Color(0xFFF6B91C),
                    size: 36,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: _ratingTags
                  .map(
                    (label) => FilterChip(
                      selected: _selectedTags.contains(label),
                      label: Text(label),
                      onSelected: _submitting
                          ? null
                          : (_) => setState(
                              () => _selectedTags.contains(label)
                                  ? _selectedTags.remove(label)
                                  : _selectedTags.add(label),
                            ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _commentController,
              maxLines: 4,
              maxLength: 500,
              enabled: !_submitting,
              decoration: const InputDecoration(
                hintText: 'Eklemek istediğin bir not var mı? (isteğe bağlı)',
              ),
            ),
            const Spacer(),
            PrimaryButton(
              label: 'Değerlendirmeyi gönder',
              loading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
            TextButton(
              onPressed: _submitting ? null : () => context.go('/home'),
              child: const Text('Şimdi değil'),
            ),
          ],
        ),
      ),
    );
  }
}
