/** رمز Finnhub (مثل OANDA:EUR_USD) ←→ زوج العرض في قاعدة البيانات (مثل EUR/USD) */
export type FinnhubForexSymbolRow = { finnhubSymbol: string; pair: string };

/** الافتراضيات المعتمدة في البث الحي (فوركس + سلع) */
export const DEFAULT_MARKET_SYMBOL_ROWS: FinnhubForexSymbolRow[] = [
  { finnhubSymbol: 'OANDA:EUR_USD', pair: 'EUR/USD' },
  { finnhubSymbol: 'OANDA:GBP_USD', pair: 'GBP/USD' },
  { finnhubSymbol: 'OANDA:USD_JPY', pair: 'USD/JPY' },
  { finnhubSymbol: 'OANDA:USD_CHF', pair: 'USD/CHF' },
  { finnhubSymbol: 'OANDA:AUD_USD', pair: 'AUD/USD' },
  { finnhubSymbol: 'OANDA:USD_CAD', pair: 'USD/CAD' },
  { finnhubSymbol: 'OANDA:EUR_GBP', pair: 'EUR/GBP' },
  { finnhubSymbol: 'OANDA:EUR_JPY', pair: 'EUR/JPY' },
  // سلع: نستخدم Yahoo fallback بالبادئة YAHOO:
  { finnhubSymbol: 'YAHOO:GC=F', pair: 'XAU/USD' }, // Gold
  { finnhubSymbol: 'YAHOO:CL=F', pair: 'OIL/USD' }, // Crude Oil
  { finnhubSymbol: 'YAHOO:NG=F', pair: 'GAS/USD' }, // Natural Gas
  { finnhubSymbol: 'YAHOO:SB=F', pair: 'SUGAR/USD' }, // Sugar
  { finnhubSymbol: 'YAHOO:ZR=F', pair: 'RICE/USD' }, // Rough Rice
];
