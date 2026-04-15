import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:intl/intl.dart' as intl;

import 'src/config/app_config.dart';
import 'src/data/api_client.dart';
import 'src/data/repositories.dart';
import 'src/services/crypto_ws_service.dart';
import 'src/state/app_controller.dart';

void main() {
  runApp(const NspMobileApp());
}

class NspMobileApp extends StatelessWidget {
  const NspMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'NSP Mobile',
      theme: ThemeData(colorSchemeSeed: Colors.blue, useMaterial3: true),
      home: const AppBootstrap(),
    );
  }
}

class AppBootstrap extends StatefulWidget {
  const AppBootstrap({super.key});

  @override
  State<AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends State<AppBootstrap> {
  late final AppController controller;
  int navIndex = 0;

  @override
  void initState() {
    super.initState();
    final api = ApiClient(baseUrl: AppConfig.baseUrl);
    controller = AppController(
      ratesRepo: RatesRepository(api),
      articlesRepo: ArticlesRepository(api),
      cryptoWs: CryptoWsService(),
    )..init();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final isAr = controller.isArabic;
        final body = switch (navIndex) {
          0 => _MarketsScreen(controller: controller),
          1 => _ArticlesScreen(controller: controller),
          _ => _CalculatorScreen(controller: controller),
        };
        return Directionality(
          textDirection: isAr ? ui.TextDirection.rtl : ui.TextDirection.ltr,
          child: Scaffold(
            appBar: AppBar(
              title: Text(isAr ? 'ليرة لايف - التطبيق' : 'NSP Live - Mobile'),
              actions: [
                IconButton(
                  onPressed: controller.toggleLocale,
                  icon: const Icon(Icons.language),
                  tooltip: isAr ? 'تبديل اللغة' : 'Switch language',
                ),
                IconButton(
                  onPressed: controller.refreshAll,
                  icon: const Icon(Icons.refresh),
                  tooltip: isAr ? 'تحديث' : 'Refresh',
                ),
              ],
            ),
            body: controller.loading
                ? const Center(child: CircularProgressIndicator())
                : controller.error != null
                    ? Padding(
                        padding: const EdgeInsets.all(16),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isAr ? 'تعذر الاتصال بالخادم' : 'Failed to connect to backend',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${isAr ? 'API الحالي' : 'Current API'}: ${AppConfig.baseUrl}',
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                controller.error!,
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      )
                    : body,
            bottomNavigationBar: NavigationBar(
              selectedIndex: navIndex,
              onDestinationSelected: (v) => setState(() => navIndex = v),
              destinations: [
                NavigationDestination(
                  icon: const Icon(Icons.show_chart),
                  label: isAr ? 'الأسواق' : 'Markets',
                ),
                NavigationDestination(
                  icon: const Icon(Icons.article_outlined),
                  label: isAr ? 'المقالات' : 'Articles',
                ),
                NavigationDestination(
                  icon: const Icon(Icons.calculate_outlined),
                  label: isAr ? 'الحاسبة' : 'Calculator',
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MarketsScreen extends StatefulWidget {
  final AppController controller;
  const _MarketsScreen({required this.controller});

  @override
  State<_MarketsScreen> createState() => _MarketsScreenState();
}

class _MarketsScreenState extends State<_MarketsScreen> with SingleTickerProviderStateMixin {
  late final TabController tabs;

  @override
  void initState() {
    super.initState();
    tabs = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    tabs.dispose();
    super.dispose();
  }

  String _fmt(num n, {int d = 2}) => intl.NumberFormat('#,##0.${'0' * d}').format(n);

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final isAr = c.isArabic;
    final usd = c.currencies.where((e) => e.code == 'USD').firstOrNull;

    return Column(
      children: [
        TabBar(
          controller: tabs,
          isScrollable: true,
          tabs: [
            Tab(text: isAr ? 'العملات' : 'Currencies'),
            Tab(text: isAr ? 'الذهب' : 'Gold'),
            Tab(text: isAr ? 'المحروقات' : 'Fuel'),
            Tab(text: isAr ? 'البورصات' : 'Global'),
            Tab(text: isAr ? 'كريبتو' : 'Crypto'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: tabs,
            children: [
              ListView(
                children: c.currencies
                    .map((r) => ListTile(
                          title: Text('${c.displayName(r.nameAr, r.nameEn)} (${r.code})'),
                          subtitle: Text('${isAr ? 'شراء' : 'Buy'} ${_fmt(r.buyRate)}  |  ${isAr ? 'بيع' : 'Sell'} ${_fmt(r.sellRate)}'),
                          trailing: Text('${(r.changeBuyPct ?? 0).toStringAsFixed(2)}%'),
                        ))
                    .toList(),
              ),
              ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(child: ListTile(title: const Text('USD/oz'), trailing: Text('\$${_fmt(c.goldPrice?.priceUsd ?? 0)}'))),
                  Card(child: ListTile(title: const Text('24K g'), trailing: Text('\$${_fmt(c.goldPrice?.pricePerGram ?? 0, d: 3)}'))),
                  if ((c.goldPrice?.pricePerGram21 ?? 0) > 0)
                    Card(child: ListTile(title: const Text('21K g'), trailing: Text('\$${_fmt(c.goldPrice!.pricePerGram21!, d: 3)}'))),
                  if ((c.goldPrice?.pricePerGram18 ?? 0) > 0)
                    Card(child: ListTile(title: const Text('18K g'), trailing: Text('\$${_fmt(c.goldPrice!.pricePerGram18!, d: 3)}'))),
                  if ((c.goldPrice?.pricePerGram14 ?? 0) > 0)
                    Card(child: ListTile(title: const Text('14K g'), trailing: Text('\$${_fmt(c.goldPrice!.pricePerGram14!, d: 3)}'))),
                ],
              ),
              ListView(
                children: c.fuelPrices.map((f) {
                  final usdPrice = (usd != null && usd.buyRate > 0) ? (f.price / usd.buyRate) : null;
                  return ListTile(
                    title: Text(c.displayName(f.nameAr, f.nameEn)),
                    subtitle: Text('≈ ${_fmt(f.price)} ${isAr ? 'ل.س' : 'SYP'}'),
                    trailing: Text(usdPrice == null ? '---' : '\$${_fmt(usdPrice, d: 3)}'),
                  );
                }).toList(),
              ),
              ListView(
                children: c.forexRates
                    .map((f) => ListTile(
                          title: Text(c.displayName(f.nameAr, f.nameEn)),
                          subtitle: Text(f.pair),
                          trailing: Text(_fmt(f.rate, d: 5)),
                        ))
                    .toList(),
              ),
              ListView(
                children: c.cryptoRates
                    .map((r) => ListTile(
                          title: Text('${c.displayName(r.nameAr, r.nameEn)} (${r.code})'),
                          subtitle: Text('${r.change.toStringAsFixed(2)}%'),
                          trailing: Text('\$${_fmt(r.price, d: r.price > 1 ? 2 : 6)}'),
                        ))
                    .toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ArticlesScreen extends StatelessWidget {
  final AppController controller;
  const _ArticlesScreen({required this.controller});

  @override
  Widget build(BuildContext context) {
    final isAr = controller.isArabic;
    return ListView.builder(
      itemCount: controller.articles.length,
      itemBuilder: (context, i) {
        final a = controller.articles[i];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: ListTile(
            leading: a.featuredImageUrl != null ? const Icon(Icons.image) : const Icon(Icons.description_outlined),
            title: Text(a.title),
            subtitle: Text(
              a.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            onTap: () async {
              final details = await controller.loadArticle(a.slug);
              if (!context.mounted) return;
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => Directionality(
                    textDirection: isAr ? ui.TextDirection.rtl : ui.TextDirection.ltr,
                    child: Scaffold(
                      appBar: AppBar(title: Text(details.title)),
                      body: Markdown(
                        data: details.content,
                        padding: const EdgeInsets.all(16),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _CalculatorScreen extends StatefulWidget {
  final AppController controller;
  const _CalculatorScreen({required this.controller});

  @override
  State<_CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<_CalculatorScreen> {
  final amountCtrl = TextEditingController(text: '100');
  String source = 'USD';

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final isAr = c.isArabic;
    final amount = double.tryParse(amountCtrl.text) ?? 0;
    final src = c.currencies.where((e) => e.code == source).firstOrNull;
    final syp = (src == null || src.sellRate <= 0) ? 0 : amount * src.sellRate;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(isAr ? 'حاسبة تحويل سريعة' : 'Quick converter', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(
            controller: amountCtrl,
            decoration: InputDecoration(labelText: isAr ? 'المبلغ' : 'Amount'),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          DropdownButton<String>(
            value: source,
            items: c.currencies
                .map((x) => DropdownMenuItem(value: x.code, child: Text('${x.code} - ${c.displayName(x.nameAr, x.nameEn)}')))
                .toList(),
            onChanged: (v) => setState(() => source = v ?? source),
          ),
          const SizedBox(height: 16),
          Text('${isAr ? 'المكافئ بالليرة السورية' : 'Equivalent in SYP'}: ${intl.NumberFormat('#,##0').format(syp)}'),
          const SizedBox(height: 10),
          Expanded(
            child: ListView(
              children: c.currencies.take(10).map((x) {
                final out = x.buyRate > 0 ? syp / x.buyRate : 0;
                return ListTile(
                  title: Text('${c.displayName(x.nameAr, x.nameEn)} (${x.code})'),
                  trailing: Text(intl.NumberFormat('#,##0.####').format(out)),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
