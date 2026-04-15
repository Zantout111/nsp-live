class CurrencyRate {
  final String id;
  final String code;
  final String nameAr;
  final String nameEn;
  final double buyRate;
  final double sellRate;
  final double? changeBuyPct;
  final double? changeSellPct;

  CurrencyRate({
    required this.id,
    required this.code,
    required this.nameAr,
    required this.nameEn,
    required this.buyRate,
    required this.sellRate,
    this.changeBuyPct,
    this.changeSellPct,
  });

  factory CurrencyRate.fromJson(Map<String, dynamic> j) => CurrencyRate(
        id: (j['id'] ?? '').toString(),
        code: (j['code'] ?? '').toString(),
        nameAr: (j['nameAr'] ?? '').toString(),
        nameEn: (j['nameEn'] ?? '').toString(),
        buyRate: (j['buyRate'] as num?)?.toDouble() ?? 0,
        sellRate: (j['sellRate'] as num?)?.toDouble() ?? 0,
        changeBuyPct: (j['changeBuyPct'] as num?)?.toDouble(),
        changeSellPct: (j['changeSellPct'] as num?)?.toDouble(),
      );
}

class GoldPrice {
  final double priceUsd;
  final double pricePerGram;
  final double? pricePerGram21;
  final double? pricePerGram18;
  final double? pricePerGram14;

  GoldPrice({
    required this.priceUsd,
    required this.pricePerGram,
    this.pricePerGram21,
    this.pricePerGram18,
    this.pricePerGram14,
  });

  factory GoldPrice.fromJson(Map<String, dynamic> j) => GoldPrice(
        priceUsd: (j['priceUsd'] as num?)?.toDouble() ?? 0,
        pricePerGram: (j['pricePerGram'] as num?)?.toDouble() ?? 0,
        pricePerGram21: (j['pricePerGram21'] as num?)?.toDouble(),
        pricePerGram18: (j['pricePerGram18'] as num?)?.toDouble(),
        pricePerGram14: (j['pricePerGram14'] as num?)?.toDouble(),
      );
}

class FuelPrice {
  final String id;
  final String code;
  final String nameAr;
  final String nameEn;
  final String unitAr;
  final String unitEn;
  final double price;
  final double? changePct;

  FuelPrice({
    required this.id,
    required this.code,
    required this.nameAr,
    required this.nameEn,
    required this.unitAr,
    required this.unitEn,
    required this.price,
    this.changePct,
  });

  factory FuelPrice.fromJson(Map<String, dynamic> j) => FuelPrice(
        id: (j['id'] ?? '').toString(),
        code: (j['code'] ?? '').toString(),
        nameAr: (j['nameAr'] ?? '').toString(),
        nameEn: (j['nameEn'] ?? '').toString(),
        unitAr: (j['unitAr'] ?? '').toString(),
        unitEn: (j['unitEn'] ?? '').toString(),
        price: (j['price'] as num?)?.toDouble() ?? 0,
        changePct: (j['changePct'] as num?)?.toDouble(),
      );
}

class ForexRate {
  final String pair;
  final String nameAr;
  final String nameEn;
  final double rate;
  final double change;

  ForexRate({
    required this.pair,
    required this.nameAr,
    required this.nameEn,
    required this.rate,
    required this.change,
  });

  factory ForexRate.fromJson(Map<String, dynamic> j) => ForexRate(
        pair: (j['pair'] ?? '').toString(),
        nameAr: (j['nameAr'] ?? '').toString(),
        nameEn: (j['nameEn'] ?? '').toString(),
        rate: (j['rate'] as num?)?.toDouble() ?? 0,
        change: (j['change'] as num?)?.toDouble() ?? 0,
      );
}

class CryptoRate {
  final String code;
  final String nameAr;
  final String nameEn;
  final double price;
  final double change;

  CryptoRate({
    required this.code,
    required this.nameAr,
    required this.nameEn,
    required this.price,
    required this.change,
  });

  CryptoRate copyWith({double? price, double? change}) => CryptoRate(
        code: code,
        nameAr: nameAr,
        nameEn: nameEn,
        price: price ?? this.price,
        change: change ?? this.change,
      );

  factory CryptoRate.fromJson(Map<String, dynamic> j) => CryptoRate(
        code: (j['code'] ?? '').toString(),
        nameAr: (j['nameAr'] ?? '').toString(),
        nameEn: (j['nameEn'] ?? '').toString(),
        price: (j['price'] as num?)?.toDouble() ?? 0,
        change: (j['change'] as num?)?.toDouble() ?? 0,
      );
}

class Article {
  final String id;
  final String slug;
  final String title;
  final String description;
  final String content;
  final String? featuredImageUrl;
  final String? featuredImageAlt;
  final String? publishedAt;

  Article({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.content,
    this.featuredImageUrl,
    this.featuredImageAlt,
    this.publishedAt,
  });

  factory Article.fromJson(Map<String, dynamic> j) => Article(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        content: (j['content'] ?? '').toString(),
        featuredImageUrl: j['featuredImageUrl']?.toString(),
        featuredImageAlt: j['featuredImageAlt']?.toString(),
        publishedAt: j['publishedAt']?.toString(),
      );
}

class RatesBundle {
  final List<CurrencyRate> rates;
  final GoldPrice? goldPrice;
  final List<FuelPrice> fuelPrices;

  RatesBundle({
    required this.rates,
    required this.goldPrice,
    required this.fuelPrices,
  });
}

class CalculatorInput {
  final String category; // syp|currency|gold|fuel|crypto|forex
  final double amount;
  final String? code;
  final String? goldUnit;
  const CalculatorInput({
    required this.category,
    required this.amount,
    this.code,
    this.goldUnit,
  });
}
