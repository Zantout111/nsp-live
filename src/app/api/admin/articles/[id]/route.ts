import { NextResponse } from 'next/server';
import { deleteArticle, getArticleById, updateArticle, type ArticleInput } from '@/lib/articles-db';
import { isAdminAuthenticated } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return bad('Unauthorized', 401);
  try {
    const { id } = await context.params;
    const row = await getArticleById(id);
    if (!row) return bad('Not found', 404);
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error('admin article GET by id error:', error);
    return bad('Failed to fetch article', 500);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return bad('Unauthorized', 401);
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<ArticleInput>;
    if (!body.title?.trim()) return bad('Title is required');
    const updated = await updateArticle(id, {
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
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('admin article PUT error:', error);
    return bad('Failed to update article', 500);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return bad('Unauthorized', 401);
  try {
    const { id } = await context.params;
    await deleteArticle(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('admin article DELETE error:', error);
    return bad('Failed to delete article', 500);
  }
}

