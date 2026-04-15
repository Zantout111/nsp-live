import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type { UtcRange } from '@/lib/site-visit-analytics-range';

/** إدراج زيارة بدون الاعتماد على `prisma generate` لنموذج SiteVisit */
export async function insertSiteVisit(input: {
  visitorId: string;
  country: string;
  path: string;
}): Promise<void> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await db.$executeRaw`
    INSERT INTO "SiteVisit" ("id", "createdAt", "country", "visitorId", "path")
    VALUES (${id}, ${createdAt}, ${input.country}, ${input.visitorId}, ${input.path})
  `;
}

export type SiteVisitAnalytics = {
  preset: string;
  fromInclusiveYmd: string;
  toInclusiveYmd: string;
  pageViewsInRange: number;
  uniqueVisitorsInRange: number;
  avgPageViewsPerDay: number;
  peakDay: { day: string; views: number } | null;
  /** تقويم اليوم الحالي UTC (ثابت بغض النظر عن الفلتر) */
  todayPageViewsUtc: number;
  todayUniqueVisitorsUtc: number;
  byCountry: { country: string; visits: number }[];
  daily: { day: string; views: number }[];
};

function num(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'bigint' ? Number(v) : v;
}

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * MS_DAY);
}

export async function loadSiteVisitAnalytics(
  range: UtcRange,
  meta: { preset: string; fromInclusiveYmd: string; toInclusiveYmd: string },
  now: Date
): Promise<SiteVisitAnalytics> {
  const { fromIso, toExclusiveIso } = range;
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const todayStartIso = todayStart.toISOString();
  const tomorrowStartIso = tomorrowStart.toISOString();

  const [
    pageViewsRow,
    uniqueRow,
    countryRows,
    recentRows,
    todayPvRow,
    todayUvRow,
  ] = await Promise.all([
    db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM "SiteVisit"
      WHERE "createdAt" >= ${fromIso} AND "createdAt" < ${toExclusiveIso}
    `,
    db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT "visitorId") AS n FROM "SiteVisit"
      WHERE "createdAt" >= ${fromIso} AND "createdAt" < ${toExclusiveIso}
    `,
    db.$queryRaw<Array<{ country: string; visits: bigint }>>`
      SELECT "country", COUNT(*) AS visits FROM "SiteVisit"
      WHERE "createdAt" >= ${fromIso} AND "createdAt" < ${toExclusiveIso}
      GROUP BY "country" ORDER BY visits DESC LIMIT 50
    `,
    db.$queryRaw<Array<{ createdAt: string | Date }>>`
      SELECT "createdAt" FROM "SiteVisit"
      WHERE "createdAt" >= ${fromIso} AND "createdAt" < ${toExclusiveIso}
    `,
    db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM "SiteVisit"
      WHERE "createdAt" >= ${todayStartIso} AND "createdAt" < ${tomorrowStartIso}
    `,
    db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT "visitorId") AS n FROM "SiteVisit"
      WHERE "createdAt" >= ${todayStartIso} AND "createdAt" < ${tomorrowStartIso}
    `,
  ]);

  const dailyMap = new Map<string, number>();
  for (const row of recentRows) {
    const raw = row.createdAt as unknown;
    const d =
      raw instanceof Date
        ? raw.toISOString().slice(0, 10)
        : typeof raw === 'string'
          ? raw.slice(0, 10)
          : '';
    if (!d) continue;
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + 1);
  }
  const daily = [...dailyMap.entries()]
    .map(([day, views]) => ({ day, views }))
    .sort((a, b) => b.day.localeCompare(a.day));

  const pageViewsInRange = num(pageViewsRow[0]?.n);
  const uniqueVisitorsInRange = num(uniqueRow[0]?.n);

  const fromDay = new Date(`${meta.fromInclusiveYmd}T00:00:00.000Z`);
  const toDay = new Date(`${meta.toInclusiveYmd}T00:00:00.000Z`);
  const dayCount = Math.max(1, Math.floor((toDay.getTime() - fromDay.getTime()) / MS_DAY) + 1);
  const avgPageViewsPerDay = pageViewsInRange / dayCount;

  let peakDay: { day: string; views: number } | null = null;
  for (const row of daily) {
    if (!peakDay || row.views > peakDay.views) peakDay = { day: row.day, views: row.views };
  }

  return {
    preset: meta.preset,
    fromInclusiveYmd: meta.fromInclusiveYmd,
    toInclusiveYmd: meta.toInclusiveYmd,
    pageViewsInRange,
    uniqueVisitorsInRange,
    avgPageViewsPerDay,
    peakDay,
    todayPageViewsUtc: num(todayPvRow[0]?.n),
    todayUniqueVisitorsUtc: num(todayUvRow[0]?.n),
    byCountry: countryRows.map((r) => ({ country: r.country, visits: num(r.visits) })),
    daily,
  };
}
