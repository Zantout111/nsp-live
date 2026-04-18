import { NextResponse } from 'next/server';
import { getPublishedArticleBySlug } from '@/lib/articles-db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const row = await getPublishedArticleBySlug(slug);
    if (!row) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error('article details error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch article' }, { status: 500 });
  }
}

