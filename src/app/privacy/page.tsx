import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('privacyTitle'),
    description: t('privacyP2'),
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('backHome')}
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{t('privacyTitle')}</h1>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>{t('privacyP1')}</p>
          <p>{t('privacyP2')}</p>
          <p>{t('privacyP3')}</p>
        </div>
      </main>
    </div>
  );
}
