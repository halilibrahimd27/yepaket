import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/dummy/dummy_data.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/bag_card.dart';

class BrowsePage extends StatefulWidget {
  const BrowsePage({super.key});

  @override
  State<BrowsePage> createState() => _BrowsePageState();
}

class _BrowsePageState extends State<BrowsePage> {
  bool listMode = false;

  @override
  Widget build(BuildContext context) {
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
                    readOnly: true,
                    decoration: const InputDecoration(
                      hintText: 'Kadıköy canlı haritasında ara',
                      prefixIcon: Icon(Icons.search_rounded),
                      contentPadding: EdgeInsets.symmetric(vertical: 13),
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
              children: const [
                _FilterChip(
                  label: 'Canlı',
                  icon: Icons.wifi_tethering_rounded,
                  selected: true,
                ),
                _FilterChip(label: 'Kategori', icon: Icons.expand_more_rounded),
                _FilterChip(
                  label: 'Teslim zamanı',
                  icon: Icons.expand_more_rounded,
                ),
                _FilterChip(label: 'Mesafe', icon: Icons.expand_more_rounded),
                _FilterChip(label: 'Fiyat', icon: Icons.expand_more_rounded),
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
    this.selected = false,
  });

  final String label;
  final IconData icon;
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
        onPressed: () {},
      ),
    );
  }
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
    final selectedBag = DummyData.bags[selectedBagIndex];
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
                  for (var index = 0; index < storeLocations.length; index++)
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
                        price: '${DummyData.bags[index].price}₺',
                        selected: selectedBagIndex == index,
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
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _LiveDot(),
                SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'KADIKÖY CANLI',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .8,
                        color: AppColors.lime,
                      ),
                    ),
                    Text(
                      '12 kurtarıcı yakında',
                      style: TextStyle(
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
