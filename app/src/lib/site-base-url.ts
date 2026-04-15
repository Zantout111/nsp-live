/**
 * عنوان الموقع العلني لـ sitemap و robots.
 *
 * الأضمن في الإنتاج: ضبط في `.env` (بدون / في النهاية):
 *   SITE_URL=https://nsp-live.com
 *   NEXT_PUBLIC_SITE_URL=https://nsp-live.com
 * ثم `npm run build` (لنسخ .env إلى standalone) وإعادة تشغيل PM2.
 *
 * عند غياب المتغيرات يُستنتج من رؤوس الطلب؛ إن مرّر Nginx للخلفية
 * Host=127.0.0.1 فاستخدم في Nginx: X-Forwarded-Host و Host للعميل.
 */
export function getSiteBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
    process.env.SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL.replace(/\/$/, '');
    return v.startsWith('http') ? v : `https://${v}`;
  }
  return 'http://localhost:3000';
}

function normalizeProto(p: string | null): 'http' | 'https' {
  const x = (p || 'https').split(',')[0].trim().toLowerCase();
  return x === 'http' ? 'http' : 'https';
}

function isLocalHost(host: string): boolean {
  if (/^localhost(:\d+)?$/i.test(host)) return true;
  if (/^127\.\d+\.\d+\.\d+(:\d+)?$/.test(host)) return true;
  return false;
}

/** RFC 7239 Forwarded: host=example.com */
function hostFromForwardedHeader(forwarded: string | null): string | null {
  if (!forwarded) return null;
  for (const segment of forwarded.split(',')) {
    const m = /(?:^|;)\s*host=([^;]+)/i.exec(segment);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (v && !isLocalHost(v)) return v;
  }
  return null;
}

/**
 * أول اسم مضيف «علني» من الرؤوس (يتجاهل 127.0.0.1 وlocalhost).
 */
function publicHostFromHeaders(h: Headers): string | null {
  const tryList: string[] = [];
  const push = (s: string | null) => {
    const x = s?.split(',')[0]?.trim();
    if (x) tryList.push(x);
  };
  push(h.get('x-forwarded-host'));
  push(h.get('x-original-host'));
  const fromFwd = hostFromForwardedHeader(h.get('forwarded'));
  if (fromFwd) tryList.push(fromFwd);
  push(h.get('host'));

  for (const raw of tryList) {
    if (raw && !isLocalHost(raw)) return raw;
  }
  return null;
}

/**
 * للاستخدام في sitemap.ts و robots.ts (async + force-dynamic).
 */
export async function resolvePublicSiteUrl(): Promise<string> {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
    process.env.SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL.replace(/\/$/, '');
    return v.startsWith('http') ? v : `https://${v}`;
  }

  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const host = publicHostFromHeaders(h);
    if (host) {
      const proto = normalizeProto(h.get('x-forwarded-proto'));
      return `${proto}://${host}`;
    }
  } catch {
    /* خارج سياق طلب */
  }

  return 'http://localhost:3000';
}
