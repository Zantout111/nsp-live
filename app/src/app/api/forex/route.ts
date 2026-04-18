import { NextResponse } from 'next/server';
import { db, ensureSqliteSchema } from '@/lib/db';
import { readForexFinnhubPublic } from '@/lib/forex-finnhub-db';
import { getForexLiveSnapshot } from '@/lib/finnhub-forex-hub';
import { fetchFrankfurterSpotForPair, fetchYahooCommoditySpotForPair } from '@/lib/free-market-rates';
import { ensureForexCryptoSeeded } from '@/lib/seed-forex-crypto';

// Default forex rates to initialize
const defaultForexRates = [
  { pair: 'EUR/USD', nameAr: 'اليورو مقابل الدولار', nameEn: 'Euro vs US Dollar', rate: 1.0856, change: 0.12, flag1: 'eu', flag2: 'us' },
  { pair: 'GBP/USD', nameAr: 'الجنيه الإسترليني مقابل الدولار', nameEn: 'British Pound vs US Dollar', rate: 1.2634, change: -0.08, flag1: 'gb', flag2: 'us' },
  { pair: 'USD/JPY', nameAr: 'الدولار مقابل الين الياباني', nameEn: 'US Dollar vs Japanese Yen', rate: 154.32, change: 0.25, flag1: 'us', flag2: 'jp' },
  { pair: 'USD/CHF', nameAr: 'الدولار مقابل الفرنك السويسري', nameEn: 'US Dollar vs Swiss Franc', rate: 0.8845, change: -0.15, flag1: 'us', flag2: 'ch' },
  { pair: 'AUD/USD', nameAr: 'الدولار الأسترالي مقابل الدولار الأمريكي', nameEn: 'Australian Dollar vs US Dollar', rate: 0.6523, change: 0.18, flag1: 'au', flag2: 'us' },
  { pair: 'USD/CAD', nameAr: 'الدولار مقابل الدولار الكندي', nameEn: 'US Dollar vs Canadian Dollar', rate: 1.3678, change: -0.22, flag1: 'us', flag2: 'ca' },
  { pair: 'EUR/GBP', nameAr: 'اليورو مقابل الجنيه الإسترليني', nameEn: 'Euro vs British Pound', rate: 0.8592, change: 0.05, flag1: 'eu', flag2: 'gb' },
  { pair: 'EUR/JPY', nameAr: 'اليورو مقابل الين الياباني', nameEn: 'Euro vs Japanese Yen', rate: 167.45, change: 0.32, flag1: 'eu', flag2: 'jp' },
  { pair: 'XAU/USD', nameAr: 'الذهب مقابل الدولار', nameEn: 'Gold vs US Dollar', rate: 2300.25, change: 0.18, flag1: 'asset-gold', flag2: 'us' },
  { pair: 'XAG/USD', nameAr: 'الفضة مقابل الدولار', nameEn: 'Silver vs US Dollar', rate: 28.5, change: 0.1, flag1: 'asset-silver', flag2: 'us' },
  { pair: 'OIL/USD', nameAr: 'النفط مقابل الدولار', nameEn: 'Crude Oil vs US Dollar', rate: 79.35, change: -0.12, flag1: 'asset-oil', flag2: 'us' },
  { pair: 'GAS/USD', nameAr: 'الغاز الطبيعي مقابل الدولار', nameEn: 'Natural Gas vs US Dollar', rate: 2.15, change: 0.44, flag1: 'asset-gas', flag2: 'us' },
  { pair: 'SUGAR/USD', nameAr: 'السكر مقابل الدولار', nameEn: 'Sugar vs US Dollar', rate: 22.6, change: 0.09, flag1: 'asset-sugar', flag2: 'us' },
  { pair: 'RICE/USD', nameAr: 'الأرز مقابل الدولار', nameEn: 'Rice vs US Dollar', rate: 17.85, change: -0.03, flag1: 'asset-rice', flag2: 'us' },
];

export async function GET() {
  try {
    await ensureSqliteSchema();
    await ensureForexCryptoSeeded();
    const forexRates = await db.$queryRaw<any[]>`SELECT * FROM ForexRate ORDER BY pair ASC`;
    const fin = await readForexFinnhubPublic();
    const live = getForexLiveSnapshot();
    /** البث يعمل بمجرد تفعيل الفوركس الحي والرموز؛ المفتاح اختياري (احتياط Frankfurter بدون Finnhub). */
    const sseReady = fin.forexRealtimeEnabled && fin.finnhubForexSymbolRows.length > 0;
    const livePairSet = new Set(fin.finnhubForexSymbolRows.map((x) => x.pair.trim()));

    const merged = await Promise.all(
      forexRates.map(async (row) => {
        const pair = String((row as { pair: string }).pair);
        const u = live[pair];
        if (!sseReady) return row;
        if (u) {
          return {
            ...row,
            rate: u.rate,
            change: u.change,
            lastUpdated: new Date(u.updatedAt).toISOString(),
          };
        }
        /** أول طلب قبل اكتمال poll، أو عند تعارض الحِزم: جلب ECB مباشرة للأزواج المفعّلة فقط */
        if (livePairSet.has(pair)) {
          const fb = await fetchFrankfurterSpotForPair(pair);
          if (fb != null) {
            return {
              ...row,
              rate: fb,
              lastUpdated: new Date().toISOString(),
            };
          }
          const yc = await fetchYahooCommoditySpotForPair(pair);
          if (yc != null) {
            return {
              ...row,
              rate: yc,
              lastUpdated: new Date().toISOString(),
            };
          }
        }
        return row;
      })
    );
    const byPair = new Map<string, (typeof merged)[number]>();
    for (const row of merged) {
      byPair.set(String((row as { pair: string }).pair), row);
    }
    /** عند تفعيل البث الحي: أزواج مضبوطة في لوحة التحكم فقط (حسب الترتيب هناك) */
    const dataOut =
      sseReady && fin.finnhubForexSymbolRows.length > 0
        ? fin.finnhubForexSymbolRows
            .map((x) => byPair.get(x.pair.trim()))
            .filter((row): row is NonNullable<typeof row> => row != null)
        : merged;
    return NextResponse.json({
      success: true,
      data: dataOut,
      realtime: {
        enabled: sseReady,
        streamPath: '/api/forex/stream',
        pairs: sseReady ? fin.finnhubForexSymbolRows.map((x) => x.pair.trim()) : [],
      },
    });
  } catch (error) {
    console.error('Error fetching forex rates:', error);
    return NextResponse.json({
      success: true,
      data: defaultForexRates,
      realtime: { enabled: false, streamPath: '/api/forex/stream' },
    });
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pair, rate, change } = body;

    await db.$executeRawUnsafe(`
      UPDATE ForexRate 
      SET rate = ${rate}, change = ${change}, lastUpdated = datetime('now')
      WHERE pair = '${pair}'
    `);
    const updated = await db.$queryRaw<any[]>`SELECT * FROM ForexRate WHERE pair = ${pair}`;
    return NextResponse.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating forex rate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update forex rate' },
      { status: 500 }
    );
  }
}
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rates } = body;
    for (const rate of rates) {
      await db.$executeRawUnsafe(`
        UPDATE ForexRate 
        SET rate = ${rate.rate}, change = ${rate.change || 0}, lastUpdated = datetime('now')
        WHERE pair = '${rate.pair}'
      `);
    }
    return NextResponse.json({
      success: true,
      message: 'Forex rates updated successfully'
    });
  } catch (error) {
    console.error('Error updating forex rates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update forex rates' },
      { status: 500 }
    );
  }
}
