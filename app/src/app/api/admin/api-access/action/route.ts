import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, ensureSqliteSchema } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { normalizeDomain } from '@/lib/normalize-domain';
import { subscriptionExpiresAtFromNow } from '@/lib/api-subscription-expiry';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    requestId: z.string().min(1),
    domain: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    requestId: z.string().min(1),
    adminNote: z.string().trim().max(2000).optional(),
  }),
]);

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
    }

    const row = await db.apiAccessRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!row) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    if (parsed.data.action === 'reject') {
      await db.apiAccessRequest.update({
        where: { id: row.id },
        data: {
          status: 'REJECTED',
          adminNote: parsed.data.adminNote ?? null,
        },
      });
      return NextResponse.json({ success: true });
    }

    const rawDomain =
      parsed.data.domain && parsed.data.domain.trim() !== ''
        ? parsed.data.domain
        : row.websiteUrl;
    const domain = normalizeDomain(rawDomain);
    if (!domain) {
      return NextResponse.json({ success: false, error: 'Could not resolve domain' }, { status: 400 });
    }

    const site = await db.siteSettings.findFirst();
    const subDays = site?.platformApiSubscriptionDays ?? 365;
    const expiresAt = subscriptionExpiresAtFromNow(subDays);

    await db.$transaction([
      db.apiAccessRequest.update({
        where: { id: row.id },
        data: { status: 'APPROVED', adminNote: null },
      }),
      db.apiAllowedDomain.upsert({
        where: { domain },
        create: { domain, enabled: true, requestId: row.id, expiresAt },
        update: { enabled: true, requestId: row.id, expiresAt },
      }),
    ]);

    return NextResponse.json({ success: true, domain, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error('admin api-access action:', e);
    return NextResponse.json({ success: false, error: 'Action failed' }, { status: 500 });
  }
}
