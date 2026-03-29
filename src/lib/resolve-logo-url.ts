/** ملف الشعار الافتراضي في `public` */
export const DEFAULT_BRAND_LOGO = '/logo.svg';

export type LogoSettingsSlice = {
  logoUrl?: string | null;
  logoUrlAr?: string | null;
  logoUrlNonAr?: string | null;
};

/**
 * يحوّل روابط الشعار المحفوظة كـ localhost/127.0.0.1 إلى أصل الصفحة الحالية
 * حتى يعمل الرفع من لوحة التحكم عند فتح الموقع من هاتف عبر IP الشبكة.
 */
export function resolveLogoUrlForClient(logoUrl: string | null | undefined): string {
  if (typeof window === 'undefined') {
    return logoUrl?.trim() || DEFAULT_BRAND_LOGO;
  }
  const raw = logoUrl?.trim();
  if (!raw) return DEFAULT_BRAND_LOGO;
  if (raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw);
    const loopback =
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1' ||
      u.hostname === '[::1]' ||
      u.hostname === '::1' ||
      u.hostname === '0.0.0.0' ||
      u.hostname.endsWith('.localhost');
    if (loopback) {
      return `${window.location.origin}${u.pathname}${u.search}`;
    }
  } catch {
    return raw;
  }
  return raw;
}

/** يختار رابط الشعار المخزَّن حسب اللغة (عربي مقابل باقي اللغات) مع الرجوع للحقل القديم logoUrl */
export function pickLogoStorageUrl(
  locale: string,
  s: LogoSettingsSlice | null | undefined
): string | null {
  if (!s) return null;
  const legacy = s.logoUrl?.trim() || null;
  if (locale === 'ar') {
    return s.logoUrlAr?.trim() || legacy;
  }
  return s.logoUrlNonAr?.trim() || legacy;
}

/** حلّ الشعار للعرض حسب اللغة (يشمل معالجة localhost للشبكة المحلية) */
export function resolveLogoForLocale(locale: string, s: LogoSettingsSlice | null | undefined): string {
  return resolveLogoUrlForClient(pickLogoStorageUrl(locale, s));
}
