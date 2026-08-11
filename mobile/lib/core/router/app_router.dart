import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/state/app_state.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/onboarding_page.dart';
import '../../features/bag/presentation/bag_detail_page.dart';
import '../../features/checkout/presentation/checkout_page.dart';
import '../../features/home/presentation/main_shell_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/orders/presentation/active_order_page.dart';
import '../../features/orders/presentation/order_success_page.dart';
import '../../features/orders/presentation/orders_page.dart';
import '../../features/orders/presentation/pickup_complete_page.dart';
import '../../features/orders/presentation/rating_page.dart';
import '../../features/parcels/presentation/parcels_page.dart';
import '../../features/settings/presentation/settings_page.dart';
import '../../features/support/presentation/support_page.dart';

GoRouter createAppRouter(AppState state) {
  return GoRouter(
    initialLocation: state.onboardingSeen ? '/login' : '/onboarding',
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
        path: '/home',
        builder: (context, state) => const MainShellPage(),
      ),
      GoRoute(
        path: '/bag/:id',
        builder: (context, state) =>
            BagDetailPage(bagId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/checkout/:id',
        builder: (context, state) =>
            CheckoutPage(bagId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/order-success',
        builder: (context, state) => const OrderSuccessPage(),
      ),
      GoRoute(
        path: '/active-order',
        builder: (context, state) => const ActiveOrderPage(),
      ),
      GoRoute(
        path: '/pickup-complete',
        builder: (context, state) => const PickupCompletePage(),
      ),
      GoRoute(path: '/rating', builder: (context, state) => const RatingPage()),
      GoRoute(path: '/orders', builder: (context, state) => const OrdersPage()),
      GoRoute(
        path: '/parcels',
        builder: (context, state) => const ParcelsPage(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: '/support',
        builder: (context, state) => const SupportPage(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsPage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Sayfa bulunamadı')),
      body: Center(
        child: FilledButton(
          onPressed: () => context.go('/home'),
          child: const Text('Ana sayfaya dön'),
        ),
      ),
    ),
  );
}
