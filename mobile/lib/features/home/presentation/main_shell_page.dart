import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../browse/presentation/browse_page.dart';
import '../../discover/presentation/discover_page.dart';
import '../../favorites/presentation/favorites_page.dart';
import '../../profile/presentation/profile_page.dart';

class MainShellPage extends StatefulWidget {
  const MainShellPage({super.key});

  /// Alt gezinme sekmesini değiştirir.
  ///
  /// Alt ekranlar (keşfet) kendi içindeki bağlantılardan haritaya geçebilsin
  /// diye dışarı açılmıştır; ayrı bir durum yönetimi eklemek bu tek ihtiyaç
  /// için fazla olurdu.
  static void goToTab(BuildContext context, int index) {
    context.findAncestorStateOfType<_MainShellPageState>()?.setTab(index);
  }

  @override
  State<MainShellPage> createState() => _MainShellPageState();
}

class _MainShellPageState extends State<MainShellPage> {
  int index = 0;

  void setTab(int value) {
    if (value == index) return;
    setState(() => index = value);
  }

  final pages = const [
    DiscoverPage(),
    BrowsePage(),
    FavoritesPage(),
    ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded, color: AppColors.forest),
            label: 'Keşfet',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map_rounded, color: AppColors.forest),
            label: 'Harita',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_border_rounded),
            selectedIcon: Icon(Icons.favorite_rounded, color: AppColors.forest),
            label: 'Favoriler',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded, color: AppColors.forest),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
