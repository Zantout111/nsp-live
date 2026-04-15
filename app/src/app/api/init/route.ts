import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default currencies to initialize
const defaultCurrencies = [
  { code: 'USD', nameAr: 'الدولار الأمريكي', nameEn: 'US Dollar', symbol: '$', flagEmoji: '🇺🇸', sortOrder: 1 },
  { code: 'EUR', nameAr: 'اليورو الأوروبي', nameEn: 'Euro', symbol: '€', flagEmoji: '🇪🇺', sortOrder: 2 },
  { code: 'TRY', nameAr: 'الليرة التركية', nameEn: 'Turkish Lira', symbol: '₺', flagEmoji: '🇹🇷', sortOrder: 3 },
  { code: 'SAR', nameAr: 'الريال السعودي', nameEn: 'Saudi Riyal', symbol: '﷼', flagEmoji: '🇸🇦', sortOrder: 4 },
  { code: 'AED', nameAr: 'الدرهم الإماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', flagEmoji: '🇦🇪', sortOrder: 5 },
  { code: 'GBP', nameAr: 'الجنيه الإسترليني', nameEn: 'British Pound', symbol: '£', flagEmoji: '🇬🇧', sortOrder: 6 },
  { code: 'CHF', nameAr: 'الفرنك السويسري', nameEn: 'Swiss Franc', symbol: 'Fr', flagEmoji: '🇨🇭', sortOrder: 7 },
  { code: 'CAD', nameAr: 'الدولار الكندي', nameEn: 'Canadian Dollar', symbol: 'C$', flagEmoji: '🇨🇦', sortOrder: 8 },
  { code: 'AUD', nameAr: 'الدولار الأسترالي', nameEn: 'Australian Dollar', symbol: 'A$', flagEmoji: '🇦🇺', sortOrder: 9 },
  { code: 'JOD', nameAr: 'الدينار الأردني', nameEn: 'Jordanian Dinar', symbol: 'JD', flagEmoji: '🇯🇴', sortOrder: 10 },
];

export async function POST() {
  try {
    // Check if currencies already exist
    const existingCurrencies = await db.currency.count();
    
    if (existingCurrencies > 0) {
      return NextResponse.json({
        success: true,
        message: 'Currencies already initialized',
        count: existingCurrencies
      });
    }

    // Create currencies with default rates
    for (const currency of defaultCurrencies) {
      await db.currency.create({
        data: {
          ...currency,
          isActive: true,
          rates: {
            create: {
              buyRate: 0,
              sellRate: 0,
              lastUpdated: new Date()
            }
          }
        }
      });
    }

    // Create default gold price
    await db.goldPrice.create({
      data: {
        priceUsd: 2650.00,
        pricePerGram: 85.20
      }
    });

    // Create site settings
    await db.siteSettings.create({
      data: {
        siteName: 'سعر الليرة السورية',
        lastUpdate: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      currenciesCreated: defaultCurrencies.length
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize database' },
      { status: 500 }
    );
  }
}
