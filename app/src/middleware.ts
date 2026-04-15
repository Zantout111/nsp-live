import { NextRequest, NextResponse } from 'next/server';

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get('origin');
  if (origin && isAllowedOrigin(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return applyCors(req, new NextResponse(null, { status: 204 }));
  }
  return applyCors(req, NextResponse.next());
}

export const config = {
  matcher: ['/api/:path*'],
};
