/**
 * مصادر مجانية بدون API key (حدود استخدام معقولة):
 *
 * 1) الفوركس / أزواج العملات — Frankfurter (ECB)
 *    https://www.frankfurter.app — GET /latest?from=USD&to=...
 *
 * 2) العملات الرقمية — CoinGecko
 *    https://www.coingecko.com/en/api/documentation
 *    GET /api/v3/simple/price?ids=...&vs_currencies=usd&include_24hr_change=true
 */

const FRANKFURTER =
  'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,CAD,AUD';

/** أزواج الجدول المحلي ← حساب من أسعار Frankfurter (أساس USD) */
export function forexPairsFromFrankfurter(rates: Record<string, number>): Partial<Record<string, number>> {
  const e = rates.EUR;
  const g = rates.GBP;
  const j = rates.JPY;
  const ch = rates.CHF;
  const au = rates.AUD;
  const ca = rates.CAD;
  const out: Partial<Record<string, number>> = {};

  if (e && e > 0) out['EUR/USD'] = 1 / e;
  if (g && g > 0) out['GBP/USD'] = 1 / g;
  if (j && j > 0) out['USD/JPY'] = j;
  if (ch && ch > 0) out['USD/CHF'] = ch;
  if (au && au > 0) out['AUD/USD'] = 1 / au;
  if (ca && ca > 0) out['USD/CAD'] = ca;
  if (e && g && e > 0 && g > 0) out['EUR/GBP'] = g / e;
  if (e && j && e > 0) out['EUR/JPY'] = j / e;

  return out;
}

export async function fetchFrankfurterUsdRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(FRANKFURTER, { cache: 'no-store', next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    if (!data.rates || typeof data.rates !== 'object') return null;
    return data.rates;
  } catch {
    return null;
  }
}

/**
 * سعر لحظي لزوج BASE/QUOTE عبر Frankfurter (ECB، بدون مفتاح).
 * يُستخدم احتياطاً عندما يمنع Finnhub الطبقة المجانية شموع OANDA (403).
 */
export async function fetchFrankfurterSpotForPair(pair: string): Promise<number | null> {
  const parts = pair
    .trim()
    .split('/')
    .map((s) => s.trim().toUpperCase());
  if (parts.length !== 2) return null;
  const [base, quote] = parts;
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) return null;
  if (base === quote) return 1;
  try {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
    const res = await fetch(url, { cache: 'no-store', next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const r = data.rates?.[quote];
    return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null;
  } catch {
    return null;
  }
}

const YAHOO_SYMBOL_BY_PAIR: Record<string, string> = {
  'XAU/USD': 'GC=F', // Gold futures
  'OIL/USD': 'CL=F', // Crude oil WTI
  'GAS/USD': 'NG=F', // Natural gas
  'SUGAR/USD': 'SB=F', // Sugar No.11
  'RICE/USD': 'ZR=F', // Rough rice
};

/**
 * بعض عقود Yahoo للسلع تكون بوحدة "سنت" وليست "دولار".
 * نحولها هنا إلى دولار قبل عرضها في الواجهة.
 */
function normalizeYahooCommodityPrice(pair: string, raw: number): number {
  const p = pair.trim().toUpperCase();
  // Sugar (SB=F) and Rough Rice (ZR=F) عادةً تظهر بالسنت في Yahoo.
  if (p === 'SUGAR/USD' || p === 'RICE/USD') return raw / 100;
  return raw;
}

/** احتياط سلع عبر Yahoo Finance chart API (بدون مفتاح). */
export async function fetchYahooCommoditySpotForPair(pair: string): Promise<number | null> {
  const p = pair.trim().toUpperCase();
  const sym = YAHOO_SYMBOL_BY_PAIR[p];
  if (!sym) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const v = j.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
    const normalized = normalizeYahooCommodityPrice(p, v);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  } catch {
    return null;
  }
}

/** CoinGecko: id ← رمز الجدول المحلي */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  TON: 'the-open-network',
  SHIB: 'shiba-inu',
  SUI: 'sui',
  DOT: 'polkadot',
  BCH: 'bitcoin-cash',
  LTC: 'litecoin',
  HBAR: 'hedera-hashgraph',
  XLM: 'stellar',
  UNI: 'uniswap',
  PEPE: 'pepe',
  ETC: 'ethereum-classic',
  APT: 'aptos',
  ICP: 'internet-computer',
  NEAR: 'near',
  VET: 'vechain',
  FIL: 'filecoin',
  ATOM: 'cosmos',
  OP: 'optimism',
};

export type CoinGeckoRow = { price: number; change: number };

const CG_RUNTIME_KEY = '__SYP_COINGECKO_CACHE__' as const;
type CoinGeckoCache = {
  at: number;
  rows: Record<string, CoinGeckoRow>;
};

function getCgCache(): CoinGeckoCache {
  const g = globalThis as unknown as Record<string, CoinGeckoCache>;
  if (!g[CG_RUNTIME_KEY]) {
    g[CG_RUNTIME_KEY] = { at: 0, rows: {} };
  }
  return g[CG_RUNTIME_KEY];
}

function fromCache(codes: string[]): Map<string, CoinGeckoRow> {
  const out = new Map<string, CoinGeckoRow>();
  const cache = getCgCache().rows;
  for (const c of codes) {
    const r = cache[c];
    if (r) out.set(c, r);
  }
  return out;
}

export async function fetchCoinGeckoForCodes(codes: string[]): Promise<Map<string, CoinGeckoRow>> {
  const reqCodes = [...new Set(codes.map((c) => String(c).toUpperCase()).filter(Boolean))];
  const map = new Map<string, CoinGeckoRow>();
  if (reqCodes.length === 0) return map;

  const cache = getCgCache();
  const now = Date.now();
  const FRESH_MS = 5000;
  const STALE_MS = 180000;
  if (now - cache.at <= FRESH_MS) {
    return fromCache(reqCodes);
  }

  const ids = [...new Set(reqCodes.map((c) => COINGECKO_IDS[c]).filter(Boolean))];
  if (ids.length === 0) return fromCache(reqCodes);

  try {
    const dataMerged: Record<string, { usd?: number; usd_24h_change?: number }> = {};
    const CHUNK = 12;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        part.join(',')
      )}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'syp-rates/1.0',
        },
      });
      if (!res.ok) {
        continue;
      }
      const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      Object.assign(dataMerged, data);
    }

    const idToCode = new Map<string, string>();
    for (const code of reqCodes) {
      const id = COINGECKO_IDS[code];
      if (id) idToCode.set(id, code);
    }

    for (const [id, row] of Object.entries(dataMerged)) {
      const code = idToCode.get(id);
      if (!code || row.usd == null || !isFinite(row.usd)) continue;
      const change =
        row.usd_24h_change != null && isFinite(row.usd_24h_change) ? row.usd_24h_change : 0;
      map.set(code, { price: row.usd, change });
      cache.rows[code] = { price: row.usd, change };
      cache.at = now;
    }
  } catch {
    /* شبكة أو حد معدل — يُستخدم احتياطي SP Today */
  }

  if (map.size > 0) return map;
  if (now - cache.at <= STALE_MS) return fromCache(reqCodes);
  return map;
}
