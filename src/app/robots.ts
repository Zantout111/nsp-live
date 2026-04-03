import type { MetadataRoute } from 'next';
import { getSiteBaseUrl } from '@/lib/site-base-url';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
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
