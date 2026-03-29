'use client';

import { useMemo, useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Layers, Sparkles } from 'lucide-react';

export interface AdvCurrencyRate {
  code: string;
  nameAr: string;
  nameEn: string;
  buyRate: number;
  sellRate: number;
  flagEmoji: string | null;
}

export interface AdvGoldPrice {
  priceUsd: number;
  pricePerGram: number;
}

export interface AdvFuelPrice {
  code: string;
  nameAr: string;
  nameEn: string;
  price: number;
  unitAr: string;
  unitEn: string;
}

export interface AdvForexRate {
  pair: string;
  nameAr: string;
  nameEn: string;
  rate: number;
}

export interface AdvCryptoRate {
  code: string;
  nameAr: string;
  nameEn: string;
  price: number;
}

type SourceCategory = 'syp' | 'currency' | 'gold' | 'fuel' | 'crypto' | 'forex';
type GoldUnit = 'gram' | 'oz' | 'lira';
type ForexAmountSide = 'base' | 'quote';

function splitForexPair(pair: string): [string, string] | null {
  const p = pair.split('/').map((s) => s.trim().toUpperCase());
  if (p.length !== 2 || !p[0] || !p[1]) return null;
  return [p[0], p[1]];
}

function sourceToSyp(params: {
  category: SourceCategory;
  amount: number;
  rates: AdvCurrencyRate[];
  gold: AdvGoldPrice | null;
  fuelPrices: AdvFuelPrice[];
  forexRates: AdvForexRate[];
  cryptoRates: AdvCryptoRate[];
  currencyCode: string;
  goldUnit: GoldUnit;
  fuelCode: string;
  cryptoCode: string;
  forexPair: string;
  forexSide: ForexAmountSide;
}): number | null {
  const usd = params.rates.find((c) => c.code === 'USD');
  if (!usd || !Number.isFinite(params.amount)) return null;

  const { amount, category, rates } = params;

  switch (category) {
    case 'syp':
      return Math.max(0, amount);
    case 'currency': {
      const c = rates.find((r) => r.code === params.currencyCode);
      if (!c || c.sellRate <= 0) return null;
      return amount * c.sellRate;
    }
    case 'gold': {
      const g = params.gold;
      if (!g || g.pricePerGram <= 0 || g.priceUsd <= 0) return null;
      const usdSell = usd.sellRate;
      if (params.goldUnit === 'gram') return amount * g.pricePerGram * usdSell;
      if (params.goldUnit === 'oz') return amount * g.priceUsd * usdSell;
      return amount * g.pricePerGram * 8.5 * usdSell;
    }
    case 'fuel': {
      const f = params.fuelPrices.find((x) => x.code === params.fuelCode);
      if (!f || f.price <= 0) return null;
      return amount * f.price;
    }
    case 'crypto': {
      const cr = params.cryptoRates.find((x) => x.code === params.cryptoCode);
      if (!cr || cr.price <= 0) return null;
      return amount * cr.price * usd.sellRate;
    }
    case 'forex': {
      const fx = params.forexRates.find((x) => x.pair === params.forexPair);
      const pq = splitForexPair(params.forexPair);
      if (!fx || !pq || fx.rate <= 0) return null;
      const [base, quote] = pq;
      const r = fx.rate;
      if (quote === 'USD') {
        if (params.forexSide === 'base') {
          return amount * r * usd.sellRate;
        }
        return amount * usd.sellRate;
      }
      if (base === 'USD') {
        if (params.forexSide === 'base') {
          return amount * usd.sellRate;
        }
        const usdVal = amount / r;
        return usdVal * usd.sellRate;
      }
      return null;
    }
    default:
      return null;
  }
}

function sypToForeignUnits(syp: number, buyRate: number): number | null {
  if (buyRate <= 0) return null;
  return syp / buyRate;
}

export type TargetRow = { id: string; label: string; value: string; sub?: string };

