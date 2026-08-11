import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/router/app_router.dart';
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

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: widget.appState,
      child: MaterialApp.router(
        title: 'YePaket',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: router,
      ),
    );
  }
}
