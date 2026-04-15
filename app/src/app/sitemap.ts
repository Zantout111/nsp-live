import type { MetadataRoute } from 'next';
import { resolvePublicSiteUrl } from '@/lib/site-base-url';
import { listPublishedArticleSlugs } from '@/lib/articles-db';

/** يولّد عناوين من نطاق الطلب الفعلي وليس localhost المجمّع وقت البناء. */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await resolvePublicSiteUrl();
  const now = new Date();

  const paths = ['/', '/privacy', '/about', '/api-access', '/articles'] as const;
  const baseUrls = paths.map((path) => ({
    url: path === '/' ? base : `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'hourly' : path === '/articles' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));

  const articleSlugs = await listPublishedArticleSlugs();
  const articleUrls = articleSlugs.map((slug) => ({
    url: `${base}/articles/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...baseUrls, ...articleUrls];
}
