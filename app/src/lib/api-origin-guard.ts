import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hostFromUrl, normalizeDomain } from '@/lib/normalize-domain';

function selfHostFromRequest(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-host');
  const raw = (xf?.split(',')[0]?.trim() || req.headers.get('host') || '').trim();
  return normalizeDomain(raw);
}

function originHost(req: NextRequest): string | null {
  const o = req.headers.get('origin');
  if (!o || o === 'null') return null;
  try {
    return normalizeDomain(new URL(o).hostname);
  } catch {
    return null;
  }
}

function refererHost(req: NextRequest): string | null {
  const r = req.headers.get('referer');
  if (!r) return null;
  return hostFromUrl(r);
}

/**
 * عند وجود نطاقات مفعّلة: السماح فقط لنفس أصل الموقع أو لنطاقات القائمة.
 * بدون نطاقات مفعّلة: لا قيود (سلوك قديم).
 */
export async function ratesApiOriginDenied(req: NextRequest): Promise<NextResponse | null> {
  const off = process.env.API_RATES_ORIGIN_GUARD;
  if (off === '0' || off === 'false' || off === 'off') {
    return null;
  }

  let allowedRows: { domain: string }[] = [];
  try {
    const now = new Date();
    await db.apiAllowedDomain.updateMany({
      where: {
        enabled: true,
        expiresAt: { not: null, lt: now },
      },
      data: { enabled: false },
    });

    allowedRows = await db.apiAllowedDomain.findMany({
      where: {
        enabled: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { domain: true },
    });
  } catch {
    return null;
  }

  if (allowedRows.length === 0) {
    return null;
  }

  const allowed = new Set(
    allowedRows.map((r) => normalizeDomain(r.domain)).filter(Boolean)
  );

  const selfH = selfHostFromRequest(req);
  const oh = originHost(req);
  const rh = refererHost(req);

  if (oh && selfH && oh === selfH) {
    return null;
  }
  if (rh && selfH && rh === selfH) {
    return null;
  }

  if (oh && allowed.has(oh)) {
    return null;
  }
  if (rh && allowed.has(rh)) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: 'API access denied: domain not authorized. Request API access from the platform.',
    },
    { status: 403 }
  );
}
