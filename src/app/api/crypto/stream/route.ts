import { getCryptoLiveSnapshot, onCryptoHubTick, restartCryptoBridge } from '@/lib/crypto-live-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  // ضمان تشغيل الجسر حتى لو لم تُنفّذ instrumentation (أو بعد إعادة تشغيل الخادم).
  await restartCryptoBridge();

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* ignore */
        }
      };

      send({ type: 'hello', rates: getCryptoLiveSnapshot() });

      const unsub = onCryptoHubTick((snap) => {
        send({ type: 'tick', rates: snap.rates, enabled: snap.enabled });
      });

      const keepAlive = setInterval(() => send({ type: 'ping', t: Date.now() }), 25_000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
