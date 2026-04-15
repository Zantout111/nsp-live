const MAX_LEN = 512;

/**
 * يُفرغ النص الفارغ إلى null، ويُضيف https:// عند غياب البروتوكول، ويتحقق من صحة الرابط.
 */
export function normalizeSocialUrl(input: unknown): string | null {
  if (input === undefined || input === null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  let u = raw;
  if (!/^https?:\/\//i.test(u)) {
    u = /^\/\//.test(u) ? `https:${u}` : `https://${u}`;
  }
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString().slice(0, MAX_LEN);
  } catch {
    return null;
  }
}
