import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/bag_card.dart';

class BrowsePage extends StatefulWidget {
  const BrowsePage({super.key});

  @override
  State<BrowsePage> createState() => _BrowsePageState();
}

class _BrowsePageState extends State<BrowsePage> {
  final searchController = TextEditingController();
  bool listMode = false;

  @override
  void initState() {
    super.initState();
    // Arama kutusundaki temizle düğmesinin görünürlüğü metne bağlı.
    searchController.addListener(() => setState(() {}));
    searchController.text = context.read<AppState>().searchQuery;
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: searchController,
                    textInputAction: TextInputAction.search,
                    // Her tuşta istek atmamak için gönderimde aranıyor;
                    // her karakterde sorgu, sunucuyu gereksiz yorar.
                    onSubmitted: (value) =>
                        context.read<AppState>().search(value.trim()),
                    decoration: InputDecoration(
                      hintText: 'Paket veya işletme ara',
                      prefixIcon: const Icon(Icons.search_rounded),
                      contentPadding: const EdgeInsets.symmetric(vertical: 13),
                      suffixIcon: searchController.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () {
                                searchController.clear();
                                context.read<AppState>().search('');
                                setState(() {});
                              },
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 9),
                IconButton.filled(
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.forest,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => setState(() => listMode = !listMode),
                  icon: Icon(
                    listMode ? Icons.map_rounded : Icons.view_list_rounded,
                  ),
                  tooltip: listMode ? 'Harita görünümü' : 'Liste görünümü',
                ),
              ],
            ),
          ),
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                // Kategori: sunucudaki filtreyi uygular.
                _FilterChip(
                  label: state.selectedCategory == BagCategory.all
                      ? 'Kategori'
                      : state.selectedCategory.label,
                  icon: Icons.expand_more_rounded,
                  selected: state.selectedCategory != BagCategory.all,
                  onPressed: () => _pickCategory(context, state),
                ),
                // Sıralama: sunucunun desteklediği beş seçenek.
                _FilterChip(
                  label: state.selectedSort == BagSort.relevance
                      ? 'Sırala'
                      : state.selectedSort.label,
                  icon: Icons.swap_vert_rounded,
                  selected: state.selectedSort != BagSort.relevance,
                  onPressed: () => _pickSort(context, state),
                ),
                if (state.selectedCategory != BagCategory.all ||
                    state.selectedSort != BagSort.relevance ||
                    state.searchQuery.isNotEmpty)
                  _FilterChip(
                    label: 'Filtreleri temizle',
                    icon: Icons.close_rounded,
                    onPressed: () {
                      searchController.clear();
                      state.clearFilters();
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(child: listMode ? const _ListView() : const _LiveMapView()),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.selected = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        label: Text(label),
        avatar: Icon(icon, size: 16),
        backgroundColor: selected ? AppColors.lime : null,
        side: selected ? BorderSide.none : null,
        onPressed: onPressed,
      ),
    );
  }
}

