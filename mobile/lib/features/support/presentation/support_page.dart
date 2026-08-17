import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/models.dart';
import '../../../data/state/app_state.dart';
import '../../../shared/widgets/async_content.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/responsive_content.dart';

/// Sık sorulan sorular.
///
/// Sunucudan gelmesi gerekmez: içerik nadiren değişir ve çevrimdışıyken de
/// erişilebilir olması kullanıcıyı destek talebi açmaktan kurtarır.
const _faqs = [
  (
    'Paketimi belirtilen saat dışında alabilir miyim?',
    'Teslim kaydırıcısı yalnızca mağazanın belirlediği zaman aralığında aktif olur. Aralığı kaçırırsan işletmeyle iletişime geçmen gerekir.',
  ),
  (
    'İçerikte ne olduğunu önceden görebilir miyim?',
    'Paket kategorisi ve örnek içeriği gösterilir; gerçek içerik o gün kalan ürünlere göre değişir. Sürpriz olması işin doğasında var.',
  ),
  (
    'Siparişimi nasıl iptal ederim?',
    'Aktif sipariş detayından teslim saatinden iki saat öncesine kadar ücretsiz iptal edebilirsin. Sonrasında iade yapılmaz.',
  ),
  (
    'Bir arkadaşım benim yerime alabilir mi?',
    'Evet. Aktif siparişteki "arkadaşına gönder" özelliği tek kullanımlık teslim bağlantısı üretir.',
  ),
  (
    'Ödemem ne zaman iade edilir?',
    'İade, ödeme kuruluşuna bildirildikten sonra bankana bağlı olarak 3–10 iş günü içinde kartına yansır.',
  ),
  (
    'Alerjen bilgisi var mı?',
    'Paket açıklamasında işletmenin bildirdiği alerjenler yer alır. Ciddi alerjin varsa siparişten önce işletmeyi aramanı öneririz.',
  ),
];

/// Destek kategorileri — sunucudaki `SupportCategory` sıralamasıyla aynı.
const _categories = [
  ('ORDER', 'Siparişim'),
  ('ACCOUNT', 'Hesabım'),
  ('PAYMENT', 'Ödeme / İade'),
  ('PARTNER', 'İşletme başvurusu'),
  ('OTHER', 'Diğer'),
];

