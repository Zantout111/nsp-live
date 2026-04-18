import { NextRequest, NextResponse } from 'next/server';
import { parseLogoSizes, type LogoSizes } from '@/lib/logo-sizes';
import { db, ensureSqliteSchema } from '@/lib/db';
import { ensureForexCryptoSeeded } from '@/lib/seed-forex-crypto';
import { upsertExchangeRateWithSnapshot } from '@/lib/rate-snapshot';
import { pctDeltaFromPrevious } from '@/lib/pct-delta';
import ZAI from 'z-ai-web-dev-sdk';
import { ratesApiOriginDenied } from '@/lib/api-origin-guard';
import { readFooterSocialTiktok } from '@/lib/footer-social-tiktok';
import { readFuelVisibilityMap } from '@/lib/fuel-visibility-db';
import { normalizeCaPub } from '@/lib/adsense-config';
import { fetchHeroSectionThemeRow } from '@/lib/hero-section-theme';

export const dynamic = 'force-dynamic';

// SP Today URL for auto-fetch
const SP_TODAY_URL = 'https://sp-today.com/en/currencies';
const CURRENCIES_TO_FETCH = ['USD', 'EUR', 'TRY', 'SAR', 'AED', 'GBP', 'CHF', 'CAD', 'AUD', 'JOD', 'KWD', 'EGP', 'LYD'];

// Default currencies to initialize
const defaultCurrencies = [
  { code: 'USD', nameAr: 'الدولار الأمريكي', nameEn: 'US Dollar', symbol: '$', flagEmoji: '🇺🇸', sortOrder: 1, buyRate: 13500, sellRate: 13600 },
  { code: 'EUR', nameAr: 'اليورو الأوروبي', nameEn: 'Euro', symbol: '€', flagEmoji: '🇪🇺', sortOrder: 2, buyRate: 14600, sellRate: 14700 },
  { code: 'TRY', nameAr: 'الليرة التركية', nameEn: 'Turkish Lira', symbol: '₺', flagEmoji: '🇹🇷', sortOrder: 3, buyRate: 380, sellRate: 390 },
  { code: 'SAR', nameAr: 'الريال السعودي', nameEn: 'Saudi Riyal', symbol: '﷼', flagEmoji: '🇸🇦', sortOrder: 4, buyRate: 3600, sellRate: 3620 },
  { code: 'AED', nameAr: 'الدرهم الإماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', flagEmoji: '🇦🇪', sortOrder: 5, buyRate: 3670, sellRate: 3700 },
  { code: 'GBP', nameAr: 'الجنيه الإسترليني', nameEn: 'British Pound', symbol: '£', flagEmoji: '🇬🇧', sortOrder: 6, buyRate: 17000, sellRate: 17100 },
  { code: 'CHF', nameAr: 'الفرنك السويسري', nameEn: 'Swiss Franc', symbol: 'Fr', flagEmoji: '🇨🇭', sortOrder: 7, buyRate: 15200, sellRate: 15300 },
  { code: 'CAD', nameAr: 'الدولار الكندي', nameEn: 'Canadian Dollar', symbol: 'C$', flagEmoji: '🇨🇦', sortOrder: 8, buyRate: 9800, sellRate: 9900 },
  { code: 'AUD', nameAr: 'الدولار الأسترالي', nameEn: 'Australian Dollar', symbol: 'A$', flagEmoji: '🇦🇺', sortOrder: 9, buyRate: 8700, sellRate: 8800 },
  { code: 'JOD', nameAr: 'الدينار الأردني', nameEn: 'Jordanian Dinar', symbol: 'JD', flagEmoji: '🇯🇴', sortOrder: 10, buyRate: 19000, sellRate: 19200 },
];

/**
 * تأرجح مستمر حول السعر المخزّن (مركز ثابت من قاعدة البيانات).
 * محدد زمنياً + بذرة العملة حتى يرى كل المستخدمون نفس الرقم في نفس اللحظة.
 * نفس الإزاحة تُطبَّق على الشراء والبيع ليبقى الفارق بينهما ثابتاً تقريباً.
 */
