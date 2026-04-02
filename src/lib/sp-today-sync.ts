import type { PrismaClient } from '@prisma/client';
import {
  fetchCoinGeckoForCodes,
  fetchFrankfurterUsdRates,
  forexPairsFromFrankfurter,
} from '@/lib/free-market-rates';
import {
  applyAdjustmentToNumber,
  type CategorySyncConfig,
  type SyncCategoryId,
  type SyncConfigV1,
} from '@/lib/sync-config';
import {
  upsertExchangeRateWithSnapshot,
  updateLatestGoldWithSnapshot,
  updateFuelPriceWithSnapshot,
} from '@/lib/rate-snapshot';

const SP = {
  currencies: 'https://sp-today.com/en/currencies',
  gold: 'https://sp-today.com/en/gold',
  energy: 'https://sp-today.com/en/energy',
  crypto: 'https://sp-today.com/en/crypto',
} as const;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ScrapedCurrency {
  code: string;
  buyRate: number;
  sellRate: number;
}

export async function fetchSpTodayHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  if (!html || html.length < 2000) {
    throw new Error(`Short or empty response from ${url}`);
  }
  return html;
}

/** كل أكواد العملات الظاهرة في الجدول (ثلاثة أحرف كبيرة) */
export function extractCurrencyRatesFromHTML(html: string): ScrapedCurrency[] {
  const rates: ScrapedCurrency[] = [];
  const seen = new Set<string>();
  const re =
    /<span class="font-bold block">([A-Z]{3})<\/span>[\s\S]*?<span[^>]*class="[^"]*font-mono[^"]*font-bold[^"]*text-lg[^"]*"[^>]*>([\d,]+)<\/span>[\s\S]*?<span[^>]*class="[^"]*font-mono[^"]*font-bold[^"]*text-lg[^"]*"[^>]*>([\d,]+)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    if (seen.has(code)) continue;
    const buyRate = parseInt(m[2].replace(/,/g, ''), 10);
    const sellRate = parseInt(m[3].replace(/,/g, ''), 10);
    if (!isNaN(buyRate) && !isNaN(sellRate) && buyRate > 0 && sellRate > 0) {
      seen.add(code);
      rates.push({ code, buyRate, sellRate });
    }
  }
  return rates;
}

function applyPair(buy: number, sell: number, c: CategorySyncConfig): { buy: number; sell: number } {
  return {
    buy: applyAdjustmentToNumber(buy, c),
    sell: applyAdjustmentToNumber(sell, c),
  };
}

/**
 * يحاكي "سلوك سوق" بسيط: بعد تطبيق التعديل، نختار نقطة عشوائية
 * بين السعر الخام من SP Today والسعر بعد التعديل.
 * - في الزيادة: الخام حد أدنى، والمعدل حد أعلى.
 * - في النقصان: المعدل حد أدنى، والخام حد أعلى.
 */
function applyPairWithRandomSwing(
  buy: number,
  sell: number,
  c: CategorySyncConfig
): { buy: number; sell: number } {
  const adjusted = applyPair(buy, sell, c);
  const dBuy = adjusted.buy - buy;
  const dSell = adjusted.sell - sell;
  if ((!Number.isFinite(dBuy) && !Number.isFinite(dSell)) || (dBuy === 0 && dSell === 0)) {
    return adjusted;
  }
  const t = Math.random(); // نفس المعامل للشراء والبيع للحفاظ على شكل السبريد
  return {
    buy: Math.max(0, buy + dBuy * t),
    sell: Math.max(0, sell + dSell * t),
  };
}

/** حركة أبطأ وأكثر إقناعاً: خطوة تدريجية من السعر السابق نحو الهدف. */
function smoothTowardTarget(prev: number | null, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (prev == null || !Number.isFinite(prev) || prev <= 0) return target;
  const diff = target - prev;
  if (diff === 0) return prev;

  // سقف الحركة في كل دورة (حوالي 0.35% مع حد أدنى عددي).
  const maxStep = Math.max(15, Math.abs(prev) * 0.0035);
  const signedStep = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
  // نعومة إضافية: لا نأخذ كامل الخطوة دائماً.
  const softness = 0.72 + Math.random() * 0.2; // 72%..92%
  return Math.max(0, prev + signedStep * softness);
}

