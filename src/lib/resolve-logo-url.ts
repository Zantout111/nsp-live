/** ملف الشعار الافتراضي في `public` */
export const DEFAULT_BRAND_LOGO = '/logo.svg';

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
