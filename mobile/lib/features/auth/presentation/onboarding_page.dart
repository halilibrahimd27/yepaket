import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/brand_logo.dart';
import '../../../shared/widgets/primary_button.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  int page = 0;

  static const items = [
    (
      title: 'İyi yemek\nçöpe gitmesin.',
      text:
          'Mahallendeki gün sonu sürpriz paketleri keşfet, üçte bir fiyatına kurtar.',
      image: 'assets/images/hero-produce.jpg',
      badge: 'GIDA KURTARMA',
    ),
    (
      title: 'Yakınındakini\nkolayca bul.',
      text:
          'Harita, kategori ve teslim saatine göre sana uygun paketleri filtrele.',
      image: 'assets/images/bag-bakery.jpg',
      badge: 'KONUMUNA ÖZEL',
    ),
    (
      title: 'Göster, kaydır\nve paketini al.',
      text:
          'Uygulamada güvenli öde; teslim saatinde mağazada kaydırarak doğrula.',
      image: 'assets/images/bag-croissant.jpg',
      badge: 'KOLAY TESLİM',
    ),
  ];

  Future<void> next() async {
    if (page < items.length - 1) {
      setState(() => page++);
      return;
    }
    await context.read<AppState>().completeOnboarding();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final item = items[page];
    return Scaffold(
      backgroundColor: AppColors.forest,
      body: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 450),
            // AnimatedSwitcher çocuğuna gevşek kısıt verir; boyut açıkça
            // verilmezse BoxFit.cover görseli doğal boyutuna düşürür ve
            // ekranın ortasında bir bant olarak kalır.
            child: SizedBox.expand(
              key: ValueKey(item.image),
              child: Image.asset(item.image, fit: BoxFit.cover),
            ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x32000000),
                  Color(0x3A0B3B2E),
                  Color(0xF20B3B2E),
                ],
                stops: [0, .42, 1],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.all(Radius.circular(16)),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 11,
                            vertical: 7,
                          ),
                          child: BrandLogo(size: 32),
                        ),
                      ),
                      TextButton(
                        onPressed: () async {
                          await context.read<AppState>().completeOnboarding();
                          if (context.mounted) context.go('/login');
                        },
                        child: const Text(
                          'Atla',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 350),
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween(
                          begin: const Offset(0, .08),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    ),
                    child: Column(
                      key: ValueKey(page),
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.lime,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            item.badge,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.1,
                              color: AppColors.forest,
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          item.title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayLarge
                              ?.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 16),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 430),
                          child: Text(
                            item.text,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 16,
                              height: 1.5,
                              color: Colors.white70,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      items.length,
                      (index) => AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        width: index == page ? 28 : 8,
                        height: 8,
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        decoration: BoxDecoration(
                          color: index == page
                              ? AppColors.lime
                              : Colors.white38,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  PrimaryButton(
                    label: page == items.length - 1
                        ? 'YePaket’e başla'
                        : 'Devam et',
                    onPressed: next,
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.forest,
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
