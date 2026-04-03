/**
 * عنوان الموقع العلني لـ sitemap و robots (يفضّل ضبط NEXT_PUBLIC_SITE_URL في الإنتاج).
 */
export function getSiteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL.replace(/\/$/, '');
    return v.startsWith('http') ? v : `https://${v}`;
  }
  return 'http://localhost:3000';
}
