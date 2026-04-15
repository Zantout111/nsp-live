import { WebSocketServer } from 'ws';

const BRIDGE_PORT = Number(process.env.MOBILE_WS_PORT || 3101);
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000';
const PUSH_INTERVAL_MS = Number(process.env.MOBILE_WS_PUSH_MS || 4000);

const wss = new WebSocketServer({ port: BRIDGE_PORT });
let timer = null;
let lastPayload = null;

async function fetchJson(path) {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${path} => ${res.status}`);
  return res.json();
}

async function collectPayload() {
  const [cryptoRes, forexRes, ratesRes] = await Promise.all([
    fetchJson('/api/crypto'),
    fetchJson('/api/forex'),
    fetchJson('/api/rates'),
  ]);
  return {
    type: 'snapshot',
    updatedAt: new Date().toISOString(),
    crypto: cryptoRes?.data || [],
    forex: forexRes?.data || [],
    rates: ratesRes?.data?.rates || [],
  };
}

function broadcast(data) {
  const text = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(text);
  }
}

async function tick() {
  try {
    lastPayload = await collectPayload();
    broadcast(lastPayload);
  } catch (err) {
    broadcast({
      type: 'error',
      message: err instanceof Error ? err.message : 'bridge_error',
      updatedAt: new Date().toISOString(),
    });
  }
}

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'hello',
      updatedAt: new Date().toISOString(),
      intervalMs: PUSH_INTERVAL_MS,
    }),
  );
  if (lastPayload) socket.send(JSON.stringify(lastPayload));
});

timer = setInterval(tick, PUSH_INTERVAL_MS);
tick();

console.log(`[mobile-ws-bridge] ws://0.0.0.0:${BRIDGE_PORT}`);
console.log(`[mobile-ws-bridge] backend: ${BACKEND_BASE_URL}`);

process.on('SIGINT', () => {
  if (timer) clearInterval(timer);
  wss.close(() => process.exit(0));
});
