/**
 * Derives shadcn-style CSS variables from three brand hex colors per mode
 * (primary, accent, background) for coherent light/dark public UI.
 */

export type SiteBrandColors = {
  lightPrimaryColor: string;
  lightAccentColor: string;
  lightBgColor: string;
  darkPrimaryColor: string;
  darkAccentColor: string;
  darkBgColor: string;
};

type Rgb = { r: number; g: number; b: number };

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 15, g: 23, b: 42 };
const SLATE_LIGHT: Rgb = { r: 241, g: 245, b: 249 };

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((x) => clamp255(x).toString(16).padStart(2, '0')).join('')}`;
}

/** Accepts #rgb, #rrggbb, rrggbb */
export function normalizeHex(input: string | null | undefined, fallback: string): string {
  const raw = String(input ?? '').trim();
  const m = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(raw);
  if (!m) return fallback.startsWith('#') ? fallback : `#${fallback}`;
  let h = m[1];
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return `#${h.toLowerCase()}`;
}

function hexToRgb(hex: string): Rgb | null {
  const n = normalizeHex(hex, '#000000').slice(1);
  if (n.length !== 6) return null;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** WCAG relative luminance contrast ratio (higher = more contrast). */
function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = luminance(fg) + 0.05;
  const L2 = luminance(bg) + 0.05;
  return L1 > L2 ? L1 / L2 : L2 / L1;
}

function pickOnColor(bg: Rgb): string {
  const whiteRatio = contrastRatio(WHITE, bg);
  const blackRatio = contrastRatio(BLACK, bg);
  return whiteRatio >= blackRatio ? '#ffffff' : rgbToHex(BLACK);
}

function pickReadableOn(bg: Rgb, candidates: [Rgb, Rgb]): string {
  const [a, b] = candidates;
  const ra = contrastRatio(a, bg);
  const rb = contrastRatio(b, bg);
  return rgbToHex(ra >= rb ? a : b);
}

const DESTRUCTIVE = '#ef4444';

export function getSiteBrandCssVariables(
  mode: 'light' | 'dark',
  brand: SiteBrandColors
): Record<string, string> {
  const primaryHex = normalizeHex(
    mode === 'light' ? brand.lightPrimaryColor : brand.darkPrimaryColor,
    '#0ea5e9'
  );
  const accentHex = normalizeHex(
    mode === 'light' ? brand.lightAccentColor : brand.darkAccentColor,
    mode === 'light' ? '#0284c7' : '#38bdf8'
  );
  const bgHex = normalizeHex(
    mode === 'light' ? brand.lightBgColor : brand.darkBgColor,
    mode === 'light' ? '#ffffff' : '#0f172a'
  );

  const bg = hexToRgb(bgHex) ?? (mode === 'light' ? WHITE : { r: 15, g: 23, b: 42 });
  const primary = hexToRgb(primaryHex) ?? hexToRgb('#0ea5e9')!;
  const accent = hexToRgb(accentHex) ?? primary;

  const L = luminance(bg);

  let foreground: Rgb;
  let card: Rgb;
  let muted: Rgb;
  let mutedFg: Rgb;
  let border: Rgb;
  let input: Rgb;
  let secondary: Rgb;
  let popover: Rgb;

  if (mode === 'light') {
    foreground = pickReadableOn(bg, [BLACK, mix(BLACK, bg, 0.35)]);
    card = mix(bg, WHITE, L > 0.55 ? 0.45 : 0.2);
    muted = mix(bg, primary, 0.1);
    mutedFg = mix(foreground, bg, 0.42);
    border = mix(bg, foreground, 0.14);
    input = mix(bg, border, 0.55);
    secondary = mix(bg, primary, 0.16);
    popover = mix(card, WHITE, 0.25);
  } else {
    foreground = mix(bg, SLATE_LIGHT, 0.94);
    card = mix(bg, WHITE, 0.09);
    muted = mix(bg, WHITE, 0.12);
    mutedFg = mix(foreground, bg, 0.38);
    border = mix(bg, foreground, 0.14);
    input = mix(border, bg, 0.45);
    secondary = mix(bg, primary, 0.2);
    popover = mix(card, WHITE, 0.06);
  }

  const primaryFg = pickOnColor(primary);
  const accentFg = pickOnColor(accent);

  const secondaryFg = rgbToHex(foreground);

  const ring = primaryHex;
  const neonBlue = primaryHex;
  const neonCyan = accentHex;
  const neonPurple = rgbToHex(mix(primary, accent, 0.5));
  const neonGold = mode === 'light' ? '#eab308' : '#fbbf24';

  const accentSecondary = rgbToHex(mix(primary, mode === 'light' ? WHITE : SLATE_LIGHT, 0.28));
  const accentSecondaryFg =
    mode === 'light' ? rgbToHex(mix(BLACK, primary, 0.25)) : pickOnColor(hexToRgb(accentSecondary)!);

  const vars: Record<string, string> = {
    '--background': bgHex,
    '--foreground': rgbToHex(foreground),
    '--card': rgbToHex(card),
    '--card-foreground': rgbToHex(foreground),
    '--popover': rgbToHex(popover),
    '--popover-foreground': rgbToHex(foreground),
    '--primary': primaryHex,
    '--primary-foreground': primaryFg,
    '--secondary': rgbToHex(secondary),
    '--secondary-foreground': secondaryFg,
    '--muted': rgbToHex(muted),
    '--muted-foreground': rgbToHex(mutedFg),
    '--accent': accentHex,
    '--accent-foreground': accentFg,
    '--destructive': DESTRUCTIVE,
    '--border': rgbToHex(border),
    '--input': rgbToHex(input),
    '--ring': ring,
    '--sidebar': rgbToHex(mode === 'light' ? mix(bg, WHITE, 0.12) : mix(bg, BLACK, 0.35)),
    '--sidebar-foreground': rgbToHex(foreground),
    '--sidebar-primary': primaryHex,
    '--sidebar-primary-foreground': primaryFg,
    '--sidebar-accent': rgbToHex(muted),
    '--sidebar-accent-foreground': rgbToHex(foreground),
    '--sidebar-border': rgbToHex(border),
    '--sidebar-ring': ring,
    '--neon-blue': neonBlue,
    '--neon-cyan': neonCyan,
    '--neon-purple': neonPurple,
    '--neon-gold': neonGold,
    '--accent-primary': primaryHex,
    '--accent-primary-foreground': primaryFg,
    '--accent-secondary': accentSecondary,
    '--accent-secondary-foreground': accentSecondaryFg,
    '--chart-1': primaryHex,
    '--chart-2': accentHex,
    '--chart-3': rgbToHex(mix(primary, accent, 0.35)),
    '--chart-4': rgbToHex(mix(foreground, primary, mode === 'light' ? 0.55 : 0.5)),
    '--chart-5': rgbToHex(mix(mutedFg, primary, 0.4)),
  };

  return vars;
}

export function applySiteBrandCssVars(
  el: HTMLElement | null,
  mode: 'light' | 'dark',
  brand: SiteBrandColors
): void {
  if (!el) return;
  const vars = getSiteBrandCssVariables(mode, brand);
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
}

