import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { ensureSqliteSchema } from '@/lib/db';
import { fetchCoinGeckoForCodes } from '@/lib/free-market-rates';
import { readCryptoRealtimeSecrets } from '@/lib/forex-finnhub-db';

type CryptoState = { price: number; change: number; baseline: number; updatedAt: number };

const RUNTIME_KEY = '__SYP_CRYPTO_LIVE_RUNTIME__' as const;

type CryptoRuntime = {
  hub: EventEmitter;
  byCode: Map<string, CryptoState>;
  timer: ReturnType<typeof setInterval> | null;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  reconnectPaused: boolean;
  wsSymbols: string[];
  symbolToCode: Map<string, string>;
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
      ws: null,
      reconnectTimer: null,
      pingTimer: null,
      reconnectPaused: true,
      wsSymbols: [],
      symbolToCode: new Map(),
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

function clearWsTimers() {
  const s = rt();
  if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
  s.reconnectTimer = null;
  if (s.pingTimer) clearInterval(s.pingTimer);
  s.pingTimer = null;
}

function closeSocketOnly() {
  clearWsTimers();
  const s = rt();
  if (!s.ws) return;
  try {
    s.ws.removeAllListeners();
    s.ws.close();
  } catch {
    /* ignore */
  }
  s.ws = null;
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

function toBinanceUsdtSymbol(code: string): string | null {
  const c = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(c)) return null;
  // لا يوجد سوق USDT/USDT.
  if (c === 'USDT') return null;
  const fixed: Record<string, string> = {
    BCH: 'BCHUSDT',
    DOGE: 'DOGEUSDT',
    SHIB: 'SHIBUSDT',
    PEPE: 'PEPEUSDT',
    XRP: 'XRPUSDT',
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    BNB: 'BNBUSDT',
    SOL: 'SOLUSDT',
    ADA: 'ADAUSDT',
    TRX: 'TRXUSDT',
    LTC: 'LTCUSDT',
    DOT: 'DOTUSDT',
    AVAX: 'AVAXUSDT',
    LINK: 'LINKUSDT',
    UNI: 'UNIUSDT',
    XLM: 'XLMUSDT',
    SUI: 'SUIUSDT',
    APT: 'APTUSDT',
    ICP: 'ICPUSDT',
    FIL: 'FILUSDT',
    VET: 'VETUSDT',
    NEAR: 'NEARUSDT',
    ETC: 'ETCUSDT',
    HBAR: 'HBARUSDT',
    OP: 'OPUSDT',
    ATOM: 'ATOMUSDT',
    USDC: 'USDCUSDT',
  };
  return fixed[c] ?? `${c}USDT`;
}

function fallbackCodes(): string[] {
  const s = rt();
  if (s.wsSymbols.length === 0) return s.codes;
  const covered = new Set<string>([...s.symbolToCode.values()]);
  return s.codes.filter((c) => !covered.has(c));
}

function applyWsTrade(symbol: string, price: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  const s = rt();
  const code = s.symbolToCode.get(String(symbol).toUpperCase());
  if (!code) return false;
  const prev = s.byCode.get(code);
  const baseline = prev ? prev.baseline : price;
  s.byCode.set(code, {
    price,
    change: prev ? prev.change : 0,
    baseline,
    updatedAt: Date.now(),
  });
  return true;
}

async function pollCryptoOnce() {
  const s = rt();
  const codes = fallbackCodes();
  if (!s.enabled || codes.length === 0) return;
  // في البث اللحظي نخفف الكاش المحلي لأقصى سرعة ممكنة.
  const map = await fetchCoinGeckoForCodes(codes, { freshMs: 0, staleMs: 20_000 });
  if (map.size === 0) return;
  let changed = false;
  for (const code of codes) {
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
  // Fallback فقط للعملات غير المدعومة عبر WebSocket.
  rt().timer = setInterval(() => void pollCryptoOnce(), 12_000);
}

function scheduleReconnect() {
  const s = rt();
  if (s.reconnectPaused || s.reconnectTimer) return;
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null;
    if (!s.reconnectPaused) connectWs();
  }, 3000);
}

function connectWs() {
  const s = rt();
  if (s.reconnectPaused || s.wsSymbols.length === 0) return;

  const streams = s.wsSymbols.map((sym) => `${sym.toLowerCase()}@trade`).join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${encodeURIComponent(streams)}`;
  try {
    s.ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  s.ws.on('open', () => {
    s.hub.emit('tick', buildSnapshot());
    s.pingTimer = setInterval(() => {
      try {
        if (s.ws?.readyState === WebSocket.OPEN) s.ws.ping();
      } catch {
        /* ignore */
      }
    }, 30000);
  });

  s.ws.on('message', (raw) => {
    let msg: { stream?: string; data?: { s?: string; p?: string } };
    try {
      msg = JSON.parse(String(raw)) as typeof msg;
    } catch {
      return;
    }
    const sym = msg?.data?.s ? String(msg.data.s).toUpperCase() : '';
    const pStr = msg?.data?.p;
    if (!sym || pStr == null) return;
    const price = Number(pStr);
    if (applyWsTrade(sym, price)) {
      s.hub.emit('tick', buildSnapshot());
    }
  });

  s.ws.on('close', () => {
    clearWsTimers();
    s.hub.emit('tick', buildSnapshot());
    scheduleReconnect();
  });

  s.ws.on('error', () => {
    /* close handles reconnect */
  });
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
  s.reconnectPaused = true;
  stopPoll();
  closeSocketOnly();
  await ensureSqliteSchema();
  const cfg = await readCryptoRealtimeSecrets();
  s.enabled = cfg.enabled;
  s.codes = cfg.codes;
  s.symbolToCode = new Map<string, string>();
  s.wsSymbols = [];

  if (!s.enabled || s.codes.length === 0) {
    s.byCode.clear();
    s.hub.emit('tick', buildSnapshot());
    return;
  }
  for (const code of s.codes) {
    const sym = toBinanceUsdtSymbol(code);
    if (!sym) continue;
    s.wsSymbols.push(sym);
    s.symbolToCode.set(sym.toUpperCase(), code);
  }
  s.reconnectPaused = false;
  if (s.wsSymbols.length > 0) {
    connectWs();
  }
  startPoll();
}
