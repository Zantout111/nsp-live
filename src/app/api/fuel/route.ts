import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateFuelPriceWithSnapshot } from '@/lib/rate-snapshot';

// Default fuel prices to initialize
const defaultFuelPrices = [
  { code: 'GASOLINE_95', nameAr: 'بنزين 95', nameEn: 'Gasoline 95', price: 15000, unitAr: 'لتر', unitEn: 'Liter' },
  { code: 'GASOLINE_98', nameAr: 'بنزين 98', nameEn: 'Gasoline 98', price: 16500, unitAr: 'لتر', unitEn: 'Liter' },
  { code: 'DIESEL', nameAr: 'ديزل', nameEn: 'Diesel', price: 8500, unitAr: 'لتر', unitEn: 'Liter' },
  { code: 'LPG', nameAr: 'غاز منزلي', nameEn: 'LPG', price: 2500, unitAr: 'كلغ', unitEn: 'Kg' },
  { code: 'KEROSENE', nameAr: 'كيروسين', nameEn: 'Kerosene', price: 7000, unitAr: 'لتر', unitEn: 'Liter' },
  { code: 'MAZUT', nameAr: 'مازوت', nameEn: 'Mazut', price: 6000, unitAr: 'لتر', unitEn: 'Liter' },
];

export async function GET() {
  try {
    // Check if table exists and create if needed
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS FuelPrice (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE,
          nameAr TEXT,
          nameEn TEXT,
          price REAL,
          unitAr TEXT DEFAULT 'لتر',
          unitEn TEXT DEFAULT 'Liter',
          lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      // Table might already exist
    }

    // Check if we have fuel prices
    let fuelPrices = await db.$queryRaw<any[]>`SELECT * FROM FuelPrice ORDER BY code ASC`;
    
    if (fuelPrices.length === 0) {
      // Insert default fuel prices
      for (const fuel of defaultFuelPrices) {
        const id = `fuel_${fuel.code.toLowerCase()}_${Date.now()}`;
        await db.$executeRawUnsafe(`
          INSERT INTO FuelPrice (id, code, nameAr, nameEn, price, unitAr, unitEn, lastUpdated, createdAt, updatedAt)
          VALUES ('${id}', '${fuel.code}', '${fuel.nameAr}', '${fuel.nameEn}', ${fuel.price}, '${fuel.unitAr}', '${fuel.unitEn}', datetime('now'), datetime('now'), datetime('now'))
        `);
      }
      // Fetch again
      fuelPrices = await db.$queryRaw<any[]>`SELECT * FROM FuelPrice ORDER BY code ASC`;
    }

    return NextResponse.json({
      success: true,
      data: fuelPrices
    });
  } catch (error) {
    console.error('Error fetching fuel prices:', error);
    // Return default data if database fails
    return NextResponse.json({
      success: true,
      data: defaultFuelPrices.map((fuel, i) => ({
        id: `fuel_${i}`,
        ...fuel,
        lastUpdated: new Date().toISOString()
      }))
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, price } = body;

    await updateFuelPriceWithSnapshot(db, String(code), Number(price));

    const updated = await db.fuelPrice.findUnique({ where: { code: String(code) } });

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating fuel price:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update fuel price' },
      { status: 500 }
    );
  }
}
