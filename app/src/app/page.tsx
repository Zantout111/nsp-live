'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import { useTheme } from 'next-themes';
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
  Medal,
  Bitcoin,
  Zap,
} from 'lucide-react';
import { numberingLatn } from '@/lib/intl-latn';
import { DEFAULT_LOGO_SIZES, parseLogoSizes, type LogoSizes } from '@/lib/logo-sizes';
import {
  DEFAULT_BRAND_LOGO,
  pickLogoStorageUrl,
  resolveLogoForLocale,
  resolveLogoUrlForClient,
} from '@/lib/resolve-logo-url';
import { PriceShareButton } from '@/components/price-share-button';
import { FooterSocialLinks, footerSocialHasAny } from '@/components/footer-social-links';
import { AdvancedExchangeCalculator } from '@/components/advanced-exchange-calculator';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AdSenseSlot } from '@/components/adsense-slot';
import { applySiteBrandCssVars, type SiteBrandColors } from '@/lib/theme-from-brand';
import { heroSectionInlineStyle, type HeroSectionThemeStored } from '@/lib/hero-section-theme';

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
  pricePerGram21?: number | null;
  pricePerGram18?: number | null;
  pricePerGram14?: number | null;
  lastUpdated: string;
  changeOuncePct?: number | null;
  changeGramPct?: number | null;
  changeGram21Pct?: number | null;
  changeGram18Pct?: number | null;
  changeGram14Pct?: number | null;
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

type HeroGridItem =
  | { kind: 'currency'; currency: CurrencyRate }
  | { kind: 'gold' };