function oscillationOffsetForCurrency(center: number, seed: string, nowMs: number): number {
  const c = Number(center);
  if (!Number.isFinite(c) || c <= 0) return 0;

  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const phase = ((h >>> 0) % 6283) / 1000; // ~0..2π
  const periodSec = 40 + ((h >>> 8) % 55); // 40..94 ثانية لدورة كاملة صعوداً وهبوطاً
  const t = nowMs / 1000;
  const w1 = (2 * Math.PI * t) / periodSec + phase;
  const w2 = w1 * 1.73 + phase * 0.42;
  const amp = Math.max(5, c * 0.0009);
  return amp * (Math.sin(w1) * 0.82 + Math.sin(w2) * 0.18);
}

function displayRatesWithOscillation(
  buyStored: number,
  sellStored: number,
  code: string,
  nowMs: number,
  enabled: boolean
): { buy: number; sell: number } {
  const b = Number(buyStored);
  const s = Number(sellStored);
  if (!Number.isFinite(b) || b <= 0) return { buy: 0, sell: 0 };
  if (!Number.isFinite(s) || s <= 0) return { buy: Math.round(b), sell: Math.round(b) };

  // عند إلغاء السحب التلقائي (وضع يدوي)، اعرض الأسعار الثابتة دون أي تذبذب.
  if (!enabled) {
    return { buy: Math.round(b), sell: Math.round(s) };
  }

  /** الليرة التركية: بدون تأرجح حول السعر المخزّن */
  if (code === 'TRY') {
    return { buy: Math.round(b), sell: Math.round(s) };
  }

  const off = oscillationOffsetForCurrency((b + s) / 2, `fx-${code}`, nowMs);
  let buy = Math.max(1, Math.round(b + off));
  let sell = Math.max(1, Math.round(s + off));
  if (sell <= buy) sell = buy + Math.max(1, Math.round(s - b));
  return { buy, sell };
}

