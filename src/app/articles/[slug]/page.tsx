import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { getPublishedArticleBySlug } from '@/lib/articles-db';
import { getAdsenseLayoutData } from '@/lib/adsense-layout-data';
import { AdSenseSlot } from '@/components/adsense-slot';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Params = { slug: string };

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-8 text-4xl font-extrabold leading-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-7 text-3xl font-bold leading-snug">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-2xl font-bold leading-snug">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-5 text-xl font-bold leading-snug">{children}</h4>,
  p: ({ children }) => <p className="my-3 text-base font-normal leading-8">{children}</p>,
};

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
      <div className="mb-4">
        <Link
          href="/articles"
          className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          العودة إلى المقالات
        </Link>
      </div>
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

        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert prose-img:rounded-lg">
          <ReactMarkdown components={markdownComponents}>{article.content}</ReactMarkdown>
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

