import { NextResponse } from 'next/server';
import { db, ensureSqliteSchema } from '@/lib/db';
import { readCryptoRealtimePublic } from '@/lib/forex-finnhub-db';
import { getCryptoLiveSnapshot } from '@/lib/crypto-live-hub';
import { fetchCoinGeckoForCodes } from '@/lib/free-market-rates';
import { ensureForexCryptoSeeded } from '@/lib/seed-forex-crypto';

// Default crypto rates to initialize
const defaultCryptoRates = [
  { code: 'BTC', nameAr: 'بيتكوين', nameEn: 'Bitcoin', price: 67234.56, change: 2.34, icon: '₿' },
  { code: 'ETH', nameAr: 'إيثيريوم', nameEn: 'Ethereum', price: 3456.78, change: -1.23, icon: 'Ξ' },
  { code: 'BNB', nameAr: 'بينانس', nameEn: 'Binance', price: 567.89, change: 0.87, icon: '◆' },
  { code: 'XRP', nameAr: 'ريبل', nameEn: 'Ripple', price: 0.5234, change: 3.45, icon: '✕' },
  { code: 'SOL', nameAr: 'سولانا', nameEn: 'Solana', price: 178.45, change: -2.12, icon: '◎' },
  { code: 'ADA', nameAr: 'كاردانو', nameEn: 'Cardano', price: 0.4567, change: 1.56, icon: '₳' },
  { code: 'DOGE', nameAr: 'دوجكوين', nameEn: 'Dogecoin', price: 0.1523, change: 5.67, icon: 'Ð' },
];

export async function GET() {
  try {
    await ensureSqliteSchema();
    await ensureForexCryptoSeeded();
    const cryptoRates = await db.$queryRaw<any[]>`SELECT * FROM CryptoRate ORDER BY code ASC`;
    const cfg = await readCryptoRealtimePublic();
    const live = getCryptoLiveSnapshot();
    const enabled = cfg.cryptoRealtimeEnabled && cfg.cryptoRealtimeCodes.length > 0;
    const missingCodes: string[] = [];
    const merged = cryptoRates.map((row) => {
      const code = String((row as { code: string }).code).toUpperCase();
      const u = live[code];
      if (!enabled) return row;
      if (!u) {
        if (cfg.cryptoRealtimeCodes.includes(code)) missingCodes.push(code);
        return row;
      }
      return {
        ...row,
        price: u.price,
        change: u.change,
        lastUpdated: new Date(u.updatedAt).toISOString(),
      };
    });
    if (enabled && missingCodes.length > 0) {
      const m = await fetchCoinGeckoForCodes(missingCodes);
      for (const row of merged) {
        const code = String((row as { code: string }).code).toUpperCase();
        const u = m.get(code);
        if (!u) continue;
        (row as { price: number; change: number; lastUpdated: string }).price = u.price;
        (row as { price: number; change: number; lastUpdated: string }).change = u.change;
        (row as { price: number; change: number; lastUpdated: string }).lastUpdated = new Date().toISOString();
      }
    }
    return NextResponse.json({
      success: true,
      data: merged,
      realtime: {
        enabled,
        streamPath: '/api/crypto/stream',
        codes: enabled ? cfg.cryptoRealtimeCodes : [],
      },
    });
  } catch (error) {
    console.error('Error fetching crypto rates:', error);
    return NextResponse.json({
      success: true,
      data: defaultCryptoRates,
      realtime: { enabled: false, streamPath: '/api/crypto/stream' },
    });
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, price, change } = body;

    await db.$executeRawUnsafe(`
      UPDATE CryptoRate 
      SET price = ${price}, change = ${change}, lastUpdated = datetime('now')
      WHERE code = '${code}'
    `);
    const updated = await db.$queryRaw<any[]>`SELECT * FROM CryptoRate WHERE code = ${code}`;

    return NextResponse.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating crypto rate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update crypto rate' },
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
        UPDATE CryptoRate 
        SET price = ${rate.price}, change = ${rate.change || 0}, lastUpdated = datetime('now')
        WHERE code = '${rate.code}'
      `);
    }
    return NextResponse.json({
      success: true,
      message: 'Crypto rates updated successfully'
    });
  } catch (error) {
    console.error('Error updating crypto rates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update crypto rates' },
      { status: 500 }
    );
  }
}
