import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { ensureSqliteSchema } from '@/lib/db';
import { countryFromRequest } from '@/lib/request-geo';
import { insertSiteVisit } from '@/lib/site-visit-store';

const VISITOR_COOKIE = 'nsp_visitor';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~13 شهر

export async function POST(req: NextRequest) {
  try {
    await ensureSqliteSchema();
    let visitorId = req.cookies.get(VISITOR_COOKIE)?.value?.trim();
    let setVisitorCookie = false;
    if (!visitorId || visitorId.length < 8) {
      visitorId = randomUUID();
      setVisitorCookie = true;
    }

    let path = '/';
    try {
      const body = (await req.json()) as { path?: unknown };
      if (typeof body?.path === 'string' && body.path.length > 0) {
        path = body.path.slice(0, 512);
        if (!path.startsWith('/')) path = `/${path}`;
      }
    } catch {
      /* empty body */
    }

    const country = countryFromRequest(req);

    await insertSiteVisit({ visitorId, country, path });

    const res = NextResponse.json({ ok: true });
    if (setVisitorCookie) {
      res.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
    }
    return res;
  } catch (e) {
    console.error('[analytics/hit]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
