/** معرّف الشهادة القياسي لسطر google.com في ads.txt */
export const GOOGLE_ADS_TXT_CERT_ID = 'f08c47fec0942fa0';

/** يحوّل المدخلات إلى `ca-pub-أرقام` أو null */
export function normalizeCaPub(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  s = s.replace(/^publisher[:/]/, '');
  const digits = s.match(/^(\d{10,20})$/);
  if (digits) return `ca-pub-${digits[1]}`;
  const m = s.match(/^ca-pub-(\d{10,20})$/);
  if (m) return `ca-pub-${m[1]}`;
  return null;
}

/** للسطر في ads.txt: `pub-…` بدون البادئة ca- */
export function pubIdForAdsTxtLine(caPub: string): string {
  const n = normalizeCaPub(caPub);
  if (!n) return '';
  return n.replace(/^ca-/, '');
}

/** يقبل القيمة فقط أو لصق وسم meta بالكامل؛ يمنع < > */
export function sanitizeSiteVerification(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t) return null;
  const metaMatch = t.match(/content\s*=\s*["']([^"']+)["']/i);
  if (metaMatch) t = metaMatch[1].trim();
  t = t.replace(/^["']|["']$/g, '').trim();
  if (!t || /[<>]/.test(t)) return null;
  return t.length > 200 ? t.slice(0, 200) : t;
}

const ADS_TXT_MAX = 12_000;

export function sanitizeAdsTxtRaw(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  return t.length > ADS_TXT_MAX ? t.slice(0, ADS_TXT_MAX) : t;
}

export function sanitizeAdSlot(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!/^\d{6,14}$/.test(t)) return null;
  return t;
}

export function buildAdsTxtBody(opts: {
  adsTxtRaw: string | null | undefined;
  adsensePublisherId: string | null | undefined;
}): string {
  const raw = sanitizeAdsTxtRaw(opts.adsTxtRaw);
  if (raw) {
    return raw.endsWith('\n') ? raw : `${raw}\n`;
  }
  const pub = normalizeCaPub(opts.adsensePublisherId ?? null);
  if (!pub) return '';
  const pubLine = pubIdForAdsTxtLine(pub);
  return `google.com, ${pubLine}, DIRECT, ${GOOGLE_ADS_TXT_CERT_ID}\n`;
}
