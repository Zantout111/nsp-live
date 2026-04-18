import type { CSSProperties } from 'react';

/** ألوان قسم الهيرو (تدرج + نص) — قيم افتراضية كما في التصميم الحالي */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/i;

function sanitizeMuted(input: unknown, fallback: string): string {
  if (input == null || typeof input !== 'string') return fallback;
  const s = input.trim();
  if (HEX.test(s)) {
    const h = sanitizeHeroHex(s);
    return h ?? fallback;
  }
  if (RGBA.test(s) && s.length <= 80) return s;
  return fallback;
}

export function sanitizeHeroHex(input: unknown): string | undefined {
  if (input == null || typeof input !== 'string') return undefined;
  const s = input.trim();
  if (!HEX.test(s)) return undefined;
  return s.length === 4
    ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase()
    : s.toLowerCase();
}

export type HeroThemeSide = {
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  text: string;
  muted: string;
};

export const HERO_THEME_DEFAULTS: { light: HeroThemeSide; dark: HeroThemeSide } = {
  light: {
    gradientFrom: '#e0f2fe',
    gradientVia: '#eff6ff',
    gradientTo: '#f1f5f9',
    text: '#0f172a',
    muted: '#475569',
  },
  dark: {
    gradientFrom: '#1e3a5f',
    gradientVia: '#1a3052',
    gradientTo: '#0f172a',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
  },
};

export type HeroSectionThemeStored = {
  light?: Partial<Omit<HeroThemeSide, never>>;
  dark?: Partial<Omit<HeroThemeSide, never>>;
};

export function mergeHeroSide(
  mode: 'light' | 'dark',
  stored: HeroSectionThemeStored | null | undefined
): HeroThemeSide {
  const base = HERO_THEME_DEFAULTS[mode];
  const patch = stored?.[mode] ?? {};
  return {
    gradientFrom: sanitizeHeroHex(patch.gradientFrom) ?? base.gradientFrom,
    gradientVia: sanitizeHeroHex(patch.gradientVia) ?? base.gradientVia,
    gradientTo: sanitizeHeroHex(patch.gradientTo) ?? base.gradientTo,
    text: sanitizeHeroHex(patch.text) ?? base.text,
    muted: sanitizeMuted(patch.muted, base.muted),
  };
}

export function parseHeroSectionThemeFromDb(raw: unknown): HeroSectionThemeStored | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as HeroSectionThemeStored;
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      if (typeof o === 'object' && o !== null && !Array.isArray(o)) return o as HeroSectionThemeStored;
    } catch {
      return null;
    }
  }
  return null;
}

export function sanitizeHeroSectionThemeForSave(
  input: unknown
): HeroSectionThemeStored | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const light = o.light as Record<string, unknown> | undefined;
  const dark = o.dark as Record<string, unknown> | undefined;
  const out: HeroSectionThemeStored = {};
  if (light && typeof light === 'object') {
    const L = {
      gradientFrom: sanitizeHeroHex(light.gradientFrom),
      gradientVia: sanitizeHeroHex(light.gradientVia),
      gradientTo: sanitizeHeroHex(light.gradientTo),
      text: sanitizeHeroHex(light.text),
      muted:
        typeof light.muted === 'string' && light.muted.trim() !== ''
          ? sanitizeMuted(light.muted, HERO_THEME_DEFAULTS.light.muted)
          : undefined,
    };
    const pruned = Object.fromEntries(Object.entries(L).filter(([, v]) => v !== undefined));
    if (Object.keys(pruned).length) out.light = pruned as HeroSectionThemeStored['light'];
  }
  if (dark && typeof dark === 'object') {
    const D = {
      gradientFrom: sanitizeHeroHex(dark.gradientFrom),
      gradientVia: sanitizeHeroHex(dark.gradientVia),
      gradientTo: sanitizeHeroHex(dark.gradientTo),
      text: sanitizeHeroHex(dark.text),
      muted:
        typeof dark.muted === 'string' && dark.muted.trim() !== ''
          ? sanitizeMuted(dark.muted, HERO_THEME_DEFAULTS.dark.muted)
          : undefined,
    };
    const pruned = Object.fromEntries(Object.entries(D).filter(([, v]) => v !== undefined));
    if (Object.keys(pruned).length) out.dark = pruned as HeroSectionThemeStored['dark'];
  }
  if (!out.light && !out.dark) return null;
  return out;
}

export function isHeroThemeEqualToDefaults(stored: HeroSectionThemeStored | null): boolean {
  if (!stored || (!stored.light && !stored.dark)) return true;
  const l = mergeHeroSide('light', stored);
  const d = mergeHeroSide('dark', stored);
  const lb = HERO_THEME_DEFAULTS.light;
  const db = HERO_THEME_DEFAULTS.dark;
  return (
    l.gradientFrom === lb.gradientFrom &&
    l.gradientVia === lb.gradientVia &&
    l.gradientTo === lb.gradientTo &&
    l.text === lb.text &&
    l.muted === lb.muted &&
    d.gradientFrom === db.gradientFrom &&
    d.gradientVia === db.gradientVia &&
    d.gradientTo === db.gradientTo &&
    d.text === db.text &&
    d.muted === db.muted
  );
}

export function heroSectionInlineStyle(
  mode: 'light' | 'dark',
  stored: HeroSectionThemeStored | null | undefined
): CSSProperties {
  const t = mergeHeroSide(mode, stored);
  return {
    backgroundImage: `linear-gradient(to bottom right, ${t.gradientFrom}, ${t.gradientVia}, ${t.gradientTo})`,
    color: t.text,
    ['--hero-muted' as string]: t.muted,
  };
}

/** للمسار العام: قراءة عمود heroSectionTheme (قد يكون غير مضاف في Prisma client). */
export async function fetchHeroSectionThemeRow(
  queryRawUnsafe: <T>(sql: string, ...params: unknown[]) => Promise<T>,
  settingsId: string
): Promise<HeroSectionThemeStored | null> {
  try {
    const rows = (await queryRawUnsafe(
      `SELECT heroSectionTheme FROM SiteSettings WHERE id = ? LIMIT 1`,
      settingsId
    )) as Array<{ heroSectionTheme: string | null }>;
    return parseHeroSectionThemeFromDb(rows[0]?.heroSectionTheme ?? null);
  } catch {
    return null;
  }
}

export type HeroPersistPlan = { kind: 'skip' } | { kind: 'clear' } | { kind: 'set'; json: string };

export function planHeroSectionThemePersist(body: Record<string, unknown>): HeroPersistPlan {
  if (!('heroSectionTheme' in body) || body.heroSectionTheme === undefined) return { kind: 'skip' };
  if (body.heroSectionTheme === null) return { kind: 'clear' };
  const sanitized = sanitizeHeroSectionThemeForSave(body.heroSectionTheme);
  if (sanitized == null) return { kind: 'clear' };
  return { kind: 'set', json: JSON.stringify(sanitized) };
}

export async function applyHeroSectionThemePlan(
  executeRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown>,
  settingsId: string,
  plan: HeroPersistPlan
): Promise<void> {
  if (plan.kind === 'skip') return;
  if (plan.kind === 'clear') {
    await executeRawUnsafe(`UPDATE SiteSettings SET heroSectionTheme = NULL WHERE id = ?`, settingsId);
    return;
  }
  await executeRawUnsafe(`UPDATE SiteSettings SET heroSectionTheme = ? WHERE id = ?`, plan.json, settingsId);
}
