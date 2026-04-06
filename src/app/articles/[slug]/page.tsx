import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getPublishedArticleBySlug, listPublishedArticleSlugs } from '@/lib/articles-db';
import { getAdsenseLayoutData } from '@/lib/adsense-layout-data';
import { AdSenseSlot } from '@/components/adsense-slot';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await listPublishedArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: 'المقال غير موجود' };
  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.description,
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.description,
      images: article.featuredImageUrl ? [article.featuredImageUrl] : undefined,
      type: 'article',
    },
  };
}

export default async function ArticleDetailsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'ar';
  const ads = await getAdsenseLayoutData();
  const canShowArticleAds = Boolean(ads.scriptClient && ads.articleSlot);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <article className="surface-card overflow-hidden p-6">
        {canShowArticleAds && ads.articleTopEnabled ? (
          <AdSenseSlot
            client={ads.scriptClient!}
            slot={ads.articleSlot!}
            labelAr="إعلان"
            labelEn="Ad"
            locale={locale}
          />
        ) : null}
        {article.featuredImageUrl ? (
          <img
            src={article.featuredImageUrl}
            alt={article.featuredImageAlt || article.title}
            className="mb-5 h-64 w-full rounded-xl object-cover"
          />
        ) : null}

        <h1 className="text-3xl font-extrabold leading-tight">{article.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('ar') : ''}
        </p>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{article.description}</p>

        {canShowArticleAds && ads.articleInlineEnabled ? (
          <AdSenseSlot
            client={ads.scriptClient!}
            slot={ads.articleSlot!}
            labelAr="إعلان"
            labelEn="Ad"
            locale={locale}
          />
        ) : null}

        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert prose-headings:font-bold prose-img:rounded-lg">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>

        {canShowArticleAds && ads.articleBottomEnabled ? (
          <AdSenseSlot
            client={ads.scriptClient!}
            slot={ads.articleSlot!}
            labelAr="إعلان"
            labelEn="Ad"
            locale={locale}
          />
        ) : null}
      </article>
    </main>
  );
}

