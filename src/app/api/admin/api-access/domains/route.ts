import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, ensureSqliteSchema } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { normalizeDomain } from '@/lib/normalize-domain';
import { subscriptionExpiresAtFromNow } from '@/lib/api-subscription-expiry';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  domain: z.string().trim().min(3).max(500),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();
    const json = await request.json();
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
    }

    const domain = normalizeDomain(parsed.data.domain);
    if (!domain) {
      return NextResponse.json({ success: false, error: 'Invalid domain' }, { status: 400 });
    }

    const site = await db.siteSettings.findFirst();
    const subDays = site?.platformApiSubscriptionDays ?? 365;
    const expiresAt = subscriptionExpiresAtFromNow(subDays);

    const row = await db.apiAllowedDomain.create({
      data: {
        domain,
        enabled: true,
        note: parsed.data.note ?? null,
        expiresAt,
      },
    });

    return NextResponse.json({ success: true, domain: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique/i.test(msg)) {
      return NextResponse.json({ success: false, error: 'Domain already exists' }, { status: 409 });
    }
    console.error('admin domains POST:', e);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
