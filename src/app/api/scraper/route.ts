import { NextResponse } from 'next/server';

// Hardcoded rates from SP-Today (as of recent data)
// In production, you would fetch these dynamically from an API or scrape them
const SP_TODAY_RATES = {
  USD: { buyRate: 11870, sellRate: 11950 },
  EUR: { buyRate: 13630, sellRate: 13830 },
  TRY: { buyRate: 266, sellRate: 270 },
  SAR: { buyRate: 3130, sellRate: 3183 },
  AED: { buyRate: 3199, sellRate: 3253 },
  EGP: { buyRate: 227, sellRate: 231 },
  GBP: { buyRate: 15500, sellRate: 15700 },
  CHF: { buyRate: 14000, sellRate: 14200 },
  CAD: { buyRate: 8300, sellRate: 8500 },
  AUD: { buyRate: 7500, sellRate: 7700 },
  JOD: { buyRate: 16700, sellRate: 17000 },
};

export async function GET() {
  const rates = Object.entries(SP_TODAY_RATES).map(([code, data]) => ({
    code,
    ...data,
    source: 'SP-Today'
  }));

  return NextResponse.json({
    success: true,
    source: 'SP-Today (cached)',
    fetchedAt: new Date().toISOString(),
    rates,
    count: rates.length,
    note: 'Rates are from SP-Today. For live rates, integrate with sp-today.com API.'
  });
}

export async function POST() {
  try {
    const { db } = await import('@/lib/db');
    let updated = 0;

    for (const [code, data] of Object.entries(SP_TODAY_RATES)) {
      // Find currency by code
      const currency = await db.$queryRaw<any[]>`
        SELECT id FROM Currency WHERE code = ${code}
      `;
      
      if (currency && currency[0]) {
        // Update exchange rate
        await db.$executeRawUnsafe(`
          UPDATE ExchangeRate 
          SET buyRate = ${data.buyRate}, 
              sellRate = ${data.sellRate}, 
              lastUpdated = datetime('now'),
              updatedAt = datetime('now')
          WHERE currencyId = '${currency[0].id}'
        `);
        updated++;
      }
    }

    // Update site settings lastUpdate
    await db.$executeRawUnsafe(`
      UPDATE SiteSettings SET lastUpdate = datetime('now')
    `);

    return NextResponse.json({
      success: true,
      source: 'SP-Today (cached)',
      fetchedAt: new Date().toISOString(),
      updated,
      rates: Object.entries(SP_TODAY_RATES).map(([code, data]) => ({
        code,
        ...data
      }))
    });
  } catch (error) {
    console.error('Error updating rates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update rates' },
      { status: 500 }
    );
  }
}
