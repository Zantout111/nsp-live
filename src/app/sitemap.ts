import type { MetadataRoute } from 'next';
import { getSiteBaseUrl } from '@/lib/site-base-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  const now = new Date();

  const paths = ['/', '/privacy', '/about', '/api-access'] as const;

  return paths.map((path) => ({
    url: path === '/' ? base : `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'hourly' : 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
