import { db } from '@/lib/db';
import { executeSpTodaySync } from '@/lib/sp-today-sync';
import {
  ensureSyncCategoriesComplete,
  mergeSyncConfig,
  SYNC_CATEGORY_IDS,
  type SyncCategoryId,
} from '@/lib/sync-config';

function legacyFromRow(s: {
  updateInterval: number;
  adjustmentAmount: number;
  adjustmentType: string;
}) {
  return {
    updateIntervalHours: s.updateInterval ?? 6,
    adjustmentAmount: s.adjustmentAmount ?? 250,
    adjustmentType: (s.adjustmentType === 'addition' ? 'addition' : 'deduction') as 'deduction' | 'addition',
  };
}

function minutesSince(iso?: string): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
}

/** فئات المزامنة التلقائية فقط (بدون فوركس/عملات رقمية من التبويب) */
const SCHEDULED_SYNC_IDS: SyncCategoryId[] = ['currencies', 'gold', 'fuel'];

function dueCategories(force: boolean, merged: ReturnType<typeof mergeSyncConfig>): SyncCategoryId[] {
  const pool: readonly SyncCategoryId[] = force ? SYNC_CATEGORY_IDS : SCHEDULED_SYNC_IDS;
  if (force) {
    return pool.filter((id) => merged.categories[id]?.enabled !== false);
  }
  const out: SyncCategoryId[] = [];
  for (const id of pool) {
    const c = merged.categories[id];
    if (!c || c.enabled === false) continue;
    const last = merged.lastFetchedAt[id];
    const mins = typeof c.intervalMinutes === 'number' && c.intervalMinutes >= 1 ? c.intervalMinutes : 60;
    if (minutesSince(last) >= mins) {
      out.push(id);
    }
  }
  return out;
}

export type RunDueSyncResult =
  | {
      skipped: true;
      message: string;
      merged: ReturnType<typeof mergeSyncConfig>;
      settings: Awaited<ReturnType<typeof db.siteSettings.findFirst>>;
    }
  | {
      skipped: false;
      results: Awaited<ReturnType<typeof executeSpTodaySync>>['results'];
      nextConfig: Awaited<ReturnType<typeof executeSpTodaySync>>['config'];
      categories: SyncCategoryId[];
      anyOk: boolean;
    };

/**
 * جدولة المزامنة: يُستدعى من /api/cron أو من المؤقت الداخلي في الإنتاج.
 */
export async function runDueSyncCron(force: boolean): Promise<RunDueSyncResult> {
  const settings = await db.siteSettings.findFirst();
  const leg = legacyFromRow(settings ?? { updateInterval: 6, adjustmentAmount: 250, adjustmentType: 'deduction' });
  const merged = ensureSyncCategoriesComplete(mergeSyncConfig(settings?.syncConfig, leg), leg);

  if (!settings?.autoUpdateEnabled && !force) {
    return {
      skipped: true,
      message: 'Auto-update is disabled',
      merged,
      settings,
    };
  }

  const toRun = dueCategories(force, merged);
  if (toRun.length === 0) {
    return {
      skipped: true,
      message: force ? 'No enabled categories' : 'No category reached its interval yet',
      merged,
      settings,
    };
  }

  const { results, config: nextConfig } = await executeSpTodaySync({
    db,
    config: merged,
    categories: toRun,
  });

  const anyOk = Object.values(results).some((r) => r?.ok);
  if (settings) {
    await db.siteSettings.update({
      where: { id: settings.id },
      data: {
        syncConfig: nextConfig as object,
        lastUpdate: new Date(),
        ...(anyOk ? { lastFetchTime: new Date() } : {}),
      },
    });
    const cur = results.currencies;
    if (cur?.ok && (cur.updated ?? 0) > 0) {
      try {
        await db.$executeRawUnsafe(`UPDATE SiteSettings SET manualRatesPinned = 0 WHERE id = ?`, settings.id);
      } catch {
        // ignore on old schemas
      }
    }
  } else if (anyOk) {
    await db.siteSettings.create({
      data: {
        siteName: 'سعر الليرة السورية',
        syncConfig: nextConfig as object,
        lastFetchTime: new Date(),
        lastUpdate: new Date(),
      },
    });
  }

  return {
    skipped: false,
    results,
    nextConfig,
    categories: toRun,
    anyOk,
  };
}
