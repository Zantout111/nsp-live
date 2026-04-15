import { getForexLiveSnapshot, isFinnhubSocketOpen, onForexHubTick } from '@/lib/finnhub-forex-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SSE: الخادم يبث لقطات أسعار الفوركس الحية (من WebSocket Finnhub داخل العملية).
 * لا يحتوي على مفتاح API؛ العملاء يتصلون بالموقع فقط.
 */
export async function GET(request: Request) {
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* مغلق */
        }
      };

      send({
        type: 'hello',
        rates: getForexLiveSnapshot(),
        connected: isFinnhubSocketOpen(),
      });

      const unsub = onForexHubTick((snap) => {
        send({ type: 'tick', rates: snap.rates, connected: snap.connected });
      });

      const keepAlive = setInterval(() => {
        send({ type: 'ping', t: Date.now() });
      }, 25_000);

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
