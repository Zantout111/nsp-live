import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { ensureSqliteSchema } from '@/lib/db';
import { readForexFinnhubSecrets } from '@/lib/forex-finnhub-db';
import type { FinnhubForexSymbolRow } from '@/lib/finnhub-types';

export type { FinnhubForexSymbolRow } from '@/lib/finnhub-types';

type PairState = { rate: number; baseline: number; updatedAt: number };

/** مفتاح على globalThis حتى لا تُنسَخ الحالة بين حِزم Turbopack/Next (كان يُفضّي getForexLiveSnapshot() في المسارات). */
const RUNTIME_KEY = '__SYP_FINNHUB_FOREX_RUNTIME__' as const;

type FinnhubRuntime = {
  hub: EventEmitter;
  pairState: Map<string, PairState>;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  reconnectPaused: boolean;
  symbolRows: FinnhubForexSymbolRow[];
  apiKey: string;
};

function rt(): FinnhubRuntime {
  const g = globalThis as unknown as Record<string, FinnhubRuntime>;
  if (!g[RUNTIME_KEY]) {
    const hub = new EventEmitter();
    hub.setMaxListeners(200);
    g[RUNTIME_KEY] = {
      hub,
      pairState: new Map(),
      ws: null,
      reconnectTimer: null,
      pingTimer: null,
      pollTimer: null,
      reconnectPaused: true,
      symbolRows: [],
      apiKey: '',
    };
  }
  return g[RUNTIME_KEY];
}

function stopPoll() {
  const s = rt();
  if (s.pollTimer) clearInterval(s.pollTimer);
  s.pollTimer = null;
}

function clearTimers() {
  const s = rt();
  if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
  s.reconnectTimer = null;
  if (s.pingTimer) clearInterval(s.pingTimer);
  s.pingTimer = null;
}

function closeSocketOnly() {
  clearTimers();
  const s = rt();
  if (s.ws) {
    try {
      s.ws.removeAllListeners();
      s.ws.close();
    } catch {
      /* ignore */
    }
    s.ws = null;
  }
}

export type ForexHubSnapshot = {
  rates: Record<string, { rate: number; change: number; updatedAt: number }>;
  connected: boolean;
};

function buildSnapshot(): ForexHubSnapshot {
  const s = rt();
  const rates: Record<string, { rate: number; change: number; updatedAt: number }> = {};
  for (const [pair, v] of s.pairState) {
    const change =
      v.baseline > 0 && Number.isFinite(v.rate) ? ((v.rate - v.baseline) / v.baseline) * 100 : 0;
    rates[pair] = { rate: v.rate, change, updatedAt: v.updatedAt };
  }
  return { rates, connected: isFinnhubSocketOpen() };
}

function applyPriceToPair(pair: string, price: number) {
  const p = pair.trim();
  if (!p || !Number.isFinite(price) || price <= 0) return;
  const s = rt();
  const prev = s.pairState.get(p);
  const baseline = prev ? prev.baseline : price;
  s.pairState.set(p, { rate: price, baseline, updatedAt: Date.now() });
  s.hub.emit('tick', buildSnapshot());
}

function resolveSymbolRow(finnhubSymbol: string): FinnhubForexSymbolRow | undefined {
  const sym = finnhubSymbol.trim();
  const lower = sym.toLowerCase();
  const rows = rt().symbolRows;
  const exact = rows.find((r) => r.finnhubSymbol.trim().toLowerCase() === lower);
  if (exact) return exact;
  const tail = lower.includes(':') ? (lower.split(':').pop() ?? lower) : lower;
  return rows.find((r) => {
    const rs = r.finnhubSymbol.trim().toLowerCase();
    const rtPart = rs.includes(':') ? (rs.split(':').pop() ?? rs) : rs;
    return rtPart === tail;
  });
}

function applyTrade(finnhubSymbol: string, price: number) {
  const row = resolveSymbolRow(finnhubSymbol);
  if (!row) return;
  applyPriceToPair(row.pair, price);
}

async function fetchFinnhubCandlesResult(
  symbol: string,
  resolution: string | number,
  fromSec: number,
  toSec: number
): Promise<{ httpStatus: number; j: { s?: string; c?: number[]; error?: string } }> {
  const key = rt().apiKey;
  const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${fromSec}&to=${toSec}&token=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  let j: { s?: string; c?: number[]; error?: string } = {};
  try {
    j = (await res.json()) as typeof j;
  } catch {
    /* ignore */
  }
  return { httpStatus: res.status, j };
}

function lastCloseFromFinnhub(j: { s?: string; c?: number[] }): number | null {
  if (j.s !== 'ok' || !Array.isArray(j.c) || j.c.length === 0) return null;
  const last = j.c[j.c.length - 1]!;
  return typeof last === 'number' && Number.isFinite(last) && last > 0 ? last : null;
}

function isFinnhubAccessDenied(err?: string): boolean {
  return typeof err === 'string' && /don'?t have access|access to this resource/i.test(err);
}

