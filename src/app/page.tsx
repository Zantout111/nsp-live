'use client';

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRightLeft,
  Sparkles,
  Coins,
  Fuel,
  DollarSign,
  Globe,
} from 'lucide-react';
import { numberingLatn } from '@/lib/intl-latn';
import { DEFAULT_LOGO_SIZES, parseLogoSizes, type LogoSizes } from '@/lib/logo-sizes';
import { DEFAULT_BRAND_LOGO, resolveLogoUrlForClient } from '@/lib/resolve-logo-url';
import { PriceShareButton } from '@/components/price-share-button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CurrencyRate {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  symbol: string | null;
  flagEmoji: string | null;
  buyRate: number;
  sellRate: number;
  lastUpdated: string | null;
  changeBuyPct?: number | null;
  changeSellPct?: number | null;
}

interface GoldPriceData {
  priceUsd: number;
  pricePerGram: number;
  lastUpdated: string;
  changeOuncePct?: number | null;
  changeGramPct?: number | null;
}

interface FuelPriceData {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  price: number;
  unitAr: string;
  unitEn: string;
  lastUpdated: string;
  changePct?: number | null;
}

interface ForexRateData {
  id: string;
  pair: string;
  nameAr: string;
  nameEn: string;
  rate: number;
  change: number;
  flag1: string;
  flag2: string;
  lastUpdated: string;
}

interface CryptoRateData {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  price: number;
  change: number;
  icon: string | null;
  lastUpdated: string;
}

interface SiteSettings {
  siteName: string;
  siteNameAr: string;
  siteNameEn: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroSubtitleEn: string;
  logoUrl: string | null;
  logoSizes?: LogoSizes | null;
  lightPrimaryColor: string;
  lightAccentColor: string;
  lightBgColor: string;
  darkPrimaryColor: string;
  darkAccentColor: string;
  darkBgColor: string;
  /** مدة دورة شريط النشرة فوق الترويسة بالثواني */
  tickerMarqueeDurationSec?: number;
}

interface RatesData {
  rates: CurrencyRate[];
  goldPrice: GoldPriceData | null;
  fuelPrices: FuelPriceData[];
  forexRates: ForexRateData[];
  cryptoRates: CryptoRateData[];
  siteName: string;
  lastUpdate: string | null;
  siteSettings: SiteSettings;
}

// Flag URLs using flagcdn.com
const flagUrls: Record<string, string> = {
  USD: 'https://flagcdn.com/w80/us.png',
  EUR: 'https://flagcdn.com/w80/eu.png',
  TRY: 'https://flagcdn.com/w80/tr.png',
  SAR: 'https://flagcdn.com/w80/sa.png',
  AED: 'https://flagcdn.com/w80/ae.png',
  GBP: 'https://flagcdn.com/w80/gb.png',
  CHF: 'https://flagcdn.com/w80/ch.png',
  CAD: 'https://flagcdn.com/w80/ca.png',
  AUD: 'https://flagcdn.com/w80/au.png',
  JOD: 'https://flagcdn.com/w80/jo.png',
  KWD: 'https://flagcdn.com/w80/kw.png',
  EGP: 'https://flagcdn.com/w80/eg.png',
  LYD: 'https://flagcdn.com/w80/ly.png',
  QAR: 'https://flagcdn.com/w80/qa.png',
  BHD: 'https://flagcdn.com/w80/bh.png',
  OMR: 'https://flagcdn.com/w80/om.png',
};

function rateDeltaAvg(
  a: number | null | undefined,
  b: number | null | undefined
): number | null {
  if (a != null && Number.isFinite(a) && b != null && Number.isFinite(b)) return (a + b) / 2;
  if (a != null && Number.isFinite(a)) return a;
  if (b != null && Number.isFinite(b)) return b;
  return null;
}

function RateDeltaBadge({
  pct,
  subLabel,
  className,
}: {
  pct: number | null | undefined;
  subLabel?: string;
  className?: string;
}) {
  if (pct == null || !Number.isFinite(pct)) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground sm:text-xs',
          className
        )}
      >
        {subLabel ? <span>{subLabel}</span> : null}
        —
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-0.5 text-[11px] font-medium tabular-nums sm:text-xs',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        className
      )}
    >
      {subLabel ? <span className="font-normal text-muted-foreground">{subLabel}</span> : null}
      {up ? <TrendingUp className="h-3 w-3 shrink-0" aria-hidden /> : <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />}
      {up ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
}

function fetchWithTimeout(input: string, init: RequestInit | undefined, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => window.clearTimeout(t));
}