export function extractGoldUsd(html: string): { priceUsd: number; pricePerGram: number } | null {
  const ounce = html.match(
    /<h3 class="text-lg font-bold mb-1">Ounce<\/h3><p class="font-mono font-bold">\$<!-- -->([\d,]+)<\/p>/
  );
  const g24 = html.match(
    /<h3 class="text-lg font-bold text-amber-500 mb-1">24K<\/h3><p class="font-mono font-bold">\$<!-- -->([\d,.]+)<\/p>/
  );
  if (!ounce || !g24) return null;
  const priceUsd = parseFloat(ounce[1].replace(/,/g, ''));
  const pricePerGram = parseFloat(g24[1].replace(/,/g, ''));
  if (isNaN(priceUsd) || isNaN(pricePerGram) || priceUsd <= 0 || pricePerGram <= 0) return null;
  return { priceUsd, pricePerGram };
}

/** بنزين / ديزل / غاز مسال من صفحة الطاقة */
export function extractFuelSypFromEnergy(html: string): {
  gasoline?: number;
  diesel?: number;
  lpg?: number;
} {
  const out: { gasoline?: number; diesel?: number; lpg?: number } = {};
  const g = html.match(/Gasoline[\s\S]*?SYP[\s\S]*?≈ <!-- -->([\d,]+)/);
  const d = html.match(/Diesel[\s\S]*?SYP[\s\S]*?≈ <!-- -->([\d,]+)/);
  const l = html.match(/LPG Gas[\s\S]*?SYP[\s\S]*?≈ <!-- -->([\d,]+)/);
  if (g) {
    const n = parseInt(g[1].replace(/,/g, ''), 10);
    if (!isNaN(n) && n > 0) out.gasoline = n;
  }
  if (d) {
    const n = parseInt(d[1].replace(/,/g, ''), 10);
    if (!isNaN(n) && n > 0) out.diesel = n;
  }
  if (l) {
    const n = parseInt(l[1].replace(/,/g, ''), 10);
    if (!isNaN(n) && n > 0) out.lpg = n;
  }
  return out;
}

export function extractCryptoTable(html: string): Map<string, { price: number; change: number }> {
  const map = new Map<string, { price: number; change: number }>();
  const re =
    /<p class="text-sm text-\[var\(--muted\)\]">([A-Z0-9]{2,12})<\/p>[\s\S]*?<td class="px-4 py-4 text-end font-mono font-medium">\$<!-- -->([\d,.]+)<\/td>[\s\S]*?<span[^>]*>(▼|▲)<!-- -->([\d.-]+)<!-- -->%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    const price = parseFloat(m[2].replace(/,/g, ''));
    const rawCh = parseFloat(m[4]);
    const change = m[3] === '▼' ? -Math.abs(rawCh) : Math.abs(rawCh);
    if (!isNaN(price) && price > 0 && !isNaN(change)) {
      map.set(code, { price, change });
    }
  }
  return map;
}

/** EUR/USD = دولار لكل يورو من أسعار الشراء بالليرة */
const FOREX_FORMULA: Record<string, (b: Record<string, number>) => number | null> = {
  'EUR/USD': (x) => (x.EUR && x.USD ? x.EUR / x.USD : null),
  'GBP/USD': (x) => (x.GBP && x.USD ? x.GBP / x.USD : null),
  'USD/JPY': (x) => (x.USD && x.JPY ? x.USD / x.JPY : null),
  'USD/CHF': (x) => (x.USD && x.CHF ? x.USD / x.CHF : null),
  'AUD/USD': (x) => (x.AUD && x.USD ? x.AUD / x.USD : null),
  'USD/CAD': (x) => (x.USD && x.CAD ? x.USD / x.CAD : null),
  'EUR/GBP': (x) => (x.EUR && x.GBP ? x.EUR / x.GBP : null),
  'EUR/JPY': (x) => (x.EUR && x.JPY ? x.EUR / x.JPY : null),
};

