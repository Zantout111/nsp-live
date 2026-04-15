import { NextResponse } from 'next/server';
import { db, ensureSqliteSchema } from '@/lib/db';
import { buildAdsTxtBody } from '@/lib/adsense-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSqliteSchema();
  const s = await db.siteSettings.findFirst();
  const body = buildAdsTxtBody({
    adsTxtRaw: s?.adsTxtRaw ?? null,
    adsensePublisherId: s?.adsensePublisherId ?? null,
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
