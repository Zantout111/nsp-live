import 'package:flutter/foundation.dart';

class AppConfig {
  static const String _apiBaseFromEnv = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const String _mobileWsFromEnv = String.fromEnvironment(
    'MOBILE_WS_URL',
    defaultValue: '',
  );

  /// Auto-selects host for local development if no dart-define is provided:
  /// - Android emulator: 10.0.2.2
  /// - Other platforms: localhost
  static String get baseUrl {
    if (_apiBaseFromEnv.isNotEmpty) return _apiBaseFromEnv;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  static const Duration snapshotRefreshInterval = Duration(seconds: 12);

  static String get mobileWsBridgeUrl {
    if (_mobileWsFromEnv.isNotEmpty) return _mobileWsFromEnv;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'ws://10.0.2.2:3101';
    }
    return 'ws://localhost:3101';
  }
}
