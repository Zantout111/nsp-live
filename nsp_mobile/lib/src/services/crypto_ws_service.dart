import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

typedef CryptoTick = void Function(String code, double price);
typedef BridgeSnapshot = void Function(Map<String, dynamic> payload);

class CryptoWsService {
  WebSocketChannel? _ch;
  StreamSubscription? _sub;

  static String? _toSymbol(String code) {
    const fixed = <String, String>{
      'BTC': 'BTCUSDT',
      'ETH': 'ETHUSDT',
      'BNB': 'BNBUSDT',
      'XRP': 'XRPUSDT',
      'SOL': 'SOLUSDT',
      'ADA': 'ADAUSDT',
      'DOGE': 'DOGEUSDT',
      'TRX': 'TRXUSDT',
      'LTC': 'LTCUSDT',
      'DOT': 'DOTUSDT',
      'LINK': 'LINKUSDT',
      'AVAX': 'AVAXUSDT',
      'ATOM': 'ATOMUSDT',
      'USDC': 'USDCUSDT',
      'BCH': 'BCHUSDT',
      'ETC': 'ETCUSDT',
      'HBAR': 'HBARUSDT',
      'XLM': 'XLMUSDT',
      'FIL': 'FILUSDT',
      'NEAR': 'NEARUSDT',
      'APT': 'APTUSDT',
      'SUI': 'SUIUSDT',
      'PEPE': 'PEPEUSDT',
      'SHIB': 'SHIBUSDT',
      'VET': 'VETUSDT',
      'OP': 'OPUSDT',
      'UNI': 'UNIUSDT',
      'ICP': 'ICPUSDT',
    };
    final c = code.toUpperCase();
    if (c == 'USDT') return null;
    return fixed[c] ?? '${c}USDT';
  }

  void connect({
    required List<String> codes,
    required CryptoTick onTick,
    String? bridgeUrl,
    BridgeSnapshot? onSnapshot,
  }) {
    disconnect();
    if (bridgeUrl != null && bridgeUrl.isNotEmpty) {
      _connectBridgeFirst(
        bridgeUrl: bridgeUrl,
        codes: codes,
        onTick: onTick,
        onSnapshot: onSnapshot,
      );
      return;
    }
    _connectBinance(codes: codes, onTick: onTick);
  }

  void _connectBridgeFirst({
    required String bridgeUrl,
    required List<String> codes,
    required CryptoTick onTick,
    BridgeSnapshot? onSnapshot,
  }) {
    bool fellBack = false;

    void fallbackToBinance() {
      if (fellBack) return;
      fellBack = true;
      _connectBinance(codes: codes, onTick: onTick);
    }

    try {
      _ch = WebSocketChannel.connect(Uri.parse(bridgeUrl));
      _sub = _ch!.stream.listen(
        (event) {
          final parsed = jsonDecode(event.toString());
          if (parsed is! Map<String, dynamic>) return;
          final type = (parsed['type'] ?? '').toString();
          if (type == 'snapshot') {
            onSnapshot?.call(parsed);
            final crypto = (parsed['crypto'] as List?) ?? const [];
            for (final item in crypto) {
              final row = (item as Map).cast<String, dynamic>();
              final code = (row['code'] ?? '').toString().toUpperCase();
              final price = (row['price'] as num?)?.toDouble();
              if (code.isNotEmpty && price != null && price > 0) onTick(code, price);
            }
          }
        },
        onError: (_) => fallbackToBinance(),
        onDone: fallbackToBinance,
      );
    } catch (_) {
      fallbackToBinance();
    }
  }

  void _connectBinance({
    required List<String> codes,
    required CryptoTick onTick,
  }) {
    disconnect();
    final symbols = codes.map(_toSymbol).whereType<String>().toList();
    if (symbols.isEmpty) return;
    final streams = symbols.map((s) => '${s.toLowerCase()}@trade').join('/');
    final url = Uri.parse('wss://stream.binance.com:9443/stream?streams=$streams');
    final symbolToCode = <String, String>{
      for (final c in codes)
        if (_toSymbol(c) != null) _toSymbol(c)!.toUpperCase(): c.toUpperCase(),
    };

    _ch = WebSocketChannel.connect(url);
    _sub = _ch!.stream.listen((event) {
      try {
        final j = jsonDecode(event.toString()) as Map<String, dynamic>;
        final data = (j['data'] as Map?)?.cast<String, dynamic>() ?? const {};
        final symbol = (data['s'] ?? '').toString().toUpperCase();
        final p = double.tryParse((data['p'] ?? '').toString());
        if (symbol.isEmpty || p == null || p <= 0) return;
        final code = symbolToCode[symbol];
        if (code == null) return;
        onTick(code, p);
      } catch (_) {
        // Ignore malformed frame.
      }
    });
  }

  void disconnect() {
    _sub?.cancel();
    _sub = null;
    _ch?.sink.close();
    _ch = null;
  }
}
