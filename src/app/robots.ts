import type { MetadataRoute } from 'next';
import { resolvePublicSiteUrl } from '@/lib/site-base-url';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await resolvePublicSiteUrl();
  return {
    rules: [
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'Twitterbot', allow: '/' },
      { userAgent: 'facebookexternalhit', allow: '/' },
      { userAgent: '*', allow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
