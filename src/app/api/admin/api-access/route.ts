import { NextResponse } from 'next/server';
import { db, ensureSqliteSchema } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();
    const [requests, domains] = await Promise.all([
      db.apiAccessRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      db.apiAllowedDomain.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { request: { select: { id: true, fullName: true, email: true, websiteUrl: true } } },
      }),
    ]);

    return NextResponse.json({ success: true, requests, domains });
  } catch (e) {
    console.error('admin api-access GET:', e);
    return NextResponse.json({ success: false, error: 'Failed to load' }, { status: 500 });
  }
}