function buildTargetRows(
  syp: number,
  params: {
    locale: string;
    rates: AdvCurrencyRate[];
    gold: AdvGoldPrice | null;
    fuelPrices: AdvFuelPrice[];
    forexRates: AdvForexRate[];
    cryptoRates: AdvCryptoRate[];
    selected: Set<string>;
    formatNumber: (n: number, d?: number, o?: { noNewLira?: boolean }) => string;
    getCurrencySymbol: () => string;
    t: (key: string) => string;
  }
): TargetRow[] {
  const rows: TargetRow[] = [];
  const usd = params.rates.find((c) => c.code === 'USD');
  if (!usd || syp <= 0 || !Number.isFinite(syp)) return rows;

  const name = (ar: string, en: string) => (params.locale === 'ar' ? ar : en);
  const sym = params.getCurrencySymbol();

  for (const c of params.rates) {
    const id = `cur:${c.code}`;
    if (!params.selected.has(id)) continue;
    const u = sypToForeignUnits(syp, c.buyRate);
    if (u == null) continue;
    const dec = ['BTC', 'ETH', 'JPY'].includes(c.code) ? 6 : c.code === 'USD' ? 4 : 2;
    rows.push({
      id,
      label: `${name(c.nameAr, c.nameEn)} (${c.code})`,
      value: params.formatNumber(u, dec, { noNewLira: true }),
    });
  }

  const g = params.gold;
  if (g && g.pricePerGram > 0 && g.priceUsd > 0) {
    const usdSell = usd.sellRate;
    const sypPerG = g.pricePerGram * usdSell;
    const sypPerOz = g.priceUsd * usdSell;
    if (params.selected.has('gold:gram') && sypPerG > 0) {
      const grams = syp / sypPerG;
      rows.push({
        id: 'gold:gram',
        label: params.t('calculator.advanced.goldGram'),
        value: params.formatNumber(grams, 4, { noNewLira: true }) + ' g',
      });
    }
    if (params.selected.has('gold:oz') && sypPerOz > 0) {
      const oz = syp / sypPerOz;
      rows.push({
        id: 'gold:oz',
        label: params.t('calculator.advanced.goldOz'),
        value: params.formatNumber(oz, 4, { noNewLira: true }) + ' oz',
      });
    }
    if (params.selected.has('gold:lira') && sypPerG > 0) {
      const grams = syp / sypPerG;
      const lira = grams / 8.5;
      rows.push({
        id: 'gold:lira',
        label: params.t('calculator.advanced.goldLira'),
        value: params.formatNumber(lira, 4, { noNewLira: true }),
      });
    }
  }

  for (const f of params.fuelPrices) {
    const id = `fuel:${f.code}`;
    if (!params.selected.has(id) || f.price <= 0) continue;
    const units = syp / f.price;
    const unitLabel = name(f.unitAr, f.unitEn);
    rows.push({
      id,
      label: `${name(f.nameAr, f.nameEn)} (${f.code})`,
      value: params.formatNumber(units, 3, { noNewLira: true }) + ' ' + unitLabel,
    });
  }

  for (const cr of params.cryptoRates) {
    const id = `crypto:${cr.code}`;
    if (!params.selected.has(id) || cr.price <= 0) continue;
    const usdVal = syp / usd.sellRate;
    const coins = usdVal / cr.price;
    rows.push({
      id,
      label: `${name(cr.nameAr, cr.nameEn)} (${cr.code})`,
      value: params.formatNumber(coins, 8, { noNewLira: true }),
    });
  }

  const usdEquiv = syp / usd.sellRate;
  for (const fx of params.forexRates) {
    const id = `fx:${fx.pair}`;
    if (!params.selected.has(id) || fx.rate <= 0) continue;
    const pq = splitForexPair(fx.pair);
    if (!pq) continue;
    const [base, quote] = pq;
    let label = '';
    let val = '';
    if (quote === 'USD') {
      const baseAmt = usdEquiv / fx.rate;
      label = `${name(fx.nameAr, fx.nameEn)} → ${base}`;
      val = params.formatNumber(baseAmt, 6, { noNewLira: true }) + ' ' + base;
    } else if (base === 'USD') {
      const quoteAmt = usdEquiv * fx.rate;
      label = `${name(fx.nameAr, fx.nameEn)} → ${quote}`;
      val = params.formatNumber(quoteAmt, 4, { noNewLira: true }) + ' ' + quote;
    } else {
      continue;
    }
    rows.push({
      id,
      label,
      value: val,
      sub: params.t('calculator.advanced.fromUsdBridge'),
    });
  }

  if (params.selected.has('syp:display')) {
    rows.unshift({
      id: 'syp:display',
      label: params.t('calculator.advanced.inSyp'),
      value: params.formatNumber(syp),
      sub: sym,
    });
  }

  return rows;
}

