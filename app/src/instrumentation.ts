/**
 * مؤقت داخلي في الإنتاج: يتحقق دورياً من جدولة المزامنة (runDueSyncCron).
 * لا يُشغَّل على Edge. تجنّب !== 'nodejs' لأن NEXT_RUNTIME قد يكون غير معرّف عند تحميل هذا الملف في وقت التشغيل.
 * عطّل المزامنة الداخلية بـ DISABLE_INTERNAL_CRON=1 واستخدم /api/cron من جدولة النظام إن رغبت.
 *
 * Finnhub (فوركس لحظي): يُشغَّل في التطوير والإنتاج بعد تأخير قصير — اتصال WebSocket من الخادم فقط.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_INTERNAL_CRON !== '1') {
    const intervalMs = Math.min(
      3_600_000,
      Math.max(30_000, parseInt(process.env.INTERNAL_CRON_MS || '60000', 10) || 60_000)
    );

    const tick = async () => {
      try {
        const { runDueSyncCron } = await import('@/lib/run-due-sync-cron');
        await runDueSyncCron(false);
      } catch (e) {
        console.error('[internal-cron]', e);
      }
    };

    setInterval(tick, intervalMs);
    setTimeout(() => void tick(), 15_000);
  }

  setTimeout(() => {
    void import('@/lib/finnhub-forex-hub').then((m) => m.restartFinnhubBridge());
    void import('@/lib/crypto-live-hub').then((m) => m.restartCryptoBridge());
  }, 6000);
}
