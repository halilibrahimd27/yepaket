import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class ParcelsPage extends StatelessWidget {
  const ParcelsPage({super.key});

  static const parcels = [
    (
      title: 'Kahvaltı Kurtarma Kolisi',
      brand: 'YePaket Seçkisi',
      image: 'assets/images/bag-pastries.jpg',
      price: 289,
      oldPrice: 620,
      description: 'Granola, sürülebilir ürünler ve paketli atıştırmalıklar.',
    ),
    (
      title: 'Fırın Favorileri Kolisi',
      brand: 'Yerel Üreticiler',
      image: 'assets/images/bag-bakery.jpg',
      price: 239,
      oldPrice: 510,
      description: 'Uzun ömürlü ekmek, kraker ve tatlı çeşitleri.',
    ),
    (
      title: 'Renkli Atıştırmalık Kolisi',
      brand: 'Sürpriz Marka',
      image: 'assets/images/bag-market.jpg',
      price: 319,
      oldPrice: 690,
      description: 'Ambalajı değişen veya sezon sonu olan nefis ürünler.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fazla stok kolileri')),
      body: ResponsiveContent(
        maxWidth: 900,
        padding: const EdgeInsets.fromLTRB(18, 6, 18, 32),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.all(23),
                decoration: BoxDecoration(
                  color: AppColors.forest,
                  borderRadius: BorderRadius.circular(28),
                ),
                child: const Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Kargoyla kurtar',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          SizedBox(height: 7),
                          Text(
                            'Fazla stok ürünleri sürpriz kolilerle kapına gelsin.',
                            style: TextStyle(
                              height: 1.45,
                              fontSize: 11,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 16),
                    Icon(
                      Icons.inventory_2_rounded,
                      color: AppColors.lime,
                      size: 54,
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 18)),
            SliverLayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.crossAxisExtent >= 720 ? 3 : 1;
                return SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 14,
                    childAspectRatio: columns == 1 ? 1.42 : .67,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _ParcelCard(parcel: parcels[index]),
                    childCount: parcels.length,
                  ),
                );
              },
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 20)),
            const SliverToBoxAdapter(
              child: Text(
                'Bu bölüm dummy ödeme ve teslimat verisi kullanır. Gerçek stok, adres ve kargo uçları API sözleşmesinde tanımlanmıştır.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  height: 1.5,
                  fontSize: 10,
                  color: AppColors.muted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParcelCard extends StatelessWidget {
  const _ParcelCard({required this.parcel});

  final ({
    String title,
    String brand,
    String image,
    int price,
    int oldPrice,
    String description,
  })
  parcel;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 4,
            child: Image.asset(parcel.image, fit: BoxFit.cover),
          ),
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    parcel.brand.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 8,
                      letterSpacing: .8,
                      fontWeight: FontWeight.w900,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    parcel.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      color: AppColors.forest,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    parcel.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      height: 1.35,
                      fontSize: 9,
                      color: AppColors.muted,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      Text(
                        '${parcel.price} ₺',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.forest,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        '${parcel.oldPrice} ₺',
                        style: const TextStyle(
                          fontSize: 10,
                          decoration: TextDecoration.lineThrough,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  PrimaryButton(
                    label: 'Sepete ekle',
                    height: 42,
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${parcel.title} demo sepete eklendi.'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
