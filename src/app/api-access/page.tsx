import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { db, ensureSqliteSchema } from '@/lib/db';
import { ApiAccessClient } from './ApiAccessClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('apiPage');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: true, follow: true },
  };
}

async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host');
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http';
  if (host) return `${proto}://${host}`;
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export default async function ApiAccessPage() {
  const t = await getTranslations('apiPage');
  await ensureSqliteSchema();
  const settings = await db.siteSettings.findFirst();
  const baseUrl = await resolveBaseUrl();
  const subscriptionPriceUsd = settings?.platformApiSubscriptionPriceUsd ?? 50;
  const subscriptionDays = settings?.platformApiSubscriptionDays ?? 365;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('subtitle')}</p>
        <div className="mt-10">
          <ApiAccessClient
            baseUrl={baseUrl}
            usdtAddress={settings?.platformApiUsdtTrc20 ?? null}
            subscriptionPriceUsd={subscriptionPriceUsd}
            subscriptionDays={subscriptionDays}
          />
        </div>
      </main>
    </div>
  );
}