export function AdvancedExchangeCalculator({
  rates,
  goldPrice,
  fuelPrices,
  forexRates,
  cryptoRates,
  locale,
  formatNumber,
  getCurrencySymbol,
  t,
}: {
  rates: AdvCurrencyRate[];
  goldPrice: AdvGoldPrice | null;
  fuelPrices: AdvFuelPrice[];
  forexRates: AdvForexRate[];
  cryptoRates: AdvCryptoRate[];
  locale: string;
  formatNumber: (n: number, decimals?: number, opts?: { noNewLira?: boolean }) => string;
  getCurrencySymbol: () => string;
  t: (key: string) => string;
}) {
  const [amountStr, setAmountStr] = useState('100');
  const [category, setCategory] = useState<SourceCategory>('currency');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [goldUnit, setGoldUnit] = useState<GoldUnit>('gram');
  const [fuelCode, setFuelCode] = useState(() => fuelPrices[0]?.code ?? '');
  const [cryptoCode, setCryptoCode] = useState(() => cryptoRates[0]?.code ?? 'BTC');
  const [forexPair, setForexPair] = useState(() => forexRates[0]?.pair ?? 'EUR/USD');
  const [forexSide, setForexSide] = useState<ForexAmountSide>('base');

  const defaultTargets = useMemo(() => {
    const s = new Set<string>(['syp:display']);
    for (const c of rates) {
      if (['USD', 'EUR', 'TRY'].includes(c.code)) s.add(`cur:${c.code}`);
    }
    s.add('gold:gram');
    if (cryptoRates.some((x) => x.code === 'BTC')) s.add('crypto:BTC');
    return s;
  }, [rates, cryptoRates]);

  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(() => new Set(defaultTargets));

  const resolvedCurrencyCode = useMemo(() => {
    if (!rates.length) return '';
    if (rates.some((r) => r.code === currencyCode)) return currencyCode;
    return rates[0].code;
  }, [rates, currencyCode]);

  const resolvedFuelCode = useMemo(() => {
    if (!fuelPrices.length) return '';
    if (fuelPrices.some((f) => f.code === fuelCode)) return fuelCode;
    return fuelPrices[0].code;
  }, [fuelPrices, fuelCode]);

  const resolvedCryptoCode = useMemo(() => {
    if (!cryptoRates.length) return '';
    if (cryptoRates.some((c) => c.code === cryptoCode)) return cryptoCode;
    return cryptoRates[0].code;
  }, [cryptoRates, cryptoCode]);

  const resolvedForexPair = useMemo(() => {
    if (!forexRates.length) return '';
    if (forexRates.some((f) => f.pair === forexPair)) return forexPair;
    return forexRates[0].pair;
  }, [forexRates, forexPair]);

  const amount = parseFloat(amountStr.replace(',', '.')) || 0;

  const sypValue = useMemo(() => {
    return sourceToSyp({
      category,
      amount,
      rates,
      gold: goldPrice,
      fuelPrices,
      forexRates,
      cryptoRates,
      currencyCode: resolvedCurrencyCode,
      goldUnit,
      fuelCode: resolvedFuelCode,
      cryptoCode: resolvedCryptoCode,
      forexPair: resolvedForexPair,
      forexSide,
    });
  }, [
    category,
    amount,
    rates,
    goldPrice,
    fuelPrices,
    forexRates,
    cryptoRates,
    resolvedCurrencyCode,
    goldUnit,
    resolvedFuelCode,
    resolvedCryptoCode,
    resolvedForexPair,
    forexSide,
  ]);

  const rows = useMemo(() => {
    if (sypValue == null || sypValue <= 0) return [];
    return buildTargetRows(sypValue, {
      locale,
      rates,
      gold: goldPrice,
      fuelPrices,
      forexRates,
      cryptoRates,
      selected: selectedTargets,
      formatNumber,
      getCurrencySymbol,
      t,
    });
  }, [
    sypValue,
    locale,
    rates,
    goldPrice,
    fuelPrices,
    forexRates,
    cryptoRates,
    selectedTargets,
    formatNumber,
    getCurrencySymbol,
    t,
  ]);

  const toggleTarget = useCallback((id: string, checked: boolean) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectGroup = useCallback((ids: string[], on: boolean) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const allCurrencyIds = useMemo(() => rates.map((c) => `cur:${c.code}`), [rates]);
  const allFuelIds = useMemo(() => fuelPrices.map((f) => `fuel:${f.code}`), [fuelPrices]);
  const allCryptoIds = useMemo(() => cryptoRates.map((c) => `crypto:${c.code}`), [cryptoRates]);
  const allFxIds = useMemo(
    () =>
      forexRates
        .filter((f) => {
          const pq = splitForexPair(f.pair);
          if (!pq) return false;
          const [b, q] = pq;
          return q === 'USD' || b === 'USD';
        })
        .map((f) => `fx:${f.pair}`),
    [forexRates]
  );

  const isRtl = locale === 'ar';
  const usdOk = rates.some((c) => c.code === 'USD');

  return (
    <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <p className="text-sm leading-relaxed text-muted-foreground dark:text-slate-400">
        {t('calculator.advanced.intro')}
      </p>

      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground dark:text-slate-100">
          <Layers className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {t('calculator.advanced.sourceSection')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('calculator.advanced.amount')}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('calculator.advanced.category')}</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SourceCategory)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm dark:border-slate-600 dark:bg-slate-900/80"
            >
              <option value="syp">{t('calculator.advanced.catSyp')}</option>
              <option value="currency">{t('calculator.advanced.catCurrency')}</option>
              <option value="gold">{t('calculator.advanced.catGold')}</option>
              <option value="fuel">{t('calculator.advanced.catFuel')}</option>
              <option value="crypto">{t('calculator.advanced.catCrypto')}</option>
              <option value="forex">{t('calculator.advanced.catForex')}</option>
            </select>
          </div>

          {category === 'currency' && (
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label>{t('calculator.advanced.pickCurrency')}</Label>
              <select
                value={resolvedCurrencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm dark:border-slate-600 dark:bg-slate-900/80"
              >
                {rates.map((c) => (
                  <option key={c.code} value={c.code}>
                    {(locale === 'ar' ? c.nameAr : c.nameEn) || c.code} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'gold' && goldPrice && (
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label>{t('calculator.advanced.goldUnit')}</Label>
              <select
                value={goldUnit}
                onChange={(e) => setGoldUnit(e.target.value as GoldUnit)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm dark:border-slate-600 dark:bg-slate-900/80"
              >
                <option value="gram">{t('calculator.advanced.goldGram')}</option>
                <option value="oz">{t('calculator.advanced.goldOz')}</option>
                <option value="lira">{t('calculator.advanced.goldLira')}</option>
              </select>
            </div>
          )}

          {category === 'fuel' && fuelPrices.length > 0 && (
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label>{t('calculator.advanced.pickFuel')}</Label>
              <select
                value={resolvedFuelCode}
                onChange={(e) => setFuelCode(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm dark:border-slate-600 dark:bg-slate-900/80"
              >
                {fuelPrices.map((f) => (
                  <option key={f.code} value={f.code}>
                    {(locale === 'ar' ? f.nameAr : f.nameEn) || f.code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'crypto' && cryptoRates.length > 0 && (
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label>{t('calculator.advanced.pickCrypto')}</Label>
              <select
                value={resolvedCryptoCode}
                onChange={(e) => setCryptoCode(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm dark:border-slate-600 dark:bg-slate-900/80"
              >
                {cryptoRates.map((c) => (
                  <option key={c.code} value={c.code}>
                    {(locale === 'ar' ? c.nameAr : c.nameEn) || c.code} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'forex' && forexRates.length > 0 && (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('calculator.advanced.pickPair')}</Label>
                <select
                  value={resolvedForexPair}
                  onChange={(e) => setForexPair(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm dark:border-slate-600 dark:bg-slate-900/80"
                >
                  {forexRates.map((f) => (
                    <option key={f.pair} value={f.pair}>
                      {f.pair} — {locale === 'ar' ? f.nameAr : f.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('calculator.advanced.forexSide')}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={forexSide === 'base' ? 'default' : 'outline'}
                    className="h-11 flex-1"
                    onClick={() => setForexSide('base')}
                  >
                    {t('calculator.advanced.forexBase')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={forexSide === 'quote' ? 'default' : 'outline'}
                    className="h-11 flex-1"
                    onClick={() => setForexSide('quote')}
                  >
                    {t('calculator.advanced.forexQuote')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {!usdOk && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{t('calculator.advanced.needUsd')}</p>
        )}

        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
          <p className="text-xs font-medium text-primary dark:text-blue-300">
            {t('calculator.advanced.sypEquivalent')}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-slate-100">
            {sypValue != null && sypValue > 0
              ? formatNumber(sypValue)
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{getCurrencySymbol()}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-muted/15 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-slate-100">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            {t('calculator.advanced.compareSection')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedTargets(new Set(defaultTargets))}>
              {t('calculator.advanced.resetSelection')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Collapsible defaultOpen className="rounded-lg border border-border/60 dark:border-white/10">
            <div className="flex flex-col gap-2 border-b border-border/60 px-2 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/50 dark:hover:bg-white/5"
                >
                  {t('calculator.advanced.groupCurrencies')}
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </CollapsibleTrigger>
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => selectGroup(allCurrencyIds, true)}
                >
                  {t('calculator.advanced.selectAll')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => selectGroup(allCurrencyIds, false)}
                >
                  {t('calculator.advanced.selectNone')}
                </Button>
              </div>
            </div>
            <CollapsibleContent className="border-t border-border/60 px-3 py-3 dark:border-white/10">
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedTargets.has('syp:display')}
                  onCheckedChange={(c) => toggleTarget('syp:display', c === true)}
                />
                {t('calculator.advanced.inSyp')}
              </label>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                {rates.map((c) => {
                  const id = `cur:${c.code}`;
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={selectedTargets.has(id)}
                        onCheckedChange={(ch) => toggleTarget(id, ch === true)}
                      />
                      <span className="truncate">{c.code}</span>
                    </label>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {goldPrice && (
            <Collapsible defaultOpen className="rounded-lg border border-border/60 dark:border-white/10">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 dark:hover:bg-white/5 dark:border-white/10"
                >
                  {t('calculator.advanced.groupGold')}
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-wrap gap-4 border-t border-border/60 px-3 py-3 dark:border-white/10">
                {(['gram', 'oz', 'lira'] as const).map((u) => {
                  const id = `gold:${u}`;
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedTargets.has(id)}
                        onCheckedChange={(c) => toggleTarget(id, c === true)}
                      />
                      {u === 'gram' && t('calculator.advanced.goldGram')}
                      {u === 'oz' && t('calculator.advanced.goldOz')}
                      {u === 'lira' && t('calculator.advanced.goldLira')}
                    </label>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {fuelPrices.length > 0 && (
            <Collapsible className="rounded-lg border border-border/60 dark:border-white/10">
              <div className="flex flex-col gap-2 border-b border-border/60 px-2 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/50 dark:hover:bg-white/5"
                  >
                    {t('calculator.advanced.groupFuel')}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => selectGroup(allFuelIds, true)}
                  >
                    {t('calculator.advanced.selectAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => selectGroup(allFuelIds, false)}
                  >
                    {t('calculator.advanced.selectNone')}
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="border-t border-border/60 px-3 py-3 dark:border-white/10">
                <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {fuelPrices.map((f) => {
                    const id = `fuel:${f.code}`;
                    return (
                      <label key={id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={selectedTargets.has(id)}
                          onCheckedChange={(c) => toggleTarget(id, c === true)}
                        />
                        <span className="truncate">{f.code}</span>
                      </label>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {cryptoRates.length > 0 && (
            <Collapsible className="rounded-lg border border-border/60 dark:border-white/10">
              <div className="flex flex-col gap-2 border-b border-border/60 px-2 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/50 dark:hover:bg-white/5"
                  >
                    {t('calculator.advanced.groupCrypto')}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => selectGroup(allCryptoIds, true)}
                  >
                    {t('calculator.advanced.selectAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => selectGroup(allCryptoIds, false)}
                  >
                    {t('calculator.advanced.selectNone')}
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="border-t border-border/60 px-3 py-3 dark:border-white/10">
                <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
                  {cryptoRates.map((c) => {
                    const id = `crypto:${c.code}`;
                    return (
                      <label key={id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={selectedTargets.has(id)}
                          onCheckedChange={(ch) => toggleTarget(id, ch === true)}
                        />
                        <span className="truncate">{c.code}</span>
                      </label>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {allFxIds.length > 0 && (
            <Collapsible className="rounded-lg border border-border/60 dark:border-white/10">
              <div className="flex flex-col gap-2 border-b border-border/60 px-2 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/50 dark:hover:bg-white/5"
                  >
                    {t('calculator.advanced.groupForex')}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => selectGroup(allFxIds, true)}
                  >
                    {t('calculator.advanced.selectAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => selectGroup(allFxIds, false)}
                  >
                    {t('calculator.advanced.selectNone')}
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="border-t border-border/60 px-3 py-3 dark:border-white/10">
                <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {forexRates
                    .filter((f) => allFxIds.includes(`fx:${f.pair}`))
                    .map((f) => {
                      const id = `fx:${f.pair}`;
                      return (
                        <label key={id} className="flex cursor-pointer items-center gap-2 text-xs">
                          <Checkbox
                            checked={selectedTargets.has(id)}
                            onCheckedChange={(c) => toggleTarget(id, c === true)}
                          />
                          <span className="truncate">{f.pair}</span>
                        </label>
                      );
                    })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 dark:border-white/10">
        <div className="bg-muted/40 px-4 py-2 text-sm font-semibold dark:bg-white/5">
          {t('calculator.advanced.results')}
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('calculator.advanced.noResults')}</p>
        ) : (
          <div className="divide-y divide-border/60 dark:divide-white/10">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground dark:text-slate-100">{r.label}</p>
                  {r.sub ? <p className="text-xs text-muted-foreground">{r.sub}</p> : null}
                </div>
                <p className="text-lg font-bold tabular-nums text-primary sm:text-end dark:text-blue-300">{r.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground dark:text-slate-500">{t('calculator.advanced.disclaimer')}</p>
    </div>
  );
}
