import { db } from '@/lib/db';

/** بيانات أولية عندما تكون الجداول فارغة (لا يُبذَّر مع العملات في initializeDatabase) */
const DEFAULT_FOREX_ROWS = [
  { pair: 'EUR/USD', nameAr: 'يورو/دولار', nameEn: 'Euro/US Dollar', rate: 1.0856, change: 0.12, flag1: 'eu', flag2: 'us' },
  { pair: 'GBP/USD', nameAr: 'جنيه/دولار', nameEn: 'British Pound/US Dollar', rate: 1.2634, change: -0.08, flag1: 'gb', flag2: 'us' },
  { pair: 'USD/JPY', nameAr: 'دولار/ين', nameEn: 'US Dollar/Japanese Yen', rate: 154.32, change: 0.25, flag1: 'us', flag2: 'jp' },
  { pair: 'USD/CHF', nameAr: 'دولار/فرنك', nameEn: 'US Dollar/Swiss Franc', rate: 0.8845, change: -0.15, flag1: 'us', flag2: 'ch' },
  { pair: 'AUD/USD', nameAr: 'دولار أسترالي/دولار', nameEn: 'Australian Dollar/US Dollar', rate: 0.6523, change: 0.18, flag1: 'au', flag2: 'us' },
  { pair: 'USD/CAD', nameAr: 'دولار/دولار كندي', nameEn: 'US Dollar/Canadian Dollar', rate: 1.3678, change: -0.22, flag1: 'us', flag2: 'ca' },
  { pair: 'EUR/GBP', nameAr: 'يورو/جنيه', nameEn: 'Euro/British Pound', rate: 0.8592, change: 0.05, flag1: 'eu', flag2: 'gb' },
  { pair: 'EUR/JPY', nameAr: 'يورو/ين', nameEn: 'Euro/Japanese Yen', rate: 167.45, change: 0.32, flag1: 'eu', flag2: 'jp' },
];

const DEFAULT_CRYPTO_ROWS = [
  { code: 'BTC', nameAr: 'بيتكوين', nameEn: 'Bitcoin', price: 67234.56, change: 2.34, icon: '₿' },
  { code: 'ETH', nameAr: 'إيثيريوم', nameEn: 'Ethereum', price: 3456.78, change: -1.23, icon: 'Ξ' },
  { code: 'BNB', nameAr: 'بينانس', nameEn: 'Binance', price: 567.89, change: 0.87, icon: '◆' },
  { code: 'XRP', nameAr: 'ريبل', nameEn: 'Ripple', price: 0.5234, change: 3.45, icon: '✕' },
  { code: 'SOL', nameAr: 'سولانا', nameEn: 'Solana', price: 178.45, change: -2.12, icon: '◎' },
  { code: 'ADA', nameAr: 'كاردانو', nameEn: 'Cardano', price: 0.4567, change: 1.56, icon: '₳' },
  { code: 'DOGE', nameAr: 'دوجكوين', nameEn: 'Dogecoin', price: 0.1523, change: 5.67, icon: 'Ð' },
];

/**
 * يملأ ForexRate و CryptoRate إن كانتا فارغتين (مرة واحدة فعلياً).
 * يُستدعى من مسارات API قبل القراءة حتى لا تبقى الواجهة فارغة.
 */
export async function ensureForexCryptoSeeded(): Promise<void> {
  const [forexCount, cryptoCount] = await Promise.all([
    db.forexRate.count(),
    db.cryptoRate.count(),
  ]);
  if (forexCount === 0) {
    await db.forexRate.createMany({
      data: DEFAULT_FOREX_ROWS,
      skipDuplicates: true,
    });
  }
  if (cryptoCount === 0) {
    await db.cryptoRate.createMany({
      data: DEFAULT_CRYPTO_ROWS,
      skipDuplicates: true,
    });
  }
}
