import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, ensureSqliteSchema } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();
    const { id } = await ctx.params;
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
    }

    await db.apiAllowedDomain.update({
      where: { id },
      data: { enabled: parsed.data.enabled },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('admin domain PATCH:', e);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();
    const { id } = await ctx.params;
    await db.apiAllowedDomain.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('admin domain DELETE:', e);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
