import { db, ensureSqliteSchema } from '@/lib/db';
import { DEFAULT_MARKET_SYMBOL_ROWS, type FinnhubForexSymbolRow } from '@/lib/finnhub-types';

function parseSymbolRows(raw: string | null): FinnhubForexSymbolRow[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j
      .filter(
        (x): x is FinnhubForexSymbolRow =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as FinnhubForexSymbolRow).finnhubSymbol === 'string' &&
          typeof (x as FinnhubForexSymbolRow).pair === 'string'
      )
      .map((x) => ({
        finnhubSymbol: String(x.finnhubSymbol).trim(),
        pair: String(x.pair).trim(),
      }))
      .filter((x) => x.finnhubSymbol && x.pair);
  } catch {
    return [];
  }
}

function mergeWithDefaults(rows: FinnhubForexSymbolRow[]): FinnhubForexSymbolRow[] {
  const out = [...rows];
  const havePair = new Set(rows.map((r) => r.pair.trim().toUpperCase()));
  for (const d of DEFAULT_MARKET_SYMBOL_ROWS) {
    const key = d.pair.trim().toUpperCase();
    if (!havePair.has(key)) {
      out.push(d);
    }
  }
  return out;
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j
      .map((x) => String(x ?? '').trim().toUpperCase())
      .filter((x) => /^[A-Z0-9_-]{2,16}$/.test(x));
  } catch {
    return [];
  }
}

/** للواجهات العامة — بدون إرجاع المفتاح */
export async function readForexFinnhubPublic(): Promise<{
  forexRealtimeEnabled: boolean;
  finnhubApiKeySet: boolean;
  finnhubForexSymbolRows: FinnhubForexSymbolRow[];
}> {
  await ensureSqliteSchema();
  const idRow = await db.siteSettings.findFirst({ select: { id: true } });
  if (!idRow) {
    return { forexRealtimeEnabled: false, finnhubApiKeySet: false, finnhubForexSymbolRows: [] };
  }
  try {
    const rows = await db.$queryRawUnsafe<
      Array<{
        forexRealtimeEnabled: number | null;
        finnhubApiKey: string | null;
        finnhubForexSymbolMap: string | null;
      }>
    >('SELECT forexRealtimeEnabled, finnhubApiKey, finnhubForexSymbolMap FROM SiteSettings WHERE id = ? LIMIT 1', idRow.id);
    const r = rows[0];
    if (!r) {
      return { forexRealtimeEnabled: false, finnhubApiKeySet: false, finnhubForexSymbolRows: [] };
    }
    return {
      forexRealtimeEnabled: Boolean(r.forexRealtimeEnabled),
      finnhubApiKeySet: !!(r.finnhubApiKey && String(r.finnhubApiKey).length > 0),
      finnhubForexSymbolRows: mergeWithDefaults(parseSymbolRows(r.finnhubForexSymbolMap)),
    };
  } catch {
    return { forexRealtimeEnabled: false, finnhubApiKeySet: false, finnhubForexSymbolRows: [] };
  }
}

/** للخادم الداخلي (Finnhub hub) — يتضمن المفتاح */
export async function readForexFinnhubSecrets(): Promise<{
  enabled: boolean;
  apiKey: string | null;
  rows: FinnhubForexSymbolRow[];
}> {
  await ensureSqliteSchema();
  const idRow = await db.siteSettings.findFirst({ select: { id: true } });
  if (!idRow) return { enabled: false, apiKey: null, rows: [] };
  try {
    const rows = await db.$queryRawUnsafe<
      Array<{
        forexRealtimeEnabled: number | null;
        finnhubApiKey: string | null;
        finnhubForexSymbolMap: string | null;
      }>
    >('SELECT forexRealtimeEnabled, finnhubApiKey, finnhubForexSymbolMap FROM SiteSettings WHERE id = ? LIMIT 1', idRow.id);
    const r = rows[0];
    if (!r) return { enabled: false, apiKey: null, rows: [] };
    const key = r.finnhubApiKey?.trim() ?? null;
    return {
      enabled: Boolean(r.forexRealtimeEnabled),
      apiKey: key && key.length > 0 ? key : null,
      rows: mergeWithDefaults(parseSymbolRows(r.finnhubForexSymbolMap)),
    };
  } catch {
    return { enabled: false, apiKey: null, rows: [] };
  }
}

