import { db } from '@/lib/db';

export type FuelVisibilityMap = Record<string, boolean>;

function parseFuelVisibilityMap(raw: string | null): FuelVisibilityMap {
  if (!raw || String(raw).trim() === '') return {};
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
    const out: FuelVisibilityMap = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const code = String(k || '').trim().toUpperCase();
      if (!code) continue;
      out[code] = Boolean(v);
    }
    return out;
  } catch {
    return {};
  }
}

export async function readFuelVisibilityMap(settingsId?: string): Promise<FuelVisibilityMap> {
  try {
    const rows = settingsId
      ? await db.$queryRawUnsafe<Array<{ fuelVisibilityMap: string | null }>>(
          'SELECT fuelVisibilityMap FROM SiteSettings WHERE id = ? LIMIT 1',
          settingsId
        )
      : await db.$queryRawUnsafe<Array<{ fuelVisibilityMap: string | null }>>(
          'SELECT fuelVisibilityMap FROM SiteSettings ORDER BY updatedAt DESC LIMIT 1'
        );
    return parseFuelVisibilityMap(rows?.[0]?.fuelVisibilityMap ?? null);
  } catch {
    return {};
  }
}

export async function patchFuelVisibilityMap(
  settingsId: string,
  patch: FuelVisibilityMap
): Promise<void> {
  const current = await readFuelVisibilityMap(settingsId);
  const merged: FuelVisibilityMap = { ...current };
  for (const [codeRaw, visibleRaw] of Object.entries(patch)) {
    const code = String(codeRaw || '').trim().toUpperCase();
    if (!code) continue;
    merged[code] = Boolean(visibleRaw);
  }
  await db.$executeRawUnsafe(
    'UPDATE SiteSettings SET fuelVisibilityMap = ? WHERE id = ?',
    JSON.stringify(merged),
    settingsId
  );
}

