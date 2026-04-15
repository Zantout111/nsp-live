import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { db, ensureSqliteSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * يخدم ملف التحقق بملكية الموقع الذي يطلبه Google Search Console
 * (مثل /googlee2845b2f8c3d1a0b.html) عند ضبط الاسم والمحتوى من لوحة التحكم.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ verificationFile: string }> }
) {
  const { verificationFile } = await context.params;
  const name = String(verificationFile || '').trim().toLowerCase();
  if (!name || !name.endsWith('.html')) {
    notFound();
  }

  await ensureSqliteSchema();
  const s = await db.siteSettings.findFirst();
  const configured = s?.gscHtmlVerificationFileName?.trim().toLowerCase();
  const body = s?.gscHtmlVerificationFileBody?.trim();

  if (!configured || !body || name !== configured) {
    notFound();
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