interface SiteSettings {
  siteName: string;
  siteNameAr: string;
  siteNameEn: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroSubtitleEn: string;
  logoUrl: string | null;
  logoUrlAr: string | null;
  logoUrlNonAr: string | null;
  logoSizes?: LogoSizes | null;
  lightPrimaryColor: string;
  lightAccentColor: string;
  lightBgColor: string;
  darkPrimaryColor: string;
  darkAccentColor: string;
  darkBgColor: string;
  heroSectionTheme?: HeroSectionThemeStored | null;
  /** مدة دورة شريط النشرة فوق الترويسة بالثواني */
  tickerMarqueeDurationSec?: number;
  footerSocialFacebook?: string | null;
  footerSocialX?: string | null;
  footerSocialTelegram?: string | null;
  footerSocialInstagram?: string | null;
  footerSocialYoutube?: string | null;
  footerSocialTiktok?: string | null;
  adsenseEnabled?: boolean;
  /** ca-pub-… جاهز لوحدات العرض */
  adsenseAdClient?: string | null;
  adsenseSlotHero?: string | null;
  adsenseSlotContent?: string | null;
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

const CRYPTO_BRAND_CARD_CLASS: Record<string, string> = {
  BTC: 'border-amber-500/30 bg-amber-500/10',
  ETH: 'border-indigo-500/30 bg-indigo-500/10',
  BNB: 'border-yellow-500/30 bg-yellow-500/10',
  XRP: 'border-slate-500/30 bg-slate-500/10',
  SOL: 'border-purple-500/30 bg-purple-500/10',
  ADA: 'border-blue-500/30 bg-blue-500/10',
  DOGE: 'border-orange-500/30 bg-orange-500/10',
  USDT: 'border-emerald-500/30 bg-emerald-500/10',
  USDC: 'border-sky-500/30 bg-sky-500/10',
  TRX: 'border-red-500/30 bg-red-500/10',
};

const FOREX_PAIR_CARD_CLASS: Record<string, string> = {
  'EUR/USD': 'border-sky-500/25 bg-sky-500/10',
  'GBP/USD': 'border-indigo-500/25 bg-indigo-500/10',
  'USD/JPY': 'border-rose-500/25 bg-rose-500/10',
  'USD/CHF': 'border-red-500/25 bg-red-500/10',
  'AUD/USD': 'border-emerald-500/25 bg-emerald-500/10',
  'USD/CAD': 'border-orange-500/25 bg-orange-500/10',
  'EUR/GBP': 'border-violet-500/25 bg-violet-500/10',
  'EUR/JPY': 'border-fuchsia-500/25 bg-fuchsia-500/10',
  'XAU/USD': 'border-yellow-500/25 bg-yellow-500/10',
  'XAG/USD': 'border-slate-400/30 bg-slate-400/10',
  'OIL/USD': 'border-zinc-500/25 bg-zinc-500/10',
  'GAS/USD': 'border-cyan-500/25 bg-cyan-500/10',
  'SUGAR/USD': 'border-pink-500/25 bg-pink-500/10',
  'RICE/USD': 'border-emerald-500/25 bg-emerald-500/10',
};

const MARKET_ASSET_EMOJI: Record<string, string> = {
  'asset-gold': '🥇',
  'asset-silver': '🥈',
  'asset-oil': '🛢️',
  'asset-gas': '🔥',
  'asset-sugar': '🍬',
  'asset-rice': '🌾',
};

/** شعار تبويب الذهب وبطاقة الهيرو (ملف محلي) */
const GOLD_HEADER_LOGO_PNG = '/sicon/gold.png';

/**
 * أيقونات PNG ثلاثية الأبعاد (Icons8 — يرجى الإشارة إلى icons8.com في صفحة الاعتمادات إن لزم).
 * سبيكة، بنك/نقد، عملات، مجوهرات، ميزان غرام، كيس نقود.
 */
const ICONS8_3D = (name: string) => `https://img.icons8.com/3d-fluency/144/${name}.png`;
const GOLD_TAB_CARD_IMAGES: string[] = [
  ICONS8_3D('gold-bars'),
  ICONS8_3D('bank'),
  ICONS8_3D('coins'),
  ICONS8_3D('medal'),
  ICONS8_3D('scales'),
  ICONS8_3D('money-bag'),
];

const MARKET_ESTIMATED_SIZE_UNIT: Record<
  string,
  { ar: string; en: string }
> = {
  'XAU/USD': { ar: 'أونصة', en: 'oz' },
  'XAG/USD': { ar: 'أونصة', en: 'oz' },
  'OIL/USD': { ar: 'برميل', en: 'barrel' },
  'GAS/USD': { ar: 'م.و.ح', en: 'MMBtu' },
  'SUGAR/USD': { ar: '≈ 0.454 كغ', en: '≈ 0.454 kg' },
  'RICE/USD': { ar: '≈ 45.36 كغ', en: '≈ 45.36 kg' },
};

const MARKET_UNIT_KG_BY_PAIR: Partial<Record<string, number>> = {
  'SUGAR/USD': 0.45359237, // lb -> kg
  'RICE/USD': 45.359237, // cwt -> kg
};

function marketUsdPerKg(pair: string, rate: number): number | null {
  const kg = MARKET_UNIT_KG_BY_PAIR[pair];
  if (!kg || !Number.isFinite(rate) || rate <= 0) return null;
  const v = rate / kg;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function parseMarketPair(pair: string): [string, string] | null {
  const parts = String(pair || '')
    .trim()
    .toUpperCase()
    .split('/')
    .map((x) => x.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

function usdPerCurrencyFromForexRows(rows: ForexRateData[]): Map<string, number> {
  const out = new Map<string, number>();
  out.set('USD', 1);
  for (const r of rows) {
    const pair = parseMarketPair(r.pair);
    const rate = Number(r.rate);
    if (!pair || !Number.isFinite(rate) || rate <= 0) continue;
    const [base, quote] = pair;
    if (quote === 'USD') out.set(base, rate);
    else if (base === 'USD') out.set(quote, 1 / rate);
  }
  return out;
}

/** عنوان البطاقة: الاسم الوصفي من قاعدة البيانات وليس رمز الزوج فقط. */
function forexPairTitle(fx: Pick<ForexRateData, 'pair' | 'nameAr' | 'nameEn'>, loc: string): string {
  if (loc === 'ar') {
    const n = String(fx.nameAr ?? '').trim();
    return n || fx.pair;
  }
  const n = String(fx.nameEn ?? '').trim();
  return n || fx.pair;
}

function marketApproxSyp(
  pair: string,
  rate: number,
  usdBuySyp: number | null | undefined,
  allRows: ForexRateData[]
): number | null {
  if (!usdBuySyp || !Number.isFinite(usdBuySyp) || usdBuySyp <= 0) return null;
  const parsed = parseMarketPair(pair);
  if (!parsed || !Number.isFinite(rate) || rate <= 0) return null;
  const [base, quote] = parsed;
  if (quote === 'USD') return rate * usdBuySyp;
  if (base === 'USD') return (1 / rate) * usdBuySyp;
  const usdMap = usdPerCurrencyFromForexRows(allRows);
  const quoteUsd = usdMap.get(quote);
  if (quoteUsd && Number.isFinite(quoteUsd) && quoteUsd > 0) return quoteUsd * usdBuySyp;
  return null;
}

function MarketBadge({ code }: { code: string }) {
  const c = String(code || '').toLowerCase();
  const emoji = MARKET_ASSET_EMOJI[c];
  if (emoji) {
    return (
      <span className="inline-flex h-3.5 w-5 items-center justify-center rounded-sm border border-background bg-background/60 text-[10px] shadow-sm">
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${c}.png`}
      alt={c}
      className="h-3.5 w-5 rounded-sm border border-background object-cover shadow-sm"
    />
  );
}

function cryptoPngUrl(code: string): string {
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${code.toLowerCase()}.png`;
}

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
  const t = window.setTimeout(() => {
    ctrl.abort(new DOMException(`Request timed out after ${ms}ms`, 'TimeoutError'));
  }, ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => window.clearTimeout(t));
}

function isAbortLike(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (e instanceof DOMException && e.name === 'TimeoutError') return true;
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

export default function Home() {
  const [data, setData] = useState<RatesData | null>(null);
  /** fetching: جلب (نفس شاشة المقدمة مع الشعار) | intro: خروج المقدمة | main */
  const [phase, setPhase] = useState<'fetching' | 'intro' | 'main'>('fetching');
  const [introExiting, setIntroExiting] = useState(false);
  const [introLogoFailed, setIntroLogoFailed] = useState(false);
  const initialFetchCompleted = useRef(false);
  /** شاشة المقدمة: قيمة ابتدائية حتى يظهر الشعار الافتراضي فوراً (مهم للوصول عبر IP/شبكة بطيئة) */
  const [bootIdentity, setBootIdentity] = useState<{
    logoUrl: string | null;
    logoUrlAr: string | null;
    logoUrlNonAr: string | null;
    logoSizes: LogoSizes;
  }>({
    logoUrl: null,
    logoUrlAr: null,
    logoUrlNonAr: null,
    logoSizes: { ...DEFAULT_LOGO_SIZES },
  });
  const [isNewLira, setIsNewLira] = useState(false);
  const [activeTab, setActiveTab] = useState('currencies');
  /** بث فوركس لحظي من الخادم (Finnhub → SSE) */
  const [forexRealtime, setForexRealtime] = useState(false);
  const [forexLiveConnected, setForexLiveConnected] = useState(false);
  const [cryptoRealtime, setCryptoRealtime] = useState(false);
  const [forexFlashByPair, setForexFlashByPair] = useState<Record<string, 'up' | 'down'>>({});
  const [cryptoFlashByCode, setCryptoFlashByCode] = useState<Record<string, 'up' | 'down'>>({});
  const [brokenCryptoIconByCode, setBrokenCryptoIconByCode] = useState<Record<string, true>>({});
  const { toast } = useToast();
  const t = useTranslations();
  const locale = useLocale();
  /** يمنع تكدّس جلب كل 1ث مع شبكة بطيئة (إلغاءات متزاحمة وضجيج AbortError في المتصفح) */
  const fetchDataInFlight = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchDataInFlight.current) return;
    fetchDataInFlight.current = true;
    const bootFrom = (s: SiteSettings) => {
      setBootIdentity({
        logoUrl: s.logoUrl ?? null,
        logoUrlAr: s.logoUrlAr ?? null,
        logoUrlNonAr: s.logoUrlNonAr ?? null,
        logoSizes: parseLogoSizes(s.logoSizes),
      });
    };

    const reqTimeoutMs = 25000;
    async function safeFetchJson(url: string): Promise<unknown> {
      try {
        const res = await fetchWithTimeout(url, { cache: 'no-store' }, reqTimeoutMs);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        if (isAbortLike(e)) return null;
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
      const forexJson = forexRaw as {
        success?: boolean;
        data?: ForexRateData[];
        realtime?: { enabled?: boolean; streamPath?: string; pairs?: string[] };
      } | null;
      const cryptoJson = cryptoRaw as { success?: boolean; data?: CryptoRateData[] } | null;
      const cryptoMeta = cryptoRaw as {
        success?: boolean;
        data?: CryptoRateData[];
        realtime?: { enabled?: boolean; streamPath?: string; codes?: string[] };
      } | null;

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
      setForexRealtime(!!(forexJson?.success && forexJson?.realtime?.enabled));
      setCryptoRealtime(!!(cryptoMeta?.success && cryptoMeta?.realtime?.enabled));
    } catch (error) {
      if (!isAbortLike(error)) {
        console.error('Error fetching data:', error);
      }
    } finally {
      fetchDataInFlight.current = false;
      if (!initialFetchCompleted.current) {
        initialFetchCompleted.current = true;
        setPhase('intro');
      }
    }
  }, []);

  useEffect(() => {
    void fetchData().catch(() => {});
    const interval = setInterval(() => void fetchData().catch(() => {}), 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!forexRealtime || typeof window === 'undefined') {
      setForexLiveConnected(false);
      return;
    }
    const es = new EventSource(new URL('/api/forex/stream', window.location.origin).toString());
    es.onopen = () => setForexLiveConnected(true);
    es.onerror = () => setForexLiveConnected(false);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          type?: string;
          rates?: Record<string, { rate: number; change: number; updatedAt: number }>;
          connected?: boolean;
        };
        if (msg.type !== 'hello' && msg.type !== 'tick') return;
        if (typeof msg.connected === 'boolean') setForexLiveConnected(msg.connected);
        const rates = msg.rates;
        if (rates && typeof rates === 'object' && Object.keys(rates).length > 0) {
          const flash: Record<string, 'up' | 'down'> = {};
          setData((d) => {
            if (!d) return d;
            return {
              ...d,
              forexRates: d.forexRates.map((f) => {
                const u = rates[f.pair];
                if (!u) return f;
                if (u.rate > f.rate) flash[f.pair] = 'up';
                else if (u.rate < f.rate) flash[f.pair] = 'down';
                return {
                  ...f,
                  rate: u.rate,
                  change: u.change,
                  lastUpdated: new Date(u.updatedAt).toISOString(),
                };
              }),
            };
          });
          if (Object.keys(flash).length > 0) {
            setForexFlashByPair((prev) => ({ ...prev, ...flash }));
            window.setTimeout(() => {
              setForexFlashByPair((prev) => {
                const next = { ...prev };
                for (const k of Object.keys(flash)) delete next[k];
                return next;
              });
            }, 700);
          }
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      es.close();
      setForexLiveConnected(false);
    };
  }, [forexRealtime]);

  useEffect(() => {
    if (!cryptoRealtime || typeof window === 'undefined') return;
    const es = new EventSource(new URL('/api/crypto/stream', window.location.origin).toString());
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          type?: string;
          rates?: Record<string, { price: number; change: number; updatedAt: number }>;
        };
        if (msg.type !== 'hello' && msg.type !== 'tick') return;
        const rates = msg.rates;
        if (!rates || typeof rates !== 'object' || Object.keys(rates).length === 0) return;
        const flash: Record<string, 'up' | 'down'> = {};
        setData((d) => {
          if (!d) return d;
          return {
            ...d,
            cryptoRates: d.cryptoRates.map((c) => {
              const u = rates[c.code];
              if (!u) return c;
              if (u.price > c.price) flash[c.code] = 'up';
              else if (u.price < c.price) flash[c.code] = 'down';
              return {
                ...c,
                price: u.price,
                change: u.change,
                lastUpdated: new Date(u.updatedAt).toISOString(),
              };
            }),
          };
        });
        if (Object.keys(flash).length > 0) {
          setCryptoFlashByCode((prev) => ({ ...prev, ...flash }));
          window.setTimeout(() => {
            setCryptoFlashByCode((prev) => {
              const next = { ...prev };
              for (const k of Object.keys(flash)) delete next[k];
              return next;
            });
          }, 700);
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [cryptoRealtime]);

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

  const { resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => {
    setThemeMounted(true);
  }, []);

  // Apply full semantic theme from brand colors (light/dark packs)
  useEffect(() => {
    if (!data?.siteSettings) return;
    const root = document.documentElement;
    const isDark =
      themeMounted && resolvedTheme
        ? resolvedTheme === 'dark'
        : root.classList.contains('dark');
    const brand: SiteBrandColors = {
      lightPrimaryColor: data.siteSettings.lightPrimaryColor,
      lightAccentColor: data.siteSettings.lightAccentColor,
      lightBgColor: data.siteSettings.lightBgColor,
      darkPrimaryColor: data.siteSettings.darkPrimaryColor,
      darkAccentColor: data.siteSettings.darkAccentColor,
      darkBgColor: data.siteSettings.darkBgColor,
    };
    applySiteBrandCssVars(root, isDark ? 'dark' : 'light', brand);
  }, [data?.siteSettings, resolvedTheme, themeMounted]);

  const heroSectionSurfaceStyle = useMemo(() => {
    if (!data?.siteSettings) return undefined;
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const isDark =
      themeMounted && resolvedTheme
        ? resolvedTheme === 'dark'
        : Boolean(root?.classList.contains('dark'));
    return heroSectionInlineStyle(
      isDark ? 'dark' : 'light',
      data.siteSettings.heroSectionTheme ?? null
    );
  }, [data?.siteSettings, data?.siteSettings?.heroSectionTheme, resolvedTheme, themeMounted]);

  const getSiteName = () => {
    if (!data?.siteSettings) return t('site.title');
    return locale === 'ar' ? data.siteSettings.siteNameAr : data.siteSettings.siteNameEn;
  };

  const getLogoUrl = () => resolveLogoForLocale(locale, data?.siteSettings);

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

  /** بجانب «مباشر»: يوم/شهر رقمان D/M بدون سنة، + وقت بدون ثوانٍ */
  const formatLiveStatusDateTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const localeStr = locale === 'ar' ? 'ar-SY' : locale === 'de' ? 'de-DE' : locale === 'sv' ? 'sv-SE' : locale === 'fr' ? 'fr-FR' : 'en-US';
    const timeStr = new Intl.DateTimeFormat(localeStr, {
      ...numberingLatn,
      hour: '2-digit',
      minute: '2-digit',
      ...(locale === 'ar' ? { hour12: true } : {}),
    }).format(date);
    return `${d}/${m} ${timeStr}`;
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

  const getFlagUrl = (code: string) => {
    return flagUrls[code] || null;
  };

  const scrollToRates = (tab?: string) => {
    if (tab) setActiveTab(tab);
    document.getElementById('rates-panel')?.scrollIntoView({ behavior: 'smooth' });
  };

  const usd = getFeaturedCurrency('USD');
  /** USD → EUR → TRY → ذهب (أونصة) → EGP — بدل بطاقة SAR */
  const heroGridItems: HeroGridItem[] = (() => {
    const items: HeroGridItem[] = [];
    if (usd) items.push({ kind: 'currency', currency: usd });
    for (const code of ['EUR', 'TRY'] as const) {
      const r = data?.rates.find((x) => x.code === code);
      if (r) items.push({ kind: 'currency', currency: r });
    }
    if (data?.goldPrice) items.push({ kind: 'gold' });
    const egp = data?.rates.find((r) => r.code === 'EGP');
    if (egp) items.push({ kind: 'currency', currency: egp });
    return items;
  })();

  const tickerMarqueeSec = Math.min(
    180,
    Math.max(8, data?.siteSettings?.tickerMarqueeDurationSec ?? 42)
  );

  const footerSocialUrls = {
    facebook: data?.siteSettings?.footerSocialFacebook ?? null,
    x: data?.siteSettings?.footerSocialX ?? null,
    telegram: data?.siteSettings?.footerSocialTelegram ?? null,
    instagram: data?.siteSettings?.footerSocialInstagram ?? null,
    youtube: data?.siteSettings?.footerSocialYoutube ?? null,
    tiktok: data?.siteSettings?.footerSocialTiktok ?? null,
  };
  const showFooterSocial = footerSocialHasAny(footerSocialUrls);

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

  const heroRateCardClassName =
    'rounded-2xl border border-white/70 bg-white/75 p-3 shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-lg hover:shadow-sky-900/10 dark:border-white/10 dark:bg-white/10 dark:ring-white/5 dark:hover:bg-white/15 min-w-0';

  const liveStatusPieces = (at: string | null) => (
    <>
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.65)] animate-pulse"
          aria-hidden
        />
        <span className="text-[11px] font-semibold leading-none text-emerald-600 dark:text-emerald-400">
          {locale === 'ar' ? 'مباشر' : 'Live'}
        </span>
      </span>
      {at ? (
        <span className="min-w-0 text-[11px] leading-snug text-muted-foreground dark:text-white/50">
          {t('hero.lastUpdatedAt')}{' '}
          <span className="tabular-nums text-muted-foreground/90 dark:text-white/55">
            {formatLiveStatusDateTime(at)}
          </span>
        </span>
      ) : null}
    </>
  );

  const renderHeroLiveRow = (at: string | null) => (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">{liveStatusPieces(at)}</div>
  );

  const renderHeroRateCard = (c: CurrencyRate) => (
    <div className={heroRateCardClassName}>
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {getFlagUrl(c.code) ? (
            <div className="relative mt-0.5 h-9 w-12 shrink-0 overflow-hidden rounded-md sm:h-10 sm:w-14">
              <img
                src={getFlagUrl(c.code)!}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 h-[132%] w-[132%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
              />
            </div>
          ) : (
            <span className="mt-0.5 text-2xl leading-none sm:text-[1.75rem]">{c.flagEmoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium" title={c.code}>
                {locale === 'ar' ? getCurrencyName(c) : c.code}
              </span>
              <RateDeltaBadge
                pct={rateDeltaAvg(c.changeBuyPct, c.changeSellPct)}
                className="shrink-0"
              />
            </div>
            {renderHeroLiveRow(c.lastUpdated ?? data?.lastUpdate ?? null)}
          </div>
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
            fileNameSlug={`hero-${c.code}`}
            detailLine={`${getCurrencyName(c)} (${c.code}): ${t('currency.buyRate')} ${formatNumber(c.buyRate)} — ${t('currency.sellRate')} ${formatNumber(c.sellRate)}`}
          />
        )}
      </div>
      <div className="mt-0.5 grid grid-cols-2 gap-1.5 border-t border-slate-900/[0.06] pt-2 text-center dark:border-white/10">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground dark:text-white/55">
            {t('currency.buyRate')}
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight sm:text-xl">{formatNumber(c.buyRate)}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground dark:text-white/55">
            {t('currency.sellRate')}
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight sm:text-xl">{formatNumber(c.sellRate)}</p>
        </div>
      </div>
    </div>
  );

  const renderHeroGoldCard = () => {
    if (!data?.goldPrice) return null;
    const gp = data.goldPrice;
    const sypOunce = usd ? gp.priceUsd * usd.buyRate : null;
    return (
      <div className={heroRateCardClassName}>
        <div className="mb-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            <div className="relative mt-0.5 h-9 w-12 shrink-0 overflow-hidden rounded-md sm:h-10 sm:w-14">
              <img
                src={GOLD_HEADER_LOGO_PNG}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium" title="XAU">
                  {locale === 'ar' ? 'الذهب' : 'Gold'}
                </span>
                <RateDeltaBadge pct={gp.changeOuncePct} className="shrink-0" />
              </div>
              {renderHeroLiveRow(gp.lastUpdated)}
            </div>
          </div>
          {shareBase && usd && (
            <PriceShareButton
              {...shareBase}
              size="icon"
              className="h-7 w-7 shrink-0 border-white/60 bg-white/50 dark:border-white/20 dark:bg-white/10"
              headline={locale === 'ar' ? 'الذهب — معاينة سريعة' : 'Gold — quick view'}
              subheadline="XAU / USD / SYP"
              rows={[
                {
                  label: locale === 'ar' ? 'أونصة (USD)' : 'Ounce (USD)',
                  value: `$${formatUsd(gp.priceUsd, 2)}`,
                  tone: 'neutral',
                },
                {
                  label: `${locale === 'ar' ? 'أونصة' : 'Ounce'} (${getCurrencySymbol()})`,
                  value: formatNumber(gp.priceUsd * usd.buyRate),
                  tone: 'neutral',
                },
              ]}
              fileNameSlug="gold-hero"
              detailLine={`${locale === 'ar' ? 'الذهب' : 'Gold'}: USD/oz $${formatUsd(gp.priceUsd, 2)} · ${getCurrencySymbol()} ${formatNumber(gp.priceUsd * usd.buyRate)}`}
            />
          )}
        </div>
        <div className="mt-0.5 grid min-w-0 grid-cols-2 gap-1.5 border-t border-slate-900/[0.06] pt-2 text-center dark:border-white/10">
          <div>
            <p
              className={`text-[0.65rem] font-medium tracking-wide text-muted-foreground dark:text-white/55 ${locale === 'ar' ? '' : 'uppercase'}`}
            >
              {locale === 'ar' ? 'الدولار' : 'USD'}
            </p>
            <p className="text-lg font-bold tabular-nums leading-tight sm:text-xl">
              ${formatUsd(gp.priceUsd, 2)}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground dark:text-white/55">
              {getCurrencySymbol()}
            </p>
            <p className="text-lg font-bold tabular-nums leading-tight sm:text-xl">
              {sypOunce != null ? formatNumber(sypOunce) : '---'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const introLh =
    bootIdentity?.logoSizes.loading ??
    parseLogoSizes(data?.siteSettings?.logoSizes).loading ??
    DEFAULT_LOGO_SIZES.loading;
  const introLogoRaw = pickLogoStorageUrl(locale, bootIdentity);
  const introLogoSrc = introLogoRaw ? resolveLogoUrlForClient(introLogoRaw) : null;

  useEffect(() => {
    setIntroLogoFailed(false);
  }, [introLogoSrc]);

  return (
    <>
      {(phase === 'fetching' || phase === 'intro') && (
        <div
          className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background text-foreground transition-[opacity] duration-700 ease-out ${
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
              {/* شاشة المقدمة؛ مسار افتراضي logo.svg */}
              {!introLogoFailed && introLogoSrc ? (
                <>
                  { }
                  <img
                    key={introLogoSrc}
                    src={introLogoSrc}
                    alt=""
                    width={240}
                    height={80}
                    decoding="async"
                    fetchPriority="high"
                    onError={() => setIntroLogoFailed(true)}
                    className="block rounded-lg object-contain"
                    style={{ height: introLh, width: 'auto', maxWidth: 200 }}
                  />
                </>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground dark:text-white/70">{t('site.description')}</p>
          </div>
        </div>
      )}

      {phase === 'main' && data && (
    <div
      className="home-surface relative min-h-screen flex flex-col bg-background text-foreground animate-in fade-in-0 duration-700 ease-out"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* شعار شفاف كخلفية — fixed للنافذة؛ بدون zoom على الأب حتى لا يصبح fixed نسبياً لحاوية بها transform */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[40%] z-0 h-[min(72vh,480px)] w-[min(88vw,480px)] -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat opacity-[0.07] saturate-150 dark:opacity-[0.11] dark:saturate-100"
        style={{ backgroundImage: `url(${getLogoUrl()})` }}
      />
      <header className="spt-header sticky top-0 z-50 overflow-hidden border-b border-border/70 bg-background/85 text-foreground shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-border/60 dark:bg-background/92 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]">
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
            {/* شعار الترويسة بدون إطار/قص دائري */}
            { }
            <img
              key={getLogoUrl()}
              src={getLogoUrl()}
              alt=""
              width={240}
              height={80}
              decoding="async"
              style={{ height: getLogoSizes().header, width: 'auto', maxHeight: getLogoSizes().header }}
              className="header-site-logo w-auto shrink-0 border-0 object-contain shadow-none ring-0 outline-none"
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

      <main className="relative z-10 flex-1 text-foreground">
        <section
          className="section-bg-hero relative scroll-mt-20 overflow-hidden pb-6 pt-5 sm:pt-6 lg:pb-8"
          style={heroSectionSurfaceStyle}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-36 z-[1] h-80 w-80 rounded-full bg-white/40 blur-3xl dark:bg-white/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-24 z-[1] h-72 w-72 rounded-full bg-white/35 blur-3xl dark:bg-white/8"
            aria-hidden
          />
          <div className="relative z-[2] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <header className="mb-4 text-center lg:mb-5">
              <h1 className="text-3xl font-bold tracking-tight text-inherit sm:text-4xl lg:text-[2.5rem]">
                {t('hero.brandTitle')}
              </h1>
              <p
                className="mx-auto mt-2 max-w-2xl text-base leading-snug sm:text-lg"
                style={{ color: 'var(--hero-muted)' }}
              >
                {t('hero.brandTagline')}
              </p>
            </header>
            {/* موبايل: عمود واحد تحت بعض */}
            <div className="flex flex-col gap-2 sm:gap-3 md:hidden">
              {heroGridItems.map((item) => (
                <div key={item.kind === 'currency' ? item.currency.code : 'gold-hero'}>
                  {item.kind === 'currency' ? renderHeroRateCard(item.currency) : renderHeroGoldCard()}
                </div>
              ))}
            </div>
            {/* تابلت: صف من 3 ثم الباقي في المنتصف */}
            <div className="hidden flex-col gap-2 sm:gap-3 md:flex lg:hidden">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {heroGridItems.slice(0, 3).map((item) => (
                  <div key={item.kind === 'currency' ? item.currency.code : 'gold-hero'}>
                    {item.kind === 'currency' ? renderHeroRateCard(item.currency) : renderHeroGoldCard()}
                  </div>
                ))}
              </div>
              {heroGridItems.length > 3 ? (
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {heroGridItems.slice(3).map((item) => (
                    <div
                      key={item.kind === 'currency' ? item.currency.code : 'gold-hero'}
                      className="w-full max-w-[min(100%,17.5rem)] sm:max-w-[min(100%,15rem)]"
                    >
                      {item.kind === 'currency' ? renderHeroRateCard(item.currency) : renderHeroGoldCard()}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {/* سطح المكتب: كل البطاقات بجانب بعض في صف واحد */}
            <div className="hidden gap-2 sm:gap-3 lg:flex lg:flex-row lg:items-stretch">
              {heroGridItems.map((item) => (
                <div key={item.kind === 'currency' ? item.currency.code : 'gold-hero'} className="min-w-0 flex-1">
                  {item.kind === 'currency' ? renderHeroRateCard(item.currency) : renderHeroGoldCard()}
                </div>
              ))}
            </div>
          </div>
        </section>

        {data.siteSettings.adsenseEnabled &&
        data.siteSettings.adsenseAdClient &&
        data.siteSettings.adsenseSlotHero ? (
          <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-4 sm:px-6 lg:px-8">
            <AdSenseSlot
              client={data.siteSettings.adsenseAdClient}
              slot={data.siteSettings.adsenseSlotHero}
              labelAr="إعلان"
              labelEn="Advertisement"
              locale={locale}
            />
          </div>
        ) : null}

        <section
          id="rates-panel"
          className="section-bg-rates relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-[1] w-full">
            <TabsList className="no-scrollbar mb-8 flex h-auto w-full flex-nowrap items-end justify-between gap-0.5 border-0 border-b border-border/70 bg-transparent p-0 shadow-none dark:border-slate-600/80 sm:gap-1 md:justify-center md:gap-x-2">
              <TabsTrigger
                value="currencies"
                className="-mb-px min-w-0 flex-1 basis-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2 pt-2 text-center text-xs font-medium text-muted-foreground shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-slate-400 dark:data-[state=active]:border-sky-400 dark:data-[state=active]:text-white sm:px-2 sm:text-sm md:flex-none md:basis-auto md:px-3"
              >
                <span className="flex w-full min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <Coins className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" aria-hidden />
                  <span
                    className="w-full truncate text-center text-[0.62rem] leading-tight sm:max-w-[9rem] sm:text-xs md:max-w-none md:text-sm"
                    title={locale === 'ar' ? 'العملات' : 'Currencies'}
                  >
                    {locale === 'ar' ? 'العملات' : 'Currencies'}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="gold"
                className="-mb-px min-w-0 flex-1 basis-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2 pt-2 text-center text-xs font-medium text-muted-foreground shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-slate-400 dark:data-[state=active]:border-sky-400 dark:data-[state=active]:text-white sm:px-2 sm:text-sm md:flex-none md:basis-auto md:px-3"
              >
                <span className="flex w-full min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <Medal className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" aria-hidden />
                  <span
                    className="w-full truncate text-center text-[0.62rem] leading-tight sm:max-w-[9rem] sm:text-xs md:max-w-none md:text-sm"
                    title={locale === 'ar' ? 'الذهب' : 'Gold'}
                  >
                    {locale === 'ar' ? 'الذهب' : 'Gold'}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="fuel"
                className="-mb-px min-w-0 flex-1 basis-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2 pt-2 text-center text-xs font-medium text-muted-foreground shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-slate-400 dark:data-[state=active]:border-sky-400 dark:data-[state=active]:text-white sm:px-2 sm:text-sm md:flex-none md:basis-auto md:px-3"
              >
                <span className="flex w-full min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <Fuel className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" aria-hidden />
                  <span
                    className="w-full truncate text-center text-[0.62rem] leading-tight sm:max-w-[9rem] sm:text-xs md:max-w-none md:text-sm"
                    title={locale === 'ar' ? 'المحروقات' : 'Fuel'}
                  >
                    {locale === 'ar' ? 'المحروقات' : 'Fuel'}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="forex"
                className="-mb-px min-w-0 flex-1 basis-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2 pt-2 text-center text-xs font-medium text-muted-foreground shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-slate-400 dark:data-[state=active]:border-sky-400 dark:data-[state=active]:text-white sm:px-2 sm:text-sm md:flex-none md:basis-auto md:px-3"
              >
                <span className="flex w-full min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" aria-hidden />
                  <span
                    className="w-full truncate text-center text-[0.62rem] leading-tight sm:max-w-[9rem] sm:text-xs md:max-w-none md:text-sm"
                    title={locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}
                  >
                    {locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="crypto"
                className="-mb-px min-w-0 flex-1 basis-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2 pt-2 text-center text-xs font-medium text-muted-foreground shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-slate-400 dark:data-[state=active]:border-sky-400 dark:data-[state=active]:text-white sm:px-2 sm:text-sm md:flex-none md:basis-auto md:px-3"
              >
                <span className="flex w-full min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                  <Bitcoin className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" aria-hidden />
                  <span
                    className="w-full truncate text-center text-[0.62rem] leading-tight sm:max-w-[9rem] sm:text-xs md:max-w-none md:text-sm"
                    title={locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
                  >
                    {locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
                  </span>
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Currencies Tab */}
            <TabsContent value="currencies" className="space-y-4">
              <div className="surface-card overflow-hidden p-4 sm:p-6">
                {/* جوال: بطاقات عمودية بعرض الشاشة — بلا تمرير أفقي */}
                <div className="flex min-w-0 flex-col gap-3 md:hidden">
                  {(data?.rates ?? []).map((currency, index) => (
                    <div
                      key={currency.id}
                      className="animate-fade-in-up min-w-0 rounded-xl border border-border/80 bg-muted/25 p-3 dark:border-slate-600/50 dark:bg-slate-800/40"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="h-7 w-10 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-black/10 dark:ring-white/10">
                            {getFlagUrl(currency.code) ? (
                              <img
                                src={getFlagUrl(currency.code)!}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted text-base">
                                {currency.flagEmoji || '💱'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold leading-tight">{getCurrencyName(currency)}</p>
                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="shrink-0 text-xs text-muted-foreground font-mono">{currency.code}</p>
                              {liveStatusPieces(currency.lastUpdated ?? data?.lastUpdate ?? null)}
                            </div>
                          </div>
                        </div>
                        {shareBase ? (
                          <div className="shrink-0">
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
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-lg bg-green-500/10 px-2 py-2 text-center dark:bg-green-500/[0.08]">
                          <div className="flex items-center justify-center gap-0.5 text-[0.65rem] font-medium text-green-700 dark:text-green-400">
                            <TrendingDown className="h-3 w-3" aria-hidden />
                            {t('currency.buyRate')}
                          </div>
                          <p className="mt-0.5 truncate text-base font-bold tabular-nums text-green-600 dark:text-green-400">
                            {formatNumber(currency.buyRate)}
                          </p>
                          <div className="mt-1 flex justify-center">
                            <RateDeltaBadge pct={currency.changeBuyPct} subLabel={t('rateDelta.buyShort')} />
                          </div>
                        </div>
                        <div className="min-w-0 rounded-lg bg-red-500/10 px-2 py-2 text-center dark:bg-red-500/[0.08]">
                          <div className="flex items-center justify-center gap-0.5 text-[0.65rem] font-medium text-red-700 dark:text-red-400">
                            <TrendingUp className="h-3 w-3" aria-hidden />
                            {t('currency.sellRate')}
                          </div>
                          <p className="mt-0.5 truncate text-base font-bold tabular-nums text-red-600 dark:text-red-400">
                            {formatNumber(currency.sellRate)}
                          </p>
                          <div className="mt-1 flex justify-center">
                            <RateDeltaBadge pct={currency.changeSellPct} subLabel={t('rateDelta.sellShort')} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* شاشات أوسع: جدول */}
                <div className="hidden min-w-0 md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-0 table-auto">
                      <thead>
                        <tr className="border-b border-border dark:border-slate-600/80">
                          <th className="p-3 text-start text-sm font-semibold text-muted-foreground md:p-4">
                            {locale === 'ar' ? 'العملة' : 'Currency'}
                          </th>
                          <th className="p-3 text-center text-sm font-semibold text-green-500 md:p-4">
                            <div className="flex items-center justify-center gap-1">
                              <TrendingDown className="h-4 w-4" />
                              {t('currency.buyRate')}
                            </div>
                          </th>
                          <th className="p-3 text-center text-sm font-semibold text-red-500 md:p-4">
                            <div className="flex items-center justify-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              {t('currency.sellRate')}
                            </div>
                          </th>
                          <th className="hidden p-3 text-center text-xs font-semibold text-muted-foreground sm:table-cell sm:p-4 sm:text-sm">
                            {t('rateDelta.sinceLast')}
                          </th>
                          <th className="hidden p-4 text-end text-sm font-semibold text-muted-foreground sm:table-cell">
                            {locale === 'ar' ? 'الرمز' : 'Code'}
                          </th>
                          <th className="w-[1%] whitespace-nowrap p-3 text-center text-sm font-semibold text-muted-foreground md:p-4">
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
                            <td className="p-3 md:p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-7 w-10 shrink-0 overflow-hidden rounded-md shadow-md ring-1 ring-black/10 dark:ring-white/10">
                                  {getFlagUrl(currency.code) ? (
                                    <img
                                      src={getFlagUrl(currency.code)!}
                                      alt={currency.code}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-muted text-lg">
                                      {currency.flagEmoji || '💱'}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold">{getCurrencyName(currency)}</p>
                                  {renderHeroLiveRow(currency.lastUpdated ?? data?.lastUpdate ?? null)}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center md:p-4">
                              <span className="text-lg font-bold text-green-500">{formatNumber(currency.buyRate)}</span>
                            </td>
                            <td className="p-3 text-center md:p-4">
                              <span className="text-lg font-bold text-red-500">{formatNumber(currency.sellRate)}</span>
                            </td>
                            <td className="hidden p-3 align-middle sm:table-cell sm:p-4">
                              <div className="flex flex-col items-center gap-1">
                                <RateDeltaBadge pct={currency.changeBuyPct} subLabel={t('rateDelta.buyShort')} />
                                <RateDeltaBadge pct={currency.changeSellPct} subLabel={t('rateDelta.sellShort')} />
                              </div>
                            </td>
                            <td className="hidden p-4 text-end sm:table-cell">
                              <span className="font-mono text-sm text-muted-foreground">{currency.code}</span>
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
              </div>
            </TabsContent>

            {/* Gold Tab */}
            <TabsContent value="gold" className="space-y-4">
              {data?.goldPrice && (
                <div className="surface-card p-6">
                  <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                    <img
                      src={GOLD_HEADER_LOGO_PNG}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded-sm object-contain"
                    />
                    {locale === 'ar' ? 'أسعار الذهب' : 'Gold Prices'}
                  </CardTitle>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[
                      {
                        label: locale === 'ar' ? 'أونصة بالدولار' : 'Ounce in USD',
                        value: `$${formatUsd(data.goldPrice.priceUsd, 2)}`,
                        color: 'amber' as const,
                        deltaPct: data.goldPrice.changeOuncePct,
                      },
                      {
                        label: locale === 'ar' ? 'أونصة بالليرة' : 'Ounce in SYP',
                        value: getFeaturedCurrency('USD') ? formatNumber(data.goldPrice.priceUsd * getFeaturedCurrency('USD')!.buyRate) : '---',
                        suffix: getCurrencySymbol(),
                        color: 'green' as const,
                        deltaPct: data.goldPrice.changeOuncePct,
                      },
                      {
                        label: locale === 'ar' ? 'ليرة ذهبية بالدولار' : 'Gold Lira in USD',
                        value: `$${formatUsd(data.goldPrice.pricePerGram * 8.5, 2)}`,
                        color: 'amber' as const,
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                      {
                        label: locale === 'ar' ? 'ليرة ذهبية بالليرة' : 'Gold Lira in SYP',
                        value: getFeaturedCurrency('USD') ? formatNumber(data.goldPrice.pricePerGram * 8.5 * getFeaturedCurrency('USD')!.buyRate) : '---',
                        suffix: getCurrencySymbol(),
                        color: 'green' as const,
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                      {
                        label: locale === 'ar' ? 'غرام بالدولار' : 'Gram in USD',
                        value: `$${formatUsd(data.goldPrice.pricePerGram, 2)}`,
                        color: 'amber' as const,
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                      {
                        label: locale === 'ar' ? 'غرام بالليرة' : 'Gram in SYP',
                        value: getFeaturedCurrency('USD') ? formatNumber(data.goldPrice.pricePerGram * getFeaturedCurrency('USD')!.buyRate) : '---',
                        suffix: getCurrencySymbol(),
                        color: 'green' as const,
                        deltaPct: data.goldPrice.changeGramPct,
                      },
                    ].map((item, i) => {
                      const cardImg = GOLD_TAB_CARD_IMAGES[i] ?? GOLD_TAB_CARD_IMAGES[0];
                      const displayVal = item.suffix ? `${item.value} ${item.suffix}` : String(item.value);
                      const iconRing =
                        item.color === 'amber'
                          ? 'from-amber-400/40 via-amber-500/25 to-yellow-600/15 ring-amber-500/30 dark:from-amber-500/35 dark:via-amber-600/20 dark:ring-amber-400/30'
                          : 'from-emerald-400/35 via-emerald-500/25 to-teal-600/15 ring-emerald-500/30 dark:from-emerald-500/30 dark:via-emerald-600/15 dark:ring-emerald-400/25';
                      return (
                        <div
                          key={i}
                          className={`relative overflow-hidden rounded-xl border p-4 pt-12 text-center shadow-sm transition-shadow hover:shadow-md ${item.color === 'amber' ? 'border-amber-500/35 bg-gradient-to-b from-amber-500/[0.07] to-transparent' : 'border-emerald-500/35 bg-gradient-to-b from-emerald-500/[0.07] to-transparent'}`}
                        >
                          <div
                            className={`pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl ${item.color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            aria-hidden
                          />
                          {shareBase && (
                            <div className="absolute end-2 top-2 z-10">
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
                          <div
                            className={`relative mx-auto mb-3 flex h-[4.75rem] w-[4.75rem] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br p-2 shadow-md ring-1 ${iconRing}`}
                          >
                            <img
                              src={cardImg}
                              alt=""
                              width={144}
                              height={144}
                              className="relative z-[1] h-full w-full object-contain drop-shadow-md"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <p className="relative mb-2 text-sm font-medium text-muted-foreground">{item.label}</p>
                          <p
                            className={`relative text-2xl font-bold tabular-nums ${item.color === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                          >
                            {item.value}
                          </p>
                          {item.suffix && <p className="relative mt-1 text-xs text-muted-foreground">{item.suffix}</p>}
                          <div className="relative mt-2 flex justify-center">
                            <RateDeltaBadge pct={item.deltaPct} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const karats: { k: 21 | 18 | 14; usd: number; delta: number | null | undefined }[] = [];
                    if (data.goldPrice.pricePerGram21 != null && data.goldPrice.pricePerGram21 > 0) {
                      karats.push({
                        k: 21,
                        usd: data.goldPrice.pricePerGram21,
                        delta: data.goldPrice.changeGram21Pct,
                      });
                    }
                    if (data.goldPrice.pricePerGram18 != null && data.goldPrice.pricePerGram18 > 0) {
                      karats.push({
                        k: 18,
                        usd: data.goldPrice.pricePerGram18,
                        delta: data.goldPrice.changeGram18Pct,
                      });
                    }
                    if (data.goldPrice.pricePerGram14 != null && data.goldPrice.pricePerGram14 > 0) {
                      karats.push({
                        k: 14,
                        usd: data.goldPrice.pricePerGram14,
                        delta: data.goldPrice.changeGram14Pct,
                      });
                    }
                    if (karats.length === 0) return null;
                    const usdRate = getFeaturedCurrency('USD');
                    return (
                      <div className="mt-8 border-t border-amber-500/20 pt-8">
                        <div className="grid gap-4 md:grid-cols-3">
                          {karats.map(({ k, usd, delta }) => {
                            const sypVal =
                              usdRate != null && usdRate.buyRate > 0
                                ? formatNumber(usd * usdRate.buyRate)
                                : '---';
                            const displayUsd = `$${formatUsd(usd, 2)}`;
                            const displayFull =
                              usdRate != null ? `${sypVal} ${getCurrencySymbol()}` : String(sypVal);
                            const iconRing =
                              'from-amber-400/40 via-amber-500/25 to-yellow-600/15 ring-amber-500/30 dark:from-amber-500/35 dark:via-amber-600/20 dark:ring-amber-400/30';
                            return (
                              <div
                                key={k}
                                className="relative overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.07] to-transparent p-4 pt-12 text-center shadow-sm transition-shadow hover:shadow-md"
                              >
                                <div
                                  className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full bg-amber-400 opacity-[0.12] blur-2xl"
                                  aria-hidden
                                />
                                {shareBase && (
                                  <div className="absolute end-2 top-2 z-10">
                                    <PriceShareButton
                                      {...shareBase}
                                      size="icon"
                                      className="h-7 w-7"
                                      headline={
                                        locale === 'ar'
                                          ? `ذهب عيار ${k} — غرام`
                                          : `Gold ${k}K — per gram`
                                      }
                                      subheadline={
                                        locale === 'ar'
                                          ? `عيار ${k} — دولار وليرة`
                                          : `${k}K — USD & SYP`
                                      }
                                      rows={[
                                        {
                                          label: locale === 'ar' ? 'الغرام بالدولار' : 'Gram USD',
                                          value: displayUsd,
                                          tone: 'neutral',
                                        },
                                        {
                                          label: locale === 'ar' ? 'الغرام بالليرة' : 'Gram SYP',
                                          value: displayFull,
                                          tone: 'neutral',
                                        },
                                      ]}
                                      fileNameSlug={`gold-k${k}`}
                                      detailLine={`${k}K: ${displayUsd} · ${displayFull}`}
                                    />
                                  </div>
                                )}
                                <div
                                  className={`relative mx-auto mb-4 flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-full bg-gradient-to-br p-0 shadow-md ring-2 ${iconRing}`}
                                >
                                  <span className="text-2xl font-black tabular-nums text-amber-800 dark:text-amber-200">
                                    {k}
                                  </span>
                                </div>
                                <p className="relative mb-1 text-sm font-medium text-muted-foreground">
                                  {locale === 'ar' ? `عيار ${k} — غرام` : `${k}K — gram`}
                                </p>
                                <p className="relative text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                  {displayUsd}
                                </p>
                                <p className="relative mt-1 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                  {displayFull}
                                </p>
                                <div className="relative mt-2 flex justify-center">
                                  <RateDeltaBadge pct={delta} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
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
                  {data?.fuelPrices.map((fuel) => {
                    const fuelUsd =
                      usd && Number.isFinite(usd.buyRate) && usd.buyRate > 0
                        ? fuel.price / usd.buyRate
                        : null;
                    return (
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
                                value:
                                  fuelUsd != null
                                    ? `$${formatUsd(fuelUsd, 3)}`
                                    : `${formatNumber(fuel.price)} ${getCurrencySymbol()}`,
                                tone: 'neutral',
                              },
                            ]}
                            fileNameSlug={`fuel-${fuel.code}`}
                            detailLine={
                              fuelUsd != null
                                ? `${getFuelName(fuel)}: $${formatUsd(fuelUsd, 3)} (≈ ${formatNumber(fuel.price)} ${getCurrencySymbol()})`
                                : `${getFuelName(fuel)}: ${formatNumber(fuel.price)} ${getCurrencySymbol()}`
                            }
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
                        <p className="text-2xl font-bold text-primary dark:text-blue-400">
                          {fuelUsd != null ? `$${formatUsd(fuelUsd, 3)}` : '---'}
                        </p>
                        <p className="text-xs text-muted-foreground">USD</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          ≈ {formatNumber(fuel.price)} {getCurrencySymbol()}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <RateDeltaBadge pct={fuel.changePct} />
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </TabsContent>

            {/* Forex Tab */}
            <TabsContent value="forex" className="space-y-4">
              <div className="surface-card p-6">
                <CardTitle className="mb-6 flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                  <Globe className="h-5 w-5" />
                  {locale === 'ar' ? 'البورصات العالمية' : 'Global market rates'}
                  {forexRealtime && (
                    <span
                      className={cn(
                        'ms-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        forexLiveConnected
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                      )}
                    >
                      <Zap
                        className={cn(
                          'h-3.5 w-3.5',
                          forexLiveConnected && 'text-emerald-600 dark:text-emerald-400'
                        )}
                        aria-hidden
                      />
                      {locale === 'ar'
                        ? forexLiveConnected
                          ? 'لحظي من الخادم'
                          : 'جاري الاتصال…'
                        : forexLiveConnected
                          ? 'Live (server)'
                          : 'Connecting…'}
                    </span>
                  )}
                </CardTitle>
                {forexRealtime && (!data?.forexRates || data.forexRates.length === 0) ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {locale === 'ar'
                      ? 'لا توجد أزواج فوركس مطابقة للبث الحي. تأكد من أن «زوج الموقع» في لوحة التحكم موجود في جدول الفوركس، وأن رموز Finnhub صحيحة.'
                      : 'No forex pairs match live mode. Ensure each «site pair» exists in the forex table and Finnhub symbols are valid.'}
                  </p>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {data?.forexRates?.map((pair) => {
                    const fxTitle = forexPairTitle(pair, locale);
                    const rateNum = Number(pair.rate);
                    const rateFormatted = formatUsd(rateNum, 3);
                    const approxSyp = marketApproxSyp(
                      pair.pair,
                      rateNum,
                      getFeaturedCurrency('USD')?.buyRate ?? null,
                      data.forexRates
                    );
                    const shareDetail =
                      approxSyp != null
                        ? `${fxTitle} (${pair.pair}): ${rateFormatted} · ≈ ${formatNumber(approxSyp)} ${getCurrencySymbol()}`
                        : `${fxTitle} (${pair.pair}): ${rateFormatted}`;
                    return (
                    <div
                      key={pair.pair}
                      className={cn(
                        'relative rounded-lg border border-border bg-muted/40 pt-11 transition-all duration-300 dark:border-slate-700 dark:bg-slate-800/40 pe-4 pb-4 ps-4',
                        FOREX_PAIR_CARD_CLASS[pair.pair] ?? 'border-cyan-500/25 bg-cyan-500/10',
                        forexFlashByPair[pair.pair] === 'up' && 'border-emerald-500/40 bg-emerald-500/10',
                        forexFlashByPair[pair.pair] === 'down' && 'border-red-500/40 bg-red-500/10'
                      )}
                    >
                      {shareBase && (
                        <div className="absolute end-2 top-2">
                          <PriceShareButton
                            {...shareBase}
                            size="icon"
                            className="h-7 w-7"
                            headline={locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}
                            subheadline={fxTitle}
                            rows={[
                              { label: locale === 'ar' ? 'السعر' : 'Rate', value: rateFormatted, tone: 'neutral' },
                              ...(approxSyp != null
                                ? [
                                    {
                                      label: `≈ ${getCurrencySymbol()}`,
                                      value: formatNumber(approxSyp),
                                      tone: 'neutral' as const,
                                    },
                                  ]
                                : []),
                            ]}
                            fileNameSlug={`fx-${pair.pair.replace(/[\/\\]/g, '-')}`}
                            detailLine={shareDetail}
                          />
                        </div>
                      )}
                      <div className="mb-2 flex items-center gap-2">
                        <div className="-space-x-1 flex items-center">
                          <MarketBadge code={pair.flag1} />
                          <MarketBadge code={pair.flag2} />
                        </div>
                        <span className="min-w-0 font-bold leading-snug">{fxTitle}</span>
                        {MARKET_ESTIMATED_SIZE_UNIT[pair.pair] && (
                          <span className="rounded-full border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {locale === 'ar'
                              ? MARKET_ESTIMATED_SIZE_UNIT[pair.pair]!.ar
                              : MARKET_ESTIMATED_SIZE_UNIT[pair.pair]!.en}
                          </span>
                        )}
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
                      <p className="text-xl font-bold text-foreground dark:text-slate-100">
                        {rateFormatted}
                      </p>
                      {marketUsdPerKg(pair.pair, rateNum) != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {locale === 'ar' ? 'سعر الكيلو: ' : 'Per kg: '}
                          {formatUsd(marketUsdPerKg(pair.pair, rateNum)!, 3)} $
                        </p>
                      )}
                      {approxSyp != null && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          ≈ {formatNumber(approxSyp)} {getCurrencySymbol()}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Crypto Tab */}
            <TabsContent value="crypto" className="space-y-4">
              <div className="surface-card p-6">
                <CardTitle className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
                  <span className="text-2xl">₿</span>
                  {locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
                  {cryptoRealtime ? (
                    <span className="ms-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      {locale === 'ar' ? 'لحظي من الخادم' : 'Live (server)'}
                    </span>
                  ) : null}
                </CardTitle>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data?.cryptoRates?.map((crypto) => (
                    <div
                      key={crypto.code}
                      className={cn(
                        'relative rounded-lg border border-border bg-muted/40 pt-11 transition-all duration-300 dark:border-slate-700 dark:bg-slate-800/40 pe-4 pb-4 ps-4',
                        CRYPTO_BRAND_CARD_CLASS[crypto.code] ?? 'border-cyan-500/25 bg-cyan-500/10',
                        cryptoFlashByCode[crypto.code] === 'up' && 'border-emerald-500/40 bg-emerald-500/10',
                        cryptoFlashByCode[crypto.code] === 'down' && 'border-red-500/40 bg-red-500/10'
                      )}
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
                                value: `$${formatUsd(crypto.price, 3)}`,
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
                                ? `${crypto.code}: $${formatUsd(crypto.price, 3)} · ≈ ${formatNumber(crypto.price * getFeaturedCurrency('USD')!.buyRate)} ${getCurrencySymbol()}`
                                : `${crypto.code}: $${formatUsd(crypto.price, 3)}`
                            }
                          />
                        </div>
                      )}
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-2xl font-bold dark:border-slate-600 dark:bg-slate-800">
                            {!brokenCryptoIconByCode[crypto.code] ? (
                              <img
                                src={cryptoPngUrl(crypto.code)}
                                alt={crypto.code}
                                className="h-8 w-8 object-contain"
                                loading="lazy"
                                onError={() =>
                                  setBrokenCryptoIconByCode((prev) => ({ ...prev, [crypto.code]: true }))
                                }
                              />
                            ) : (
                              crypto.icon || '₿'
                            )}
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
                        ${formatUsd(crypto.price, 3)}
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

        {data.siteSettings.adsenseEnabled &&
        data.siteSettings.adsenseAdClient &&
        data.siteSettings.adsenseSlotContent ? (
          <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-4 sm:px-6 lg:px-8">
            <AdSenseSlot
              client={data.siteSettings.adsenseAdClient}
              slot={data.siteSettings.adsenseSlotContent}
              labelAr="إعلان"
              labelEn="Advertisement"
              locale={locale}
            />
          </div>
        ) : null}

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
        <section
          id="currency-calculator"
          className="section-bg-calculator relative mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 lg:px-8"
        >
          <div className="surface-card relative z-[1] p-6">
            <CardTitle className="mb-2 flex items-center gap-2 text-xl font-semibold text-foreground dark:text-slate-100">
              <ArrowRightLeft className="h-5 w-5" />
              {t('calculator.advancedPageTitle')}
            </CardTitle>
            <p className="mb-6 text-sm text-muted-foreground dark:text-slate-400">{t('calculator.advancedSubtitle')}</p>
            <AdvancedExchangeCalculator
              rates={data?.rates || []}
              goldPrice={data?.goldPrice ?? null}
              fuelPrices={data?.fuelPrices || []}
              forexRates={data?.forexRates || []}
              cryptoRates={data?.cryptoRates || []}
              locale={locale}
              formatNumber={formatNumber}
              getCurrencySymbol={getCurrencySymbol}
              t={t}
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="section-bg-footer relative z-10 mt-auto border-t border-border/80 bg-gradient-to-b from-muted/30 to-muted/50 py-8 text-muted-foreground dark:border-border/60 dark:from-background dark:to-muted/40">
        <div className="relative z-[1] mx-auto max-w-7xl px-4 text-sm sm:px-6 lg:px-8">
          <div
            className={cn(
              'grid justify-items-center gap-8 text-center',
              showFooterSocial
                ? 'md:grid-cols-2 lg:grid-cols-3 lg:gap-10 xl:gap-12'
                : 'md:grid-cols-2 md:gap-10 lg:gap-12'
            )}
          >
            <div className="flex min-w-0 max-w-md flex-col items-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/80 dark:text-slate-300">
                {t('footer.quickLinks')}
              </p>
              <nav className="flex flex-col items-center gap-2" aria-label={t('footer.quickLinksAria')}>
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
                <Link
                  href="/api-access"
                  className="text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {t('footer.api')}
                </Link>
                <Link
                  href="/articles"
                  className="text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {locale === 'ar' ? 'المقالات' : 'Articles'}
                </Link>
              </nav>
            </div>
            <div className="flex min-w-0 max-w-lg flex-col items-center">
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground dark:text-slate-400">
                {t('footer.siteImportance')}
              </p>
              {data.lastUpdate ? (
                <p className="mb-4 flex justify-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="text-balance">
                    <span className="font-medium text-foreground/70 dark:text-slate-300">
                      {t('footer.lastUpdatedLabel')}
                    </span>{' '}
                    {formatLastUpdateForShare(data.lastUpdate)}
                  </span>
                </p>
              ) : null}
              <nav className="flex flex-col items-center gap-2" aria-label={t('footer.helpfulNavAria')}>
                <a
                  href="#rates-panel"
                  className="text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {t('footer.jumpRates')}
                </a>
                <a
                  href="#currency-calculator"
                  className="text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {t('footer.jumpCalculator')}
                </a>
              </nav>
            </div>
            {showFooterSocial ? (
              <div className="flex min-w-0 max-w-md flex-col items-center">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/80 dark:text-slate-300">
                  {t('footer.social')}
                </p>
                <div className="flex justify-center">
                  <FooterSocialLinks
                    urls={footerSocialUrls}
                    labelFacebook={t('footer.socialFacebook')}
                    labelX={t('footer.socialX')}
                    labelTelegram={t('footer.socialTelegram')}
                    labelInstagram={t('footer.socialInstagram')}
                    labelYoutube={t('footer.socialYoutube')}
                    labelTiktok={t('footer.socialTiktok')}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-10 flex flex-col items-center gap-2 border-t border-border/60 pt-8 text-center dark:border-white/10">
            <Image
              key={getLogoUrl()}
              src={getLogoUrl()}
              alt=""
              width={120}
              height={40}
              style={{ height: getLogoSizes().footer, width: 'auto', maxHeight: getLogoSizes().footer }}
              className="rounded object-contain"
              unoptimized
            />
            <span className="text-foreground/80 dark:text-slate-300">
              {getSiteName()} © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </footer>
    </div>
      )}

      {phase === 'main' && !data && (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-sm text-muted-foreground dark:text-white/80">
            {locale === 'ar' ? 'تعذر تحميل البيانات. حاول تحديث الصفحة.' : 'Could not load data. Please refresh.'}
          </p>
        </div>
      )}
    </>
  );
}

