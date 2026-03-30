'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations, useLocale } from 'next-intl';
import { numberingLatn } from '@/lib/intl-latn';
import { DEFAULT_LOGO_SIZES, parseLogoSizes, type LogoSizes } from '@/lib/logo-sizes';
import { resolveLogoUrlForClient } from '@/lib/resolve-logo-url';
import type { SyncCategoryId, SyncConfigV1, CategorySyncConfig } from '@/lib/sync-config';
import { SYNC_CATEGORY_IDS, defaultSyncConfigV1 } from '@/lib/sync-config';
import { 
  RefreshCw, 
  Coins, 
  Settings,
  Check,
  Clock,
  Shield,
  Lock,
  LogOut,
  AlertCircle,
  Sparkles,
  Download,
  TrendingDown,
  TrendingUp,
  Palette,
  Image as ImageIcon,
  Globe,
  Paintbrush,
  Fuel,
  DollarSign,
  Gauge,
  Code,
  Share2,
} from 'lucide-react';

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
}

interface GoldPriceData {
  priceUsd: number;
  pricePerGram: number;
  lastUpdated: string;
}

interface SyncSettings {
  autoUpdateEnabled: boolean;
  updateInterval: number;
  adjustmentAmount: number;
  adjustmentType: 'deduction' | 'addition';
  lastFetchTime: string | null;
}

const SYNC_CATEGORY_LABEL: Record<SyncCategoryId, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  currencies: {
    ar: 'العملات',
    en: 'Currencies',
    hintAr: 'سعر شراء/بيع بالليرة من صفحة العملات',
    hintEn: 'Buy/sell SYP from currencies page',
  },
  gold: {
    ar: 'الذهب',
    en: 'Gold',
    hintAr: 'أونصة وغرام 24 قيراط بالدولار',
    hintEn: 'Ounce & 24K gram in USD',
  },
  fuel: {
    ar: 'المحروقات',
    en: 'Fuel',
    hintAr: 'بنزين/ديزل/غاز من صفحة الطاقة (ل.س)',
    hintEn: 'Gasoline/diesel/LPG from energy (SYP)',
  },
  crypto: {
    ar: 'العملات الرقمية',
    en: 'Cryptocurrencies',
    hintAr: 'CoinGecko (مجاني) أو احتياطي SP Today',
    hintEn: 'CoinGecko (free) or SP Today fallback',
  },
  forex: {
    ar: 'البورصات العالمية',
    en: 'Global markets',
    hintAr: 'Frankfurter/ECB (مجاني) أو احتياطي من أسعار الليرة',
    hintEn: 'Frankfurter/ECB (free) or SYP cross-rate fallback',
  },
};

interface SiteIdentity {
  siteName: string;
  siteNameAr: string;
  siteNameEn: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroSubtitleEn: string;
  /** احتياطي قديم — يُستخدم إن لم يُضبط شعار العربية أو باقي اللغات */
  logoUrl: string | null;
  logoUrlAr: string | null;
  logoUrlNonAr: string | null;
  logoSizes: LogoSizes;
  /** مدة دورة شريط الأسعار فوق الترويسة (ثوانٍ؛ أقل = حركة أسرع) */
  tickerMarqueeDurationSec: number;
  footerSocialFacebook: string;
  footerSocialX: string;
  footerSocialTelegram: string;
  footerSocialInstagram: string;
  footerSocialYoutube: string;
}

interface VisualIdentity {
  lightPrimaryColor: string;
  lightAccentColor: string;
  lightBgColor: string;
  darkPrimaryColor: string;
  darkAccentColor: string;
  darkBgColor: string;
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

interface ApiAccessRequestRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  websiteName: string;
  websiteUrl: string;
  usagePurpose: string;
  programmingType: string;
  receiptImageUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
}

