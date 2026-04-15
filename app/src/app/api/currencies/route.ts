import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { upsertExchangeRateWithSnapshot } from '@/lib/rate-snapshot';

// GET - جلب جميع العملات مع أسعارها
export async function GET() {
  try {
    const currencies = await db.currency.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        rates: true,
      },
    });

    // إذا لم تكن هناك عملات، أضف العملات الافتراضية
    if (currencies.length === 0) {
      const defaultCurrencies = [
        { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', flagEmoji: '🇺🇸', sortOrder: 1 },
        { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', flagEmoji: '🇪🇺', sortOrder: 2 },
        { code: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', symbol: '₺', flagEmoji: '🇹🇷', sortOrder: 3 },
        { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: '﷼', flagEmoji: '🇸🇦', sortOrder: 4 },
        { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', flagEmoji: '🇦🇪', sortOrder: 5 },
        { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbol: '£', flagEmoji: '🇬🇧', sortOrder: 6 },
        { code: 'CHF', nameAr: 'فرنك سويسري', nameEn: 'Swiss Franc', symbol: 'Fr', flagEmoji: '🇨🇭', sortOrder: 7 },
        { code: 'CAD', nameAr: 'دولار كندي', nameEn: 'Canadian Dollar', symbol: 'C$', flagEmoji: '🇨🇦', sortOrder: 8 },
        { code: 'AUD', nameAr: 'دولار أسترالي', nameEn: 'Australian Dollar', symbol: 'A$', flagEmoji: '🇦🇺', sortOrder: 9 },
        { code: 'JOD', nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', symbol: 'د.ا', flagEmoji: '🇯🇴', sortOrder: 10 },
      ];

      for (const currency of defaultCurrencies) {
        await db.currency.create({
          data: {
            ...currency,
            rates: {
              create: {
                buyRate: 0,
                sellRate: 0,
              },
            },
          },
        });
      }

      const newCurrencies = await db.currency.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { rates: true },
      });

      return NextResponse.json(newCurrencies);
    }

    return NextResponse.json(currencies);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return NextResponse.json({ error: 'خطأ في جلب العملات' }, { status: 500 });
  }
}

// POST - إضافة عملة جديدة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, nameAr, nameEn, symbol, flagEmoji, sortOrder, buyRate, sellRate } = body;

    const currency = await db.currency.create({
      data: {
        code,
        nameAr,
        nameEn,
        symbol,
        flagEmoji,
        sortOrder: sortOrder || 0,
        rates: {
          create: {
            buyRate: buyRate || 0,
            sellRate: sellRate || 0,
          },
        },
      },
      include: {
        rates: true,
      },
    });

    return NextResponse.json(currency);
  } catch (error) {
    console.error('Error creating currency:', error);
    return NextResponse.json({ error: 'خطأ في إضافة العملة' }, { status: 500 });
  }
}

// PUT - تحديث سعر صرف
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { currencyId, buyRate, sellRate } = body;

    await upsertExchangeRateWithSnapshot(db, {
      currencyId,
      buyRate: Number(buyRate),
      sellRate: Number(sellRate),
    });
    const rate = await db.exchangeRate.findUnique({ where: { currencyId } });

    // تحديث وقت آخر تحديث في الإعدادات
    await db.siteSettings.upsert({
      where: { id: 'site-settings' },
      update: { lastUpdate: new Date() },
      create: { id: 'site-settings', lastUpdate: new Date() },
    });

    return NextResponse.json(rate);
  } catch (error) {
    console.error('Error updating rate:', error);
    return NextResponse.json({ error: 'خطأ في تحديث السعر' }, { status: 500 });
  }
}
