import type { MetadataRoute } from 'next';
import { resolvePublicSiteUrl } from '@/lib/site-base-url';

/** يولّد عناوين من نطاق الطلب الفعلي وليس localhost المجمّع وقت البناء. */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await resolvePublicSiteUrl();
  const now = new Date();

  const paths = ['/', '/privacy', '/about', '/api-access'] as const;

  return paths.map((path) => ({
    url: path === '/' ? base : `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'hourly' : 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