async function pollForexOnce() {
  const s = rt();
  if (s.symbolRows.length === 0) return;
  const { fetchFrankfurterSpotForPair, fetchYahooCommoditySpotForPair } = await import('@/lib/free-market-rates');
  const now = Math.floor(Date.now() / 1000);
  const from = now - 7200;
  let changed = false;

  for (const r of s.symbolRows) {
    const sym = r.finnhubSymbol.trim();
    const pair = r.pair.trim();
    if (!pair) continue;

    let price: number | null = null;

    const isYahooOnly = sym.toUpperCase().startsWith('YAHOO:');
    if (!isYahooOnly && s.apiKey && sym) {
      try {
        let finnhubDenied = false;
        const first = await fetchFinnhubCandlesResult(sym, 1, from, now);
        if (first.httpStatus === 403 || isFinnhubAccessDenied(first.j.error)) finnhubDenied = true;
        let fromFinnhub = lastCloseFromFinnhub(first.j);
        if (fromFinnhub == null) {
          const second = await fetchFinnhubCandlesResult(sym, 'D', now - 86400 * 14, now);
          if (second.httpStatus === 403 || isFinnhubAccessDenied(second.j.error)) finnhubDenied = true;
          fromFinnhub = lastCloseFromFinnhub(second.j);
        }
        price = finnhubDenied ? null : fromFinnhub;
      } catch {
        price = null;
      }
    }

    if (price == null) {
      const fb = await fetchFrankfurterSpotForPair(pair);
      if (fb != null) price = fb;
    }
    if (price == null) {
      const yc = await fetchYahooCommoditySpotForPair(pair);
      if (yc != null) price = yc;
    }

    if (price != null && price > 0) {
      const prev = s.pairState.get(pair);
      const baseline = prev ? prev.baseline : price;
      s.pairState.set(pair, { rate: price, baseline, updatedAt: Date.now() });
      changed = true;
    }
  }
  if (changed) s.hub.emit('tick', buildSnapshot());
}

function startPoll() {
  stopPoll();
  void pollForexOnce();
  rt().pollTimer = setInterval(() => void pollForexOnce(), 12_000);
}

function scheduleReconnect() {
  const s = rt();
  if (s.reconnectPaused) return;
  if (s.reconnectTimer) return;
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null;
    if (!s.reconnectPaused) connectWs();
  }, 5000);
}

function connectWs() {
  const s = rt();
  if (s.reconnectPaused || !s.apiKey || s.symbolRows.length === 0) return;

  const url = `wss://ws.finnhub.io?token=${encodeURIComponent(s.apiKey)}`;
  try {
    s.ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  s.ws.on('open', () => {
    s.hub.emit('tick', buildSnapshot());
    for (const r of s.symbolRows) {
      const sym = r.finnhubSymbol.trim();
      if (sym && s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
      }
    }
    s.pingTimer = setInterval(() => {
      if (s.ws?.readyState === WebSocket.OPEN) {
        try {
          s.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          /* ignore */
        }
      }
    }, 45_000);
  });

  s.ws.on('message', (raw) => {
    let msg: { type?: string; data?: Array<{ s?: string; p?: number }> };
    try {
      msg = JSON.parse(String(raw)) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === 'trade' && Array.isArray(msg.data)) {
      for (const t of msg.data) {
        if (t?.s != null && typeof t.p === 'number') {
          applyTrade(String(t.s), t.p);
        }
      }
    }
  });

  s.ws.on('close', () => {
    clearTimers();
    s.hub.emit('tick', buildSnapshot());
    scheduleReconnect();
  });

  s.ws.on('error', () => {
    /* close يعالج إعادة الاتصال */
  });
}

export function isFinnhubSocketOpen(): boolean {
  const w = rt().ws;
  return w !== null && w.readyState === WebSocket.OPEN;
}

export function getForexLiveSnapshot(): Record<string, { rate: number; change: number; updatedAt: number }> {
  return buildSnapshot().rates;
}

export function onForexHubTick(fn: (snap: ForexHubSnapshot) => void): () => void {
  const s = rt();
  const listener = (snap: ForexHubSnapshot) => fn(snap);
  s.hub.on('tick', listener);
  return () => {
    s.hub.off('tick', listener);
  };
}

/** إعادة قراءة الإعدادات وبدء/إيقاف WebSocket Finnhub (يُستدعى بعد حفظ الإعدادات أو عند إقلاع الخادم). */
export async function restartFinnhubBridge(): Promise<void> {
  const s = rt();
  s.reconnectPaused = true;
  stopPoll();
  closeSocketOnly();

  await ensureSqliteSchema();
  const cfg = await readForexFinnhubSecrets();

  if (!cfg.enabled) {
    s.pairState.clear();
    s.symbolRows = [];
    s.apiKey = '';
    s.hub.emit('tick', buildSnapshot());
    return;
  }

  s.symbolRows = cfg.rows.filter((x) => x.finnhubSymbol && x.pair);

  if (s.symbolRows.length === 0) {
    s.apiKey = '';
    s.hub.emit('tick', buildSnapshot());
    return;
  }

  s.apiKey = cfg.apiKey?.trim() ?? '';
  s.reconnectPaused = false;
  if (s.apiKey) {
    connectWs();
  } else {
    closeSocketOnly();
    s.reconnectPaused = true;
  }
  startPoll();
}