async function initializeDatabase() {
  try {
    // Check if currencies already exist
    const existingCurrencies = await db.currency.count();
    
    if (existingCurrencies === 0) {
      // Create currencies with default rates
      for (const currency of defaultCurrencies) {
        await db.currency.create({
          data: {
            code: currency.code,
            nameAr: currency.nameAr,
            nameEn: currency.nameEn,
            symbol: currency.symbol,
            flagEmoji: currency.flagEmoji,
            sortOrder: currency.sortOrder,
            isActive: true,
            rates: {
              create: {
                buyRate: currency.buyRate,
                sellRate: currency.sellRate,
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
    }

    await ensureForexCryptoSeeded();

    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Check and perform auto-update if needed (runs in background)
async function checkAutoUpdate() {
  try {
    const settings = await db.siteSettings.findFirst();
    
    // If auto-update is disabled, skip
    if (!settings?.autoUpdateEnabled) return;
    
    const lastFetch = settings.lastFetchTime;
    const updateInterval = settings.updateInterval || 6;
    const adjustmentAmount = settings.adjustmentAmount || 250;
    const adjustmentType = settings.adjustmentType || 'deduction';
    
    // Check if enough time has passed
    if (lastFetch) {
      const hoursSinceLastFetch = (Date.now() - new Date(lastFetch).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastFetch < updateInterval) {
        return; // Not time yet
      }
    }
    
    console.log('[Auto-Update] Starting scheduled update from SP Today...');
    
    // Fetch from SP Today using SDK
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', {
      url: SP_TODAY_URL
    });
    
    if (!result || !result.data || !result.data.html) {
      console.error('[Auto-Update] Failed to fetch SP Today page');
      return;
    }
    
    const html = result.data.html;
    
    // Extract rates
    const rates: { code: string; buyRate: number; sellRate: number }[] = [];
    
    for (const currency of CURRENCIES_TO_FETCH) {
      const pattern = new RegExp(
        `<span class="font-bold block">${currency}</span>[\\s\\S]*?` +
        `<span[^>]*class="[^"]*font-mono[^"]*font-bold[^"]*text-lg[^"]*"[^>]*>([\\d,]+)</span>[\\s\\S]*?` +
        `<span[^>]*class="[^"]*font-mono[^"]*font-bold[^"]*text-lg[^"]*"[^>]*>([\\d,]+)</span>`,
        's'
      );
      
      const match = html.match(pattern);
      if (match) {
        const rawBuy = parseInt(match[1].replace(/,/g, ''));
        const rawSell = parseInt(match[2].replace(/,/g, ''));
        let buyRate = rawBuy;
        let sellRate = rawSell;

        // Apply adjustment (deduction or addition) ثم نقطة عشوائية بين الخام والمعدل
        if (adjustmentType === 'deduction') {
          buyRate = Math.max(0, buyRate - adjustmentAmount);
          sellRate = Math.max(0, sellRate - adjustmentAmount);
        } else {
          buyRate = buyRate + adjustmentAmount;
          sellRate = sellRate + adjustmentAmount;
        }

        const t = Math.random();
        const swungBuy = Math.max(0, rawBuy + (buyRate - rawBuy) * t);
        const swungSell = Math.max(0, rawSell + (sellRate - rawSell) * t);
        buyRate = Math.max(rawBuy, swungBuy);
        sellRate = Math.max(rawSell, swungSell);

        if (!isNaN(buyRate) && !isNaN(sellRate) && buyRate > 0 && sellRate > 0) {
          rates.push({ code: currency, buyRate, sellRate });
        }
      }
    }
    
    // Update database
    for (const rate of rates) {
      const currency = await db.currency.findFirst({ where: { code: rate.code } });
      if (currency) {
        const buyRate = rate.buyRate;
        const sellRate = rate.sellRate;
        await upsertExchangeRateWithSnapshot(db, {
          currencyId: currency.id,
          buyRate,
          sellRate,
        });
      }
    }
    
    // Update last fetch time
    await db.siteSettings.updateMany({
      data: { lastFetchTime: new Date(), lastUpdate: new Date() },
    });
    try {
      await db.$executeRawUnsafe(`UPDATE SiteSettings SET manualRatesPinned = 0`);
    } catch {
      // عمود اختياري في قواعد قديمة
    }
    
    console.log(`[Auto-Update] Completed. Updated ${rates.length} currencies.`);
  } catch (error) {
    console.error('[Auto-Update] Error:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureSqliteSchema();
    const denied = await ratesApiOriginDenied(request);
    if (denied) return denied;

    // Auto-initialize if needed (يشمل بذر الفوركس/الرقميات إن وُجدت الجداول فارغة)
    await initializeDatabase();

    // Check for auto-update in background (non-blocking)
    checkAutoUpdate().catch(console.error);

    // Get all currencies with their exchange rates
    const currencies = await db.currency.findMany({
      where: { isActive: true },
      include: { rates: true },
      orderBy: { sortOrder: 'asc' }
    });

    // Get gold price
    const goldPrice = await db.goldPrice.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    // Get site settings
    const settings = await db.siteSettings.findFirst();
    const manualPinned =
      settings?.id != null
        ? Number(
            (
              await db.$queryRawUnsafe<Array<{ manualRatesPinned: number | null }>>(
                `SELECT manualRatesPinned FROM SiteSettings WHERE id = ? LIMIT 1`,
                settings.id
              )
            )[0]?.manualRatesPinned ?? 0
          ) > 0
        : false;
    const footerTiktok =
      settings?.id != null ? await readFooterSocialTiktok(db, settings.id) : null;
    const heroSectionTheme =
      settings?.id != null
        ? await fetchHeroSectionThemeRow((sql, ...params) => db.$queryRawUnsafe(sql, ...params), settings.id)
        : null;

    let fuelPrices: Awaited<ReturnType<typeof db.fuelPrice.findMany>> = [];
    try {
      fuelPrices = await db.fuelPrice.findMany({ orderBy: { code: 'asc' } });
    } catch (e) {
      console.error('Could not fetch fuel prices:', e);
    }

    const nowMs = Date.now();
    // Format the response
    const rates = currencies.map(currency => {
      const rate = currency.rates[0];
      const buyStored = rate?.buyRate ?? 0;
      const sellStored = rate?.sellRate ?? 0;
      const { buy: buyRate, sell: sellRate } = displayRatesWithOscillation(
        buyStored,
        sellStored,
        currency.code,
        nowMs,
        !manualPinned
      );
      return {
        id: currency.id,
        code: currency.code,
        nameAr: currency.nameAr,
        nameEn: currency.nameEn,
        symbol: currency.symbol,
        flagEmoji: currency.flagEmoji,
        buyRate,
        sellRate,
        lastUpdated: rate?.lastUpdated || null,
        changeBuyPct: pctDeltaFromPrevious(rate?.prevBuyRate ?? null, buyStored),
        changeSellPct: pctDeltaFromPrevious(rate?.prevSellRate ?? null, sellStored),
      };
    });

    const fuelOut = fuelPrices.map((f) => ({
      id: f.id,
      code: f.code,
      nameAr: f.nameAr,
      nameEn: f.nameEn,
      price: f.price,
      unitAr: f.unitAr,
      unitEn: f.unitEn,
      lastUpdated: f.lastUpdated,
      changePct: pctDeltaFromPrevious(f.prevPrice ?? null, f.price),
    }));
    const fuelVisibilityMap = await readFuelVisibilityMap(settings?.id);
    const visibleFuel = fuelOut.filter((f) => fuelVisibilityMap[f.code.toUpperCase()] !== false);

    return NextResponse.json({
      success: true,
      data: {
        rates,
        goldPrice: goldPrice ? {
          priceUsd: goldPrice.priceUsd,
          pricePerGram: goldPrice.pricePerGram,
          pricePerGram21: goldPrice.pricePerGram21 ?? null,
          pricePerGram18: goldPrice.pricePerGram18 ?? null,
          pricePerGram14: goldPrice.pricePerGram14 ?? null,
          lastUpdated: goldPrice.lastUpdated,
          changeOuncePct: pctDeltaFromPrevious(goldPrice.prevPriceUsd ?? null, goldPrice.priceUsd),
          changeGramPct: pctDeltaFromPrevious(goldPrice.prevPricePerGram ?? null, goldPrice.pricePerGram),
          changeGram21Pct:
            goldPrice.pricePerGram21 != null
              ? pctDeltaFromPrevious(goldPrice.prevPricePerGram21 ?? null, goldPrice.pricePerGram21)
              : null,
          changeGram18Pct:
            goldPrice.pricePerGram18 != null
              ? pctDeltaFromPrevious(goldPrice.prevPricePerGram18 ?? null, goldPrice.pricePerGram18)
              : null,
          changeGram14Pct:
            goldPrice.pricePerGram14 != null
              ? pctDeltaFromPrevious(goldPrice.prevPricePerGram14 ?? null, goldPrice.pricePerGram14)
              : null,
        } : null,
        fuelPrices: visibleFuel,
        siteName: settings?.siteName || 'سعر الليرة السورية',
        lastUpdate: settings?.lastUpdate || null,
        // Site Identity
        siteSettings: {
          siteName: settings?.siteName || 'سعر الليرة السورية',
          siteNameAr: settings?.siteNameAr || 'سعر الليرة السورية',
          siteNameEn: settings?.siteNameEn || 'Syrian Pound Exchange Rate',
          heroSubtitle: settings?.heroSubtitle || 'أسعار الصرف الحية',
          heroSubtitleAr: settings?.heroSubtitleAr || 'أسعار الصرف الحية',
          heroSubtitleEn: settings?.heroSubtitleEn || 'Live Exchange Rates',
          logoUrl: settings?.logoUrl || null,
          logoUrlAr: settings?.logoUrlAr ?? null,
          logoUrlNonAr: settings?.logoUrlNonAr ?? null,
          logoSizes: parseLogoSizes(settings?.logoSizes) as LogoSizes,
          // Visual Identity - Light Mode
          lightPrimaryColor: settings?.lightPrimaryColor || '#0ea5e9',
          lightAccentColor: settings?.lightAccentColor || '#0284c7',
          lightBgColor: settings?.lightBgColor || '#ffffff',
          // Visual Identity - Dark Mode
          darkPrimaryColor: settings?.darkPrimaryColor || '#0ea5e9',
          darkAccentColor: settings?.darkAccentColor || '#38bdf8',
          darkBgColor: settings?.darkBgColor || '#0f172a',
          heroSectionTheme,
          tickerMarqueeDurationSec: settings?.tickerMarqueeDurationSec ?? 42,
          footerSocialFacebook: settings?.footerSocialFacebook ?? null,
          footerSocialX: settings?.footerSocialX ?? null,
          footerSocialTelegram: settings?.footerSocialTelegram ?? null,
          footerSocialInstagram: settings?.footerSocialInstagram ?? null,
          footerSocialYoutube: settings?.footerSocialYoutube ?? null,
          footerSocialTiktok: footerTiktok,
          fuelVisibilityMap,
          adsenseEnabled: settings?.adsenseEnabled ?? false,
          adsenseAdClient: normalizeCaPub(settings?.adsensePublisherId ?? null),
          adsenseSlotHero: settings?.adsenseSlotHero ?? null,
          adsenseSlotContent: settings?.adsenseSlotContent ?? null,
        }
      }
    });
  } catch (error) {
    console.error('Error fetching rates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rates' },
      { status: 500 }
    );
  }
}
