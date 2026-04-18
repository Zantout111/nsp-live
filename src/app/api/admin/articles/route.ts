import { NextResponse } from 'next/server';
import { createArticle, listAdminArticles, type ArticleInput } from '@/lib/articles-db';
import { isAdminAuthenticated } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return bad('Unauthorized', 401);
  try {
    const rows = await listAdminArticles();
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('admin articles GET error:', error);
    return bad('Failed to fetch articles', 500);
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return bad('Unauthorized', 401);
  try {
    const body = (await request.json()) as Partial<ArticleInput>;
    if (!body.title?.trim()) return bad('Title is required');
    const created = await createArticle({
      title: body.title,
      slug: body.slug || body.title,
      description: body.description ?? '',
      content: body.content ?? '',
      featuredImageUrl: body.featuredImageUrl ?? null,
      featuredImageAlt: body.featuredImageAlt ?? null,
      metaTitle: body.metaTitle ?? null,
      metaDescription: body.metaDescription ?? null,
      focusKeyword: body.focusKeyword ?? null,
      isPublished: Boolean(body.isPublished),
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('admin articles POST error:', error);
    return bad('Failed to create article', 500);
  }
}