interface ApiAllowedDomainRow {
  id: string;
  domain: string;
  enabled: boolean;
  expiresAt: string | null;
  requestId: string | null;
  note: string | null;
  request: {
    id: string;
    fullName: string;
    email: string;
    websiteUrl: string;
  } | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isNewLira, setIsNewLira] = useState(false);
  const [activeTab, setActiveTab] = useState('rates');
  
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [goldPrice, setGoldPrice] = useState<GoldPriceData | null>(null);
  const [editingRates, setEditingRates] = useState<Record<string, { buyRate: string; sellRate: string }>>({});
  const [goldInput, setGoldInput] = useState({ priceUsd: '', pricePerGram: '' });
  const [refreshing, setRefreshing] = useState(false);
  
  // Sync Settings
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    autoUpdateEnabled: true,
    updateInterval: 6,
    adjustmentAmount: 250,
    adjustmentType: 'deduction',
    lastFetchTime: null
  });
  
  // Site Identity
  const [siteIdentity, setSiteIdentity] = useState<SiteIdentity>({
    siteName: 'سعر الليرة السورية',
    siteNameAr: 'سعر الليرة السورية',
    siteNameEn: 'Syrian Pound Exchange Rate',
    heroSubtitle: 'أسعار الصرف الحية',
    heroSubtitleAr: 'أسعار الصرف الحية',
    heroSubtitleEn: 'Live Exchange Rates',
    logoUrl: null,
    logoUrlAr: null,
    logoUrlNonAr: null,
    logoSizes: { ...DEFAULT_LOGO_SIZES },
    tickerMarqueeDurationSec: 42,
    footerSocialFacebook: '',
    footerSocialX: '',
    footerSocialTelegram: '',
    footerSocialInstagram: '',
    footerSocialYoutube: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Visual Identity
  const [visualIdentity, setVisualIdentity] = useState<VisualIdentity>({
    lightPrimaryColor: '#0ea5e9',
    lightAccentColor: '#0284c7',
    lightBgColor: '#ffffff',
    darkPrimaryColor: '#0ea5e9',
    darkAccentColor: '#38bdf8',
    darkBgColor: '#0f172a'
  });
  
  const [isFetching, setIsFetching] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [fullSync, setFullSync] = useState<SyncConfigV1 | null>(null);
  
  // Fuel, Forex, Crypto States
  const [fuelPrices, setFuelPrices] = useState<FuelPriceData[]>([]);
  const [forexRates, setForexRates] = useState<ForexRateData[]>([]);
  const [cryptoRates, setCryptoRates] = useState<CryptoRateData[]>([]);
  const [editingFuel, setEditingFuel] = useState<Record<string, string>>({});
  const [editingForex, setEditingForex] = useState<Record<string, { rate: string; change: string }>>({});
  const [editingCrypto, setEditingCrypto] = useState<Record<string, { price: string; change: string }>>({});
  
  const [apiAccessLoading, setApiAccessLoading] = useState(false);
  const [apiRequests, setApiRequests] = useState<ApiAccessRequestRow[]>([]);
  const [apiDomains, setApiDomains] = useState<ApiAllowedDomainRow[]>([]);
  const [platformApiUsdtTrc20, setPlatformApiUsdtTrc20] = useState('');
  const [platformApiSubscriptionPriceUsd, setPlatformApiSubscriptionPriceUsd] = useState('50');
  const [platformApiSubscriptionDays, setPlatformApiSubscriptionDays] = useState('365');
  const [savingUsdtWallet, setSavingUsdtWallet] = useState(false);
  const [newManualDomain, setNewManualDomain] = useState('');
  const [approveDomainDraft, setApproveDomainDraft] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const t = useTranslations();
  const locale = useLocale();

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth');
      const result = await response.json();
      setIsAuthenticated(result.authenticated);
      if (result.authenticated) {
        fetchData();
        loadSettings();
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (activeTab !== 'api' || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setApiAccessLoading(true);
      try {
        const r = await fetch('/api/admin/api-access');
        const j = await r.json();
        if (!cancelled && j.success) {
          setApiRequests(j.requests as ApiAccessRequestRow[]);
          setApiDomains(j.domains as ApiAllowedDomainRow[]);
        }
      } finally {
        if (!cancelled) setApiAccessLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthenticated]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const result = await response.json();
      if (result.success) {
        setSyncSettings({
          autoUpdateEnabled: result.settings.autoUpdateEnabled,
          updateInterval: result.settings.updateInterval,
          adjustmentAmount: result.settings.adjustmentAmount,
          adjustmentType: result.settings.adjustmentType,
          lastFetchTime: result.settings.lastFetchTime
        });
        if (result.settings.syncConfig) {
          setFullSync(result.settings.syncConfig as SyncConfigV1);
        }
        setSiteIdentity({
          siteName: result.settings.siteName,
          siteNameAr: result.settings.siteNameAr || result.settings.siteName,
          siteNameEn: result.settings.siteNameEn || 'Syrian Pound Exchange Rate',
          heroSubtitle: result.settings.heroSubtitle || 'أسعار الصرف الحية',
          heroSubtitleAr: result.settings.heroSubtitleAr || 'أسعار الصرف الحية',
          heroSubtitleEn: result.settings.heroSubtitleEn || 'Live Exchange Rates',
          logoUrl: result.settings.logoUrl ?? null,
          logoUrlAr: result.settings.logoUrlAr ?? null,
          logoUrlNonAr: result.settings.logoUrlNonAr ?? null,
          logoSizes: parseLogoSizes(result.settings.logoSizes),
          tickerMarqueeDurationSec: Math.min(
            180,
            Math.max(8, Number(result.settings.tickerMarqueeDurationSec) || 42)
          ),
          footerSocialFacebook: result.settings.footerSocialFacebook ?? '',
          footerSocialX: result.settings.footerSocialX ?? '',
          footerSocialTelegram: result.settings.footerSocialTelegram ?? '',
          footerSocialInstagram: result.settings.footerSocialInstagram ?? '',
          footerSocialYoutube: result.settings.footerSocialYoutube ?? '',
        });
        setVisualIdentity({
          lightPrimaryColor: result.settings.lightPrimaryColor || '#0ea5e9',
          lightAccentColor: result.settings.lightAccentColor || '#0284c7',
          lightBgColor: result.settings.lightBgColor || '#ffffff',
          darkPrimaryColor: result.settings.darkPrimaryColor || '#0ea5e9',
          darkAccentColor: result.settings.darkAccentColor || '#38bdf8',
          darkBgColor: result.settings.darkBgColor || '#0f172a'
        });
        setPlatformApiUsdtTrc20(result.settings.platformApiUsdtTrc20 ?? '');
        const p = result.settings.platformApiSubscriptionPriceUsd;
        setPlatformApiSubscriptionPriceUsd(
          p !== undefined && p !== null && Number.isFinite(Number(p)) ? String(p) : '50'
        );
        const d = result.settings.platformApiSubscriptionDays;
        setPlatformApiSubscriptionDays(
          d !== undefined && d !== null && Number.isFinite(Number(d)) ? String(Math.round(Number(d))) : '365'
        );
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetch('/api/rates');
      const result = await response.json();
      if (result.success) {
        setRates(result.data.rates);
        setGoldPrice(result.data.goldPrice);
        
        const editRates: Record<string, { buyRate: string; sellRate: string }> = {};
        result.data.rates.forEach((rate: CurrencyRate) => {
          editRates[rate.id] = {
            buyRate: rate.buyRate.toString(),
            sellRate: rate.sellRate.toString()
          };
        });
        setEditingRates(editRates);
        
        if (result.data.goldPrice) {
          setGoldInput({
            priceUsd: result.data.goldPrice.priceUsd.toString(),
            pricePerGram: result.data.goldPrice.pricePerGram.toString()
          });
        }
      }
      
      // Fetch fuel prices
      const fuelResponse = await fetch('/api/fuel');
      const fuelResult = await fuelResponse.json();
      if (fuelResult.success) {
        setFuelPrices(fuelResult.data);
        const editFuel: Record<string, string> = {};
        fuelResult.data.forEach((fuel: FuelPriceData) => {
          editFuel[fuel.code] = fuel.price.toString();
        });
        setEditingFuel(editFuel);
      }
      
      // Fetch forex rates
      const forexResponse = await fetch('/api/forex');
      const forexResult = await forexResponse.json();
      if (forexResult.success) {
        setForexRates(forexResult.data);
        const editForex: Record<string, { rate: string; change: string }> = {};
        forexResult.data.forEach((forex: ForexRateData) => {
          editForex[forex.pair] = {
            rate: forex.rate.toString(),
            change: forex.change.toString()
          };
        });
        setEditingForex(editForex);
      }
      
      // Fetch crypto rates
      const cryptoResponse = await fetch('/api/crypto');
      const cryptoResult = await cryptoResponse.json();
      if (cryptoResult.success) {
        setCryptoRates(cryptoResult.data);
        const editCrypto: Record<string, { price: string; change: string }> = {};
        cryptoResult.data.forEach((crypto: CryptoRateData) => {
          editCrypto[crypto.code] = {
            price: crypto.price.toString(),
            change: crypto.change.toString()
          };
        });
        setEditingCrypto(editCrypto);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (result.success) {
        setIsAuthenticated(true);
        fetchData();
        loadSettings();
        toast({
          title: locale === 'ar' ? 'تم تسجيل الدخول' : 'Logged in',
          description: locale === 'ar' ? 'مرحباً بك في لوحة التحكم' : 'Welcome to admin panel'
        });
      } else {
        setLoginError(result.message || (locale === 'ar' ? 'فشل في تسجيل الدخول' : 'Login failed'));
      }
    } catch {
      setLoginError(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      setIsAuthenticated(false);
      setUsername('');
      setPassword('');
      toast({
        title: locale === 'ar' ? 'تم تسجيل الخروج' : 'Logged out',
        description: locale === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Successfully logged out'
      });
    } catch {
      // ignore
    }
  };

  const refreshApiAccessPanel = async () => {
    setApiAccessLoading(true);
    try {
      const r = await fetch('/api/admin/api-access');
      const j = await r.json();
      if (j.success) {
        setApiRequests(j.requests as ApiAccessRequestRow[]);
        setApiDomains(j.domains as ApiAllowedDomainRow[]);
      }
    } finally {
      setApiAccessLoading(false);
    }
  };

  const handleSaveUsdtWallet = async () => {
    setSavingUsdtWallet(true);
    try {
      const priceNum = parseFloat(platformApiSubscriptionPriceUsd.replace(',', '.'));
      const daysNum = parseInt(platformApiSubscriptionDays, 10);
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformApiUsdtTrc20: platformApiUsdtTrc20.trim() === '' ? null : platformApiUsdtTrc20.trim(),
          platformApiSubscriptionPriceUsd: Number.isFinite(priceNum) ? priceNum : 50,
          platformApiSubscriptionDays: Number.isFinite(daysNum) ? daysNum : 365,
        }),
      });
      const j = await r.json();
      if (j.success) {
        toast({
          title: locale === 'ar' ? 'تم حفظ إعدادات API' : 'API settings saved',
        });
      } else {
        toast({
          variant: 'destructive',
          title: locale === 'ar' ? 'فشل الحفظ' : 'Save failed',
          description: j.error || j.details,
        });
      }
    } finally {
      setSavingUsdtWallet(false);
    }
  };

  const handleApproveApiRequest = async (requestId: string) => {
    const domain = (approveDomainDraft[requestId] ?? '').trim();
    try {
      const r = await fetch('/api/admin/api-access/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          requestId,
          ...(domain ? { domain } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast({
          variant: 'destructive',
          title: locale === 'ar' ? 'فشلت الموافقة' : 'Approve failed',
          description: j.error,
        });
        return;
      }
      toast({ title: locale === 'ar' ? 'تمت الموافقة والنطاق' : 'Approved & domain updated' });
      await refreshApiAccessPanel();
    } catch {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'خطأ' : 'Error' });
    }
  };

  const handleRejectApiRequest = async (requestId: string) => {
    try {
      const r = await fetch('/api/admin/api-access/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', requestId }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast({
          variant: 'destructive',
          title: locale === 'ar' ? 'فشل الرفض' : 'Reject failed',
          description: j.error,
        });
        return;
      }
      toast({ title: locale === 'ar' ? 'تم رفض الطلب' : 'Request rejected' });
      await refreshApiAccessPanel();
    } catch {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'خطأ' : 'Error' });
    }
  };

  const handleToggleApiDomain = async (id: string, enabled: boolean) => {
    try {
      const r = await fetch(`/api/admin/api-access/domains/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast({ variant: 'destructive', title: locale === 'ar' ? 'فشل التحديث' : 'Update failed' });
        return;
      }
      await refreshApiAccessPanel();
    } catch {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'خطأ' : 'Error' });
    }
  };

  const handleDeleteApiDomain = async (id: string) => {
    if (!confirm(locale === 'ar' ? 'حذف هذا النطاق من القائمة؟' : 'Remove this domain from the list?')) return;
    try {
      const r = await fetch(`/api/admin/api-access/domains/${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast({ variant: 'destructive', title: locale === 'ar' ? 'فشل الحذف' : 'Delete failed' });
        return;
      }
      await refreshApiAccessPanel();
    } catch {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'خطأ' : 'Error' });
    }
  };

  const handleAddManualDomain = async () => {
    const d = newManualDomain.trim();
    if (!d) return;
    try {
      const r = await fetch('/api/admin/api-access/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast({
          variant: 'destructive',
          title: locale === 'ar' ? 'فشل الإضافة' : 'Add failed',
          description: j.error,
        });
        return;
      }
      setNewManualDomain('');
      toast({ title: locale === 'ar' ? 'تمت إضافة النطاق' : 'Domain added' });
      await refreshApiAccessPanel();
    } catch {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'خطأ' : 'Error' });
    }
  };

  const handleUpdateRate = async (currencyId: string) => {
    const editRate = editingRates[currencyId];
    if (!editRate) return;

    try {
      const response = await fetch('/api/admin/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyId,
          buyRate: editRate.buyRate,
          sellRate: editRate.sellRate
        })
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          description: locale === 'ar' ? 'تم تحديث السعر بنجاح' : 'Rate updated successfully'
        });
        fetchData();
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في تحديث السعر' : 'Failed to update rate',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateGold = async () => {
    try {
      const response = await fetch('/api/admin/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goldInput)
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          description: locale === 'ar' ? 'تم تحديث سعر الذهب بنجاح' : 'Gold price updated successfully'
        });
        fetchData();
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في تحديث سعر الذهب' : 'Failed to update gold price',
        variant: 'destructive'
      });
    }
  };

  const handleRefreshGold = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/gold', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          description: locale === 'ar' 
            ? `تم تحديث سعر الذهب من ${result.data.source}`
            : `Gold price updated from ${result.data.source}`
        });
        fetchData();
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في تحديث سعر الذهب' : 'Failed to update gold price',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Update fuel price
  const handleUpdateFuel = async (code: string) => {
    const price = editingFuel[code];
    if (!price) return;

    try {
      const response = await fetch('/api/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, price: parseFloat(price) })
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          description: locale === 'ar' ? 'تم تحديث سعر المحروق بنجاح' : 'Fuel price updated successfully'
        });
        fetchData();
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في تحديث سعر المحروق' : 'Failed to update fuel price',
        variant: 'destructive'
      });
    }
  };

  // Update forex rate
  const handleUpdateForex = async (pair: string) => {
    const data = editingForex[pair];
    if (!data) return;

    try {
      const response = await fetch('/api/forex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair, rate: parseFloat(data.rate), change: parseFloat(data.change) })
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          description: locale === 'ar' ? 'تم تحديث السعر بنجاح' : 'Rate updated successfully'
        });
        fetchData();
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في تحديث السعر' : 'Failed to update rate',
        variant: 'destructive'
      });
    }
  };

  // Update crypto rate
  const handleUpdateCrypto = async (code: string) => {
    const data = editingCrypto[code];
    if (!data) return;

    try {
      const response = await fetch('/api/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, price: parseFloat(data.price), change: parseFloat(data.change) })
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          description: locale === 'ar' ? 'تم تحديث سعر العملة الرقمية بنجاح' : 'Crypto rate updated successfully'
        });
        fetchData();
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في تحديث سعر العملة الرقمية' : 'Failed to update crypto rate',
        variant: 'destructive'
      });
    }
  };

  const patchSyncCategory = (id: SyncCategoryId, patch: Partial<CategorySyncConfig>) => {
    setFullSync((prev) => {
      const base =
        prev ??
        defaultSyncConfigV1({
          updateIntervalHours: syncSettings.updateInterval,
          adjustmentAmount: syncSettings.adjustmentAmount,
          adjustmentType: syncSettings.adjustmentType,
        });
      return {
        ...base,
        categories: {
          ...base.categories,
          [id]: { ...base.categories[id], ...patch },
        },
      };
    });
  };

  const resolvedSyncConfig = (): SyncConfigV1 =>
    fullSync ??
    defaultSyncConfigV1({
      updateIntervalHours: syncSettings.updateInterval,
      adjustmentAmount: syncSettings.adjustmentAmount,
      adjustmentType: syncSettings.adjustmentType,
    });

  // Fetch rates from SP Today
  const handleFetchFromSPToday = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/fetch-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({
          title: locale === 'ar' ? 'خطأ' : 'Error',
          description:
            (result.error as string) ||
            (locale === 'ar'
              ? `فشل الطلب (${response.status})`
              : `Request failed (${response.status})`),
          variant: 'destructive',
        });
        return;
      }

      if (result.success) {
        const res = result.results as Record<string, { ok?: boolean; updated?: number; message?: string }> | undefined;
        const summary =
          res &&
          Object.entries(res)
            .filter(([, r]) => r?.ok)
            .map(([k, r]) => `${k}: ${r.updated ?? 0}`)
            .join(' · ');
        toast({
          title: locale === 'ar' ? 'تم الجلب' : 'Fetched',
          description:
            summary ||
            (locale === 'ar' ? 'اكتملت المزامنة' : 'Sync completed'),
        });
        fetchData();
        loadSettings();
      } else {
        toast({
          title: locale === 'ar' ? 'خطأ' : 'Error',
          description:
            (result.error as string) ||
            (result.message as string) ||
            (locale === 'ar' ? 'فشلت المزامنة أو كل الفئات فشلت' : 'Sync failed or all categories failed'),
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في الاتصال بـ SP Today' : 'Failed to connect to SP Today',
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Update sync settings
  const handleUpdateSyncSettings = async () => {
    setSavingSettings(true);
    try {
      const cfg = resolvedSyncConfig();
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoUpdateEnabled: syncSettings.autoUpdateEnabled,
          syncConfig: { categories: cfg.categories },
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
          description: locale === 'ar' ? 'تم حفظ إعدادات المزامنة بنجاح' : 'Sync settings saved successfully'
        });
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في حفظ الإعدادات' : 'Failed to save settings',
        variant: 'destructive'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoFile = async (file: File | null, target: 'ar' | 'nonAr') => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('variant', target === 'ar' ? 'ar' : 'nonAr');
      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      let result: { success?: boolean; url?: string; error?: string } = {};
      try {
        result = await response.json();
      } catch {
        toast({
          title: locale === 'ar' ? 'فشل الرفع' : 'Upload failed',
          description: locale === 'ar' ? 'استجابة غير صالحة من الخادم' : 'Invalid server response',
          variant: 'destructive',
        });
        return;
      }
      if (!response.ok || !result.success || !result.url) {
        toast({
          title: locale === 'ar' ? 'فشل الرفع' : 'Upload failed',
          description:
            result.error ||
            (locale === 'ar'
              ? `خطأ ${response.status}: تأكد من تسجيل الدخول وصيغة الصورة`
              : `Error ${response.status}. Stay logged in; use PNG/JPG/WebP/GIF/SVG.`),
          variant: 'destructive',
        });
        return;
      }

      const sizesToSave = siteIdentity.logoSizes;
      const patch =
        target === 'ar'
          ? { logoUrlAr: result.url!, logoSizes: sizesToSave }
          : { logoUrlNonAr: result.url!, logoSizes: sizesToSave };
      setSiteIdentity((prev) =>
        target === 'ar'
          ? { ...prev, logoUrlAr: result.url! }
          : { ...prev, logoUrlNonAr: result.url! }
      );

      const saveRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        credentials: 'include',
      });
      const saveJson = (await saveRes.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        details?: string;
      };

      if (!saveRes.ok || !saveJson.success) {
        const hint = [saveJson.details, saveJson.error].filter(Boolean).join(' — ');
        toast({
          title: locale === 'ar' ? 'تم الرفع' : 'Uploaded',
          description:
            hint ||
            (locale === 'ar'
              ? 'الملف على الخادم، لكن فشل حفظ الرابط في قاعدة البيانات. اضغط «حفظ هوية الموقع».'
              : 'File saved on server, but DB update failed. Click «Save Site Identity».'),
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: locale === 'ar' ? 'تم' : 'Done',
        description:
          locale === 'ar'
            ? 'تم رفع الشعار وحفظه. حدّث الصفحة الرئيسية إن لزم.'
            : 'Logo uploaded and saved. Refresh the homepage if needed.',
      });
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل رفع الشعار' : 'Logo upload failed',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Update site identity
  const handleUpdateSiteIdentity = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteIdentity),
        credentials: 'include',
      });

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        details?: string;
      };
      if (!response.ok || !result.success) {
        const hint = [result.details, result.error].filter(Boolean).join(' — ');
        toast({
          title: locale === 'ar' ? 'فشل الحفظ' : 'Save failed',
          description:
            hint ||
            (locale === 'ar' ? `خطأ ${response.status}` : `Error ${response.status}`),
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
        description: locale === 'ar' ? 'تم حفظ هوية الموقع بنجاح' : 'Site identity saved successfully',
      });
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في حفظ هوية الموقع' : 'Failed to save site identity',
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Update visual identity
  const handleUpdateVisualIdentity = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visualIdentity)
      });
      
      const result = await response.json();
      if (result.success) {
        toast({
          title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
          description: locale === 'ar' ? 'تم حفظ الهوية البصرية بنجاح' : 'Visual identity saved successfully'
        });
        // Apply colors to CSS variables
        applyColors(visualIdentity);
      }
    } catch {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل في حفظ الهوية البصرية' : 'Failed to save visual identity',
        variant: 'destructive'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Apply colors to CSS variables
  const applyColors = (colors: VisualIdentity) => {
    const root = document.documentElement;
    const isDark = document.documentElement.classList.contains('dark');
    
    if (isDark) {
      root.style.setProperty('--primary', colors.darkPrimaryColor);
      root.style.setProperty('--accent', colors.darkAccentColor);
    } else {
      root.style.setProperty('--primary', colors.lightPrimaryColor);
      root.style.setProperty('--accent', colors.lightAccentColor);
    }
  };

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

  const formatNumber = (num: number) => {
    const displayNum = isNewLira ? num / 100 : num;
    const localeStr = locale === 'ar' ? 'ar-SY' : locale === 'de' ? 'de-DE' : locale === 'sv' ? 'sv-SE' : locale === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(localeStr, { ...numberingLatn }).format(displayNum);
  };

  const getCurrencyName = (currency: CurrencyRate) => {
    if (locale === 'ar') return currency.nameAr;
    return currency.nameEn || currency.nameAr;
  };

  const isRtl = locale === 'ar';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5 p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <Card className="w-full max-w-md bg-card/50 border-border backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('admin.title')}</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">{t('site.title')}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {loginError}
                </div>
              )}
              
              <div>
                <Label htmlFor="username">{t('admin.username')}</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('admin.usernamePlaceholder')}
                  className="mt-1"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password">{t('admin.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('admin.passwordPlaceholder')}
                  className="mt-1"
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 ml-1" />
                )}
                {t('admin.loginButton')}
              </Button>
            </form>
            
            <div className="mt-6 pt-4 border-t text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="text-muted-foreground"
              >
                {t('admin.backToHome')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,oklch(0.55_0.14_245/0.08),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,oklch(0.72_0.12_72/0.12),transparent_50%)]"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Settings className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t('admin.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('admin.description')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* New Lira Toggle */}
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                <Sparkles className={`w-4 h-4 ${isNewLira ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium hidden sm:inline">
                  {locale === 'ar' ? 'الليرة الجديدة' : 'New Lira'}
                </span>
                <Switch
                  checked={isNewLira}
                  onCheckedChange={setIsNewLira}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              
              <LanguageSwitcher />
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/')}
              >
                {locale === 'ar' ? 'الصفحة الرئيسية' : 'Home'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 ml-1" />
                {t('admin.logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* New Lira Banner */}
        {isNewLira && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
            <p className="text-amber-600 dark:text-amber-400 font-medium flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              {locale === 'ar' 
                ? 'أسعار الليرة السورية الجديدة (تم حذف صفرين)' 
                : 'New Syrian Pound prices (2 zeros removed)'}
            </p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex w-full flex-wrap gap-1">
            <TabsTrigger value="rates" className="flex items-center gap-1">
              <Coins className="w-4 h-4" />
              <span className="hidden lg:inline">{locale === 'ar' ? 'الصرف' : 'Rates'}</span>
            </TabsTrigger>
            <TabsTrigger value="fuel" className="flex items-center gap-1">
              <Fuel className="w-4 h-4" />
              <span className="hidden lg:inline">{locale === 'ar' ? 'المحروقات' : 'Fuel'}</span>
            </TabsTrigger>
            <TabsTrigger value="forex" className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              <span className="hidden lg:inline">{locale === 'ar' ? 'البورصات العالمية' : 'Global markets'}</span>
            </TabsTrigger>
            <TabsTrigger value="crypto" className="flex items-center gap-1">
              <span className="text-sm">₿</span>
              <span className="hidden lg:inline">{locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}</span>
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">{locale === 'ar' ? 'مزامنة' : 'Sync'}</span>
            </TabsTrigger>
            <TabsTrigger value="identity" className="flex items-center gap-1">
              <Globe className="w-4 h-4" />
              <span className="hidden lg:inline">{locale === 'ar' ? 'الهوية' : 'Identity'}</span>
            </TabsTrigger>
            <TabsTrigger value="visual" className="flex items-center gap-1">
              <Palette className="w-4 h-4" />
              <span className="hidden lg:inline">{locale === 'ar' ? 'الألوان' : 'Colors'}</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-1">
              <Code className="w-4 h-4" />
              <span className="hidden lg:inline">API</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Exchange Rates */}
          <TabsContent value="rates" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Gold Price Management */}
              <Card className="bg-card/50 border-border backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🥇</span>
                    {t('admin.goldManagement')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                    <p className="text-primary text-sm">{t('admin.currentPrice')}</p>
                    <p className="text-2xl font-bold">
                      ${goldPrice ? goldPrice.priceUsd.toFixed(2) : '---'}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('admin.perOunce')}</p>
                  </div>
                  
                  <Button 
                    onClick={handleRefreshGold}
                    disabled={refreshing}
                    className="w-full"
                  >
                    {refreshing ? (
                      <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 ml-1" />
                    )}
                    {t('admin.autoUpdate')}
                  </Button>
                  
                  <Separator />
                  
                  <p className="text-sm text-muted-foreground text-center">{t('admin.orManual')}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('admin.ouncePriceUsd')}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={goldInput.priceUsd}
                        onChange={(e) => setGoldInput({...goldInput, priceUsd: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{t('admin.gramPriceUsd')}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={goldInput.pricePerGram}
                        onChange={(e) => setGoldInput({...goldInput, pricePerGram: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={handleUpdateGold} className="w-full bg-green-600 hover:bg-green-700">
                    <Check className="w-4 h-4 ml-1" />
                    {t('admin.saveGold')}
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-card/50 border-border backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary" />
                    {t('admin.stats')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-muted-foreground text-sm">{t('admin.currencyCount')}</p>
                      <p className="text-3xl font-bold">{rates.length}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-muted-foreground text-sm">{t('admin.usdRate')}</p>
                      <p className="text-xl font-bold text-green-500">
                        {rates.find(r => r.code === 'USD')?.buyRate ? formatNumber(rates.find(r => r.code === 'USD')!.buyRate) : '---'}
                        <span className="text-xs text-muted-foreground ml-1">
                          {isNewLira ? (locale === 'ar' ? 'ل.ج' : 'NSP') : ''}
                        </span>
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-muted-foreground text-sm">{t('admin.eurRate')}</p>
                      <p className="text-xl font-bold text-green-500">
                        {rates.find(r => r.code === 'EUR')?.buyRate ? formatNumber(rates.find(r => r.code === 'EUR')!.buyRate) : '---'}
                        <span className="text-xs text-muted-foreground ml-1">
                          {isNewLira ? (locale === 'ar' ? 'ل.ج' : 'NSP') : ''}
                        </span>
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-muted-foreground text-sm">{t('admin.tryRate')}</p>
                      <p className="text-xl font-bold text-green-500">
                        {rates.find(r => r.code === 'TRY')?.buyRate ? formatNumber(rates.find(r => r.code === 'TRY')!.buyRate) : '---'}
                        <span className="text-xs text-muted-foreground ml-1">
                          {isNewLira ? (locale === 'ar' ? 'ل.ج' : 'NSP') : ''}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Currency Rates Management */}
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">💱</span>
                  {t('admin.exchangeManagement')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {rates.map((currency, index) => (
                    <div
                      key={`cur-${index}-${currency.id ?? currency.code}`}
                      className="bg-muted/50 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{currency.flagEmoji}</span>
                        <div>
                          <p className="font-bold">{getCurrencyName(currency)}</p>
                          <p className="text-sm text-muted-foreground">{currency.code} {currency.symbol}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-green-500 text-xs">{t('currency.buyRate')}</Label>
                          <Input
                            type="number"
                            value={editingRates[currency.id]?.buyRate || '0'}
                            onChange={(e) => setEditingRates({
                              ...editingRates,
                              [currency.id]: {
                                ...editingRates[currency.id],
                                buyRate: e.target.value
                              }
                            })}
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-red-500 text-xs">{t('currency.sellRate')}</Label>
                          <Input
                            type="number"
                            value={editingRates[currency.id]?.sellRate || '0'}
                            onChange={(e) => setEditingRates({
                              ...editingRates,
                              [currency.id]: {
                                ...editingRates[currency.id],
                                sellRate: e.target.value
                              }
                            })}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => handleUpdateRate(currency.id)}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 ml-1" />
                        {t('admin.save')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Fuel Prices */}
          <TabsContent value="fuel" className="space-y-6">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-primary" />
                  {locale === 'ar' ? 'أسعار المحروقات' : 'Fuel Prices'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {fuelPrices.map((fuel, index) => (
                    <div
                      key={`fuel-${index}-${fuel.id ?? fuel.code}`}
                      className="bg-muted/50 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">⛽</span>
                        <div>
                          <p className="font-bold">{locale === 'ar' ? fuel.nameAr : fuel.nameEn}</p>
                          <p className="text-sm text-muted-foreground">{fuel.code} • {locale === 'ar' ? fuel.unitAr : fuel.unitEn}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-primary text-xs">
                          {locale === 'ar' ? 'السعر (ل.س)' : 'Price (SYP)'}
                        </Label>
                        <Input
                          type="number"
                          value={editingFuel[fuel.code] || '0'}
                          onChange={(e) => setEditingFuel({
                            ...editingFuel,
                            [fuel.code]: e.target.value
                          })}
                          className="mt-1 h-9"
                        />
                      </div>
                      
                      <Button 
                        onClick={() => handleUpdateFuel(fuel.code)}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 ml-1" />
                        {t('admin.save')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Forex Rates */}
          <TabsContent value="forex" className="space-y-6">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  {locale === 'ar' ? 'البورصات العالمية' : 'Global market rates'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {forexRates.map((forex, index) => (
                    <div
                      key={`fx-${index}-${forex.id ?? forex.pair}`}
                      className="bg-muted/50 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1">
                          <img 
                            src={`https://flagcdn.com/w40/${forex.flag1}.png`} 
                            alt={forex.flag1}
                            className="w-5 h-3.5 object-cover rounded-sm border border-background shadow-sm"
                          />
                          <img 
                            src={`https://flagcdn.com/w40/${forex.flag2}.png`} 
                            alt={forex.flag2}
                            className="w-5 h-3.5 object-cover rounded-sm border border-background shadow-sm"
                          />
                        </div>
                        <span className="font-bold">{forex.pair}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{locale === 'ar' ? 'السعر' : 'Rate'}</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={editingForex[forex.pair]?.rate || '0'}
                            onChange={(e) => setEditingForex({
                              ...editingForex,
                              [forex.pair]: {
                                ...editingForex[forex.pair],
                                rate: e.target.value
                              }
                            })}
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{locale === 'ar' ? 'التغير %' : 'Change %'}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingForex[forex.pair]?.change || '0'}
                            onChange={(e) => setEditingForex({
                              ...editingForex,
                              [forex.pair]: {
                                ...editingForex[forex.pair],
                                change: e.target.value
                              }
                            })}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => handleUpdateForex(forex.pair)}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 ml-1" />
                        {t('admin.save')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Crypto Rates */}
          <TabsContent value="crypto" className="space-y-6">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">₿</span>
                  {locale === 'ar' ? 'العملات الرقمية' : 'Cryptocurrencies'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {cryptoRates.map((crypto, index) => (
                    <div
                      key={`cr-${index}-${crypto.id ?? crypto.code}`}
                      className="bg-muted/50 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl w-10 h-10 flex items-center justify-center bg-primary/10 rounded-xl">{crypto.icon || '₿'}</span>
                        <div>
                          <p className="font-bold">{crypto.code}</p>
                          <p className="text-sm text-muted-foreground">{locale === 'ar' ? crypto.nameAr : crypto.nameEn}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{locale === 'ar' ? 'السعر ($)' : 'Price ($)'}</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={editingCrypto[crypto.code]?.price || '0'}
                            onChange={(e) => setEditingCrypto({
                              ...editingCrypto,
                              [crypto.code]: {
                                ...editingCrypto[crypto.code],
                                price: e.target.value
                              }
                            })}
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{locale === 'ar' ? 'التغير %' : 'Change %'}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingCrypto[crypto.code]?.change || '0'}
                            onChange={(e) => setEditingCrypto({
                              ...editingCrypto,
                              [crypto.code]: {
                                ...editingCrypto[crypto.code],
                                change: e.target.value
                              }
                            })}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => handleUpdateCrypto(crypto.code)}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 ml-1" />
                        {t('admin.save')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: SP Today Sync */}
          <TabsContent value="sync" className="space-y-6">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-primary" />
                  {locale === 'ar' ? 'مزامنة الأسعار مع SP Today' : 'Sync Rates from SP Today'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {syncSettings.lastFetchTime && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm">
                      {locale === 'ar' ? 'آخر مزامنة عامة:' : 'Last full sync:'}{' '}
                      {formatTime(syncSettings.lastFetchTime)}
                    </span>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'التحديث التلقائي (جدولة cron)' : 'Auto update (cron)'}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {locale === 'ar'
                        ? 'عند التفعيل، يُنفَّذ الجلب حسب فترة كل فئة على حدة'
                        : 'When on, each category syncs on its own interval'}
                    </p>
                  </div>
                  <Switch
                    checked={syncSettings.autoUpdateEnabled}
                    onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, autoUpdateEnabled: checked })}
                  />
                </div>

                <div className="space-y-3">
                  {SYNC_CATEGORY_IDS.map((id, syncIndex) => {
                    const cat = resolvedSyncConfig().categories[id];
                    const label = SYNC_CATEGORY_LABEL[id];
                    const last = resolvedSyncConfig().lastFetchedAt[id];
                    return (
                      <div
                        key={`sync-cat-${id}-${syncIndex}`}
                        className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={cat.enabled}
                                onCheckedChange={(checked) => patchSyncCategory(id, { enabled: checked })}
                              />
                              <span className="font-medium">
                                {locale === 'ar' ? label.ar : label.en}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ms-1">
                              {locale === 'ar' ? label.hintAr : label.hintEn}
                            </p>
                            {last && (
                              <p className="text-xs text-muted-foreground mt-1 ms-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {locale === 'ar' ? 'آخر جلب لهذه الفئة:' : 'Last fetch:'}{' '}
                                {formatTime(last)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <Label className="text-xs">
                              {locale === 'ar' ? 'كل كم ساعة؟' : 'Every (hours)'}
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={168}
                              className="mt-1 h-9"
                              value={Math.max(1, Math.round(cat.intervalMinutes / 60))}
                              onChange={(e) => {
                                const h = parseInt(e.target.value, 10) || 1;
                                patchSyncCategory(id, { intervalMinutes: h * 60 });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">
                              {locale === 'ar' ? 'نوع التعديل' : 'Adjustment'}
                            </Label>
                            <select
                              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              value={cat.adjustmentMode}
                              onChange={(e) =>
                                patchSyncCategory(id, {
                                  adjustmentMode: e.target.value as 'fixed' | 'percent',
                                })
                              }
                            >
                              <option value="fixed">
                                {locale === 'ar' ? 'رقم ثابت' : 'Fixed amount'}
                              </option>
                              <option value="percent">
                                {locale === 'ar' ? 'نسبة مئوية %' : 'Percent %'}
                              </option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">
                              {cat.adjustmentMode === 'percent'
                                ? locale === 'ar'
                                  ? 'النسبة %'
                                  : 'Percent'
                                : id === 'gold' || id === 'crypto'
                                  ? locale === 'ar'
                                    ? 'القيمة (دولار)'
                                    : 'Amount (USD)'
                                  : locale === 'ar'
                                    ? 'القيمة (ل.س)'
                                    : 'Amount (SYP)'}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={cat.adjustmentMode === 'percent' ? 0.1 : id === 'gold' || id === 'crypto' ? 0.01 : 50}
                              className="mt-1 h-9"
                              value={cat.adjustmentValue}
                              onChange={(e) =>
                                patchSyncCategory(id, {
                                  adjustmentValue: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">
                              {locale === 'ar' ? 'اتجاه التعديل' : 'Direction'}
                            </Label>
                            <div className="flex gap-1 mt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={cat.adjustmentDirection === 'deduction' ? 'default' : 'outline'}
                                className="flex-1 h-9 px-2 text-xs"
                                onClick={() => patchSyncCategory(id, { adjustmentDirection: 'deduction' })}
                              >
                                <TrendingDown className="w-3 h-3 mr-0.5" />
                                {locale === 'ar' ? 'تقليل' : 'Less'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={cat.adjustmentDirection === 'addition' ? 'default' : 'outline'}
                                className="flex-1 h-9 px-2 text-xs"
                                onClick={() => patchSyncCategory(id, { adjustmentDirection: 'addition' })}
                              >
                                <TrendingUp className="w-3 h-3 mr-0.5" />
                                {locale === 'ar' ? 'زيادة' : 'More'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={handleFetchFromSPToday} disabled={isFetching} className="flex-1">
                    {isFetching ? (
                      <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 ml-1" />
                    )}
                    {locale === 'ar' ? 'جلب كل الفئات المفعّلة الآن' : 'Fetch all enabled now'}
                  </Button>

                  <Button
                    onClick={handleUpdateSyncSettings}
                    disabled={savingSettings}
                    variant="outline"
                    className="flex-1"
                  >
                    {savingSettings ? (
                      <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 ml-1" />
                    )}
                    {locale === 'ar' ? 'حفظ إعدادات المزامنة' : 'Save sync settings'}
                  </Button>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-600 dark:text-blue-400">
                  {locale === 'ar'
                    ? 'الرقم الثابت: يُخصم أو يُضاف لكل من سعرَي الشراء والبيع (العملات)، أو لسعر الذهب/العملات الرقمية بالدولار، أو لسعر المحروقات بالليرة. النسبة: تُطبَّق على القيمة كاملة. البورصات العالمية: Frankfurter (ECB) عند التوفّر، وإلا من أسعار الليرة بعد جلب العملات.'
                    : 'Fixed: buy/sell (currencies), gold/crypto in USD, or fuel in SYP. Percent: full value. Global FX: Frankfurter (ECB) when available; else cross-rates from SYP after currencies sync.'}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Site Identity */}
          <TabsContent value="identity" className="space-y-6">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  {locale === 'ar' ? 'هوية الموقع' : 'Site Identity'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Site Names */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Site Name Arabic */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'اسم الموقع (عربي)' : 'Site Name (Arabic)'}
                    </Label>
                    <Input
                      value={siteIdentity.siteNameAr}
                      onChange={(e) => setSiteIdentity({...siteIdentity, siteNameAr: e.target.value})}
                      placeholder="سعر الليرة السورية"
                      dir="rtl"
                    />
                  </div>

                  {/* Site Name English */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'اسم الموقع (إنجليزي)' : 'Site Name (English)'}
                    </Label>
                    <Input
                      value={siteIdentity.siteNameEn}
                      onChange={(e) => setSiteIdentity({...siteIdentity, siteNameEn: e.target.value})}
                      placeholder="Syrian Pound Exchange Rate"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Hero Subtitles */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Hero Subtitle Arabic */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'النص الترحيبي (عربي)' : 'Hero Subtitle (Arabic)'}
                    </Label>
                    <Input
                      value={siteIdentity.heroSubtitleAr}
                      onChange={(e) => setSiteIdentity({...siteIdentity, heroSubtitleAr: e.target.value})}
                      placeholder="أسعار الصرف الحية"
                      dir="rtl"
                    />
                  </div>

                  {/* Hero Subtitle English */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'النص الترحيبي (إنجليزي)' : 'Hero Subtitle (English)'}
                    </Label>
                    <Input
                      value={siteIdentity.heroSubtitleEn}
                      onChange={(e) => setSiteIdentity({...siteIdentity, heroSubtitleEn: e.target.value})}
                      placeholder="Live Exchange Rates"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Ticker speed (above header) */}
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Gauge className="h-4 w-4 text-primary" />
                    {locale === 'ar' ? 'سرعة شريط الأسعار (فوق الترويسة)' : 'Ticker speed (above header)'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locale === 'ar'
                      ? 'المدة بالثواني لإكمال دورة التمرير. قيمة أقل = حركة أسرع. يُنصح بين 20 و 90 ثانية.'
                      : 'Seconds for one full scroll cycle. Lower = faster. Try 20–90s.'}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Slider
                      className="flex-1 py-2"
                      min={8}
                      max={180}
                      step={1}
                      value={[siteIdentity.tickerMarqueeDurationSec]}
                      onValueChange={(v) => {
                        const n = v[0] ?? 42;
                        setSiteIdentity((prev) => ({ ...prev, tickerMarqueeDurationSec: n }));
                      }}
                    />
                    <div className="flex shrink-0 items-center gap-2 sm:w-36">
                      <Input
                        type="number"
                        min={8}
                        max={180}
                        className="h-9 w-20 font-mono text-sm"
                        value={siteIdentity.tickerMarqueeDurationSec}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value, 10);
                          if (!Number.isFinite(raw)) return;
                          setSiteIdentity((prev) => ({
                            ...prev,
                            tickerMarqueeDurationSec: Math.min(180, Math.max(8, raw)),
                          }));
                        }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {locale === 'ar' ? 'ثانية / دورة' : 'sec / loop'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logo: Arabic + non-Arabic + sizes */}
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="w-4 h-4" />
                    {locale === 'ar' ? 'الشعارات حسب اللغة' : 'Logos by language'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locale === 'ar'
                      ? 'شعار للعربية وشعار لباقي اللغات. إن تُرك «باقي اللغات» فارغاً يُعرض شعار العربية ثم «شعار موحّد» القديم إن وُجد — حتى لا يبقى الموقع على الشعار الافتراضي.'
                      : 'Arabic vs other locales. If non-Arabic logo is empty, the Arabic logo is shown, then the legacy unified field — so English etc. are not stuck on the default SVG unless you clear all.'}
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 rounded-md border border-border/80 bg-background/50 p-3">
                      <Label className="text-sm font-medium">
                        {locale === 'ar' ? 'شعار الواجهة العربية' : 'Arabic UI logo'}
                      </Label>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        disabled={uploadingLogo}
                        className="cursor-pointer"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          void handleLogoFile(f ?? null, 'ar');
                          e.target.value = '';
                        }}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {locale === 'ar' ? 'أو رابط (اختياري)' : 'Or URL (optional)'}
                      </Label>
                      <Input
                        value={siteIdentity.logoUrlAr || ''}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, logoUrlAr: e.target.value || null })
                        }
                        placeholder="/uploads/logo-ar-....png"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2 rounded-md border border-border/80 bg-background/50 p-3">
                      <Label className="text-sm font-medium">
                        {locale === 'ar' ? 'شعار باقي اللغات' : 'Non-Arabic locales logo'}
                      </Label>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        disabled={uploadingLogo}
                        className="cursor-pointer"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          void handleLogoFile(f ?? null, 'nonAr');
                          e.target.value = '';
                        }}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {locale === 'ar' ? 'أو رابط (اختياري)' : 'Or URL (optional)'}
                      </Label>
                      <Input
                        value={siteIdentity.logoUrlNonAr || ''}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, logoUrlNonAr: e.target.value || null })
                        }
                        placeholder="/uploads/logo-non-....png"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {uploadingLogo && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      {locale === 'ar' ? 'جاري الرفع…' : 'Uploading…'}
                    </p>
                  )}

                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="text-xs text-muted-foreground">
                      {locale === 'ar'
                        ? 'شعار موحّد (قديم — احتياطي إذا لم تُضبط الأعلى)'
                        : 'Legacy unified logo URL (fallback)'}
                    </Label>
                    <Input
                      value={siteIdentity.logoUrl || ''}
                      onChange={(e) => setSiteIdentity({ ...siteIdentity, logoUrl: e.target.value || null })}
                      placeholder="https://example.com/logo.png أو /uploads/..."
                      dir="ltr"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {(
                      [
                        { key: 'header' as const, ar: 'شريط التنقل (الهيدر)', en: 'Header (navbar)' },
                        { key: 'footer' as const, ar: 'تذييل الصفحة', en: 'Footer' },
                        { key: 'loading' as const, ar: 'شاشة التحميل الافتراضية', en: 'Default loading screen' },
                      ] as const
                    ).map(({ key, ar, en }) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs font-medium">{locale === 'ar' ? ar : en}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={16}
                            max={512}
                            className="h-9"
                            value={siteIdentity.logoSizes[key]}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!Number.isFinite(v)) return;
                              setSiteIdentity({
                                ...siteIdentity,
                                logoSizes: { ...siteIdentity.logoSizes, [key]: v },
                              });
                            }}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">px</span>
                        </div>
                        <input
                          type="range"
                          min={16}
                          max={512}
                          value={siteIdentity.logoSizes[key]}
                          onChange={(e) =>
                            setSiteIdentity({
                              ...siteIdentity,
                              logoSizes: {
                                ...siteIdentity.logoSizes,
                                [key]: parseInt(e.target.value, 10),
                              },
                            })
                          }
                          className="w-full accent-primary"
                        />
                      </div>
                    ))}
                  </div>

                  {(siteIdentity.logoUrlAr ||
                    siteIdentity.logoUrlNonAr ||
                    siteIdentity.logoUrl) && (
                    <div className="mt-2 space-y-3 rounded-md border border-dashed border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        {locale === 'ar' ? 'معاينة الأحجام (عربي | باقي اللغات):' : 'Size previews (AR | other locales):'}
                      </p>
                      {(['header', 'footer', 'loading'] as const).map((slot) => (
                        <div key={slot} className="space-y-1">
                          <p className="text-[10px] font-medium uppercase text-muted-foreground">{slot}</p>
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="text-center">
                              <p className="mb-0.5 text-[10px] text-muted-foreground">AR</p>
                              <img
                                key={`prev-ar-${slot}-${siteIdentity.logoUrlAr || siteIdentity.logoUrl || ''}`}
                                src={resolveLogoUrlForClient(
                                  siteIdentity.logoUrlAr || siteIdentity.logoUrl
                                )}
                                alt=""
                                className="mx-auto object-contain"
                                style={{
                                  height: siteIdentity.logoSizes[slot],
                                  width: 'auto',
                                  maxWidth: slot === 'header' ? 280 : 200,
                                }}
                              />
                            </div>
                            <div className="text-center">
                              <p className="mb-0.5 text-[10px] text-muted-foreground">
                                {locale === 'ar' ? 'غير عربي' : 'Non-AR'}
                              </p>
                              <img
                                src={resolveLogoUrlForClient(
                                  siteIdentity.logoUrlNonAr || siteIdentity.logoUrl
                                )}
                                alt=""
                                className="mx-auto object-contain"
                                style={{
                                  height: siteIdentity.logoSizes[slot],
                                  width: 'auto',
                                  maxWidth: slot === 'header' ? 280 : 200,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer social (public site) */}
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Share2 className="h-4 w-4 text-primary" />
                    {locale === 'ar' ? 'روابط التواصل في التذييل' : 'Footer social links'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locale === 'ar'
                      ? 'اترك الحقل فارغاً لإخفاء الزر. يُضاف https:// تلقائياً عند الحاجة.'
                      : 'Leave empty to hide a button. https:// is added when missing.'}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Facebook</Label>
                      <Input
                        dir="ltr"
                        placeholder="https://facebook.com/..."
                        value={siteIdentity.footerSocialFacebook}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, footerSocialFacebook: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">X (Twitter)</Label>
                      <Input
                        dir="ltr"
                        placeholder="https://x.com/..."
                        value={siteIdentity.footerSocialX}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, footerSocialX: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Telegram</Label>
                      <Input
                        dir="ltr"
                        placeholder="https://t.me/..."
                        value={siteIdentity.footerSocialTelegram}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, footerSocialTelegram: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Instagram</Label>
                      <Input
                        dir="ltr"
                        placeholder="https://instagram.com/..."
                        value={siteIdentity.footerSocialInstagram}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, footerSocialInstagram: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs">YouTube</Label>
                      <Input
                        dir="ltr"
                        placeholder="https://youtube.com/..."
                        value={siteIdentity.footerSocialYoutube}
                        onChange={(e) =>
                          setSiteIdentity({ ...siteIdentity, footerSocialYoutube: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    {locale === 'ar' ? 'معاينة:' : 'Preview:'}
                  </p>
                  <div className="bg-background rounded-lg p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">AR</span>
                        <img
                          key={`hdr-ar-${siteIdentity.logoUrlAr || siteIdentity.logoUrl || ''}`}
                          src={resolveLogoUrlForClient(
                            siteIdentity.logoUrlAr || siteIdentity.logoUrl
                          )}
                          alt=""
                          className="w-auto object-contain"
                          style={{
                            height: siteIdentity.logoSizes.header,
                            maxHeight: siteIdentity.logoSizes.header,
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {locale === 'ar' ? 'غير عربي' : 'Non-AR'}
                        </span>
                        <img
                          key={`hdr-non-${siteIdentity.logoUrlNonAr || siteIdentity.logoUrl || ''}`}
                          src={resolveLogoUrlForClient(
                            siteIdentity.logoUrlNonAr || siteIdentity.logoUrl
                          )}
                          alt=""
                          className="w-auto object-contain"
                          style={{
                            height: siteIdentity.logoSizes.header,
                            maxHeight: siteIdentity.logoSizes.header,
                          }}
                        />
                      </div>
                    </div>
                    <p className="mb-2 font-bold text-lg">
                      {locale === 'ar' ? siteIdentity.siteNameAr : siteIdentity.siteNameEn}
                    </p>
                    <p className="text-muted-foreground">
                      {locale === 'ar' ? siteIdentity.heroSubtitleAr : siteIdentity.heroSubtitleEn}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleUpdateSiteIdentity}
                  disabled={savingSettings}
                  className="w-full"
                >
                  {savingSettings ? (
                    <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 ml-1" />
                  )}
                  {locale === 'ar' ? 'حفظ هوية الموقع' : 'Save Site Identity'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Visual Identity */}
          <TabsContent value="visual" className="space-y-6">
            {/* Light Mode Colors */}
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">☀️</span>
                  {locale === 'ar' ? 'ألوان الوضع النهاري' : 'Light Mode Colors'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Primary Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'اللون الأساسي' : 'Primary Color'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={visualIdentity.lightPrimaryColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, lightPrimaryColor: e.target.value})}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={visualIdentity.lightPrimaryColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, lightPrimaryColor: e.target.value})}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    <div 
                      className="h-8 rounded-lg" 
                      style={{ backgroundColor: visualIdentity.lightPrimaryColor }}
                    />
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'اللون المميز' : 'Accent Color'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={visualIdentity.lightAccentColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, lightAccentColor: e.target.value})}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={visualIdentity.lightAccentColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, lightAccentColor: e.target.value})}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    <div 
                      className="h-8 rounded-lg" 
                      style={{ backgroundColor: visualIdentity.lightAccentColor }}
                    />
                  </div>

                  {/* Background Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'لون الخلفية' : 'Background Color'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={visualIdentity.lightBgColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, lightBgColor: e.target.value})}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={visualIdentity.lightBgColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, lightBgColor: e.target.value})}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    <div 
                      className="h-8 rounded-lg border" 
                      style={{ backgroundColor: visualIdentity.lightBgColor }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dark Mode Colors */}
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🌙</span>
                  {locale === 'ar' ? 'ألوان الوضع الليلي' : 'Dark Mode Colors'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Primary Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'اللون الأساسي' : 'Primary Color'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={visualIdentity.darkPrimaryColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, darkPrimaryColor: e.target.value})}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={visualIdentity.darkPrimaryColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, darkPrimaryColor: e.target.value})}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    <div 
                      className="h-8 rounded-lg" 
                      style={{ backgroundColor: visualIdentity.darkPrimaryColor }}
                    />
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'اللون المميز' : 'Accent Color'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={visualIdentity.darkAccentColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, darkAccentColor: e.target.value})}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={visualIdentity.darkAccentColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, darkAccentColor: e.target.value})}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    <div 
                      className="h-8 rounded-lg" 
                      style={{ backgroundColor: visualIdentity.darkAccentColor }}
                    />
                  </div>

                  {/* Background Color */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {locale === 'ar' ? 'لون الخلفية' : 'Background Color'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={visualIdentity.darkBgColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, darkBgColor: e.target.value})}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={visualIdentity.darkBgColor}
                        onChange={(e) => setVisualIdentity({...visualIdentity, darkBgColor: e.target.value})}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    <div 
                      className="h-8 rounded-lg border border-gray-600" 
                      style={{ backgroundColor: visualIdentity.darkBgColor }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paintbrush className="w-5 h-5 text-primary" />
                  {locale === 'ar' ? 'معاينة الألوان' : 'Color Preview'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Light Mode Preview */}
                  <div className="rounded-lg p-4" style={{ backgroundColor: visualIdentity.lightBgColor }}>
                    <p className="text-sm text-gray-600 mb-2">Light Mode</p>
                    <div className="flex gap-2">
                      <div 
                        className="px-4 py-2 rounded-lg text-white font-medium"
                        style={{ backgroundColor: visualIdentity.lightPrimaryColor }}
                      >
                        Primary
                      </div>
                      <div 
                        className="px-4 py-2 rounded-lg text-white font-medium"
                        style={{ backgroundColor: visualIdentity.lightAccentColor }}
                      >
                        Accent
                      </div>
                    </div>
                  </div>

                  {/* Dark Mode Preview */}
                  <div className="rounded-lg p-4" style={{ backgroundColor: visualIdentity.darkBgColor }}>
                    <p className="text-sm text-gray-400 mb-2">Dark Mode</p>
                    <div className="flex gap-2">
                      <div 
                        className="px-4 py-2 rounded-lg text-white font-medium"
                        style={{ backgroundColor: visualIdentity.darkPrimaryColor }}
                      >
                        Primary
                      </div>
                      <div 
                        className="px-4 py-2 rounded-lg text-white font-medium"
                        style={{ backgroundColor: visualIdentity.darkAccentColor }}
                      >
                        Accent
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleUpdateVisualIdentity}
              disabled={savingSettings}
              className="w-full"
            >
              {savingSettings ? (
                <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
              ) : (
                <Check className="w-4 h-4 ml-1" />
              )}
              {locale === 'ar' ? 'حفظ الهوية البصرية' : 'Save Visual Identity'}
            </Button>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-primary" />
                  {locale === 'ar' ? 'إعدادات صفحة API والاشتراك' : 'API page & subscription settings'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {locale === 'ar'
                    ? 'يُعرض السعر والمدة في /api-access. عند الموافقة على طلب أو إضافة نطاق يدوياً يُضبط تاريخ انتهاء = اليوم + عدد الأيام هنا؛ بعدها يُعطّل النطاق تلقائياً عند طلب /api/rates.'
                    : 'Price and duration appear on /api-access. New approvals/manual domains get expiresAt = today + days below; expired domains auto-disable on /api/rates.'}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{locale === 'ar' ? 'السعر (USD)' : 'Price (USD)'}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={platformApiSubscriptionPriceUsd}
                      onChange={(e) => setPlatformApiSubscriptionPriceUsd(e.target.value)}
                      dir="ltr"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{locale === 'ar' ? 'مدة الاشتراك (يوم)' : 'Subscription period (days)'}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={platformApiSubscriptionDays}
                      onChange={(e) => setPlatformApiSubscriptionDays(e.target.value)}
                      dir="ltr"
                      className="mt-1"
                    />
                  </div>
                </div>
                <Label>{locale === 'ar' ? 'عنوان المحفظة USDT (TRC20)' : 'USDT TRC20 wallet address'}</Label>
                <Input
                  value={platformApiUsdtTrc20}
                  onChange={(e) => setPlatformApiUsdtTrc20(e.target.value)}
                  dir="ltr"
                  placeholder="T..."
                  className="font-mono text-sm"
                />
                <Button onClick={handleSaveUsdtWallet} disabled={savingUsdtWallet}>
                  {savingUsdtWallet ? (
                    <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 ml-1" />
                  )}
                  {locale === 'ar' ? 'حفظ الإعدادات' : 'Save settings'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle>
                  {locale === 'ar' ? 'طلبات وصول API' : 'API access requests'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiAccessLoading && (
                  <p className="text-sm text-muted-foreground">{locale === 'ar' ? 'جاري التحميل…' : 'Loading…'}</p>
                )}
                {!apiAccessLoading && apiRequests.length === 0 && (
                  <p className="text-sm text-muted-foreground">{locale === 'ar' ? 'لا طلبات بعد.' : 'No requests yet.'}</p>
                )}
                {apiRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{req.fullName}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          req.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                            : req.status === 'APPROVED'
                              ? 'bg-green-500/20 text-green-800 dark:text-green-200'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground break-all" dir="ltr">
                      {req.email} · {req.phone}
                    </p>
                    <p>
                      {req.websiteName} —{' '}
                      <span className="break-all" dir="ltr">
                        {req.websiteUrl}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {req.usagePurpose} / {req.programmingType}
                    </p>
                    {req.receiptImageUrl && (
                      <a
                        href={req.receiptImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline text-xs"
                      >
                        {locale === 'ar' ? 'عرض إيصال الدفع' : 'View receipt'}
                      </a>
                    )}
                    {req.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <Label className="text-xs">
                            {locale === 'ar' ? 'نطاق للتفعيل (اختياري، افتراضي من الرابط)' : 'Domain to allow (optional)'}
                          </Label>
                          <Input
                            value={approveDomainDraft[req.id] ?? ''}
                            onChange={(e) =>
                              setApproveDomainDraft((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            dir="ltr"
                            placeholder={req.websiteUrl}
                            className="mt-1 font-mono text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApproveApiRequest(req.id)}>
                            {locale === 'ar' ? 'موافقة' : 'Approve'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectApiRequest(req.id)}>
                            {locale === 'ar' ? 'رفض' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle>{locale === 'ar' ? 'النطاقات المصرّح بها' : 'Allowed domains'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label>{locale === 'ar' ? 'إضافة نطاق يدوياً' : 'Add domain manually'}</Label>
                    <Input
                      value={newManualDomain}
                      onChange={(e) => setNewManualDomain(e.target.value)}
                      dir="ltr"
                      placeholder="example.com"
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <Button type="button" onClick={handleAddManualDomain}>
                    {locale === 'ar' ? 'إضافة' : 'Add'}
                  </Button>
                </div>
                {apiDomains.length === 0 && !apiAccessLoading && (
                  <p className="text-sm text-muted-foreground">
                    {locale === 'ar'
                      ? 'القائمة فارغة: لا قيود على /api/rates. أي نطاق يمكنه الاستدعاء من المتصفح.'
                      : 'Empty list: no origin restrictions on /api/rates.'}
                  </p>
                )}
                <ul className="space-y-3">
                  {apiDomains.map((d) => {
                    const exp = d.expiresAt ? new Date(d.expiresAt) : null;
                    const expired = !!(exp && exp.getTime() < Date.now());
                    const expLabel =
                      exp &&
                      exp.toLocaleDateString(locale === 'ar' ? 'ar-SY' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });
                    return (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm break-all" dir="ltr">
                          {d.domain}
                        </p>
                        {d.request && (
                          <p className="text-xs text-muted-foreground">
                            {d.request.fullName} · {d.request.email}
                          </p>
                        )}
                        {d.expiresAt ? (
                          <p className={`text-xs ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {locale === 'ar' ? 'ينتهي الاشتراك:' : 'Subscription ends:'}{' '}
                            {expLabel}
                            {expired ? ` (${locale === 'ar' ? 'منتهي' : 'expired'})` : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-500/90">
                            {locale === 'ar' ? 'بدون تاريخ انتهاء (سجل قديم)' : 'No expiry date (legacy row)'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={d.enabled}
                            onCheckedChange={(v) => handleToggleApiDomain(d.id, v)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {d.enabled ? (locale === 'ar' ? 'مفعّل' : 'On') : locale === 'ar' ? 'معطّل' : 'Off'}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteApiDomain(d.id)}>
                          {locale === 'ar' ? 'حذف' : 'Del'}
                        </Button>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-card/80 border-t py-4 mt-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t('site.title')} - {t('admin.title')}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4 ml-1" />
              {t('admin.logout')}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
