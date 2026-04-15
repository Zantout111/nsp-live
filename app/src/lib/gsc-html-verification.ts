import { sanitizeSiteVerification } from '@/lib/adsense-config';

/** اسم ملف التحقق من Google (مثل googlee2845b2f8c3d1a0b.html) */
export function sanitizeGscHtmlFileName(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s.length > 96) return null;
  if (!/^google[0-9a-z._-]+\.html$/.test(s)) return null;
  return s;
}

export function sanitizeGscHtmlFileBody(raw: unknown): string | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t) return null;
  if (t.length > 8192) t = t.slice(0, 8192);
  if (/<\s*script/i.test(t) || /\bjavascript:/i.test(t)) return null;
  return t;
}

export function sanitizeGscExtraMeta(raw: unknown): string | null {
  if (raw == null) return null;
  return sanitizeSiteVerification(String(raw));
}
