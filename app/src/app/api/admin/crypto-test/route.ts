import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { ensureSqliteSchema } from '@/lib/db';
import { fetchCoinGeckoForCodes } from '@/lib/free-market-rates';
import { readCryptoRealtimePublic } from '@/lib/forex-finnhub-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await ensureSqliteSchema();
    const cfg = await readCryptoRealtimePublic();
    const codes = cfg.cryptoRealtimeCodes;
    const map = await fetchCoinGeckoForCodes(codes);
    const rows = codes.map((code) => {
      const r = map.get(code);
      return {
        code,
        ok: !!r,
        price: r?.price ?? null,
        change: r?.change ?? null,
      };
    });
    return NextResponse.json({
      success: true,
      configured: {
        enabled: cfg.cryptoRealtimeEnabled,
        codeCount: codes.length,
      },
      result: {
        ok: rows.some((r) => r.ok),
        message: rows.some((r) => r.ok)
          ? 'CoinGecko returned live prices.'
          : 'No live prices returned for configured codes.',
      },
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
