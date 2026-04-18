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
  type GoldSnapshotUpdate,
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

const FALLBACK_CURRENCY_CODES = [
  'USD',
  'EUR',
  'TRY',
  'SAR',
  'AED',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'JOD',
  'KWD',
  'EGP',
  'LYD',
] as const;

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
  const toNum = (raw: string): number => {
    const n = parseFloat(raw.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
  };
  const re =
    /<span class="font-bold block">([A-Z]{3})<\/span>[\s\S]*?<span[^>]*class="[^"]*font-mono[^"]*font-bold[^"]*text-lg[^"]*"[^>]*>([\d,]+)<\/span>[\s\S]*?<span[^>]*class="[^"]*font-mono[^"]*font-bold[^"]*text-lg[^"]*"[^>]*>([\d,]+)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    if (seen.has(code)) continue;
    const buyRate = toNum(m[2]);
    const sellRate = toNum(m[3]);
    if (buyRate > 0 && sellRate > 0) {
      seen.add(code);
      rates.push({ code, buyRate, sellRate });
    }
  }
  // Fallback parse لكل كود على حدة (أكثر تحملاً لتغيرات بنية HTML).
  for (const code of FALLBACK_CURRENCY_CODES) {
    if (seen.has(code)) continue;
    const esc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const perCode = new RegExp(
      `<span[^>]*>\\s*${esc}\\s*<\\/span>[\\s\\S]{0,2200}?<span[^>]*class="[^"]*font-mono[^"]*"[^>]*>([\\d,.]+)<\\/span>[\\s\\S]{0,900}?<span[^>]*class="[^"]*font-mono[^"]*"[^>]*>([\\d,.]+)<\\/span>`,
      'i'
    );
    const mm = html.match(perCode);
    if (!mm) continue;
    const buyRate = toNum(mm[1]);
    const sellRate = toNum(mm[2]);
    if (buyRate > 0 && sellRate > 0) {
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
  // لا نسمح بالنزول تحت السعر الخام المسحوب من SP Today.
  const swungBuy = Math.max(0, buy + dBuy * t);
  const swungSell = Math.max(0, sell + dSell * t);
  return {
    buy: Math.max(buy, swungBuy),
    sell: Math.max(sell, swungSell),
  };
}

/** سعر الغرام بالدولار من قسم International Prices على sp-today.com/en/gold */
function extractKaratUsdPerGram(html: string, karatLabel: string): number | null {
  const esc = karatLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<h3 class="text-lg font-bold text-amber-500 mb-1">${esc}<\\/h3><p class="font-mono font-bold">\\$<!-- -->([\\d,.]+)<\\/p>`
  );
  const m = html.match(re);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n) || n <= 0) return null;
  return n;
}

export type SpTodayGoldUsdParsed = {
  priceUsd: number;
  pricePerGram: number;
  pricePerGram21?: number;
  pricePerGram18?: number;
  pricePerGram14?: number;
};

export function extractGoldUsd(html: string): SpTodayGoldUsdParsed | null {
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
  const out: SpTodayGoldUsdParsed = { priceUsd, pricePerGram };
  const k21 = extractKaratUsdPerGram(html, '21K');
  const k18 = extractKaratUsdPerGram(html, '18K');
  const k14 = extractKaratUsdPerGram(html, '14K');
  if (k21 != null) out.pricePerGram21 = k21;
  if (k18 != null) out.pricePerGram18 = k18;
  if (k14 != null) out.pricePerGram14 = k14;
  return out;
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
        const prepared = rows.map((row) => {
          const swung = applyPairWithRandomSwing(row.buyRate, row.sellRate, c);
          return {
            ...row,
            targetBuy: swung.buy,
            targetSell: swung.sell,
            floorBuy: row.buyRate,
            floorSell: row.sellRate,
          };
        });
        let updated = 0;
        for (const rate of prepared) {
          const currency = await db.currency.findFirst({ where: { code: rate.code } });
          if (!currency) continue;
          // بعد أي تعديل يدوي سابق، يجب أن تعود المزامنة فوراً إلى السعر المسحوب
          // (مع قيد: لا نزول تحت السعر الخام من SP Today).
          const buyRate = Math.max(rate.floorBuy, rate.targetBuy);
          const sellRate = Math.max(rate.floorSell, rate.targetSell);
          await upsertExchangeRateWithSnapshot(db, {
            currencyId: currency.id,
            buyRate,
            sellRate,
          });
          updated++;
        }
        mark('currencies', {
          ok: updated > 0,
          updated,
          message: updated > 0 ? `${updated} عملات` : 'No mapped currencies updated',
        });
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
        const payload: GoldSnapshotUpdate = { priceUsd, pricePerGram };
        if (raw.pricePerGram21 != null) {
          payload.pricePerGram21 = applyAdjustmentToNumber(raw.pricePerGram21, c);
        }
        if (raw.pricePerGram18 != null) {
          payload.pricePerGram18 = applyAdjustmentToNumber(raw.pricePerGram18, c);
        }
        if (raw.pricePerGram14 != null) {
          payload.pricePerGram14 = applyAdjustmentToNumber(raw.pricePerGram14, c);
        }
        await updateLatestGoldWithSnapshot(db, payload);
        const kN = [raw.pricePerGram21, raw.pricePerGram18, raw.pricePerGram14].filter((x) => x != null).length;
        mark('gold', { ok: true, updated: 1, message: kN >= 3 ? 'Gold + 21/18/14K' : 'Gold OK' });
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
