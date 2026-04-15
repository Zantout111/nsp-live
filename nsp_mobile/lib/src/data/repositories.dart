import '../models/domain.dart';
import 'api_client.dart';

class RatesRepository {
  final ApiClient api;
  RatesRepository(this.api);

  Future<RatesBundle> fetchRatesBundle() async {
    final j = await api.getJson('/api/rates?ts=${DateTime.now().millisecondsSinceEpoch}');
    final data = (j['data'] as Map<String, dynamic>? ?? const {});

    final rates = ((data['rates'] as List?) ?? const [])
        .map((e) => CurrencyRate.fromJson((e as Map).cast<String, dynamic>()))
        .toList();

    final goldJson = data['goldPrice'] as Map<String, dynamic>?;
    final fuel = ((data['fuelPrices'] as List?) ?? const [])
        .map((e) => FuelPrice.fromJson((e as Map).cast<String, dynamic>()))
        .toList();

    return RatesBundle(
      rates: rates,
      goldPrice: goldJson == null ? null : GoldPrice.fromJson(goldJson),
      fuelPrices: fuel,
    );
  }

  Future<List<ForexRate>> fetchForex() async {
    final j = await api.getJson('/api/forex?ts=${DateTime.now().millisecondsSinceEpoch}');
    final data = (j['data'] as List?) ?? const [];
    return data
        .map((e) => ForexRate.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<(List<CryptoRate>, List<String>)> fetchCrypto() async {
    final j = await api.getJson('/api/crypto?ts=${DateTime.now().millisecondsSinceEpoch}');
    final data = (j['data'] as List?) ?? const [];
    final realtime = (j['realtime'] as Map<String, dynamic>? ?? const {});
    final codes = ((realtime['codes'] as List?) ?? const [])
        .map((e) => e.toString().toUpperCase())
        .toList();
    return (
      data.map((e) => CryptoRate.fromJson((e as Map).cast<String, dynamic>())).toList(),
      codes
    );
  }
}

class ArticlesRepository {
  final ApiClient api;
  ArticlesRepository(this.api);

  Future<List<Article>> fetchArticles() async {
    final j = await api.getJson('/api/articles');
    final data = (j['data'] as List?) ?? const [];
    return data
        .map((e) => Article.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Article> fetchArticleBySlug(String slug) async {
    final j = await api.getJson('/api/articles/$slug');
    final data = (j['data'] as Map<String, dynamic>? ?? const {});
    return Article.fromJson(data);
  }
}