export async function patchForexFinnhubSettings(
  settingsId: string,
  patch: {
    forexRealtimeEnabled?: boolean;
    finnhubForexSymbolRows?: FinnhubForexSymbolRow[];
    finnhubApiKey?: string | null;
    clearFinnhubApiKey?: boolean;
  }
): Promise<void> {
  await ensureSqliteSchema();
  const cur = await db.$queryRawUnsafe<
    Array<{
      forexRealtimeEnabled: number | null;
      finnhubApiKey: string | null;
      finnhubForexSymbolMap: string | null;
    }>
  >('SELECT forexRealtimeEnabled, finnhubApiKey, finnhubForexSymbolMap FROM SiteSettings WHERE id = ? LIMIT 1', settingsId);
  const r = cur[0];
  if (!r) return;

  let enabled = Boolean(r.forexRealtimeEnabled);
  if (typeof patch.forexRealtimeEnabled === 'boolean') enabled = patch.forexRealtimeEnabled;

  let key: string | null = r.finnhubApiKey;
  if (patch.clearFinnhubApiKey) key = null;
  else if (typeof patch.finnhubApiKey === 'string' && patch.finnhubApiKey.trim().length > 0) {
    key = patch.finnhubApiKey.trim().slice(0, 256);
  }

  let mapJson = r.finnhubForexSymbolMap ?? '[]';
  if (Array.isArray(patch.finnhubForexSymbolRows)) {
    const cleaned = patch.finnhubForexSymbolRows
      .map((x) => ({
        finnhubSymbol: String(x.finnhubSymbol ?? '').trim(),
        pair: String(x.pair ?? '').trim(),
      }))
      .filter((x) => x.finnhubSymbol && x.pair)
      .slice(0, 48);
    mapJson = JSON.stringify(cleaned);
  }

  await db.$executeRawUnsafe(
    'UPDATE SiteSettings SET forexRealtimeEnabled = ?, finnhubApiKey = ?, finnhubForexSymbolMap = ? WHERE id = ?',
    enabled ? 1 : 0,
    key,
    mapJson,
    settingsId
  );
}

export async function readCryptoRealtimePublic(): Promise<{
  cryptoRealtimeEnabled: boolean;
  cryptoRealtimeCodes: string[];
}> {
  await ensureSqliteSchema();
  const idRow = await db.siteSettings.findFirst({ select: { id: true } });
  if (!idRow) {
    return { cryptoRealtimeEnabled: false, cryptoRealtimeCodes: [] };
  }
  try {
    const rows = await db.$queryRawUnsafe<
      Array<{
        cryptoRealtimeEnabled: number | null;
        cryptoRealtimeCodes: string | null;
      }>
    >('SELECT cryptoRealtimeEnabled, cryptoRealtimeCodes FROM SiteSettings WHERE id = ? LIMIT 1', idRow.id);
    const r = rows[0];
    if (!r) return { cryptoRealtimeEnabled: false, cryptoRealtimeCodes: [] };
    return {
      cryptoRealtimeEnabled: Boolean(r.cryptoRealtimeEnabled),
      cryptoRealtimeCodes: parseStringArray(r.cryptoRealtimeCodes),
    };
  } catch {
    return { cryptoRealtimeEnabled: false, cryptoRealtimeCodes: [] };
  }
}

export async function readCryptoRealtimeSecrets(): Promise<{
  enabled: boolean;
  codes: string[];
}> {
  const p = await readCryptoRealtimePublic();
  return { enabled: p.cryptoRealtimeEnabled, codes: p.cryptoRealtimeCodes };
}

export async function patchCryptoRealtimeSettings(
  settingsId: string,
  patch: {
    cryptoRealtimeEnabled?: boolean;
    cryptoRealtimeCodes?: string[];
  }
): Promise<void> {
  await ensureSqliteSchema();
  const cur = await db.$queryRawUnsafe<
    Array<{
      cryptoRealtimeEnabled: number | null;
      cryptoRealtimeCodes: string | null;
    }>
  >('SELECT cryptoRealtimeEnabled, cryptoRealtimeCodes FROM SiteSettings WHERE id = ? LIMIT 1', settingsId);
  const r = cur[0];
  if (!r) return;

  let enabled = Boolean(r.cryptoRealtimeEnabled);
  if (typeof patch.cryptoRealtimeEnabled === 'boolean') enabled = patch.cryptoRealtimeEnabled;

  let codes = parseStringArray(r.cryptoRealtimeCodes);
  if (Array.isArray(patch.cryptoRealtimeCodes)) {
    codes = patch.cryptoRealtimeCodes
      .map((x) => String(x ?? '').trim().toUpperCase())
      .filter((x) => /^[A-Z0-9_-]{2,16}$/.test(x))
      .slice(0, 40);
  }

  await db.$executeRawUnsafe(
    'UPDATE SiteSettings SET cryptoRealtimeEnabled = ?, cryptoRealtimeCodes = ? WHERE id = ?',
    enabled ? 1 : 0,
    JSON.stringify(codes),
    settingsId
  );
}
