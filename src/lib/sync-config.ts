import type { Prisma } from '@prisma/client';

export const SYNC_CATEGORY_IDS = ['currencies', 'gold', 'fuel', 'crypto', 'forex'] as const;
export type SyncCategoryId = (typeof SYNC_CATEGORY_IDS)[number];

export interface CategorySyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  adjustmentMode: 'fixed' | 'percent';
  adjustmentValue: number;
  adjustmentDirection: 'deduction' | 'addition';
}

export interface SyncConfigV1 {
  version: 1;
  categories: Record<SyncCategoryId, CategorySyncConfig>;
  lastFetchedAt: Partial<Record<SyncCategoryId, string>>;
}

function cat(
  enabled: boolean,
  intervalMinutes: number,
  mode: 'fixed' | 'percent',
  value: number,
  direction: 'deduction' | 'addition'
): CategorySyncConfig {
  return { enabled, intervalMinutes, adjustmentMode: mode, adjustmentValue: value, adjustmentDirection: direction };
}

export function defaultSyncConfigV1(legacy: {
  updateIntervalHours: number;
  adjustmentAmount: number;
  adjustmentType: 'deduction' | 'addition';
}): SyncConfigV1 {
  const m = Math.max(15, Math.round(legacy.updateIntervalHours * 60));
  return {
    version: 1,
    categories: {
      currencies: cat(true, m, 'fixed', legacy.adjustmentAmount, legacy.adjustmentType),
      gold: cat(true, m, 'percent', 0, 'deduction'),
      fuel: cat(true, m, 'fixed', 0, 'deduction'),
      /** لا تُفعّل تلقائياً — التحديث من لوحة التحكم فقط */
      crypto: cat(false, m, 'percent', 0, 'deduction'),
      forex: cat(false, m, 'percent', 0, 'deduction'),
    },
    lastFetchedAt: {},
  };
}

function isCategorySyncConfig(x: unknown): x is CategorySyncConfig {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.enabled === 'boolean' &&
    typeof o.intervalMinutes === 'number' &&
    o.intervalMinutes >= 1 &&
    (o.adjustmentMode === 'fixed' || o.adjustmentMode === 'percent') &&
    typeof o.adjustmentValue === 'number' &&
    o.adjustmentValue >= 0 &&
    (o.adjustmentDirection === 'deduction' || o.adjustmentDirection === 'addition')
  );
}

export function mergeSyncConfig(
  raw: Prisma.JsonValue | null | undefined,
  legacy: {
    updateIntervalHours: number;
    adjustmentAmount: number;
    adjustmentType: 'deduction' | 'addition';
  }
): SyncConfigV1 {
  const base = defaultSyncConfigV1(legacy);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 && o.version !== undefined) {
    return base;
  }
  const cats = o.categories;
  if (!cats || typeof cats !== 'object') {
    return base;
  }
  for (const id of SYNC_CATEGORY_IDS) {
    const patch = (cats as Record<string, unknown>)[id];
    if (isCategorySyncConfig(patch)) {
      base.categories[id] = { ...base.categories[id], ...patch };
    }
  }
  const last = o.lastFetchedAt;
  if (last && typeof last === 'object' && !Array.isArray(last)) {
    for (const id of SYNC_CATEGORY_IDS) {
      const v = (last as Record<string, unknown>)[id];
      if (typeof v === 'string') {
        base.lastFetchedAt[id] = v;
      }
    }
  }
  return base;
}

/** يضمن وجود كل مفتاح فئة بعد دمج JSON قد يكون ناقصاً */
export function ensureSyncCategoriesComplete(
  cfg: SyncConfigV1,
  legacy: { updateIntervalHours: number; adjustmentAmount: number; adjustmentType: 'deduction' | 'addition' }
): SyncConfigV1 {
  const fallback = defaultSyncConfigV1(legacy);
  for (const id of SYNC_CATEGORY_IDS) {
    if (!cfg.categories[id]) {
      cfg.categories[id] = fallback.categories[id];
    }
  }
  return cfg;
}

export function applyAdjustmentToNumber(value: number, c: CategorySyncConfig): number {
  const { adjustmentMode, adjustmentValue, adjustmentDirection } = c;
  const sign = adjustmentDirection === 'deduction' ? -1 : 1;
  if (adjustmentMode === 'percent') {
    const factor = 1 + (sign * adjustmentValue) / 100;
    return Math.max(0, value * factor);
  }
  return Math.max(0, value + sign * adjustmentValue);
}

export function mirrorLegacyFromCurrencies(cfg: SyncConfigV1): {
  updateInterval: number;
  adjustmentAmount: number;
  adjustmentType: 'deduction' | 'addition';
} {
  const c = cfg.categories.currencies;
  return {
    updateInterval: Math.max(1, Math.round(c.intervalMinutes / 60)),
    adjustmentAmount: Math.round(c.adjustmentMode === 'fixed' ? c.adjustmentValue : 0),
    adjustmentType: c.adjustmentDirection,
  };
}
