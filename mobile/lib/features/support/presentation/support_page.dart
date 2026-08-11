import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

class SupportPage extends StatefulWidget {
  const SupportPage({super.key});

  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  int open = 0;
  static const faqs = [
    (
      'Paketimi belirtilen saat dışında alabilir miyim?',
      'Teslim kaydırıcısı yalnızca mağazanın belirlediği zaman aralığında aktif olur.',
    ),
    (
      'İçerikte ne olduğunu önceden görebilir miyim?',
      'Paket kategorisi ve örnek içeriği gösterilir; gerçek içerik o gün kalan ürünlere göre değişir.',
    ),
    (
      'Siparişimi nasıl iptal ederim?',
      'Aktif sipariş detayından teslim saatinden iki saat öncesine kadar ücretsiz iptal talebi oluşturabilirsin.',
    ),
    (
      'Bir arkadaşım benim yerime alabilir mi?',
      'Evet. Aktif siparişteki arkadaşına gönder özelliği tek kullanımlık teslim bağlantısı üretir.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yardım merkezi')),
      body: ResponsiveContent(
        maxWidth: 720,
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        child: ListView(
          children: [
            const TextField(
              decoration: InputDecoration(
                hintText: 'Nasıl yardımcı olabiliriz?',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Popüler konular',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            ...List.generate(
              faqs.length,
              (index) => Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(21),
                  ),
                  child: ExpansionTile(
                    initiallyExpanded: open == index,
                    onExpansionChanged: (expanded) {
                      if (expanded) setState(() => open = index);
                    },
                    shape: const Border(),
                    title: Text(
                      faqs[index].$1,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: AppColors.forest,
                      ),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(17, 0, 17, 17),
                        child: Text(
                          faqs[index].$2,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.55,
                            color: AppColors.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: AppColors.forest,
                borderRadius: BorderRadius.circular(25),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.support_agent_rounded,
                    color: AppColors.lime,
                    size: 31,
                  ),
                  SizedBox(height: 14),
                  Text(
                    'Cevabı bulamadın mı?',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Destek talebi bırak; gerçek backend bağlandığında ekibimiz sana uygulama içinden yanıt versin.',
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.5,
                      color: Colors.white60,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            PrimaryButton(
              label: 'Destek talebi oluştur',
              onPressed: () => _showTicket(context),
            ),
          ],
        ),
      ),
    );
  }

  void _showTicket(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          22,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Yeni destek talebi',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 17),
            const DropdownMenu<String>(
              expandedInsets: EdgeInsets.zero,
              initialSelection: 'order',
              dropdownMenuEntries: [
                DropdownMenuEntry(value: 'order', label: 'Siparişim'),
                DropdownMenuEntry(value: 'account', label: 'Hesabım'),
                DropdownMenuEntry(value: 'payment', label: 'Ödeme / İade'),
              ],
            ),
            const SizedBox(height: 13),
            const TextField(
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Sorununu detaylıca anlat...',
              ),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Talebi hazırla',
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Demo talebi hazırlandı; sunucuya gönderilmedi.',
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
