import { NextResponse } from 'next/server';
import { listPublishedArticles } from '@/lib/articles-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await listPublishedArticles();
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('articles list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 });
  }
}

