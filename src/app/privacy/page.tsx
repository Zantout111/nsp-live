import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

function asStringParagraphs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('privacyTitle'),
    description: t('privacyMetaDescription'),
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  const paragraphs = asStringParagraphs(t.raw('privacyParagraphs'));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('backHome')}
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{t('privacyTitle')}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{t('privacyLastUpdated')}</p>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem] sm:leading-7">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </main>
    </div>
  );
}
