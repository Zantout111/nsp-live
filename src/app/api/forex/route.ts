import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureForexCryptoSeeded } from '@/lib/seed-forex-crypto';

// Default forex rates to initialize
const defaultForexRates = [
  { pair: 'EUR/USD', nameAr: 'يورو/دولار', nameEn: 'Euro/US Dollar', rate: 1.0856, change: 0.12, flag1: 'eu', flag2: 'us' },
  { pair: 'GBP/USD', nameAr: 'جنيه/دولار', nameEn: 'British Pound/US Dollar', rate: 1.2634, change: -0.08, flag1: 'gb', flag2: 'us' },
  { pair: 'USD/JPY', nameAr: 'دولار/ين', nameEn: 'US Dollar/Japanese Yen', rate: 154.32, change: 0.25, flag1: 'us', flag2: 'jp' },
  { pair: 'USD/CHF', nameAr: 'دولار/فرنك', nameEn: 'US Dollar/Swiss Franc', rate: 0.8845, change: -0.15, flag1: 'us', flag2: 'ch' },
  { pair: 'AUD/USD', nameAr: 'دولار أسترالي/دولار', nameEn: 'Australian Dollar/US Dollar', rate: 0.6523, change: 0.18, flag1: 'au', flag2: 'us' },
  { pair: 'USD/CAD', nameAr: 'دولار/دولار كندي', nameEn: 'US Dollar/Canadian Dollar', rate: 1.3678, change: -0.22, flag1: 'us', flag2: 'ca' },
  { pair: 'EUR/GBP', nameAr: 'يورو/جنيه', nameEn: 'Euro/British Pound', rate: 0.8592, change: 0.05, flag1: 'eu', flag2: 'gb' },
  { pair: 'EUR/JPY', nameAr: 'يورو/ين', nameEn: 'Euro/Japanese Yen', rate: 167.45, change: 0.32, flag1: 'eu', flag2: 'jp' },
];

export async function GET() {
  try {
    await ensureForexCryptoSeeded();
    const forexRates = await db.$queryRaw<any[]>`SELECT * FROM ForexRate ORDER BY pair ASC`;
    return NextResponse.json({
      success: true,
      data: forexRates
    });
  } catch (error) {
    console.error('Error fetching forex rates:', error);
    return NextResponse.json({
      success: true,
      data: defaultForexRates
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
