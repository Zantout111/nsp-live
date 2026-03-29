/**
 * يُرجع اسم النطاق الموحّد (بدون www، أحرف صغيرة، بدون مسار).
 */
export function normalizeDomain(input: string): string {
  const t = input.trim().toLowerCase();
  if (!t) return '';
  try {
    const u = t.includes('://') ? new URL(t) : new URL(`https://${t}`);
    let h = u.hostname;
    if (h.startsWith('www.')) h = h.slice(4);
    return h;
  } catch {
    const first = t.replace(/^https?:\/\//, '').split('/')[0] ?? '';
    let h = first.split(':')[0] ?? '';
    if (h.startsWith('www.')) h = h.slice(4);
    return h;
  }
}

export function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return normalizeDomain(u.hostname);
  } catch {
    return null;
  }
}