/// Kategori seçimi.
Future<void> _pickCategory(BuildContext context, AppState state) async {
  final selected = await showModalBottomSheet<BagCategory>(
    context: context,
    backgroundColor: AppColors.cream,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 16),
          Text('Kategori', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...BagCategory.values.map(
            (category) => ListTile(
              title: Text(category.label),
              trailing: state.selectedCategory == category
                  ? const Icon(Icons.check_rounded, color: AppColors.forest)
                  : null,
              onTap: () => Navigator.pop(sheetContext, category),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );

  if (selected != null) await state.selectCategory(selected);
}

/// Sıralama seçimi.
Future<void> _pickSort(BuildContext context, AppState state) async {
  final selected = await showModalBottomSheet<BagSort>(
    context: context,
    backgroundColor: AppColors.cream,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 16),
          Text('Sırala', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...BagSort.values.map(
            (sort) => ListTile(
              title: Text(sort.label),
              trailing: state.selectedSort == sort
                  ? const Icon(Icons.check_rounded, color: AppColors.forest)
                  : null,
              onTap: () => Navigator.pop(sheetContext, sort),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );

  if (selected != null) await state.selectSort(selected);
}

class _ListView extends StatelessWidget {
  const _ListView();

  @override
  Widget build(BuildContext context) {
    final bags = context.watch<AppState>().filteredBags;
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      itemCount: bags.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) => BagCard(bag: bags[index], compact: true),
    );
  }
}

class _LiveMapView extends StatefulWidget {
  const _LiveMapView();

  @override
  State<_LiveMapView> createState() => _LiveMapViewState();
}

class _LiveMapViewState extends State<_LiveMapView>
    with SingleTickerProviderStateMixin {
  static const center = LatLng(40.9877, 29.0277);
  static const storeLocations = [
    LatLng(40.9877, 29.0277),
    LatLng(40.9849, 29.0314),
    LatLng(40.9910, 29.0226),
    LatLng(40.9897, 29.0341),
  ];
  static const people = [
    (point: LatLng(40.9890, 29.0251), emoji: '🧑‍🍳', label: '2 dk'),
    (point: LatLng(40.9856, 29.0258), emoji: '🥐', label: 'şimdi'),
    (point: LatLng(40.9884, 29.0324), emoji: '🌿', label: '4 dk'),
  ];

  final mapController = MapController();
  late final AnimationController pulseController;
  int selectedBagIndex = 0;

  @override
  void initState() {
    super.initState();
    pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    pulseController.dispose();
    mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Harita artık AppState'ten besleniyor; DummyData okumak uzak modda
    // var olmayan paketlere yönlendirip çökmeye yol açıyordu (K2).
    final bags = context.watch<AppState>().bags;
    if (bags.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Yakınında yayında paket yok.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
        ),
      );
    }
    final safeIndex = selectedBagIndex.clamp(0, bags.length - 1);
    final selectedBag = bags[safeIndex];
    return Stack(
      children: [
        Positioned.fill(
          child: FlutterMap(
            mapController: mapController,
            options: const MapOptions(
              initialCenter: center,
              initialZoom: 14.5,
              minZoom: 11,
              maxZoom: 18,
              interactionOptions: InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: ApiConfig.mapTileUrl,
                userAgentPackageName: ApiConfig.mapUserAgent,
                maxNativeZoom: 19,
              ),
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: const LatLng(40.9874, 29.0274),
                    radius: 68,
                    color: AppColors.lime.withValues(alpha: .16),
                    borderColor: AppColors.limeDark.withValues(alpha: .25),
                    borderStrokeWidth: 2,
                  ),
                  CircleMarker(
                    point: const LatLng(40.9904, 29.0227),
                    radius: 48,
                    color: AppColors.forest.withValues(alpha: .09),
                    borderColor: AppColors.forest.withValues(alpha: .14),
                    borderStrokeWidth: 1,
                  ),
                ],
              ),
              MarkerLayer(
                markers: [
                  for (
                    var index = 0;
                    index < bags.length && index < storeLocations.length;
                    index++
                  )
                    Marker(
                      point: storeLocations[index],
                      width: 78,
                      height: 70,
                      child: _StoreMarker(
                        label: index == 0
                            ? 'MF'
                            : index == 1
                            ? 'K'
                            : index == 2
                            ? 'M'
                            : 'P',
                        price: bags[index].priceLabel,
                        selected: safeIndex == index,
                        onTap: () => setState(() => selectedBagIndex = index),
                      ),
                    ),
                  for (final person in people)
                    Marker(
                      point: person.point,
                      width: 70,
                      height: 72,
                      child: _LiveActivityMarker(
                        animation: pulseController,
                        emoji: person.emoji,
                        label: person.label,
                      ),
                    ),
                ],
              ),
              Align(
                alignment: Alignment.topRight,
                child: SafeArea(
                  bottom: false,
                  child: GestureDetector(
                    onTap: _openAttribution,
                    child: Container(
                      margin: const EdgeInsets.all(7),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .88),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        '© OpenStreetMap contributors',
                        style: TextStyle(
                          fontSize: 7,
                          fontWeight: FontWeight.w700,
                          color: AppColors.forest,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Positioned(
          left: 12,
          top: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: AppColors.forest.withValues(alpha: .94),
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x260B3B2E),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _LiveDot(),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'HARİTADA CANLI',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .8,
                        color: AppColors.lime,
                      ),
                    ),
                    // Sayı gerçek listeden gelir; eskiden "12" sabitti (O1).
                    Text(
                      bags.isEmpty
                          ? 'Bu bölgede paket yok'
                          : '${bags.length} paket yakında',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        Positioned(
          right: 14,
          bottom: 202,
          child: Column(
            children: [
              FloatingActionButton.small(
                heroTag: 'zoom-in',
                onPressed: () => mapController.move(
                  mapController.camera.center,
                  (mapController.camera.zoom + 1).clamp(11, 18),
                ),
                backgroundColor: Colors.white,
                foregroundColor: AppColors.forest,
                child: const Icon(Icons.add_rounded),
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: 'location',
                onPressed: () => mapController.move(center, 14.5),
                backgroundColor: AppColors.forest,
                foregroundColor: AppColors.lime,
                child: const Icon(Icons.my_location_rounded),
              ),
            ],
          ),
        ),
        Positioned(
          left: 10,
          right: 10,
          bottom: 10,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 11, 8, 8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .97),
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x2B0B3B2E),
                      blurRadius: 30,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 34,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.line,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                        const Spacer(),
                        const Text(
                          '24 PAKET YAKININDA',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                            letterSpacing: .7,
                            color: AppColors.muted,
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ),
                    const SizedBox(height: 7),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: SizedBox(
                        key: ValueKey(selectedBag.id),
                        height: 106,
                        child: BagCard(bag: selectedBag, compact: true),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  static Future<void> _openAttribution() async {
    await launchUrl(
      Uri.parse('https://www.openstreetmap.org/copyright'),
      mode: LaunchMode.externalApplication,
    );
  }
}

class _StoreMarker extends StatelessWidget {
  const _StoreMarker({
    required this.label,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String price;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: selected ? 48 : 42,
            height: selected ? 48 : 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? AppColors.lime : AppColors.forest,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x35000000),
                  blurRadius: 12,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: selected ? AppColors.forest : Colors.white,
              ),
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -3),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(99),
                boxShadow: const [
                  BoxShadow(color: Color(0x18000000), blurRadius: 6),
                ],
              ),
              child: Text(
                price,
                style: const TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w900,
                  color: AppColors.forest,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveActivityMarker extends StatelessWidget {
  const _LiveActivityMarker({
    required this.animation,
    required this.emoji,
    required this.label,
  });

  final Animation<double> animation;
  final String emoji;
  final String label;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            Transform.scale(
              scale: .8 + animation.value * .34,
              child: Opacity(
                opacity: .28 - animation.value * .14,
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: AppColors.lime,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.lime, width: 3),
                    boxShadow: const [
                      BoxShadow(color: Color(0x25000000), blurRadius: 9),
                    ],
                  ),
                  child: Text(emoji, style: const TextStyle(fontSize: 19)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.forest,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 7,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _LiveDot extends StatefulWidget {
  const _LiveDot();

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
      lowerBound: .45,
      upperBound: 1,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: controller,
      child: const SizedBox(
        width: 9,
        height: 9,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.lime,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
