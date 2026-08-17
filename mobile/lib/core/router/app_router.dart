import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/state/app_state.dart';
import '../../features/auth/presentation/forgot_password_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/onboarding_page.dart';
import '../../features/auth/presentation/register_page.dart';
import '../../features/auth/presentation/reset_password_page.dart';
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

/// Oturum açmadan görülebilecek yollar.
///
/// Keşif ve paket detayı bilerek herkese açık: kullanıcı önce ürünü görsün,
/// satın almaya karar verdiğinde giriş yapsın.
const _publicRoutes = {
  '/onboarding',
  '/login',
  '/kayit',
  '/sifremi-unuttum',
  '/sifre-sifirla',
  '/home',
};

bool _isPublic(String location) {
  if (_publicRoutes.contains(location)) return true;
  return location.startsWith('/bag/');
}

GoRouter createAppRouter(AppState state) {
  return GoRouter(
    initialLocation: state.onboardingSeen ? '/home' : '/onboarding',

    // Oturum durumu değiştiğinde yönlendirme yeniden değerlendirilir; aksi
    // hâlde çıkış yapan kullanıcı korumalı ekranda kalmaya devam ederdi.
    refreshListenable: state,

    redirect: (context, routerState) {
      final location = routerState.matchedLocation;

      if (!state.onboardingSeen && location != '/onboarding') {
        return '/onboarding';
      }

      // Giriş yapmış kullanıcı kayıt/giriş ekranlarında oyalanmasın.
      if (state.isAuthenticated &&
          (location == '/login' || location == '/kayit')) {
        // Giriş sonrası kullanıcı geldiği yere döner.
        return routerState.uri.queryParameters['devam'] ?? '/home';
      }

      if (!state.isAuthenticated && !_isPublic(location)) {
        // Nereden geldiği korunur: giriş sonrası aynı ekrana dönülür.
        return '/login?devam=${Uri.encodeComponent(routerState.uri.toString())}';
      }

      return null;
    },

    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) =>
            LoginPage(returnTo: state.uri.queryParameters['devam']),
      ),
      GoRoute(path: '/kayit', builder: (context, state) => const RegisterPage()),
      GoRoute(
        path: '/sifremi-unuttum',
        builder: (context, state) => const ForgotPasswordPage(),
      ),
      GoRoute(
        path: '/sifre-sifirla',
        // Jeton e-postadaki derin bağlantıdan sorgu parametresi olarak gelir.
        builder: (context, state) =>
            ResetPasswordPage(token: state.uri.queryParameters['token'] ?? ''),
      ),
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
        path: '/order-success/:orderId',
        builder: (context, state) =>
            OrderSuccessPage(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/active-order',
        builder: (context, state) => const ActiveOrderPage(),
      ),
      GoRoute(
        path: '/pickup-complete/:orderId',
        builder: (context, state) =>
            PickupCompletePage(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/rating/:orderId',
        builder: (context, state) =>
            RatingPage(orderId: state.pathParameters['orderId']!),
      ),
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
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.explore_off_rounded, size: 56),
              const SizedBox(height: 16),
              const Text(
                'Aradığın sayfayı bulamadık.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => context.go('/home'),
                child: const Text('Ana sayfaya dön'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
