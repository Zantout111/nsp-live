import { db } from '@/lib/db';

/** بيانات أولية عندما تكون الجداول فارغة (لا يُبذَّر مع العملات في initializeDatabase) */
const DEFAULT_FOREX_ROWS = [
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

const DEFAULT_CRYPTO_ROWS = [
  { code: 'BTC', nameAr: 'بيتكوين', nameEn: 'Bitcoin', price: 67234.56, change: 2.34, icon: '₿' },
  { code: 'ETH', nameAr: 'إيثيريوم', nameEn: 'Ethereum', price: 3456.78, change: -1.23, icon: 'Ξ' },
  { code: 'USDT', nameAr: 'تيثر', nameEn: 'Tether', price: 1.0, change: 0.01, icon: '₮' },
  { code: 'XRP', nameAr: 'ريبل', nameEn: 'Ripple', price: 0.5234, change: 3.45, icon: '✕' },
  { code: 'BNB', nameAr: 'بينانس', nameEn: 'Binance', price: 567.89, change: 0.87, icon: '◆' },
  { code: 'SOL', nameAr: 'سولانا', nameEn: 'Solana', price: 178.45, change: -2.12, icon: '◎' },
  { code: 'USDC', nameAr: 'يو إس دي كوين', nameEn: 'USD Coin', price: 1.0, change: 0.0, icon: '$' },
  { code: 'DOGE', nameAr: 'دوجكوين', nameEn: 'Dogecoin', price: 0.1523, change: 5.67, icon: 'Ð' },
  { code: 'ADA', nameAr: 'كاردانو', nameEn: 'Cardano', price: 0.4567, change: 1.56, icon: '₳' },
  { code: 'TRX', nameAr: 'ترون', nameEn: 'TRON', price: 0.13, change: 0.8, icon: 'T' },
  { code: 'AVAX', nameAr: 'أفالانش', nameEn: 'Avalanche', price: 36.5, change: -0.7, icon: 'A' },
  { code: 'LINK', nameAr: 'تشين لينك', nameEn: 'Chainlink', price: 18.2, change: 1.2, icon: '⬡' },
  { code: 'TON', nameAr: 'تون كوين', nameEn: 'Toncoin', price: 6.8, change: 0.9, icon: '◉' },
  { code: 'SHIB', nameAr: 'شيبا إينو', nameEn: 'Shiba Inu', price: 0.000025, change: -1.1, icon: '🐕' },
  { code: 'SUI', nameAr: 'سوي', nameEn: 'Sui', price: 1.7, change: 2.1, icon: 'S' },
  { code: 'DOT', nameAr: 'بولكادوت', nameEn: 'Polkadot', price: 7.1, change: -0.4, icon: '●' },
  { code: 'BCH', nameAr: 'بيتكوين كاش', nameEn: 'Bitcoin Cash', price: 495.0, change: 0.5, icon: 'Ƀ' },
  { code: 'LTC', nameAr: 'لايتكوين', nameEn: 'Litecoin', price: 85.0, change: -0.3, icon: 'Ł' },
  { code: 'HBAR', nameAr: 'هيديرا', nameEn: 'Hedera', price: 0.11, change: 0.6, icon: 'H' },
  { code: 'XLM', nameAr: 'ستيلر', nameEn: 'Stellar', price: 0.12, change: 0.4, icon: '*' },
  { code: 'UNI', nameAr: 'يوني سواب', nameEn: 'Uniswap', price: 12.5, change: 0.7, icon: '🦄' },
  { code: 'PEPE', nameAr: 'بيبي', nameEn: 'Pepe', price: 0.000011, change: 1.8, icon: '🐸' },
  { code: 'ETC', nameAr: 'إيثريوم كلاسيك', nameEn: 'Ethereum Classic', price: 28.0, change: -0.2, icon: 'Ξ' },
  { code: 'APT', nameAr: 'أبتوس', nameEn: 'Aptos', price: 9.7, change: 1.0, icon: 'A' },
  { code: 'ICP', nameAr: 'إنترنت كمبيوتر', nameEn: 'Internet Computer', price: 13.4, change: -0.5, icon: '∞' },
  { code: 'NEAR', nameAr: 'نير', nameEn: 'NEAR Protocol', price: 5.6, change: 0.9, icon: 'N' },
  { code: 'VET', nameAr: 'في تشين', nameEn: 'VeChain', price: 0.04, change: 0.3, icon: 'V' },
  { code: 'FIL', nameAr: 'فايل كوين', nameEn: 'Filecoin', price: 8.2, change: -0.6, icon: 'F' },
  { code: 'ATOM', nameAr: 'كوزموس', nameEn: 'Cosmos', price: 10.1, change: 0.4, icon: '⚛' },
  { code: 'OP', nameAr: 'أوبتيميزم', nameEn: 'Optimism', price: 2.9, change: 1.1, icon: 'O' },
];

/**
 * يملأ ForexRate و CryptoRate إن كانتا فارغتين (مرة واحدة فعلياً).
 * يُستدعى من مسارات API قبل القراءة حتى لا تبقى الواجهة فارغة.
 */
export async function ensureForexCryptoSeeded(): Promise<void> {
  // SQLite: إدراج آمن بدون تكرار حتى لو كانت هناك بيانات قديمة
  for (const row of DEFAULT_FOREX_ROWS) {
    await db.$executeRawUnsafe(
      `INSERT OR IGNORE INTO ForexRate
       (id, pair, nameAr, nameEn, rate, change, flag1, flag2, lastUpdated, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      `seed-fx-${row.pair.replace('/', '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      row.pair,
      row.nameAr,
      row.nameEn,
      row.rate,
      row.change,
      row.flag1,
      row.flag2
    );
  }
  for (const row of DEFAULT_FOREX_ROWS) {
    await db.$executeRawUnsafe(
      `UPDATE ForexRate SET nameAr = ?, nameEn = ? WHERE pair = ?`,
      row.nameAr,
      row.nameEn,
      row.pair
    );
  }
  // SQLite: إدراج آمن بدون تكرار حتى مع طلبات متزامنة
  for (const row of DEFAULT_CRYPTO_ROWS) {
    await db.$executeRawUnsafe(
      `INSERT OR IGNORE INTO CryptoRate
       (id, code, nameAr, nameEn, price, change, icon, lastUpdated, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      `seed-${row.code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      row.code,
      row.nameAr,
      row.nameEn,
      row.price,
      row.change,
      row.icon ?? null
    );
  }
}
