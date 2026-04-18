/** أحجام الشعار بالبكسل (الارتفاع؛ العرض تلقائي مع الحفاظ على النسبة) */
export type LogoSizes = {
  header: number;
  footer: number;
  loading: number;
};

export const DEFAULT_LOGO_SIZES: LogoSizes = {
  header: 40,
  footer: 32,
  loading: 48,
};

export function parseLogoSizes(raw: unknown): LogoSizes {
  const d = DEFAULT_LOGO_SIZES;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const o = raw as Record<string, unknown>;
  const n = (v: unknown, fallback: number) => {
    const x = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
    if (!Number.isFinite(x) || x < 16 || x > 512) return fallback;
    return Math.round(x);
  };
  return {
    header: n(o.header, d.header),
    footer: n(o.footer, d.footer),
    loading: n(o.loading, d.loading),
  };
}
