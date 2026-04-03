import { PrismaClient } from '@prisma/client'

// Singleton Prisma client with all models including FuelPrice, ForexRate, CryptoRate
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create new Prisma client instance with fresh connection
const createPrismaClient = () => {
  return new PrismaClient({
    log: ['query'],
  })
}

// Always create a new client in development to pick up schema changes
export const db = process.env.NODE_ENV === 'production' 
  ? (globalForPrisma.prisma ?? createPrismaClient())
  : createPrismaClient()

if (process.env.NODE_ENV === 'production') globalForPrisma.prisma = db

let sqliteSchemaEnsured = false;

/**
 * إذا بقي ملف SQLite قديماً دون عمود جديد، تفشل قراءة SiteSettings ولا تُحمَّل الأسعار.
 * يُستدعى مرة قبل استعلامات الإعدادات.
 */
export async function ensureSqliteSchema(): Promise<void> {
  if (sqliteSchemaEnsured) return;
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('sqlite') && !url.includes('file:')) {
    sqliteSchemaEnsured = true;
    return;
  }
  const tryAlter = async (sql: string) => {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/duplicate column|already exists/i.test(m)) {
        console.warn('[db] ensureSqliteSchema:', m);
      }
    }
  };

  await tryAlter(
    `ALTER TABLE SiteSettings ADD COLUMN tickerMarqueeDurationSec INTEGER NOT NULL DEFAULT 42`
  );
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN logoUrlAr TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN logoUrlNonAr TEXT`);

  await tryAlter(`ALTER TABLE ExchangeRate ADD COLUMN prevBuyRate REAL`);
  await tryAlter(`ALTER TABLE ExchangeRate ADD COLUMN prevSellRate REAL`);
  await tryAlter(`ALTER TABLE ExchangeRate ADD COLUMN prevCapturedAt DATETIME`);

  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN prevPriceUsd REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN prevPricePerGram REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN prevCapturedAt DATETIME`);

  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN pricePerGram21 REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN pricePerGram18 REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN pricePerGram14 REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN prevPricePerGram21 REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN prevPricePerGram18 REAL`);
  await tryAlter(`ALTER TABLE GoldPrice ADD COLUMN prevPricePerGram14 REAL`);

  await tryAlter(`ALTER TABLE FuelPrice ADD COLUMN prevPrice REAL`);
  await tryAlter(`ALTER TABLE FuelPrice ADD COLUMN prevCapturedAt DATETIME`);

  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN platformApiUsdtTrc20 TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN platformApiSubscriptionPriceUsd REAL NOT NULL DEFAULT 50`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN platformApiSubscriptionDays INTEGER NOT NULL DEFAULT 365`);

  await tryAlter(`ALTER TABLE ApiAllowedDomain ADD COLUMN expiresAt DATETIME`);

  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN footerSocialFacebook TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN footerSocialX TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN footerSocialTelegram TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN footerSocialInstagram TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN footerSocialYoutube TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN footerSocialTiktok TEXT`);

  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN forexRealtimeEnabled INTEGER NOT NULL DEFAULT 0`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN finnhubApiKey TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN finnhubForexSymbolMap TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN cryptoRealtimeEnabled INTEGER NOT NULL DEFAULT 0`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN cryptoRealtimeCodes TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN fuelVisibilityMap TEXT`);

  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN adsenseEnabled INTEGER NOT NULL DEFAULT 0`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN adsensePublisherId TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN adsenseSiteVerification TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN adsTxtRaw TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN adsenseSlotHero TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN adsenseSlotContent TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN gscHtmlVerificationFileName TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN gscHtmlVerificationFileBody TEXT`);
  await tryAlter(`ALTER TABLE SiteSettings ADD COLUMN gscExtraSiteVerificationMeta TEXT`);

  sqliteSchemaEnsured = true;
}
