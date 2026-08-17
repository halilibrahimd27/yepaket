import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import '../core/router/app_router.dart';
import '../core/router/deep_links.dart';
import '../core/theme/app_theme.dart';
import '../data/state/app_state.dart';

class YePaketApp extends StatefulWidget {
  const YePaketApp({required this.appState, super.key});

  final AppState appState;

  @override
  State<YePaketApp> createState() => _YePaketAppState();
}

class _YePaketAppState extends State<YePaketApp> {
  late final router = createAppRouter(widget.appState);
  late final _deepLinks = DeepLinkHandler(router);

  @override
  void initState() {
    super.initState();
    // Şifre sıfırlama e-postasındaki bağlantı buradan uygulamaya düşer.
    _deepLinks.start();
  }

  @override
  void dispose() {
    _deepLinks.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: widget.appState,
      child: MaterialApp.router(
        title: 'YePaket',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,

        // Material bileşenleri (tarih seçici, metin seçimi, "Cancel")
        // yerelleştirme olmadan İngilizce kalıyordu (O4).
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('tr', 'TR')],
        // Uygulama yalnızca Türkçe: cihaz dili ne olursa olsun arayüz
        // Türkçe kalır.
        localeResolutionCallback: (_, supported) => supported.first,
        locale: const Locale('tr', 'TR'),

        routerConfig: router,
      ),
    );
  }
}
