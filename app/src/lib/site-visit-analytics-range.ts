/** حدود UTC لنطاق التحليل (from شامل، toExclusive غير شامل) */
export type UtcRange = { fromIso: string; toExclusiveIso: string };

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * MS_DAY);
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type AnalyticsPreset = 'today' | '7d' | '30d' | '90d' | '365d' | 'all' | 'custom';

export type ResolvedAnalyticsRange = {
  range: UtcRange;
  fromInclusiveYmd: string;
  toInclusiveYmd: string;
  /** بعد التطبيع (مثلاً custom غير صالح → 30d) */
  effectivePreset: AnalyticsPreset;
};

export function resolveAnalyticsRange(
  preset: AnalyticsPreset,
  now: Date,
  customFromYmd?: string | null,
  customToYmd?: string | null
): ResolvedAnalyticsRange {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);

  if (preset === 'today') {
    return {
      range: { fromIso: todayStart.toISOString(), toExclusiveIso: tomorrowStart.toISOString() },
      fromInclusiveYmd: toYmd(todayStart),
      toInclusiveYmd: toYmd(todayStart),
      effectivePreset: 'today',
    };
  }

  if (preset === 'all') {
    const from = new Date('1970-01-01T00:00:00.000Z');
    return {
      range: { fromIso: from.toISOString(), toExclusiveIso: tomorrowStart.toISOString() },
      fromInclusiveYmd: toYmd(from),
      toInclusiveYmd: toYmd(todayStart),
      effectivePreset: 'all',
    };
  }

  if (preset === 'custom' && customFromYmd && customToYmd) {
    const fromParsed = parseYmd(customFromYmd);
    const toParsed = parseYmd(customToYmd);
    if (!fromParsed || !toParsed) {
      return resolveAnalyticsRange('30d', now, null, null);
    }
    let from = startOfUtcDay(fromParsed);
    const toDay = startOfUtcDay(toParsed);
    if (from > toDay) {
      return resolveAnalyticsRange('30d', now, null, null);
    }
    const spanDays = Math.floor((toDay.getTime() - from.getTime()) / MS_DAY) + 1;
    if (spanDays > 366) {
      from = addUtcDays(toDay, -365);
    }
    return {
      range: {
        fromIso: from.toISOString(),
        toExclusiveIso: addUtcDays(toDay, 1).toISOString(),
      },
      fromInclusiveYmd: toYmd(from),
      toInclusiveYmd: toYmd(toDay),
      effectivePreset: 'custom',
    };
  }

  if (preset === 'custom') {
    return resolveAnalyticsRange('30d', now, null, null);
  }

  const daysMap: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
  };
  const n = daysMap[preset] ?? 30;
  const fromStart = addUtcDays(todayStart, -(n - 1));
  const ep = (preset in daysMap ? preset : '30d') as AnalyticsPreset;
  return {
    range: { fromIso: fromStart.toISOString(), toExclusiveIso: tomorrowStart.toISOString() },
    fromInclusiveYmd: toYmd(fromStart),
    toInclusiveYmd: toYmd(todayStart),
    effectivePreset: ep,
  };
}
