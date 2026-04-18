import type { NextRequest } from 'next/server';

function pickClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return '';
}

function isNonRoutableIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // IPv6 ULA rough
  return false;
}

/** رمز دولة ISO2 تقريبي من الهيدرز (Vercel / Cloudflare) أو LO للمحلي */
export function countryFromRequest(req: NextRequest): string {
  const h =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    req.headers.get('cloudfront-viewer-country');
  if (h && /^[A-Za-z]{2}$/.test(h.trim())) return h.trim().toUpperCase();
  const ip = pickClientIp(req);
  if (isNonRoutableIp(ip)) return 'LO';
  return 'XX';
}