class SupportPage extends StatefulWidget {
  const SupportPage({super.key});

  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  final _searchController = TextEditingController();
  int _open = -1;
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().refreshSupportTickets();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<(String, String)> get _visibleFaqs {
    if (_query.trim().isEmpty) return _faqs;
    final needle = _query.toLowerCase();
    return _faqs
        .where(
          (faq) =>
              faq.$1.toLowerCase().contains(needle) ||
              faq.$2.toLowerCase().contains(needle),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final faqs = _visibleFaqs;

    return Scaffold(
      appBar: AppBar(title: const Text('Yardım merkezi')),
      body: ResponsiveContent(
        maxWidth: 720,
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        child: ListView(
          children: [
            TextField(
              controller: _searchController,
              onChanged: (value) => setState(() {
                _query = value;
                _open = -1;
              }),
              decoration: InputDecoration(
                hintText: 'Nasıl yardımcı olabiliriz?',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => setState(() {
                          _searchController.clear();
                          _query = '';
                        }),
                      ),
              ),
            ),
            const SizedBox(height: 24),

            if (state.supportTickets.isNotEmpty) ...[
              Text(
                'Taleplerin',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              ...state.supportTickets.map(
                (ticket) => Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: _TicketCard(ticket: ticket),
                ),
              ),
              const SizedBox(height: 20),
            ],

            Text(
              _query.isEmpty ? 'Popüler konular' : 'Sonuçlar',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),

            if (faqs.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  '"$_query" için sonuç bulunamadı. Aşağıdan destek talebi '
                  'oluşturabilirsin.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted, height: 1.5),
                ),
              )
            else
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
                      key: ValueKey(faqs[index].$1),
                      initiallyExpanded: _open == index,
                      onExpansionChanged: (expanded) {
                        if (expanded) setState(() => _open = index);
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
                    'Destek talebi bırak; ekibimiz e-posta ile en geç bir iş '
                    'günü içinde dönüş yapar.',
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
              onPressed: _showTicketSheet,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showTicketSheet() async {
    final created = await showModalBottomSheet<SupportTicket>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (_) => const _TicketForm(),
    );

    if (!mounted || created == null) return;

    showInfoSnack(
      context,
      'Talebin alındı (${created.ticketNo}). E-posta ile döneceğiz.',
    );
  }
}

// -----------------------------------------------------------------------------

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});
  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ticket.subject,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: AppColors.forest,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${ticket.ticketNo} · ${Formats.relative(ticket.createdAt)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.limeSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              ticket.statusLabel,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: AppColors.forest,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Destek talebi formu.
///
/// Ayrı bir widget: `showModalBottomSheet` içinde durum tutmak için kendi
/// `State`'i gerekiyor ve form doğrulaması sunucuya gitmeden önce yapılmalı.
class _TicketForm extends StatefulWidget {
  const _TicketForm();

  @override
  State<_TicketForm> createState() => _TicketFormState();
}

class _TicketFormState extends State<_TicketForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();

  String _category = 'ORDER';
  String? _orderId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    // Giriş yapmışsa ad/e-posta önceden dolu gelir.
    final user = context.read<AppState>().user;
    if (user != null) {
      _nameController.text = user.name;
      _emailController.text = user.email;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);

    final result = await context.read<AppState>().createSupportTicket(
      name: _nameController.text.trim(),
      email: _emailController.text.trim(),
      subject: _subjectController.text.trim(),
      message: _messageController.text.trim(),
      category: _category,
      orderId: _category == 'ORDER' ? _orderId : null,
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    switch (result) {
      case Success(value: final ticket):
        Navigator.of(context).pop(ticket);
      case Failure(message: final message):
        showErrorSnack(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = context.read<AppState>().orders;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        22,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Yeni destek talebi',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 17),

              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Konu'),
                items: _categories
                    .map(
                      (entry) => DropdownMenuItem(
                        value: entry.$1,
                        child: Text(entry.$2),
                      ),
                    )
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _category = value ?? 'OTHER'),
              ),
              const SizedBox(height: 13),

              if (_category == 'ORDER' && orders.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  initialValue: _orderId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'İlgili sipariş (isteğe bağlı)',
                  ),
                  items: orders
                      .map(
                        (order) => DropdownMenuItem(
                          value: order.id,
                          child: Text(
                            '${order.orderNo} · ${order.bag.store}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _submitting
                      ? null
                      : (value) => setState(() => _orderId = value),
                ),
                const SizedBox(height: 13),
              ],

              TextFormField(
                controller: _nameController,
                enabled: !_submitting,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Adın'),
                validator: (value) => (value ?? '').trim().length < 2
                    ? 'Adını yazar mısın?'
                    : null,
              ),
              const SizedBox(height: 13),

              TextFormField(
                controller: _emailController,
                enabled: !_submitting,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-posta'),
                validator: (value) {
                  final email = (value ?? '').trim();
                  // Yanıtı buraya göndereceğiz; hatalı adres talebi kayıp eder.
                  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
                    return 'Geçerli bir e-posta adresi gir.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 13),

              TextFormField(
                controller: _subjectController,
                enabled: !_submitting,
                maxLength: 160,
                decoration: const InputDecoration(labelText: 'Başlık'),
                validator: (value) => (value ?? '').trim().length < 3
                    ? 'Kısa bir başlık yazar mısın?'
                    : null,
              ),
              const SizedBox(height: 4),

              TextFormField(
                controller: _messageController,
                enabled: !_submitting,
                maxLines: 4,
                maxLength: 4000,
                decoration: const InputDecoration(
                  hintText: 'Sorununu detaylıca anlat...',
                ),
                validator: (value) => (value ?? '').trim().length < 10
                    ? 'Biraz daha detay verir misin? (en az 10 karakter)'
                    : null,
              ),
              const SizedBox(height: 16),

              PrimaryButton(
                label: 'Talebi gönder',
                loading: _submitting,
                onPressed: _submitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
