import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'primary_button.dart';

/// Yükleniyor / hata / boş durumları için ortak gösterim.
///
/// Bu üç durumu her ekranda ayrı ayrı yazmak, birinin unutulmasına yol açar:
/// eskiden ağ hatasında ekran sonsuza kadar dönen bir göstergede kalıyordu.
class AsyncContent extends StatelessWidget {
  const AsyncContent({
    required this.isLoading,
    required this.error,
    required this.isEmpty,
    required this.builder,
    this.onRetry,
    this.emptyTitle = 'Burada henüz bir şey yok',
    this.emptyMessage,
    this.emptyIcon = Icons.inbox_rounded,
    super.key,
  });

  final bool isLoading;
  final String? error;
  final bool isEmpty;
  final WidgetBuilder builder;
  final VoidCallback? onRetry;
  final String emptyTitle;
  final String? emptyMessage;
  final IconData emptyIcon;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(color: AppColors.forest),
        ),
      );
    }

    if (error != null) {
      return _Message(
        icon: Icons.wifi_off_rounded,
        title: 'Bağlantı sorunu',
        message: error!,
        actionLabel: onRetry == null ? null : 'Tekrar dene',
        onAction: onRetry,
      );
    }

    if (isEmpty) {
      return _Message(
        icon: emptyIcon,
        title: emptyTitle,
        message: emptyMessage,
        actionLabel: onRetry == null ? null : 'Yenile',
        onAction: onRetry,
      );
    }

    return builder(context);
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: const BoxDecoration(
                color: AppColors.limeSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.forest, size: 36),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.5),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              SizedBox(
                width: 200,
                child: PrimaryButton(
                  label: actionLabel!,
                  icon: Icons.refresh_rounded,
                  onPressed: onAction,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Hata mesajını tek biçimde gösterir.
///
/// `SnackBar` yerine `ScaffoldMessenger` üzerinden gitmek, ekran
/// değiştiğinde mesajın kaybolmamasını sağlar.
void showErrorSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.danger,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
}

void showInfoSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.forest,
        behavior: SnackBarBehavior.floating,
      ),
    );
}
