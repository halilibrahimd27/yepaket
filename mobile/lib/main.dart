import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/network/api_client.dart';
import 'core/network/api_config.dart';
import 'data/repositories/repositories.dart';
import 'data/state/app_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = ApiConfig.dummyMode ? AppState() : _remoteAppState();
  await appState.initialize();
  runApp(YePaketApp(appState: appState));
}

AppState _remoteAppState() {
  final client = ApiClient();
  return AppState(
    authRepository: RemoteAuthRepository(client),
    bagRepository: RemoteBagRepository(client),
    orderRepository: RemoteOrderRepository(client),
  );
}
