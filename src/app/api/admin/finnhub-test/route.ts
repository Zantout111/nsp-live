import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { ensureSqliteSchema } from '@/lib/db';
import { readForexFinnhubSecrets } from '@/lib/forex-finnhub-db';
import { fetchFrankfurterSpotForPair, fetchYahooCommoditySpotForPair } from '@/lib/free-market-rates';

export const dynamic = 'force-dynamic';

export type FinnhubSymbolTestRow = {
  finnhubSymbol: string;
  pair: string;
  httpStatus?: number;
  finnhubStatus?: string;
  lastClose?: number | null;
  candleCount?: number;
  error?: string | null;
  /** سعر احتياطي من مصدر بديل عند تعذر Finnhub */
  fallbackClose?: number | null;
  fallbackSource?: 'frankfurter' | 'yahoo' | null;
};

/**
 * اختبار محمي: يقرأ المفتاح والرموز **المحفوظة** في قاعدة البيانات،
 * يتحقق من WebSocket المحلي ويجرب REST forex/candle لكل رمز (حتى 16).
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();
    const fin = await readForexFinnhubSecrets();

    let websocketOpen = false;
    try {
      const { isFinnhubSocketOpen } = await import('@/lib/finnhub-forex-hub');
      websocketOpen = isFinnhubSocketOpen();
    } catch {
      websocketOpen = false;
    }

    const configured = {
      enabled: fin.enabled,
      hasKey: Boolean(fin.apiKey && fin.apiKey.length > 0),
      symbolCount: fin.rows.length,
    };

    const now = Math.floor(Date.now() / 1000);
    const from1m = now - 7200;
    const fromD = now - 86400 * 14;
    const perSymbol: FinnhubSymbolTestRow[] = [];

    for (const r of fin.rows.slice(0, 16)) {
      const sym = r.finnhubSymbol.trim();
      const pair = r.pair.trim();
      if (!sym) {
        perSymbol.push({
          finnhubSymbol: sym,
          pair,
          error: 'empty_symbol',
        });
        continue;
      }

      try {
        const isYahooOnly = sym.toUpperCase().startsWith('YAHOO:');
        if (!isYahooOnly && !fin.apiKey) {
          const fb = await fetchFrankfurterSpotForPair(pair);
          const yc = fb == null ? await fetchYahooCommoditySpotForPair(pair) : null;
          perSymbol.push({
            finnhubSymbol: sym,
            pair,
            error: 'no_api_key',
            fallbackClose: fb ?? yc ?? null,
            fallbackSource: fb != null ? 'frankfurter' : yc != null ? 'yahoo' : null,
          });
          continue;
        }

        const tryCandle = async (resolution: string | number, fromSec: number) => {
          const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(sym)}&resolution=${resolution}&from=${fromSec}&to=${now}&token=${encodeURIComponent(fin.apiKey!)}`;
          const res = await fetch(url, { cache: 'no-store' });
          const j = (await res.json()) as {
            s?: string;
            c?: number[];
            error?: string;
          };
          return { res, j };
        };

        let res: Response | null = null;
        let j: { s?: string; c?: number[]; error?: string } = {};
        if (!isYahooOnly) {
          const first = await tryCandle(1, from1m);
          res = first.res;
          j = first.j;
          if (j.s !== 'ok' || !Array.isArray(j.c) || j.c.length === 0) {
            const second = await tryCandle('D', fromD);
            res = second.res;
            j = second.j;
          }
        }

        const last =
          Array.isArray(j.c) && j.c.length > 0 ? j.c[j.c.length - 1]! : null;
        const errMsg =
          j.error ??
          (j.s === 'no_data' ? 'no_data' : j.s && j.s !== 'ok' ? String(j.s) : null);

        const finnhubClose = typeof last === 'number' && Number.isFinite(last) ? last : null;
        let fallbackClose: number | null = null;
        let fallbackSource: 'frankfurter' | null = null;
        if (finnhubClose == null) {
          const fb = await fetchFrankfurterSpotForPair(pair);
          if (fb != null) {
            fallbackClose = fb;
            fallbackSource = 'frankfurter';
          } else {
            const yc = await fetchYahooCommoditySpotForPair(pair);
            if (yc != null) {
              fallbackClose = yc;
              fallbackSource = 'yahoo';
            }
          }
        }

        perSymbol.push({
          finnhubSymbol: sym,
          pair,
          httpStatus: res?.status,
          finnhubStatus: j.s,
          lastClose: finnhubClose,
          candleCount: Array.isArray(j.c) ? j.c.length : 0,
          error: errMsg,
          fallbackClose,
          fallbackSource,
        });
      } catch (e) {
        perSymbol.push({
          finnhubSymbol: sym,
          pair,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const restOk = perSymbol.some(
      (x) =>
        (x.lastClose != null && x.lastClose > 0) ||
        (x.fallbackClose != null && x.fallbackClose > 0)
    );
    const restMessage = restOk
      ? perSymbol.some((x) => x.lastClose != null && x.lastClose > 0)
        ? 'Finnhub returned at least one valid price.'
        : 'Finnhub blocked/empty for some symbols; fallback sources (Frankfurter/Yahoo) are supplying live prices.'
      : perSymbol.length === 0
        ? 'No symbols configured — add rows and save.'
        : 'No valid prices from Finnhub/Frankfurter/Yahoo. Check symbol and network.';

    return NextResponse.json({
      success: true,
      configured,
      websocket: { open: websocketOpen },
      rest: { ok: restOk, message: restMessage },
      perSymbol,
    });
  } catch (e) {
    console.error('finnhub-test:', e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
