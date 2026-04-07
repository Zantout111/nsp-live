import Link from 'next/link';
import type { Metadata } from 'next';
import { listPublishedArticles } from '@/lib/articles-db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'المقالات | Articles',
  description: 'مقالات وتحليلات عن أسعار الصرف والذهب والاقتصاد.',
};

export default async function ArticlesPage() {
  const rows = await listPublishedArticles();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          العودة إلى الرئيسية
        </Link>
      </div>
      <section className="surface-card p-6">
        <h1 className="text-2xl font-bold text-foreground">المقالات</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          آخر المقالات المنشورة مع الصور البارزة والوصف المختصر.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => (
          <article
            key={a.id}
            className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/5"
          >
            {a.featuredImageUrl ? (
              <img
                src={a.featuredImageUrl}
                alt={a.featuredImageAlt || a.title}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-48 w-full bg-muted/60" />
            )}
            <div className="p-4">
              <h2 className="line-clamp-2 text-lg font-bold">{a.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('ar') : ''}
                </span>
                <Link
                  href={`/articles/${encodeURIComponent(a.slug)}`}
                  className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  قراءة المقال
                </Link>
              </div>
            </div>
          </article>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            لا توجد مقالات منشورة حالياً.
          </div>
        ) : null}
      </section>
    </main>
  );
}

