import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { prismaErrorForUser } from '@/lib/prisma-sync-error';
import { executeSpTodaySync } from '@/lib/sp-today-sync';
import {
  ensureSyncCategoriesComplete,
  mergeSyncConfig,
  mirrorLegacyFromCurrencies,
  SYNC_CATEGORY_IDS,
  type SyncCategoryId,
  type SyncConfigV1,
} from '@/lib/sync-config';

function summarizeSyncFailures(
  results: Partial<
    Record<SyncCategoryId, { ok?: boolean; message?: string }>
  >
): string {
  const parts = (SYNC_CATEGORY_IDS as readonly SyncCategoryId[])
    .map((id) => {
      const r = results[id];
      if (!r || r.ok) return null;
      return `${id}: ${r.message ?? 'failed'}`;
    })
    .filter(Boolean) as string[];
  return parts.length ? parts.join(' | ') : 'All categories failed';
}

async function safeParseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text || !text.trim()) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

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

async function loadMergedConfig(): Promise<{ merged: SyncConfigV1; rowId: string | null }> {
  const settings = await db.siteSettings.findFirst();
  if (!settings) {
    const leg = legacyFromRow({ updateInterval: 6, adjustmentAmount: 250, adjustmentType: 'deduction' });
    return {
      merged: ensureSyncCategoriesComplete(mergeSyncConfig(null, leg), leg),
      rowId: null,
    };
  }
  const leg = legacyFromRow(settings);
  const merged = ensureSyncCategoriesComplete(mergeSyncConfig(settings.syncConfig, leg), leg);
  return { merged, rowId: settings.id };
}

async function persistConfig(rowId: string | null, merged: SyncConfigV1) {
  const mirror = mirrorLegacyFromCurrencies(merged);
  if (rowId) {
    await db.siteSettings.update({
      where: { id: rowId },
      data: { syncConfig: merged as object, lastUpdate: new Date() },
    });
  } else {
    await db.siteSettings.create({
      data: {
        siteName: 'سعر الليرة السورية',
        updateInterval: mirror.updateInterval,
        adjustmentAmount: mirror.adjustmentAmount,
        adjustmentType: mirror.adjustmentType,
        syncConfig: merged as object,
        lastUpdate: new Date(),
      },
    });
  }
}

// GET - Check fetch status and settings
export async function GET() {
  try {
    const { merged } = await loadMergedConfig();
    const settings = await db.siteSettings.findFirst();

    return NextResponse.json({
      success: true,
      settings: {
        autoUpdateEnabled: settings?.autoUpdateEnabled ?? true,
        updateInterval: settings?.updateInterval ?? 6,
        adjustmentAmount: settings?.adjustmentAmount ?? 250,
        adjustmentType: settings?.adjustmentType ?? 'deduction',
        lastFetchTime: settings?.lastFetchTime,
        syncConfig: merged,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST - Fetch from SP Today (manual: all enabled categories unless `categories` specified)
export async function POST(request: Request) {
  try {
    const body = await safeParseJsonBody(request);
    const only = Array.isArray(body.categories)
      ? (body.categories.filter((x: unknown) =>
          SYNC_CATEGORY_IDS.includes(x as SyncCategoryId)
        ) as SyncCategoryId[])
      : null;

    const { merged, rowId } = await loadMergedConfig();
    const toRun: SyncCategoryId[] =
      only && only.length > 0
        ? only
        : SYNC_CATEGORY_IDS.filter((id) => merged.categories[id]?.enabled !== false);

    if (toRun.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No enabled categories to sync. Enable at least one in sync settings.',
      });
    }

    const { results, config: nextConfig } = await executeSpTodaySync({
      db,
      config: merged,
      categories: toRun,
    });

    const anyOk = Object.values(results).some((r) => r?.ok);
    if (rowId || anyOk) {
      await persistConfig(rowId, nextConfig);
    }
    if (anyOk) {
      const s = await db.siteSettings.findFirst();
      if (s) {
        await db.siteSettings.update({
          where: { id: s.id },
          data: { lastFetchTime: new Date(), lastUpdate: new Date() },
        });
        const cur = results.currencies;
        if (cur?.ok && (cur.updated ?? 0) > 0) {
          try {
            await db.$executeRawUnsafe(`UPDATE SiteSettings SET manualRatesPinned = 0 WHERE id = ?`, s.id);
          } catch {
            // عمود اختياري في قواعد قديمة؛ لا نُفشل المزامنة بسببه.
          }
        }
      }
    }

    return NextResponse.json({
      success: anyOk,
      error: anyOk ? undefined : summarizeSyncFailures(results),
      message: anyOk ? 'Sync completed' : 'Sync finished with errors',
      categories: toRun,
      results,
      lastFetchedAt: nextConfig.lastFetchedAt,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SP Today] Error fetching rates:', error);
    return NextResponse.json(
      {
        success: false,
        error: prismaErrorForUser(error),
      },
      { status: 500 }
    );
  }
}

// PUT - Update sync settings (full syncConfig or legacy fields)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      autoUpdateEnabled,
      updateInterval,
      adjustmentAmount,
      adjustmentType,
      syncConfig: partialSync,
    } = body;

    const settings = await db.siteSettings.findFirst();
    const legacy = legacyFromRow(
      settings ?? { updateInterval: 6, adjustmentAmount: 250, adjustmentType: 'deduction' }
    );
    let merged = mergeSyncConfig(settings?.syncConfig, legacy);

    if (partialSync && typeof partialSync === 'object') {
      const p = partialSync as Partial<SyncConfigV1>;
      if (p.categories && typeof p.categories === 'object') {
        for (const id of SYNC_CATEGORY_IDS) {
          const patch = (p.categories as Record<string, unknown>)[id];
          if (patch && typeof patch === 'object') {
            merged.categories[id] = {
              ...merged.categories[id],
              ...(patch as object),
            } as (typeof merged.categories)[typeof id];
          }
        }
      }
      if (p.lastFetchedAt && typeof p.lastFetchedAt === 'object') {
        merged.lastFetchedAt = { ...merged.lastFetchedAt, ...(p.lastFetchedAt as object) };
      }
    }

    if (typeof updateInterval === 'number' && updateInterval > 0) {
      const mins = Math.round(updateInterval * 60);
      for (const id of SYNC_CATEGORY_IDS) {
        merged.categories[id] = { ...merged.categories[id], intervalMinutes: mins };
      }
    }
    if (typeof adjustmentAmount === 'number' && adjustmentAmount >= 0) {
      merged.categories.currencies = {
        ...merged.categories.currencies,
        adjustmentMode: 'fixed',
        adjustmentValue: adjustmentAmount,
      };
    }
    if (adjustmentType === 'deduction' || adjustmentType === 'addition') {
      merged.categories.currencies = {
        ...merged.categories.currencies,
        adjustmentDirection: adjustmentType,
      };
    }

    const mirror = mirrorLegacyFromCurrencies(merged);

    const row = {
      syncConfig: merged as object,
      lastUpdate: new Date(),
      updateInterval: mirror.updateInterval,
      adjustmentAmount: mirror.adjustmentAmount,
      adjustmentType: mirror.adjustmentType,
      ...(typeof autoUpdateEnabled === 'boolean' ? { autoUpdateEnabled } : {}),
    };

    if (settings) {
      await db.siteSettings.update({
        where: { id: settings.id },
        data: row,
      });
    } else {
      await db.siteSettings.create({
        data: {
          siteName: 'سعر الليرة السورية',
          autoUpdateEnabled: autoUpdateEnabled ?? true,
          ...row,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
