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

/** CoinGecko: id ← رمز الجدول المحلي */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
};

export type CoinGeckoRow = { price: number; change: number };

export async function fetchCoinGeckoForCodes(codes: string[]): Promise<Map<string, CoinGeckoRow>> {
  const map = new Map<string, CoinGeckoRow>();
  const ids = [...new Set(codes.map((c) => COINGECKO_IDS[c]).filter(Boolean))];
  if (ids.length === 0) return map;

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    ids.join(',')
  )}&vs_currencies=usd&include_24hr_change=true`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return map;

    const data = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;

    const idToCode = new Map<string, string>();
    for (const code of codes) {
      const id = COINGECKO_IDS[code];
      if (id) idToCode.set(id, code);
    }

    for (const [id, row] of Object.entries(data)) {
      const code = idToCode.get(id);
      if (!code || row.usd == null || !isFinite(row.usd)) continue;
      const change =
        row.usd_24h_change != null && isFinite(row.usd_24h_change) ? row.usd_24h_change : 0;
      map.set(code, { price: row.usd, change });
    }
  } catch {
    /* شبكة أو حد معدل — يُستخدم احتياطي SP Today */
  }
  return map;
}
