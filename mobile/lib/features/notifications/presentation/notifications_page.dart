import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/responsive_content.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    // Açılışta sunucudan çekilir; build içinde yapmak her yeniden çizimde
    // istek tetiklerdi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().refreshNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final hasUnread = state.unreadNotificationCount > 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirimler'),
        actions: [
          TextButton(
            onPressed: hasUnread ? state.markAllNotificationsRead : null,
            child: const Text('Tümünü okundu yap'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: state.refreshNotifications,
        child: ResponsiveContent(
          maxWidth: 680,
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
          child: AsyncContent(
            isLoading:
                state.isLoadingNotifications && state.notifications.isEmpty,
            error: state.notificationsError,
            isEmpty: state.notifications.isEmpty,
            emptyTitle: 'Henüz bildirim yok',
            emptyMessage:
                'Favori işletmelerin paket yayınladığında ve teslim saatin '
                'yaklaştığında seni buradan haberdar edeceğiz.',
            emptyIcon: Icons.notifications_none_rounded,
            onRetry: state.refreshNotifications,
            builder: (context) => ListView.separated(
              itemCount: state.notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: 9),
              itemBuilder: (context, index) {
                final item = state.notifications[index];
                return _NotificationCard(
                  notification: item,
                  onTap: () => _open(context, item),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context, AppNotification notification) {
    final state = context.read<AppState>();
    if (!notification.isRead) {
      state.markNotificationRead(notification.id);
    }

    // Bildirim türüne göre ilgili ekrana götürür; eşleşme yoksa listede kalır.
    switch (notification.type) {
      case 'order_reminder':
      case 'order_status':
        context.push('/orders');
      case 'bag_published':
      case 'favorite_available':
        context.go('/home');
    }
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  /// Bildirim türünü ikona eşler; bilinmeyen tür genel bir ikon alır.
  IconData get _icon => switch (notification.type) {
    'favorite_available' || 'bag_published' => Icons.favorite_rounded,
    'order_reminder' || 'order_status' => Icons.schedule_rounded,
    'impact' => Icons.eco_rounded,
    'campaign' => Icons.campaign_outlined,
    _ => Icons.notifications_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final unread = !notification.isRead;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(21),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(21),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: unread ? AppColors.lime : AppColors.limeSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon, color: AppColors.forest, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: TextStyle(
                        fontWeight: unread ? FontWeight.w900 : FontWeight.w700,
                        color: AppColors.forest,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      notification.body,
                      style: const TextStyle(
                        fontSize: 11,
                        height: 1.45,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    notification.timeLabel,
                    style: const TextStyle(fontSize: 9, color: AppColors.muted),
                  ),
                  if (unread) ...[
                    const SizedBox(height: 6),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.forest,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