export default function Home() {
  const [data, setData] = useState<RatesData | null>(null);
  /** fetching: جلب (نفس شاشة المقدمة مع الشعار) | intro: خروج المقدمة | main */
  const [phase, setPhase] = useState<'fetching' | 'intro' | 'main'>('fetching');
  const [introExiting, setIntroExiting] = useState(false);
  const initialFetchCompleted = useRef(false);
  /** شاشة المقدمة: قيمة ابتدائية حتى يظهر الشعار الافتراضي فوراً (مهم للوصول عبر IP/شبكة بطيئة) */
  const [bootIdentity, setBootIdentity] = useState<{
    logoUrl: string | null;
    logoSizes: LogoSizes;
  }>({ logoUrl: null, logoSizes: { ...DEFAULT_LOGO_SIZES } });
  const [isNewLira, setIsNewLira] = useState(false);
  const [activeTab, setActiveTab] = useState('currencies');
  const { toast } = useToast();
  const t = useTranslations();
  const locale = useLocale();

  const fetchData = useCallback(async () => {
    const bootFrom = (s: SiteSettings) => {
      setBootIdentity({
        logoUrl: s.logoUrl ?? null,
        logoSizes: parseLogoSizes(s.logoSizes),
      });
    };

    const reqTimeoutMs = 25000;
    async function safeFetchJson(url: string): Promise<unknown> {
      try {
        const res = await fetchWithTimeout(url, { cache: 'no-store' }, reqTimeoutMs);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    }

    try {
      /** جلب متوازٍ — أي فشل لا يمنع الباقي؛ يقلّل التعليق على الشبكة */
      const [settingsRaw, ratesRaw, forexRaw, cryptoRaw] = await Promise.all([
        safeFetchJson('/api/settings'),
        safeFetchJson('/api/rates'),
        safeFetchJson('/api/forex'),
        safeFetchJson('/api/crypto'),
      ]);

      const settingsJson = settingsRaw as { success?: boolean; settings?: SiteSettings } | null;
      const ratesJson = ratesRaw as { success?: boolean; data?: RatesData } | null;
      const forexJson = forexRaw as { success?: boolean; data?: ForexRateData[] } | null;
      const cryptoJson = cryptoRaw as { success?: boolean; data?: CryptoRateData[] } | null;

      if (settingsJson?.success && settingsJson.settings) {
        bootFrom(settingsJson.settings);
      }

      if (!settingsJson?.success && ratesJson?.success && ratesJson.data?.siteSettings) {
        bootFrom(ratesJson.data.siteSettings as SiteSettings);
      }

      if (ratesJson?.success && ratesJson.data) {
        setData({
          ...ratesJson.data,
          forexRates: forexJson?.success && Array.isArray(forexJson.data) ? forexJson.data : [],
          cryptoRates: cryptoJson?.success && Array.isArray(cryptoJson.data) ? cryptoJson.data : [],
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!initialFetchCompleted.current) {
        initialFetchCompleted.current = true;
        setPhase('intro');
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /** إن علّق الجلب (شبكة/خادم)، لا نبقى على شاشة التحميل إلى ما لا نهاية */
  useEffect(() => {
    if (phase !== 'fetching') return;
    const maxWaitMs = 10000;
    const t = window.setTimeout(() => {
      setPhase((p) => {
        if (p !== 'fetching') return p;
        initialFetchCompleted.current = true;
        return 'intro';
      });
    }, maxWaitMs);
    return () => window.clearTimeout(t);
  }, [phase]);

  /** مقدمة intro: بعد اكتمال الجلب — خروج خفيف + تلاشي الطبقة (نفس أسلوب الخروج السابق) */
  useEffect(() => {
    if (phase !== 'intro') return;
    setIntroExiting(false);
    let cancelled = false;
    const exitT = window.setTimeout(() => {
      if (!cancelled) setIntroExiting(true);
    }, 720);
    const doneT = window.setTimeout(() => {
      if (!cancelled) setPhase('main');
    }, 1480);
    return () => {
      cancelled = true;
      window.clearTimeout(exitT);
      window.clearTimeout(doneT);
    };
  }, [phase]);

  // Apply visual identity colors
  useEffect(() => {
    if (data?.siteSettings) {
      const settings = data.siteSettings;
      const root = document.documentElement;
      const isDark = root.classList.contains('dark');

      if (isDark) {
        root.style.setProperty('--primary', settings.darkPrimaryColor);
        root.style.setProperty('--accent', settings.darkAccentColor);
      } else {
        root.style.setProperty('--primary', settings.lightPrimaryColor);
        root.style.setProperty('--accent', settings.lightAccentColor);
      }
    }
  }, [data?.siteSettings]);

  const getSiteName = () => {
    if (!data?.siteSettings) return t('site.title');
    return locale === 'ar' ? data.siteSettings.siteNameAr : data.siteSettings.siteNameEn;
  };

  const getHeroSubtitle = () => {
    if (!data?.siteSettings) return locale === 'ar' ? 'أسعار الصرف الحية' : 'Live Exchange Rates';
    return locale === 'ar' ? data.siteSettings.heroSubtitleAr : data.siteSettings.heroSubtitleEn;
  };

  const getLogoUrl = () => {
    return resolveLogoUrlForClient(data?.siteSettings?.logoUrl);
  };

  const getLogoSizes = (): LogoSizes => parseLogoSizes(data?.siteSettings?.logoSizes);

  /**
   * أرقام الليرة القديمة بالمخزن؛ عند تفعيل الليرة الجديدة تُقسم على 100 بدون تقريب مسبق،
   * وتُعرض بفاصلة عشرية (minimum رقمين عشريين). القيم بالدولار: noNewLira.
   */
  const formatNumber = (
    num: number,
    decimals?: number,
    opts?: { noNewLira?: boolean }
  ) => {
    const applyNewLira = isNewLira && !opts?.noNewLira;
    const displayNum = applyNewLira ? num / 100 : num;
    const localeStr =
      locale === 'ar' ? 'ar-SY' : locale === 'de' ? 'de-DE' : locale === 'sv' ? 'sv-SE' : locale === 'fr' ? 'fr-FR' : 'en-US';

    if (applyNewLira) {
      const minFrac = decimals !== undefined ? Math.max(2, decimals) : 2;
      const maxFrac = decimals !== undefined ? Math.max(minFrac, decimals + 6) : 14;
      return new Intl.NumberFormat(localeStr, {
        ...numberingLatn,
        minimumFractionDigits: minFrac,
        maximumFractionDigits: maxFrac,
      }).format(displayNum);
    }

    const d = decimals ?? 0;
    return new Intl.NumberFormat(localeStr, {
      ...numberingLatn,
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(displayNum);
  };

  /** أسعار بالدولار (ذهب، عملات رقمية USD، إلخ) — لا تُقسم على 100 */
  const formatUsd = (num: number, decimals: number) => formatNumber(num, decimals, { noNewLira: true });

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const localeStr = locale === 'ar' ? 'ar-SY' : locale === 'de' ? 'de-DE' : locale === 'sv' ? 'sv-SE' : locale === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(localeStr, {
      ...numberingLatn,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(date);
  };

  /** تاريخ ووقت كامل لصورة/نص المشاركة */
  const formatLastUpdateForShare = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const localeStr = locale === 'ar' ? 'ar-SY' : locale === 'de' ? 'de-DE' : locale === 'sv' ? 'sv-SE' : locale === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(localeStr, {
      ...numberingLatn,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getCurrencyName = (currency: CurrencyRate) => {
    if (locale === 'ar') return currency.nameAr;
    return currency.nameEn || currency.nameAr;
  };

  const getFuelName = (fuel: FuelPriceData) => {
    if (locale === 'ar') return fuel.nameAr;
    return fuel.nameEn || fuel.nameAr;
  };

  const getFuelUnit = (fuel: FuelPriceData) => {
    if (locale === 'ar') return fuel.unitAr;
    return fuel.unitEn || fuel.unitAr;
  };

  const getCurrencySymbol = () => {
    return isNewLira ? (locale === 'ar' ? 'ل.ج' : 'NSP') : (locale === 'ar' ? 'ل.س' : 'SYP');
  };

  const isRtl = locale === 'ar';

  const getFeaturedCurrency = (code: string) => {
    return data?.rates.find(r => r.code === code);
  };

  const getMiniGridRates = () => {
    const order = ['EUR', 'TRY', 'SAR', 'EGP'] as const;
    return order.map((code) => data?.rates.find((r) => r.code === code)).filter(Boolean) as CurrencyRate[];
  };

  const getFlagUrl = (code: string) => {
    return flagUrls[code] || null;
  };

  const scrollToRates = (tab?: string) => {
    if (tab) setActiveTab(tab);
    document.getElementById('rates-panel')?.scrollIntoView({ behavior: 'smooth' });
  };

  const usd = getFeaturedCurrency('USD');
  const miniRates = getMiniGridRates();

  const tickerMarqueeSec = Math.min(
    180,
    Math.max(8, data?.siteSettings?.tickerMarqueeDurationSec ?? 42)
  );

  const shareBase = data
    ? {
        logoUrl: getLogoUrl(),
        siteName: getSiteName(),
        locale,
        promoLine: t('currency.sharePromo'),
        shareLabel: t('currency.shareRate'),
        successShared: t('currency.shareSuccess'),
        successDownload: t('currency.shareDownloaded'),
        errorMessage: t('currency.shareError'),
        lastUpdateLine:
          data.lastUpdate != null
            ? `${t('header.lastUpdate')}: ${formatLastUpdateForShare(data.lastUpdate)}`
            : undefined,
      }
    : null;

  /** شريط نشرة واحد داخل الهيدر: نصفان متطابقان للحلقة اللامتناهية */
  const tickerRepeats = 2;
  const renderTickerStrip = (stripKey: string) =>
    Array.from({ length: tickerRepeats }, (_, rep) => (
      <div
        key={`${stripKey}-rep-${rep}`}
        className="flex shrink-0 items-center divide-x divide-border/70 dark:divide-white/10"
      >
        {(data?.rates || []).map((currency) => {
          const label = locale === 'ar' ? currency.nameAr : currency.nameEn || currency.nameAr;
          return (
            <span
              key={`${stripKey}-${rep}-${currency.code}`}
              className="inline-flex max-w-[min(100vw,22rem)] shrink-0 items-center gap-2 px-4 py-1.5 sm:max-w-none"
              title={`${currency.code} — ${label}`}
            >
              {getFlagUrl(currency.code) ? (
                <img
                  src={getFlagUrl(currency.code)!}
                  alt=""
                  className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/20"
                  width={24}
                  height={16}
                />
              ) : (
                <span className="shrink-0 text-base leading-none">{currency.flagEmoji || '💱'}</span>
              )}
              <span className="min-w-0 truncate text-xs font-semibold text-foreground dark:text-white sm:text-sm">{label}</span>
              {currency.symbol ? (
                <span className="shrink-0 text-xs text-amber-800 dark:text-amber-200/90">{currency.symbol}</span>
              ) : null}
              <span className="shrink-0 text-sm font-bold tabular-nums text-foreground dark:text-white">{formatNumber(currency.buyRate)}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground dark:text-white/45">{getCurrencySymbol()}</span>
            </span>
          );
        })}
        {data?.goldPrice && (
          <span
            key={`${stripKey}-${rep}-gold`}
            className="inline-flex shrink-0 items-center gap-2 bg-amber-500/25 px-4 py-1.5 dark:bg-amber-500/15"
            title={locale === 'ar' ? 'الذهب — أونصة وغرام بالدولار' : 'Gold — USD oz & gram'}
          >
            <span className="text-base leading-none" aria-hidden>
              🥇
            </span>
            <span className="text-xs font-semibold text-amber-950 dark:text-amber-100">{locale === 'ar' ? 'الذهب' : 'Gold'}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/70">XAU</span>
            <span className="text-sm font-bold tabular-nums text-amber-950 dark:text-amber-50">
              {locale === 'ar' ? 'أونصة' : 'Oz'} {formatUsd(data.goldPrice.priceUsd, 2)}$
            </span>
            <span className="text-amber-800/50 dark:text-amber-200/40">·</span>
            <span className="text-sm font-bold tabular-nums text-amber-950 dark:text-amber-50/95">
              {locale === 'ar' ? 'غرام' : 'g'} {formatUsd(data.goldPrice.pricePerGram, 2)}$
            </span>
          </span>
        )}
      </div>
    ));

  const hasTickerContent = (data?.rates?.length ?? 0) > 0 || !!data?.goldPrice;

  const introLh =
    bootIdentity?.logoSizes.loading ??
    parseLogoSizes(data?.siteSettings?.logoSizes).loading ??
    DEFAULT_LOGO_SIZES.loading;
  const introLogoSrc = resolveLogoUrlForClient(bootIdentity.logoUrl);

  return (
    <>
      {(phase === 'fetching' || phase === 'intro') && (
        <div
          className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background text-foreground transition-[opacity] duration-700 ease-out dark:bg-[#0f172a] dark:text-white ${
            phase === 'intro' && introExiting ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          aria-busy={phase === 'fetching'}
        >
          <div
            className={`flex flex-col items-center gap-4 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              phase === 'intro' && introExiting ? 'scale-[1.12] opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            <div
              className="flex items-center justify-center rounded-2xl border border-border/80 bg-muted/50 p-2 shadow-lg shadow-primary/5 ring-1 ring-primary/10 dark:border-white/20 dark:bg-white/10 dark:shadow-black/20 dark:ring-white/10"
              style={{ minHeight: introLh + 16, minWidth: introLh + 16 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element — شاشة المقدمة؛ مسار افتراضي logo.svg */}
              <img
                src={introLogoSrc}
                alt=""
                width={240}
                height={80}
                decoding="async"
                fetchPriority="high"
                className="block rounded-lg object-contain"
                style={{ height: introLh, width: 'auto', maxWidth: 200 }}
              />
            </div>
            <p className="text-sm text-muted-foreground dark:text-white/70">{t('site.description')}</p>
          </div>
        </div>
      )}

      {phase === 'main' && data && (
    <div
      className="home-surface relative min-h-screen flex flex-col bg-background text-foreground animate-in fade-in-0 zoom-in-95 duration-700 ease-out dark:bg-[#0f172a] dark:text-slate-100"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* شعار شفاف كخلفية — fixed في الشاشة؛ يعتمد على logoUrl من الإعدادات */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[40%] z-0 h-[min(72vh,480px)] w-[min(88vw,480px)] -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat opacity-[0.045] saturate-150 dark:opacity-[0.07] dark:saturate-100"
        style={{ backgroundImage: `url(${getLogoUrl()})` }}
      />
      <header className="spt-header sticky top-0 z-50 overflow-hidden border-b border-border/70 bg-background/85 text-foreground shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0f1a]/92 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)] dark:text-white">
        {hasTickerContent && (
          <div
            className="ticker-bar border-b border-transparent"
            dir="ltr"
            aria-label={locale === 'ar' ? 'أسعار متداولة' : 'Live rates ticker'}
          >
            <div className="pointer-events-none select-none py-1">
              <div
                className="ticker-marquee-track"
                style={
                  {
                    '--ticker-marquee-duration': `${tickerMarqueeSec}s`,
                  } as CSSProperties
                }
              >
                <div className="flex shrink-0 flex-nowrap items-stretch">{renderTickerStrip('a')}</div>
                <div className="flex shrink-0 flex-nowrap items-stretch" aria-hidden="true">
                  {renderTickerStrip('b')}
                </div>
              </div>
            </div>
          </div>
        )}
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8" aria-label="Main">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src={getLogoUrl()}
              alt=""
              width={240}
              height={80}
              style={{ height: getLogoSizes().header, width: 'auto', maxHeight: getLogoSizes().header }}
              className="w-auto shrink-0 rounded-md object-contain"
              unoptimized
            />
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => scrollToRates('currencies')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-[0.98] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {locale === 'ar' ? 'أسعار الصرف' : 'Exchange Rates'}
            </button>
            <button
              type="button"
              onClick={() => scrollToRates('gold')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-[0.98] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {locale === 'ar' ? 'الذهب' : 'Gold'}
            </button>
            <button
              type="button"
              onClick={() => scrollToRates('fuel')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-[0.98] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {locale === 'ar' ? 'المحروقات' : 'Fuel'}
            </button>
            <button
              type="button"
              onClick={() => scrollToRates('forex')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-[0.98] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}
            </button>
            <button
              type="button"
              onClick={() => scrollToRates('crypto')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-[0.98] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {data?.lastUpdate && (
              <div className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-3 py-1.5 text-xs text-foreground/90 md:flex dark:border-white/20 dark:bg-white/10 dark:text-white/90">
                <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                <span>{formatTime(data.lastUpdate)}</span>
              </div>
            )}
            <div className="flex min-w-0 max-w-[14rem] items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2 py-1 sm:max-w-none sm:gap-2 sm:px-3 dark:border-white/20 dark:bg-white/10">
              <Sparkles
                className={`h-4 w-4 shrink-0 ${isNewLira ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground dark:text-white/50'}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-tight text-foreground/90 sm:flex-none sm:text-xs dark:text-white/85">
                {t('newLira.title')}
              </span>
              <button
                type="button"
                onClick={() => setIsNewLira(!isNewLira)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isNewLira ? 'bg-amber-500' : 'bg-muted dark:bg-white/25'}`}
                aria-pressed={isNewLira}
                aria-label={t('newLira.title')}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ease-out ${
                    isNewLira ? 'end-0.5 start-auto' : 'start-0.5 end-auto'
                  }`}
                />
              </button>
            </div>
            <LanguageSwitcher triggerClassName="text-foreground hover:bg-muted hover:text-foreground dark:text-white dark:hover:bg-white/10 dark:hover:text-white" />
            <ThemeToggle className="text-foreground hover:bg-muted dark:text-white dark:hover:bg-white/10" />
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex-1 text-foreground dark:text-slate-100">
        <section className="section-bg-hero relative scroll-mt-20 overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-slate-100/90 pb-10 pt-8 text-slate-900 sm:pt-10 lg:pb-14 dark:from-[#1e3a5f] dark:via-[#1a3052] dark:to-[#0f172a] dark:text-white">
          <div
            className="pointer-events-none absolute -right-24 -top-36 z-[1] h-80 w-80 rounded-full bg-gradient-to-br from-sky-300/45 to-blue-400/25 blur-3xl dark:from-blue-500/20 dark:to-indigo-600/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-24 z-[1] h-72 w-72 rounded-full bg-gradient-to-tr from-slate-200/90 to-sky-100/50 blur-3xl dark:from-slate-800/50 dark:to-blue-950/40"
            aria-hidden
          />
          <div className="relative z-[2] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  {getFlagUrl('USD') ? (
                    <img
                      src={getFlagUrl('USD')!}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded-md object-cover shadow-md ring-2 ring-white/80 dark:ring-white/10"
                    />
                  ) : null}
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white/95">
                      {locale === 'ar' ? 'سعر الدولار الأمريكي' : 'US Dollar Rate'}
                    </h1>
                    <p className="text-sm text-muted-foreground dark:text-white/60">{locale === 'ar' ? 'عام' : 'General'}</p>
                  </div>
                </div>
                <p className="mb-5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-white/80">{getHeroSubtitle()}</p>
                <div className="mt-2">
                  <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                    <span className="bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl lg:text-5xl dark:from-white dark:to-slate-200">
                      {usd ? formatNumber(usd.buyRate) : '---'}
                    </span>
                    <span className="text-slate-300 dark:text-white/40">-</span>
                    <span className="bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl lg:text-5xl dark:from-white dark:to-slate-200">
                      {usd ? formatNumber(usd.sellRate) : '---'}
                    </span>
                    <span className="text-lg text-muted-foreground sm:text-xl dark:text-white/60">{getCurrencySymbol()}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground sm:text-sm dark:text-white/50">
                    {t('currency.buyRate')} — {t('currency.sellRate')}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 dark:bg-emerald-500/15">
                    <RateDeltaBadge pct={usd ? rateDeltaAvg(usd.changeBuyPct, usd.changeSellPct) : null} className="text-sm" />
                  </span>
                  {shareBase && usd && (
                    <PriceShareButton
                      {...shareBase}
                      headline={locale === 'ar' ? 'سعر الدولار الأمريكي' : 'US Dollar Rate'}
                      subheadline="USD"
                      rows={[
                        {
                          label: t('currency.buyRate'),
                          value: formatNumber(usd.buyRate),
                          tone: 'buy',
                        },
                        {
                          label: t('currency.sellRate'),
                          value: formatNumber(usd.sellRate),
                          tone: 'sell',
                        },
                      ]}
                      fileNameSlug="usd-hero"
                      detailLine={`USD: ${t('currency.buyRate')} ${formatNumber(usd.buyRate)} — ${t('currency.sellRate')} ${formatNumber(usd.sellRate)}`}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {miniRates.map((c) => (
                  <div
                    key={c.code}
                    className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-lg hover:shadow-sky-900/10 dark:border-white/10 dark:bg-white/10 dark:ring-white/5 dark:hover:bg-white/15"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getFlagUrl(c.code) ? (
                          <img
                            src={getFlagUrl(c.code)!}
                            alt=""
                            className="h-6 w-8 shrink-0 rounded-sm object-cover"
                          />
                        ) : (
                          <span className="text-lg">{c.flagEmoji}</span>
                        )}
                        <span className="font-medium">{c.code}</span>
                      </div>
                      {shareBase && (
                        <PriceShareButton
                          {...shareBase}
                          size="icon"
                          className="h-7 w-7 shrink-0 border-white/60 bg-white/50 dark:border-white/20 dark:bg-white/10"
                          headline={getCurrencyName(c)}
                          subheadline={c.code}
                          rows={[
                            {
                              label: t('currency.buyRate'),
                              value: formatNumber(c.buyRate),
                              tone: 'buy',
                            },
                            {
                              label: t('currency.sellRate'),
                              value: formatNumber(c.sellRate),
                              tone: 'sell',
                            },
                          ]}
                          fileNameSlug={`mini-${c.code}`}
                          detailLine={`${getCurrencyName(c)} (${c.code}): ${t('currency.buyRate')} ${formatNumber(c.buyRate)} — ${t('currency.sellRate')} ${formatNumber(c.sellRate)}`}
                        />
                      )}
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatNumber(c.buyRate)}</div>
                    <RateDeltaBadge pct={c.changeBuyPct} className="mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
            {data?.goldPrice && (
              <div className="mt-8 rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50/95 to-orange-50/50 p-5 shadow-md shadow-amber-900/5 ring-1 ring-amber-200/50 backdrop-blur-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:from-transparent dark:to-transparent dark:ring-amber-500/20">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden>
                      🥇
                    </span>
                    <div>
                      <p className="font-semibold">{locale === 'ar' ? 'الذهب (أونصة)' : 'Gold (oz)'}</p>
                      <p className="text-sm text-muted-foreground dark:text-white/60">USD / {getCurrencySymbol()}</p>
                    </div>
                    {shareBase && usd && (
                      <PriceShareButton
                        {...shareBase}
                        size="icon"
                        className="h-8 w-8 border-amber-200/80 bg-white/60 dark:border-amber-500/30 dark:bg-black/20"
                        headline={locale === 'ar' ? 'الذهب — معاينة سريعة' : 'Gold — quick view'}
                        subheadline="XAU / USD / SYP"
                        rows={[
                          {
                            label: locale === 'ar' ? 'أونصة (USD)' : 'Ounce (USD)',
                            value: `$${formatUsd(data.goldPrice.priceUsd, 2)}`,
                            tone: 'neutral',
                          },
                          {
                            label: `${locale === 'ar' ? 'أونصة' : 'Ounce'} (${getCurrencySymbol()})`,
                            value: formatNumber(data.goldPrice.priceUsd * usd.buyRate),
                            tone: 'neutral',
                          },
                        ]}
                        fileNameSlug="gold-hero"
                        detailLine={`${locale === 'ar' ? 'الذهب' : 'Gold'}: USD/oz $${formatUsd(data.goldPrice.priceUsd, 2)} · ${getCurrencySymbol()} ${formatNumber(data.goldPrice.priceUsd * usd.buyRate)}`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-6 sm:text-end">
                    <div>
                      <p className="text-xs text-amber-800/90 dark:text-amber-200/80">USD</p>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <p className="text-xl font-bold tabular-nums text-amber-950 dark:text-inherit">
                          ${formatUsd(data.goldPrice.priceUsd, 2)}
                        </p>
                        <RateDeltaBadge pct={data.goldPrice.changeOuncePct} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-amber-800/90 dark:text-amber-200/80">{getCurrencySymbol()}</p>
                      <p className="text-xl font-bold tabular-nums text-amber-950 dark:text-inherit">
                        {usd ? formatNumber(data.goldPrice.priceUsd * usd.buyRate) : '---'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          id="rates-panel"
          className="section-bg-rates relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-[1] w-full">
            <TabsList className="no-scrollbar mb-8 flex h-auto w-full snap-x snap-mandatory flex-nowrap justify-start gap-1 overflow-x-auto overscroll-x-contain scroll-smooth rounded-2xl border border-border/90 bg-muted/80 p-1.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:grid md:grid-cols-5 md:overflow-x-visible md:overscroll-auto md:snap-none">
              <TabsTrigger
                value="currencies"
                className="min-w-[min(88vw,11.5rem)] shrink-0 snap-center rounded-xl px-2 py-2.5 text-xs text-muted-foreground transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:min-w-[9.5rem] md:min-w-0 md:px-3 md:text-sm dark:text-slate-300 dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
              >
                <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <Coins className="hidden h-4 w-4 sm:inline" />
                  {locale === 'ar' ? 'العملات' : 'Currencies'}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="gold"
                className="min-w-[min(88vw,11.5rem)] shrink-0 snap-center rounded-xl px-2 py-2.5 text-xs text-muted-foreground transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:min-w-[9.5rem] md:min-w-0 md:px-3 md:text-sm dark:text-slate-300 dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
              >
                <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <span className="text-lg leading-none sm:text-base">🥇</span>
                  {locale === 'ar' ? 'الذهب' : 'Gold'}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="fuel"
                className="min-w-[min(88vw,11.5rem)] shrink-0 snap-center rounded-xl px-2 py-2.5 text-xs text-muted-foreground transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:min-w-[9.5rem] md:min-w-0 md:px-3 md:text-sm dark:text-slate-300 dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
              >
                <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <Fuel className="hidden h-4 w-4 sm:inline" />
                  {locale === 'ar' ? 'المحروقات' : 'Fuel'}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="forex"
                className="min-w-[min(88vw,11.5rem)] shrink-0 snap-center rounded-xl px-2 py-2.5 text-xs text-muted-foreground transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:min-w-[9.5rem] md:min-w-0 md:px-3 md:text-sm dark:text-slate-300 dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
              >
                <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <DollarSign className="hidden h-4 w-4 sm:inline" />
                  {locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="crypto"
                className="min-w-[min(88vw,11.5rem)] shrink-0 snap-center rounded-xl px-2 py-2.5 text-xs text-muted-foreground transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:min-w-[9.5rem] md:min-w-0 md:px-3 md:text-sm dark:text-slate-300 dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
              >
                <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <span className="text-lg leading-none sm:text-base">₿</span>
                  {locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Currencies Tab */}
            <TabsContent value="currencies" className="space-y-4">
              <div className="surface-card overflow-hidden p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border dark:border-slate-600/80">
                        <th className="text-start p-4 font-semibold text-muted-foreground">
                          {locale === 'ar' ? 'العملة' : 'Currency'}
                        </th>
                        <th className="text-center p-4 font-semibold text-green-500">
                          <div className="flex items-center justify-center gap-1">
                            <TrendingDown className="w-4 h-4" />
                            {t('currency.buyRate')}
                          </div>
                        </th>
                        <th className="text-center p-4 font-semibold text-red-500">
                          <div className="flex items-center justify-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            {t('currency.sellRate')}
                          </div>
                        </th>
                        <th className="hidden p-3 text-center text-xs font-semibold text-muted-foreground sm:table-cell sm:p-4 sm:text-sm">
                          {t('rateDelta.sinceLast')}
                        </th>
                        <th className="text-end p-4 font-semibold text-muted-foreground hidden sm:table-cell">
                          {locale === 'ar' ? 'الرمز' : 'Code'}
                        </th>
                        <th className="w-[1%] whitespace-nowrap p-4 text-center font-semibold text-muted-foreground">
                          {t('currency.shareRate')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.rates ?? []).map((currency, index) => (
                        <tr 
                          key={currency.id} 
                          className="animate-fade-in-up border-b border-border/80 transition-colors hover:bg-muted/70 dark:border-slate-700/60 dark:hover:bg-slate-700/40"
                          style={{ animationDelay: `${index * 0.03}s` }}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-7 flex-shrink-0 overflow-hidden rounded-md shadow-md ring-1 ring-black/10 dark:ring-white/10">
                                {getFlagUrl(currency.code) ? (
                                  <img 
                                    src={getFlagUrl(currency.code)!} 
                                    alt={currency.code}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center text-lg">
                                    {currency.flagEmoji || '💱'}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold">{getCurrencyName(currency)}</p>
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 sm:hidden">
                                  <RateDeltaBadge pct={currency.changeBuyPct} subLabel={t('rateDelta.buyShort')} />
                                  <RateDeltaBadge pct={currency.changeSellPct} subLabel={t('rateDelta.sellShort')} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-lg font-bold text-green-500">
                              {formatNumber(currency.buyRate)}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-lg font-bold text-red-500">
                              {formatNumber(currency.sellRate)}
                            </span>
                          </td>
                          <td className="hidden p-3 align-middle sm:table-cell sm:p-4">
                            <div className="flex flex-col items-center gap-1">
                              <RateDeltaBadge pct={currency.changeBuyPct} subLabel={t('rateDelta.buyShort')} />
                              <RateDeltaBadge pct={currency.changeSellPct} subLabel={t('rateDelta.sellShort')} />
                            </div>
                          </td>
                          <td className="p-4 text-end hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground font-mono">{currency.code}</span>
                          </td>
                          <td className="p-2 text-center align-middle">
                            {shareBase && (
                              <PriceShareButton
                                {...shareBase}
                                headline={getCurrencyName(currency)}
                                subheadline={`${currency.code} · ${currency.symbol?.trim() || currency.code}`}
                                rows={[
                                  {
                                    label: t('currency.buyRate'),
                                    value: formatNumber(currency.buyRate),
                                    tone: 'buy',
                                  },
                                  {
                                    label: t('currency.sellRate'),
                                    value: formatNumber(currency.sellRate),
                                    tone: 'sell',
                                  },
                                ]}
                                fileNameSlug={`rate-${currency.code}`}
                                detailLine={`${getCurrencyName(currency)} (${currency.code}): ${t('currency.buyRate')} ${formatNumber(currency.buyRate)} — ${t('currency.sellRate')} ${formatNumber(currency.sellRate)}`}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Gold Tab */}
            <TabsContent value="gold" className="space-y-4">
              {data?.goldPrice && (
                <div className="surface-card p-6">
                  <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                    🥇 {locale === 'ar' ? 'أسعار الذهب' : 'Gold Prices'}
                  </CardTitle>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[
                      {
                        label: locale === 'ar' ? 'أونصة بالدولار' : 'Ounce in USD',
                        value: `$${formatUsd(data.goldPrice.priceUsd, 2)}`,
                        color: 'amber',
                        deltaPct: data.goldPrice.changeOuncePct,
                      },
                      {
                        label: locale === 'ar' ? 'أونصة بالليرة' : 'Ounce in SYP',
                        value: getFeaturedCurrency('USD') ? formatNumber(data.goldPrice.priceUsd * getFeaturedCurrency('USD')!.buyRate) : '---',
                        suffix: getCurrencySymbol(),
                        color: 'green',
                        deltaPct: data.goldPrice.changeOuncePct,
                      },
                      {
                        label: locale === 'ar' ? 'ليرة ذهبية بالدولار' : 'Gold Lira in USD',
                        value: `$${formatUsd(data.goldPrice.pricePerGram * 8.5, 2)}`,
                        color: 'amber',
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                      {
                        label: locale === 'ar' ? 'ليرة ذهبية بالليرة' : 'Gold Lira in SYP',
                        value: getFeaturedCurrency('USD') ? formatNumber(data.goldPrice.pricePerGram * 8.5 * getFeaturedCurrency('USD')!.buyRate) : '---',
                        suffix: getCurrencySymbol(),
                        color: 'green',
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                      {
                        label: locale === 'ar' ? 'غرام بالدولار' : 'Gram in USD',
                        value: `$${formatUsd(data.goldPrice.pricePerGram, 2)}`,
                        color: 'amber',
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                      {
                        label: locale === 'ar' ? 'غرام بالليرة' : 'Gram in SYP',
                        value: getFeaturedCurrency('USD') ? formatNumber(data.goldPrice.pricePerGram * getFeaturedCurrency('USD')!.buyRate) : '---',
                        suffix: getCurrencySymbol(),
                        color: 'green',
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                    ].map((item, i) => {
                      const displayVal = item.suffix ? `${item.value} ${item.suffix}` : String(item.value);
                      return (
                        <div
                          key={i}
                          className={`relative rounded-lg border p-4 pt-11 text-center ${item.color === 'amber' ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}
                        >
                          {shareBase && (
                            <div className="absolute end-2 top-2">
                              <PriceShareButton
                                {...shareBase}
                                size="icon"
                                className="h-7 w-7"
                                headline={locale === 'ar' ? 'أسعار الذهب' : 'Gold Prices'}
                                subheadline={item.label}
                                rows={[
                                  {
                                    label: locale === 'ar' ? 'القيمة' : 'Value',
                                    value: displayVal,
                                    tone: 'neutral',
                                  },
                                ]}
                                fileNameSlug={`gold-${i}`}
                                detailLine={`${item.label}: ${displayVal}`}
                              />
                            </div>
                          )}
                          <p className="mb-2 text-sm text-muted-foreground">{item.label}</p>
                          <p
                            className={`text-2xl font-bold ${item.color === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                          >
                            {item.value}
                          </p>
                          {item.suffix && <p className="text-xs text-muted-foreground mt-1">{item.suffix}</p>}
                          <div className="mt-2 flex justify-center">
                            <RateDeltaBadge pct={item.deltaPct} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Fuel Tab */}
            <TabsContent value="fuel" className="space-y-4">
              <div className="surface-card p-6">
                <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                  <Fuel className="h-5 w-5" />
                  {locale === 'ar' ? 'أسعار المحروقات' : 'Fuel Prices'}
                </CardTitle>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data?.fuelPrices.map((fuel) => (
                    <div
                      key={fuel.id}
                      className="relative flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 pt-11 dark:border-slate-700 dark:bg-slate-800/40 pe-3 pb-4 ps-4"
                    >
                      {shareBase && (
                        <div className="absolute end-2 top-2">
                          <PriceShareButton
                            {...shareBase}
                            size="icon"
                            className="h-7 w-7"
                            headline={locale === 'ar' ? 'أسعار المحروقات' : 'Fuel Prices'}
                            subheadline={getFuelName(fuel)}
                            rows={[
                              {
                                label: getFuelUnit(fuel),
                                value: `${formatNumber(fuel.price)} ${getCurrencySymbol()}`,
                                tone: 'neutral',
                              },
                            ]}
                            fileNameSlug={`fuel-${fuel.code}`}
                            detailLine={`${getFuelName(fuel)}: ${formatNumber(fuel.price)} ${getCurrencySymbol()}`}
                          />
                        </div>
                      )}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-3xl">
                          ⛽
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold">{getFuelName(fuel)}</h3>
                          <p className="text-xs text-muted-foreground">{getFuelUnit(fuel)}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-2xl font-bold text-primary dark:text-blue-400">{formatNumber(fuel.price)}</p>
                        <p className="text-xs text-muted-foreground">{getCurrencySymbol()}</p>
                        <div className="mt-1 flex justify-end">
                          <RateDeltaBadge pct={fuel.changePct} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Forex Tab */}
            <TabsContent value="forex" className="space-y-4">
              <div className="surface-card p-6">
                <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                  <Globe className="h-5 w-5" />
                  {locale === 'ar' ? 'البورصات العالمية' : 'Global market rates'}
                </CardTitle>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {data?.forexRates?.map((pair) => (
                    <div
                      key={pair.pair}
                      className="relative rounded-lg border border-border bg-muted/40 pt-11 dark:border-slate-700 dark:bg-slate-800/40 pe-4 pb-4 ps-4"
                    >
                      {shareBase && (
                        <div className="absolute end-2 top-2">
                          <PriceShareButton
                            {...shareBase}
                            size="icon"
                            className="h-7 w-7"
                            headline={locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}
                            subheadline={pair.pair}
                            rows={[
                              { label: locale === 'ar' ? 'السعر' : 'Rate', value: String(pair.rate), tone: 'neutral' },
                              ...(getFeaturedCurrency('USD')
                                ? [
                                    {
                                      label: `≈ ${getCurrencySymbol()}`,
                                      value: formatNumber(pair.rate * getFeaturedCurrency('USD')!.buyRate),
                                      tone: 'neutral' as const,
                                    },
                                  ]
                                : []),
                            ]}
                            fileNameSlug={`fx-${pair.pair.replace(/[\/\\]/g, '-')}`}
                            detailLine={
                              getFeaturedCurrency('USD')
                                ? `${pair.pair}: ${pair.rate} · ≈ ${formatNumber(pair.rate * getFeaturedCurrency('USD')!.buyRate)} ${getCurrencySymbol()}`
                                : `${pair.pair}: ${pair.rate}`
                            }
                          />
                        </div>
                      )}
                      <div className="mb-2 flex items-center gap-2">
                        <div className="-space-x-1 flex items-center">
                          <img
                            src={`https://flagcdn.com/w40/${pair.flag1}.png`}
                            alt={pair.flag1}
                            className="h-3.5 w-5 rounded-sm border border-background object-cover shadow-sm"
                          />
                          <img
                            src={`https://flagcdn.com/w40/${pair.flag2}.png`}
                            alt={pair.flag2}
                            className="h-3.5 w-5 rounded-sm border border-background object-cover shadow-sm"
                          />
                        </div>
                        <span className="font-bold">{pair.pair}</span>
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs ${pair.change >= 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
                        >
                          {pair.change >= 0 ? (
                            <TrendingUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <TrendingDown className="h-3 w-3" aria-hidden />
                          )}
                          {pair.change >= 0 ? '+' : ''}
                          {Number.isFinite(pair.change) ? pair.change.toFixed(2) : pair.change}%
                        </span>
                      </div>
                      <p className="text-xl font-bold text-foreground dark:text-slate-100">{pair.rate}</p>
                      {getFeaturedCurrency('USD') && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          ≈ {formatNumber(pair.rate * getFeaturedCurrency('USD')!.buyRate)} {getCurrencySymbol()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Crypto Tab */}
            <TabsContent value="crypto" className="space-y-4">
              <div className="surface-card p-6">
                <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                  <span className="text-2xl">₿</span>
                  {locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
                </CardTitle>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data?.cryptoRates?.map((crypto) => (
                    <div
                      key={crypto.code}
                      className="relative rounded-lg border border-border bg-muted/40 pt-11 dark:border-slate-700 dark:bg-slate-800/40 pe-4 pb-4 ps-4"
                    >
                      {shareBase && (
                        <div className="absolute end-2 top-2">
                          <PriceShareButton
                            {...shareBase}
                            size="icon"
                            className="h-7 w-7"
                            headline={locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrency'}
                            subheadline={`${crypto.code} · ${locale === 'ar' ? crypto.nameAr : crypto.nameEn}`}
                            rows={[
                              {
                                label: 'USD',
                                value: `$${formatUsd(crypto.price, crypto.price < 1 ? 4 : 2)}`,
                                tone: 'neutral',
                              },
                              ...(getFeaturedCurrency('USD')
                                ? [
                                    {
                                      label: `≈ ${getCurrencySymbol()}`,
                                      value: formatNumber(crypto.price * getFeaturedCurrency('USD')!.buyRate),
                                      tone: 'neutral' as const,
                                    },
                                  ]
                                : []),
                            ]}
                            fileNameSlug={`crypto-${crypto.code}`}
                            detailLine={
                              getFeaturedCurrency('USD')
                                ? `${crypto.code}: $${formatUsd(crypto.price, crypto.price < 1 ? 4 : 2)} · ≈ ${formatNumber(crypto.price * getFeaturedCurrency('USD')!.buyRate)} ${getCurrencySymbol()}`
                                : `${crypto.code}: $${formatUsd(crypto.price, crypto.price < 1 ? 4 : 2)}`
                            }
                          />
                        </div>
                      )}
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-2xl font-bold dark:border-slate-600 dark:bg-slate-800">
                            {crypto.icon || '₿'}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold">{crypto.code}</span>
                            <span className="ms-1 text-sm text-muted-foreground">
                              {locale === 'ar' ? crypto.nameAr : crypto.nameEn}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs ${crypto.change >= 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
                        >
                          {crypto.change >= 0 ? (
                            <TrendingUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <TrendingDown className="h-3 w-3" aria-hidden />
                          )}
                          {crypto.change >= 0 ? '+' : ''}
                          {Number.isFinite(crypto.change) ? crypto.change.toFixed(2) : crypto.change}%
                        </span>
                      </div>
                      <p className="text-xl font-bold text-foreground dark:text-slate-100">
                        ${formatUsd(crypto.price, crypto.price < 1 ? 4 : 2)}
                      </p>
                      {getFeaturedCurrency('USD') && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          ≈ {formatNumber(crypto.price * getFeaturedCurrency('USD')!.buyRate)} {getCurrencySymbol()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <section
          className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          aria-labelledby="seo-lira-heading"
        >
          <div className="surface-card relative z-[1] border-border/80 p-6 text-sm leading-relaxed text-muted-foreground">
            <h2 id="seo-lira-heading" className="mb-3 text-lg font-semibold text-foreground dark:text-slate-100">
              {t('seo.homeHeading')}
            </h2>
            <p>{t('seo.homeLead')}</p>
            <p className="mt-4 text-xs leading-relaxed opacity-80">{t('seo.homeKeywords')}</p>
          </div>
        </section>

        {/* Calculator Section */}
        <section className="section-bg-calculator relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="surface-card relative z-[1] p-6">
            <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
              <ArrowRightLeft className="h-5 w-5" />
              {locale === 'ar' ? 'حاسبة العملات' : 'Currency Calculator'}
            </CardTitle>
            <QuickCalculator 
              rates={data?.rates || []} 
              t={t} 
              locale={locale} 
              formatNumber={formatNumber} 
              getCurrencyName={getCurrencyName}
              isNewLira={isNewLira}
              getCurrencySymbol={getCurrencySymbol}
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="section-bg-footer relative z-10 mt-auto border-t border-border/80 bg-gradient-to-b from-muted/30 to-muted/50 py-8 text-muted-foreground dark:border-white/10 dark:from-[#0f172a] dark:to-[#0c1222] dark:text-slate-400">
        <div className="relative z-[1] mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 text-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image
              src={getLogoUrl()}
              alt=""
              width={120}
              height={40}
              style={{ height: getLogoSizes().footer, width: 'auto', maxHeight: getLogoSizes().footer }}
              className="rounded object-contain"
              unoptimized
            />
            <span className="text-foreground/80 dark:text-slate-300">{getSiteName()} © {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1" aria-label="Legal">
            <Link
              href="/privacy"
              className="text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-400 dark:hover:text-slate-200"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              href="/about"
              className="text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-400 dark:hover:text-slate-200"
            >
              {t('footer.about')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
      )}

      {phase === 'main' && !data && (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground dark:bg-[#0f172a] dark:text-white">
          <p className="text-sm text-muted-foreground dark:text-white/80">
            {locale === 'ar' ? 'تعذر تحميل البيانات. حاول تحديث الصفحة.' : 'Could not load data. Please refresh.'}
          </p>
        </div>
      )}
    </>
  );
}

function QuickCalculator({ 
  rates, 
  t, 
  locale, 
  formatNumber,
  getCurrencyName,
  isNewLira,
  getCurrencySymbol
}: { 
  rates: CurrencyRate[]; 
  t: (key: string) => string;
  locale: string;
  formatNumber: (num: number, decimals?: number, opts?: { noNewLira?: boolean }) => string;
  getCurrencyName: (currency: CurrencyRate) => string;
  isNewLira: boolean;
  getCurrencySymbol: () => string;
}) {
  const [amount, setAmount] = useState('100');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [direction, setDirection] = useState<'toSYP' | 'fromSYP'>('toSYP');

  const selectedRate = rates.find(r => r.code === selectedCurrency);
  
  /** ناتج بالليرة القديمة (toSYP) أو بالعملة الأجنبية (fromSYP) — بدون قسمة 100 هنا */
  const calculateResult = () => {
    const amt = parseFloat(amount) || 0;
    if (!selectedRate) return 0;
    if (direction === 'toSYP') {
      return amt * selectedRate.sellRate;
    }
    return amt / selectedRate.buyRate;
  };

  const formatResultDisplay = () => {
    const raw = calculateResult();
    if (direction === 'fromSYP') {
      return formatNumber(raw, 8, { noNewLira: true });
    }
    return formatNumber(raw);
  };

  const getCurrencyLabel = () => {
    if (direction === 'toSYP') {
      return getCurrencySymbol();
    }
    return selectedCurrency;
  };

  const getFlagUrl = (code: string) => {
    const flagUrls: Record<string, string> = {
      USD: 'https://flagcdn.com/w40/us.png',
      EUR: 'https://flagcdn.com/w40/eu.png',
      TRY: 'https://flagcdn.com/w40/tr.png',
      SAR: 'https://flagcdn.com/w40/sa.png',
      AED: 'https://flagcdn.com/w40/ae.png',
      GBP: 'https://flagcdn.com/w40/gb.png',
      CHF: 'https://flagcdn.com/w40/ch.png',
      CAD: 'https://flagcdn.com/w40/ca.png',
      AUD: 'https://flagcdn.com/w40/au.png',
      JOD: 'https://flagcdn.com/w40/jo.png',
      KWD: 'https://flagcdn.com/w40/kw.png',
      EGP: 'https://flagcdn.com/w40/eg.png',
      LYD: 'https://flagcdn.com/w40/ly.png',
    };
    return flagUrls[code] || null;
  };

  return (
    <div className="grid md:grid-cols-4 gap-4 items-end">
      <div>
        <Label className="text-sm font-medium">{locale === 'ar' ? 'المبلغ' : 'Amount'}</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-2 h-11 rounded-md border border-input bg-background text-foreground dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100"
        />
      </div>
      <div>
        <Label className="text-sm font-medium">{locale === 'ar' ? 'العملة' : 'Currency'}</Label>
        <select
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className="mt-2 h-11 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm text-foreground dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100"
        >
          {rates.map(r => (
            <option key={r.code} value={r.code}>
              {getCurrencyName(r)} ({r.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-sm font-medium">{locale === 'ar' ? 'العملية' : 'Operation'}</Label>
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant={direction === 'toSYP' ? 'default' : 'outline'}
            onClick={() => setDirection('toSYP')}
            className="flex-1 h-11"
          >
            {isNewLira 
              ? (locale === 'ar' ? 'إلى ل.ج' : 'To NSP')
              : t('calculator.toSyp')
            }
          </Button>
          <Button
            size="sm"
            variant={direction === 'fromSYP' ? 'default' : 'outline'}
            onClick={() => setDirection('fromSYP')}
            className="flex-1 h-11"
          >
            {isNewLira 
              ? (locale === 'ar' ? 'من ل.ج' : 'From NSP')
              : t('calculator.fromSyp')
            }
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center dark:border-blue-500/40 dark:bg-blue-500/10">
        <p className="mb-1 text-sm text-primary dark:text-blue-300">{locale === 'ar' ? 'النتيجة' : 'Result'}</p>
        <p className="text-2xl font-bold text-primary dark:text-blue-200">{formatResultDisplay()}</p>
        <p className="text-xs text-muted-foreground">
          {getCurrencyLabel()}
        </p>
      </div>
    </div>
  );
}