export type CategorySyncResult = {
  ok: boolean;
  message?: string;
  updated?: number;
};

export async function executeSpTodaySync(options: {
  db: PrismaClient;
  config: SyncConfigV1;
  categories: SyncCategoryId[];
}): Promise<{
  results: Partial<Record<SyncCategoryId, CategorySyncResult>>;
  config: SyncConfigV1;
}> {
  const { db, config } = options;
  const results: Partial<Record<SyncCategoryId, CategorySyncResult>> = {};
  const catSet = new Set(options.categories);
  const now = new Date().toISOString();
  const nextConfig: SyncConfigV1 = JSON.parse(JSON.stringify(config));

  const mark = (id: SyncCategoryId, r: CategorySyncResult) => {
    results[id] = r;
    if (r.ok) {
      nextConfig.lastFetchedAt[id] = now;
    }
  };

  if (catSet.has('currencies')) {
    const c = config.categories.currencies;
    try {
      const html = await fetchSpTodayHtml(SP.currencies);
      let rows = extractCurrencyRatesFromHTML(html);
      if (rows.length === 0) {
        mark('currencies', { ok: false, message: 'No currency rows parsed' });
      } else {
        rows = rows.map((row) => {
          const swung = applyPairWithRandomSwing(row.buyRate, row.sellRate, c);
          return { ...row, buyRate: swung.buy, sellRate: swung.sell };
        });
        let updated = 0;
        for (const rate of rows) {
          const currency = await db.currency.findFirst({ where: { code: rate.code } });
          if (!currency) continue;
          const prev = await db.exchangeRate.findFirst({
            where: { currencyId: currency.id },
            orderBy: { updatedAt: 'desc' },
          });
          const buyRate = smoothTowardTarget(prev?.buyRate ?? null, rate.buyRate);
          const sellRate = smoothTowardTarget(prev?.sellRate ?? null, rate.sellRate);
          await upsertExchangeRateWithSnapshot(db, {
            currencyId: currency.id,
            buyRate,
            sellRate,
          });
          updated++;
        }
        mark('currencies', { ok: true, updated, message: `${updated} عملات` });
      }
    } catch (e) {
      mark('currencies', { ok: false, message: String(e) });
    }
  }

  if (catSet.has('gold')) {
    const c = config.categories.gold;
    try {
      const html = await fetchSpTodayHtml(SP.gold);
      const raw = extractGoldUsd(html);
      if (!raw) {
        mark('gold', { ok: false, message: 'Could not parse gold USD' });
      } else {
        const priceUsd = applyAdjustmentToNumber(raw.priceUsd, c);
        const pricePerGram = applyAdjustmentToNumber(raw.pricePerGram, c);
        await updateLatestGoldWithSnapshot(db, { priceUsd, pricePerGram });
        mark('gold', { ok: true, updated: 1, message: 'Gold OK' });
      }
    } catch (e) {
      mark('gold', { ok: false, message: String(e) });
    }
  }

  if (catSet.has('fuel')) {
    const c = config.categories.fuel;
    try {
      const html = await fetchSpTodayHtml(SP.energy);
      const syp = extractFuelSypFromEnergy(html);
      if (!syp.gasoline && !syp.diesel && !syp.lpg) {
        mark('fuel', { ok: false, message: 'No fuel SYP parsed' });
      } else {
        const updates: { code: string; price: number }[] = [];
        if (syp.gasoline) {
          const p = applyAdjustmentToNumber(syp.gasoline, c);
          updates.push({ code: 'GASOLINE_95', price: Math.round(p) });
          updates.push({ code: 'GASOLINE_98', price: Math.round(p) });
        }
        if (syp.diesel) {
          updates.push({ code: 'DIESEL', price: Math.round(applyAdjustmentToNumber(syp.diesel, c)) });
        }
        if (syp.lpg) {
          updates.push({ code: 'LPG', price: Math.round(applyAdjustmentToNumber(syp.lpg, c)) });
        }
        let n = 0;
        for (const { code, price } of updates) {
          const row = await db.fuelPrice.findUnique({ where: { code } });
          if (row) {
            await updateFuelPriceWithSnapshot(db, code, price);
            n++;
          }
        }
        mark('fuel', { ok: true, updated: n, message: `${n} وقود` });
      }
    } catch (e) {
      mark('fuel', { ok: false, message: String(e) });
    }
  }

  if (catSet.has('crypto')) {
    const c = config.categories.crypto;
    try {
      const dbRows = await db.cryptoRate.findMany();
      const codes = dbRows.map((r) => r.code);
      const fromCg = await fetchCoinGeckoForCodes(codes);
      let n = 0;
      if (fromCg.size > 0) {
        for (const row of dbRows) {
          const s = fromCg.get(row.code);
          if (!s) continue;
          const prevPrice = row.price;
          const price = applyAdjustmentToNumber(s.price, c);
          const change =
            prevPrice !== 0 && Number.isFinite(prevPrice)
              ? ((price - prevPrice) / Math.abs(prevPrice)) * 100
              : 0;
          await db.cryptoRate.update({
            where: { code: row.code },
            data: { price, change, lastUpdated: new Date() },
          });
          n++;
        }
        mark('crypto', { ok: true, updated: n, message: `${n} عملات رقمية (CoinGecko)` });
      } else {
        const html = await fetchSpTodayHtml(SP.crypto);
        const scraped = extractCryptoTable(html);
        for (const row of dbRows) {
          const s = scraped.get(row.code);
          if (!s) continue;
          const prevPrice = row.price;
          const price = applyAdjustmentToNumber(s.price, c);
          const change =
            prevPrice !== 0 && Number.isFinite(prevPrice)
              ? ((price - prevPrice) / Math.abs(prevPrice)) * 100
              : 0;
          await db.cryptoRate.update({
            where: { code: row.code },
            data: { price, change, lastUpdated: new Date() },
          });
          n++;
        }
        mark('crypto', { ok: true, updated: n, message: `${n} عملات رقمية (SP Today)` });
      }
    } catch (e) {
      mark('crypto', { ok: false, message: String(e) });
    }
  }

  if (catSet.has('forex')) {
    const c = config.categories.forex;
    try {
      const pairs = await db.forexRate.findMany();
      const frUsd = await fetchFrankfurterUsdRates();
      const fromApi = frUsd ? forexPairsFromFrankfurter(frUsd) : null;
      let n = 0;
      if (fromApi && Object.keys(fromApi).length > 0) {
        for (const fr of pairs) {
          const raw = fromApi[fr.pair];
          if (raw == null || !isFinite(raw)) continue;
          const rate = applyAdjustmentToNumber(raw, c);
          const prev = fr.rate;
          const changePct = prev !== 0 ? ((rate - prev) / Math.abs(prev)) * 100 : 0;
          await db.forexRate.update({
            where: { pair: fr.pair },
            data: { rate, change: changePct, lastUpdated: new Date() },
          });
          n++;
        }
      }
      if (n === 0) {
        const rates = await db.exchangeRate.findMany({ include: { currency: true } });
        const buyByCode: Record<string, number> = {};
        for (const r of rates) {
          buyByCode[r.currency.code] = r.buyRate;
        }
        for (const fr of pairs) {
          const fn = FOREX_FORMULA[fr.pair];
          if (!fn) continue;
          const raw = fn(buyByCode);
          if (raw == null || !isFinite(raw)) continue;
          const rate = applyAdjustmentToNumber(raw, c);
          const prev = fr.rate;
          const changePct = prev !== 0 ? ((rate - prev) / Math.abs(prev)) * 100 : 0;
          await db.forexRate.update({
            where: { pair: fr.pair },
            data: { rate, change: changePct, lastUpdated: new Date() },
          });
          n++;
        }
        mark('forex', { ok: true, updated: n, message: `${n} أزواج (محسوبة من أسعار الليرة)` });
      } else {
        mark('forex', { ok: true, updated: n, message: `${n} أزواج (Frankfurter/ECB)` });
      }
    } catch (e) {
      mark('forex', { ok: false, message: String(e) });
    }
  }

  return { results, config: nextConfig };
}
