import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// "Kargoyla kurtar" — henüz yayında olmayan özellik.
///
/// Eskiden burada sahte ürünler ve fiyatlar vardı; sepete ekleme bir bildirim
/// gösterip hiçbir şey yapmıyordu. Ödeyemeyeceği bir ürün gösterilen kullanıcı
/// ürüne olan güvenini kaybeder. Bunun yerine ne planladığımızı açıkça
/// söylüyor ve haber listesine gerçek bir kayıt alıyoruz.
class ParcelsPage extends StatefulWidget {
  const ParcelsPage({super.key});

  @override
  State<ParcelsPage> createState() => _ParcelsPageState();
}

class _ParcelsPageState extends State<ParcelsPage> {
  static const _feature = 'parcels';

  final _emailController = TextEditingController();
  final _cityController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _submitting = false;
  int? _position;
  int? _total;

  @override
  void initState() {
    super.initState();

    final state = context.read<AppState>();
    _emailController.text = state.user?.email ?? '';

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final total = await state.waitlistCount(_feature);
      if (mounted) setState(() => _total = total);
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);

    final result = await context.read<AppState>().joinWaitlist(
      _feature,
      _emailController.text.trim(),
      city: _cityController.text.trim().isEmpty
          ? null
          : _cityController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    switch (result) {
      case Success(value: final position):
        setState(() {
          _position = position;
          _total = (_total ?? position) < position ? position : _total;
        });
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kargoyla kurtar')),
      body: ResponsiveContent(
        maxWidth: 720,
        padding: const EdgeInsets.fromLTRB(18, 6, 18, 32),
        child: ListView(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.forest,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.lime,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'YAKINDA',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                        color: AppColors.forest,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Türkiye’nin her yerinden kurtar',
                    style: TextStyle(
                      fontSize: 24,
                      height: 1.2,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Üreticilerin ve markaların fazla stoğunu — ambalajı '
                    'değişmiş, sezonu geçmiş ama son kullanma tarihi uzak '
                    'ürünleri — kapına gönderiyoruz.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.6,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),

            Text(
              'Nasıl çalışacak?',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            const _Step(
              index: 1,
              icon: Icons.inventory_2_rounded,
              title: 'Marka fazla stoğunu bildirir',
              description:
                  'Depoda kalan, satılamayan ama gıda güvenliği açısından '
                  'sorunsuz ürünler koli olarak listelenir.',
            ),
            const _Step(
              index: 2,
              icon: Icons.local_shipping_rounded,
              title: 'Sen sipariş verirsin, kargoyla gelir',
              description:
                  'Şehrinde YePaket işletmesi olmasa bile kurtarmaya '
                  'katılabilirsin.',
            ),
            const _Step(
              index: 3,
              icon: Icons.eco_rounded,
              title: 'Etkin hesabına eklenir',
              description:
                  'Kargo kolileri de kurtardığın paket sayısına ve CO₂e '
                  'tasarrufuna yansır.',
            ),

            const SizedBox(height: 24),

            if (_position != null)
              _JoinedCard(position: _position!)
            else
              _JoinForm(
                formKey: _formKey,
                emailController: _emailController,
                cityController: _cityController,
                submitting: _submitting,
                total: _total,
                onSubmit: _join,
              ),

            const SizedBox(height: 18),
            const Text(
              'E-posta adresini yalnızca bu özellik yayına girdiğinde haber '
              'vermek için kullanırız. Dilediğin zaman listeden çıkabilirsin.',
              textAlign: TextAlign.center,
              style: TextStyle(
                height: 1.5,
                fontSize: 10,
                color: AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------

class _Step extends StatelessWidget {
  const _Step({
    required this.index,
    required this.icon,
    required this.title,
    required this.description,
  });

  final int index;
  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(21),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: AppColors.limeSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.forest, size: 20),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$index. $title',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: AppColors.forest,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
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
      ),
    );
  }
}

class _JoinForm extends StatelessWidget {
  const _JoinForm({
    required this.formKey,
    required this.emailController,
    required this.cityController,
    required this.submitting,
    required this.total,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final TextEditingController cityController;
  final bool submitting;
  final int? total;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(25),
      ),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Yayına girince ilk sen bil',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (total != null && total! > 0) ...[
              const SizedBox(height: 4),
              Text(
                '$total kişi haber bekliyor.',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 16),
            TextFormField(
              controller: emailController,
              enabled: !submitting,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'E-posta'),
              validator: (value) {
                final email = (value ?? '').trim();
                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
                  return 'Geçerli bir e-posta adresi gir.';
                }
                return null;
              },
            ),
            const SizedBox(height: 13),
            TextFormField(
              controller: cityController,
              enabled: !submitting,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Şehir (isteğe bağlı)',
                helperText:
                    'Hangi şehirlerden başlayacağımızı buna göre seçiyoruz.',
              ),
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Haber listesine katıl',
              loading: submitting,
              onPressed: submitting ? null : onSubmit,
            ),
          ],
        ),
      ),
    );
  }
}

class _JoinedCard extends StatelessWidget {
  const _JoinedCard({required this.position});
  final int position;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.limeSoft,
        borderRadius: BorderRadius.circular(25),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.mark_email_read_rounded,
            color: AppColors.forest,
            size: 40,
          ),
          const SizedBox(height: 14),
          Text('Listedesin!', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            '$position. sıradasın. Kargoyla kurtar yayına girdiğinde sana '
            'e-posta göndereceğiz.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.55,
              color: AppColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}
