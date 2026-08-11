import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/responsive_content.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final notifications = [
      (
        Icons.favorite_rounded,
        'Kök Kahve yeniden hazır!',
        'Favorindeki Kahve Yanı Sürprizi satışa çıktı.',
        '2 dk',
      ),
      (
        Icons.schedule_rounded,
        'Teslim saatini unutma',
        'Moda Fırını paketin bugün 20:00’da hazır.',
        '1 sa',
      ),
      (
        Icons.eco_rounded,
        'Bu hafta 8,1 kg CO₂e önledin',
        'Etki özetini arkadaşlarınla paylaşabilirsin.',
        'Dün',
      ),
      (
        Icons.campaign_outlined,
        'Kadıköy’e 4 yeni işletme',
        'Yeni sürpriz paketleri keşfet.',
        '2 gün',
      ),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirimler'),
        actions: [
          TextButton(onPressed: () {}, child: const Text('Tümünü okundu yap')),
        ],
      ),
      body: ResponsiveContent(
        maxWidth: 680,
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        child: ListView.separated(
          itemCount: notifications.length,
          separatorBuilder: (_, _) => const SizedBox(height: 9),
          itemBuilder: (context, index) {
            final item = notifications[index];
            return Container(
              padding: const EdgeInsets.all(15),
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
                    decoration: BoxDecoration(
                      color: index == 0 ? AppColors.lime : AppColors.limeSoft,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(item.$1, color: AppColors.forest, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.$2,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: AppColors.forest,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.$3,
                          style: const TextStyle(
                            fontSize: 11,
                            height: 1.45,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    item.$4,
                    style: const TextStyle(fontSize: 9, color: AppColors.muted),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
