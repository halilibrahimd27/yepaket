import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class RatingPage extends StatefulWidget {
  const RatingPage({super.key});

  @override
  State<RatingPage> createState() => _RatingPageState();
}

class _RatingPageState extends State<RatingPage> {
  int rating = 5;
  final selected = <String>{'Lezzetli', 'İyi değer'};

  @override
  Widget build(BuildContext context) {
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
              'Moda Fırını nasıldı?',
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
                  onPressed: () => setState(() => rating = index + 1),
                  icon: Icon(
                    index < rating
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
              children:
                  [
                        'Lezzetli',
                        'İyi değer',
                        'Kolay teslim',
                        'Bol porsiyon',
                        'Güler yüzlü',
                      ]
                      .map(
                        (label) => FilterChip(
                          selected: selected.contains(label),
                          label: Text(label),
                          onSelected: (_) => setState(
                            () => selected.contains(label)
                                ? selected.remove(label)
                                : selected.add(label),
                          ),
                        ),
                      )
                      .toList(),
            ),
            const SizedBox(height: 20),
            const TextField(
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Eklemek istediğin bir not var mı? (isteğe bağlı)',
              ),
            ),
            const Spacer(),
            PrimaryButton(
              label: 'Değerlendirmeyi gönder',
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Teşekkürler! Değerlendirmen dummy veriye eklendi.',
                    ),
                  ),
                );
                context.go('/home');
              },
            ),
          ],
        ),
      ),
    );
  }
}
