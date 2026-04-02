import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runDueSyncCron } from '@/lib/run-due-sync-cron';

// GET — استدعاء من جدولة خارجية مع ?secret=
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const cronSecret = searchParams.get('secret');
    const validSecret = process.env.CRON_SECRET || 'syp-rates-cron-2024';

    if (!force && cronSecret !== validSecret) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - invalid or missing secret' },
        { status: 401 }
      );
    }

    const out = await runDueSyncCron(force);

    if (out.skipped) {
      return NextResponse.json({
        success: true,
        message: out.message,
        settings: out.settings
          ? {
              autoUpdateEnabled: out.settings.autoUpdateEnabled,
              lastFetchTime: out.settings.lastFetchTime,
            }
          : undefined,
      });
    }

    return NextResponse.json({
      success: out.anyOk,
      message: out.anyOk ? 'Cron sync completed' : 'Cron sync had errors',
      categories: out.categories,
      results: out.results,
      lastFetchedAt: out.nextConfig.lastFetchedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { success: false, message: 'Cron job failed', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const settings = await db.siteSettings.findFirst();
    if (!settings?.autoUpdateEnabled) {
      return NextResponse.json({ success: false, message: 'Auto-update is disabled' });
    }
    const out = await runDueSyncCron(true);
    if (out.skipped) {
      return NextResponse.json({ success: false, message: out.message });
    }
    return NextResponse.json({
      success: out.anyOk,
      message: out.anyOk ? 'Sync completed' : 'Sync had errors',
      categories: out.categories,
      results: out.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Cron job failed', error: String(error) },
      { status: 500 }
    );
  }
}
