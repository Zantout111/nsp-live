import { EventEmitter } from 'node:events';
import { ensureSqliteSchema } from '@/lib/db';
import { fetchCoinGeckoForCodes } from '@/lib/free-market-rates';
import { readCryptoRealtimeSecrets } from '@/lib/forex-finnhub-db';

type CryptoState = { price: number; change: number; baseline: number; updatedAt: number };

const RUNTIME_KEY = '__SYP_CRYPTO_LIVE_RUNTIME__' as const;

type CryptoRuntime = {
  hub: EventEmitter;
  byCode: Map<string, CryptoState>;
  timer: ReturnType<typeof setInterval> | null;
  enabled: boolean;
  codes: string[];
};

function rt(): CryptoRuntime {
  const g = globalThis as unknown as Record<string, CryptoRuntime>;
  if (!g[RUNTIME_KEY]) {
    const hub = new EventEmitter();
    hub.setMaxListeners(200);
    g[RUNTIME_KEY] = {
      hub,
      byCode: new Map(),
      timer: null,
      enabled: false,
      codes: [],
    };
  }
  return g[RUNTIME_KEY];
}

function stopPoll() {
  const s = rt();
  if (s.timer) clearInterval(s.timer);
  s.timer = null;
}

export type CryptoHubSnapshot = {
  rates: Record<string, { price: number; change: number; updatedAt: number }>;
  enabled: boolean;
};

function buildSnapshot(): CryptoHubSnapshot {
  const s = rt();
  const rates: Record<string, { price: number; change: number; updatedAt: number }> = {};
  for (const [code, v] of s.byCode) {
    rates[code] = { price: v.price, change: v.change, updatedAt: v.updatedAt };
  }
  return { rates, enabled: s.enabled };
}

async function pollCryptoOnce() {
  const s = rt();
  if (!s.enabled || s.codes.length === 0) return;
  const map = await fetchCoinGeckoForCodes(s.codes);
  if (map.size === 0) return;
  let changed = false;
  for (const code of s.codes) {
    const row = map.get(code);
    if (!row) continue;
    const prev = s.byCode.get(code);
    const baseline = prev ? prev.baseline : row.price;
    s.byCode.set(code, {
      price: row.price,
      change: row.change,
      baseline,
      updatedAt: Date.now(),
    });
    changed = true;
  }
  if (changed) s.hub.emit('tick', buildSnapshot());
}

function startPoll() {
  stopPoll();
  void pollCryptoOnce();
  rt().timer = setInterval(() => void pollCryptoOnce(), 1_000);
}

export function getCryptoLiveSnapshot(): Record<string, { price: number; change: number; updatedAt: number }> {
  return buildSnapshot().rates;
}

export function onCryptoHubTick(fn: (snap: CryptoHubSnapshot) => void): () => void {
  const s = rt();
  const listener = (snap: CryptoHubSnapshot) => fn(snap);
  s.hub.on('tick', listener);
  return () => s.hub.off('tick', listener);
}

export async function restartCryptoBridge(): Promise<void> {
  const s = rt();
  stopPoll();
  await ensureSqliteSchema();
  const cfg = await readCryptoRealtimeSecrets();
  s.enabled = cfg.enabled;
  s.codes = cfg.codes;

  if (!s.enabled || s.codes.length === 0) {
    s.byCode.clear();
    s.hub.emit('tick', buildSnapshot());
    return;
  }
  startPoll();
}
