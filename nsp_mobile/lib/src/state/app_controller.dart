import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/repositories.dart';
import '../models/domain.dart';
import '../config/app_config.dart';
import '../services/crypto_ws_service.dart';

class AppController extends ChangeNotifier {
  final RatesRepository ratesRepo;
  final ArticlesRepository articlesRepo;
  final CryptoWsService cryptoWs;

  AppController({
    required this.ratesRepo,
    required this.articlesRepo,
    required this.cryptoWs,
  });

  bool loading = true;
  String? error;
  bool isArabic = true;

  List<CurrencyRate> currencies = [];
  GoldPrice? goldPrice;
  List<FuelPrice> fuelPrices = [];
  List<ForexRate> forexRates = [];
  List<CryptoRate> cryptoRates = [];
  List<Article> articles = [];

  Timer? _pollTimer;

  Future<void> init() async {
    await refreshAll();
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      AppConfig.snapshotRefreshInterval,
      (_) => refreshMarketsOnly(),
    );
  }

  Future<void> refreshAll() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final bundle = await ratesRepo.fetchRatesBundle();
      final fx = await ratesRepo.fetchForex();
      final (cr, wsCodes) = await ratesRepo.fetchCrypto();
      final arts = await articlesRepo.fetchArticles();

      currencies = bundle.rates;
      goldPrice = bundle.goldPrice;
      fuelPrices = bundle.fuelPrices;
      forexRates = fx;
      cryptoRates = cr;
      articles = arts;

      cryptoWs.connect(
        codes: wsCodes.isNotEmpty ? wsCodes : cr.map((e) => e.code).toList(),
        onTick: _onCryptoTick,
        bridgeUrl: AppConfig.mobileWsBridgeUrl,
        onSnapshot: _applyBridgeSnapshot,
      );
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshMarketsOnly() async {
    try {
      final bundle = await ratesRepo.fetchRatesBundle();
      final fx = await ratesRepo.fetchForex();
      final (cr, _) = await ratesRepo.fetchCrypto();
      currencies = bundle.rates;
      goldPrice = bundle.goldPrice;
      fuelPrices = bundle.fuelPrices;
      forexRates = fx;
      // keep live-updated prices, only fill missing rows from fresh snapshot
      final oldMap = {for (final c in cryptoRates) c.code: c};
      cryptoRates = cr
          .map((c) => oldMap[c.code]?.copyWith(change: c.change) ?? c)
          .toList();
      notifyListeners();
    } catch (_) {
      // ignore background failures
    }
  }

  void toggleLocale() {
    isArabic = !isArabic;
    notifyListeners();
  }

  String displayName(String ar, String en) => isArabic ? ar : (en.isEmpty ? ar : en);

  void _onCryptoTick(String code, double price) {
    bool touched = false;
    cryptoRates = cryptoRates.map((c) {
      if (c.code.toUpperCase() != code.toUpperCase()) return c;
      touched = true;
      final prev = c.price;
      final pct = prev > 0 ? ((price - prev) / prev) * 100 : c.change;
      return c.copyWith(price: price, change: pct);
    }).toList();
    if (touched) notifyListeners();
  }

  void _applyBridgeSnapshot(Map<String, dynamic> payload) {
    final fxList = (payload['forex'] as List?) ?? const [];
    final ratesList = (payload['rates'] as List?) ?? const [];
    if (fxList.isNotEmpty) {
      forexRates = fxList
          .map((e) => ForexRate.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    }
    if (ratesList.isNotEmpty) {
      currencies = ratesList
          .map((e) => CurrencyRate.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    }
    notifyListeners();
  }

  Future<Article> loadArticle(String slug) => articlesRepo.fetchArticleBySlug(slug);

  @override
  void dispose() {
    _pollTimer?.cancel();
    cryptoWs.disconnect();
    super.dispose();
  }
}
