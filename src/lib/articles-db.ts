import { db } from '@/lib/db';

export type ArticleRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SqlArticleRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  isPublished: number | boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleInput = {
  slug: string;
  title: string;
  description: string;
  content: string;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  isPublished?: boolean;
};

let ensured = false;

function mapRow(r: SqlArticleRow): ArticleRecord {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    content: r.content,
    featuredImageUrl: r.featuredImageUrl ?? null,
    featuredImageAlt: r.featuredImageAlt ?? null,
    metaTitle: r.metaTitle ?? null,
    metaDescription: r.metaDescription ?? null,
    focusKeyword: r.focusKeyword ?? null,
    isPublished: Boolean(r.isPublished),
    publishedAt: r.publishedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function clean(v: string | null | undefined): string | null {
  const x = String(v ?? '').trim();
  return x ? x : null;
}

export function slugifyArticle(input: string): string {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || `article-${Date.now()}`;
}

export async function ensureArticlesTable(): Promise<void> {
  if (ensured) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Article (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      featuredImageUrl TEXT,
      featuredImageAlt TEXT,
      metaTitle TEXT,
      metaDescription TEXT,
      focusKeyword TEXT,
      isPublished INTEGER NOT NULL DEFAULT 0,
      publishedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_article_published ON Article(isPublished, publishedAt DESC, createdAt DESC)`
  );
  ensured = true;
}

async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = excludeId
    ? await db.$queryRawUnsafe<Array<{ c: number }>>(
        `SELECT COUNT(1) as c FROM Article WHERE lower(slug) = lower(?) AND id <> ?`,
        slug,
        excludeId
      )
    : await db.$queryRawUnsafe<Array<{ c: number }>>(
        `SELECT COUNT(1) as c FROM Article WHERE lower(slug) = lower(?)`,
        slug
      );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function ensureUniqueSlug(baseInput: string, excludeId?: string): Promise<string> {
  let base = slugifyArticle(baseInput);
  if (!(await slugExists(base, excludeId))) return base;
  let i = 2;
  while (i < 10000) {
    const s = `${base}-${i}`;
    if (!(await slugExists(s, excludeId))) return s;
    i++;
  }
  return `${base}-${Date.now()}`;
}

export async function listPublishedArticles(): Promise<ArticleRecord[]> {
  await ensureArticlesTable();
  const rows = await db.$queryRawUnsafe<SqlArticleRow[]>(
    `SELECT * FROM Article WHERE isPublished = 1 ORDER BY COALESCE(publishedAt, createdAt) DESC, createdAt DESC`
  );
  return rows.map(mapRow);
}

export async function listPublishedArticleSlugs(): Promise<string[]> {
  await ensureArticlesTable();
  const rows = await db.$queryRawUnsafe<Array<{ slug: string }>>(
    `SELECT slug FROM Article WHERE isPublished = 1 ORDER BY COALESCE(publishedAt, createdAt) DESC, createdAt DESC`
  );
  return rows.map((r) => r.slug).filter(Boolean);
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleRecord | null> {
  await ensureArticlesTable();
  const rows = await db.$queryRawUnsafe<SqlArticleRow[]>(
    `SELECT * FROM Article WHERE slug = ? AND isPublished = 1 LIMIT 1`,
    slug
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listAdminArticles(): Promise<ArticleRecord[]> {
  await ensureArticlesTable();
  const rows = await db.$queryRawUnsafe<SqlArticleRow[]>(
    `SELECT * FROM Article ORDER BY createdAt DESC`
  );
  return rows.map(mapRow);
}

export async function getArticleById(id: string): Promise<ArticleRecord | null> {
  await ensureArticlesTable();
  const rows = await db.$queryRawUnsafe<SqlArticleRow[]>(
    `SELECT * FROM Article WHERE id = ? LIMIT 1`,
    id
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createArticle(input: ArticleInput): Promise<ArticleRecord> {
  await ensureArticlesTable();
  const now = new Date().toISOString();
  const id = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const isPublished = Boolean(input.isPublished);
  const slug = await ensureUniqueSlug(input.slug || input.title);
  await db.$executeRawUnsafe(
    `INSERT INTO Article
      (id, slug, title, description, content, featuredImageUrl, featuredImageAlt, metaTitle, metaDescription, focusKeyword, isPublished, publishedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    slug,
    input.title.trim(),
    input.description.trim(),
    input.content ?? '',
    clean(input.featuredImageUrl),
    clean(input.featuredImageAlt),
    clean(input.metaTitle),
    clean(input.metaDescription),
    clean(input.focusKeyword),
    isPublished ? 1 : 0,
    isPublished ? now : null,
    now,
    now
  );
  const created = await getArticleById(id);
  if (!created) throw new Error('Article create failed');
  return created;
}

export async function updateArticle(id: string, input: ArticleInput): Promise<ArticleRecord> {
  await ensureArticlesTable();
  const current = await getArticleById(id);
  if (!current) throw new Error('Article not found');

  const now = new Date().toISOString();
  const isPublished = Boolean(input.isPublished);
  const slug = await ensureUniqueSlug(input.slug || input.title || current.slug, id);
  const title = String(input.title || current.title).trim();
  const description = String(input.description || current.description).trim();
  const content = input.content ?? current.content;
  const nextPublishedAt =
    isPublished && !current.isPublished ? now : isPublished ? current.publishedAt ?? now : null;

  await db.$executeRawUnsafe(
    `UPDATE Article
     SET slug = ?, title = ?, description = ?, content = ?, featuredImageUrl = ?, featuredImageAlt = ?,
         metaTitle = ?, metaDescription = ?, focusKeyword = ?, isPublished = ?, publishedAt = ?, updatedAt = ?
     WHERE id = ?`,
    slug,
    title,
    description,
    content,
    clean(input.featuredImageUrl),
    clean(input.featuredImageAlt),
    clean(input.metaTitle),
    clean(input.metaDescription),
    clean(input.focusKeyword),
    isPublished ? 1 : 0,
    nextPublishedAt,
    now,
    id
  );
  const updated = await getArticleById(id);
  if (!updated) throw new Error('Article update failed');
  return updated;
}

export async function deleteArticle(id: string): Promise<void> {
  await ensureArticlesTable();
  await db.$executeRawUnsafe(`DELETE FROM Article WHERE id = ?`, id);
}

