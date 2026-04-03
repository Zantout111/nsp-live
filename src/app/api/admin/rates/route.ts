import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  upsertExchangeRateWithSnapshot,
  updateLatestGoldWithSnapshot,
  type GoldSnapshotUpdate,
} from '@/lib/rate-snapshot';

// GET - Fetch all currencies for admin
export async function GET() {
  try {
    const currencies = await db.currency.findMany({
      include: { rates: true },
      orderBy: { sortOrder: 'asc' }
    });

    const formattedCurrencies = currencies.map(currency => ({
      id: currency.id,
      code: currency.code,
      nameAr: currency.nameAr,
      nameEn: currency.nameEn,
      symbol: currency.symbol,
      flagEmoji: currency.flagEmoji,
      isActive: currency.isActive,
      sortOrder: currency.sortOrder,
      buyRate: currency.rates[0]?.buyRate || 0,
      sellRate: currency.rates[0]?.sellRate || 0,
      lastUpdated: currency.rates[0]?.lastUpdated || null
    }));

    return NextResponse.json({
      success: true,
      data: formattedCurrencies
    });
  } catch (error) {
    console.error('Error fetching admin rates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rates' },
      { status: 500 }
    );
  }
}

// POST - Update exchange rate for a currency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currencyId, buyRate, sellRate } = body;

    if (!currencyId || buyRate === undefined || sellRate === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if rate exists
    const existingRate = await db.exchangeRate.findUnique({
      where: { currencyId }
    });

    await upsertExchangeRateWithSnapshot(db, {
      currencyId,
      buyRate: parseFloat(buyRate),
      sellRate: parseFloat(sellRate),
    });

    // Update site last update time
    await db.siteSettings.updateMany({
      data: { lastUpdate: new Date() }
    });

    return NextResponse.json({
      success: true,
      message: 'Rate updated successfully'
    });
  } catch (error) {
    console.error('Error updating rate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update rate' },
      { status: 500 }
    );
  }
}

function parseOptionalGoldGram(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

// PUT - Update gold price manually
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { priceUsd, pricePerGram, pricePerGram21, pricePerGram18, pricePerGram14 } = body;

    if (priceUsd === undefined || pricePerGram === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const pu = parseFloat(String(priceUsd));
    const pg = parseFloat(String(pricePerGram));
    if (!Number.isFinite(pu) || !Number.isFinite(pg) || pu <= 0 || pg <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid gold price values' },
        { status: 400 }
      );
    }

    const update: GoldSnapshotUpdate = { priceUsd: pu, pricePerGram: pg };
    const g21 = parseOptionalGoldGram(pricePerGram21);
    const g18 = parseOptionalGoldGram(pricePerGram18);
    const g14 = parseOptionalGoldGram(pricePerGram14);
    if (g21 !== undefined) update.pricePerGram21 = g21;
    if (g18 !== undefined) update.pricePerGram18 = g18;
    if (g14 !== undefined) update.pricePerGram14 = g14;

    await updateLatestGoldWithSnapshot(db, update);

    // Update site last update time
    await db.siteSettings.updateMany({
      data: { lastUpdate: new Date() }
    });

    return NextResponse.json({
      success: true,
      message: 'Gold price updated successfully'
    });
  } catch (error) {
    console.error('Error updating gold price:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update gold price' },
      { status: 500 }
    );
  }
}
