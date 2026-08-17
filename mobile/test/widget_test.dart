import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:yepaket/app/app.dart';
import 'package:yepaket/core/theme/app_theme.dart';
import 'package:yepaket/data/dummy/dummy_data.dart';
import 'package:yepaket/data/models/models.dart';
import 'package:yepaket/data/state/app_state.dart';
import 'package:yepaket/features/browse/presentation/browse_page.dart';
import 'package:yepaket/features/home/presentation/main_shell_page.dart';
import 'package:yepaket/features/profile/presentation/profile_page.dart';
import 'package:yepaket/shared/widgets/bag_card.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('kategori ve favori durumu dummy veri üzerinde çalışır', () async {
    final state = AppState();
    await state.initialize();

    expect(state.filteredBags, isNotEmpty);
    await state.selectCategory(BagCategory.bakery);
    expect(
      state.filteredBags.every((bag) => bag.category == BagCategory.bakery),
      isTrue,
    );

    final bagId = state.filteredBags.first.id;
    final wasFavorite = state.bagById(bagId)?.isFavorite ?? false;
    await state.toggleFavorite(bagId);
    expect(state.bagById(bagId)?.isFavorite, isNot(wasFavorite));
  });

  testWidgets('uygulama onboarding ekranıyla açılır', (tester) async {
    final state = AppState();

    await tester.pumpWidget(YePaketApp(appState: state));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.textContaining('İyi yemek'), findsOneWidget);
  });

  for (final size in [const Size(390, 844), const Size(900, 1200)]) {
    testWidgets('ana ekran ${size.width.toInt()} px genişlikte taşma yapmaz', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final state = AppState()..bags = DummyData.bags;

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: state,
          child: MaterialApp(
            theme: AppTheme.light,
            home: const MainShellPage(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Bugün ne kurtarıyoruz?'), findsOneWidget);
      final exception = tester.takeException();
      expect(exception, isNull);
    });
  }

  testWidgets('106 px kompakt paket kartı taşma yapmaz', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final state = AppState()..bags = DummyData.bags;

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 350,
                height: 106,
                child: BagCard(bag: DummyData.bags.first, compact: true),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('Günün Fırın Paketi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profil etki kartları SVG görsellerle taşmasız çizilir', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final state = AppState()..bags = DummyData.bags;

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: ProfilePage()),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.text('Etkin'), findsOneWidget);
    expect(find.text('paket kurtarıldı'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('canlı harita 390 px genişlikte açılır', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final state = AppState()..bags = DummyData.bags;

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: BrowsePage()),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('HARİTADA CANLI'), findsOneWidget);
    // Sayaç artık gerçek paket sayısından geliyor; sabit "24" değil.
    expect(
      find.text('${DummyData.bags.length} PAKET YAKININDA'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
