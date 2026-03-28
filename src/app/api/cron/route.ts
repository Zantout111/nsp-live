import { NextResponse } from 'next/server';
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

function dueCategories(force: boolean, merged: ReturnType<typeof mergeSyncConfig>): SyncCategoryId[] {
  if (force) {
    return SYNC_CATEGORY_IDS.filter((id) => merged.categories[id]?.enabled !== false);
  }
  const out: SyncCategoryId[] = [];
  for (const id of SYNC_CATEGORY_IDS) {
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

async function runDueSync(force: boolean) {
  const settings = await db.siteSettings.findFirst();
  const leg = legacyFromRow(settings ?? { updateInterval: 6, adjustmentAmount: 250, adjustmentType: 'deduction' });
  const merged = ensureSyncCategoriesComplete(mergeSyncConfig(settings?.syncConfig, leg), leg);

  if (!settings?.autoUpdateEnabled && !force) {
    return {
      skipped: true as const,
      message: 'Auto-update is disabled',
      merged,
      settings,
    };
  }

  const toRun = dueCategories(force, merged);
  if (toRun.length === 0) {
    return {
      skipped: true as const,
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
    skipped: false as const,
    results,
    nextConfig,
    categories: toRun,
    anyOk,
  };
}

// GET — استدعاء من جدولة خارجية مع ?secret=
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const cronSecret = searchParams.get('secret');
    const validSecret = process.env.CRON_SECRET || 'syp-rates-cron-2024';

    if (!force && cronSecret !== validSecret) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - invalid or missing secret' },
        { status: 401 }
      );
    }

    const out = await runDueSync(force);

    if (out.skipped) {
      return NextResponse.json({
        success: true,
        message: out.message,
        settings: out.settings
          ? {
              autoUpdateEnabled: out.settings.autoUpdateEnabled,
              lastFetchTime: out.settings.lastFetchTime,
            }
          : undefined,
      });
    }

    return NextResponse.json({
      success: out.anyOk,
      message: out.anyOk ? 'Cron sync completed' : 'Cron sync had errors',
      categories: out.categories,
      results: out.results,
      lastFetchedAt: out.nextConfig.lastFetchedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { success: false, message: 'Cron job failed', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const settings = await db.siteSettings.findFirst();
    if (!settings?.autoUpdateEnabled) {
      return NextResponse.json({ success: false, message: 'Auto-update is disabled' });
    }
    const out = await runDueSync(true);
    if (out.skipped) {
      return NextResponse.json({ success: false, message: out.message });
    }
    return NextResponse.json({
      success: out.anyOk,
      message: out.anyOk ? 'Sync completed' : 'Sync had errors',
      categories: out.categories,
      results: out.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Cron job failed', error: String(error) },
      { status: 500 }
    );
  }
}
