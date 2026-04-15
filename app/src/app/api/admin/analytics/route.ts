import { NextRequest, NextResponse } from 'next/server';
import { ensureSqliteSchema } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { loadSiteVisitAnalytics } from '@/lib/site-visit-store';
import {
  resolveAnalyticsRange,
  type AnalyticsPreset,
} from '@/lib/site-visit-analytics-range';

const PRESETS: AnalyticsPreset[] = ['today', '7d', '30d', '90d', '365d', 'all', 'custom'];

function parsePreset(v: string | null): AnalyticsPreset {
  if (v && PRESETS.includes(v as AnalyticsPreset)) return v as AnalyticsPreset;
  return '30d';
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSqliteSchema();

    const { searchParams } = new URL(req.url);
    const preset = parsePreset(searchParams.get('preset'));
    const fromQ = searchParams.get('from');
    const toQ = searchParams.get('to');

    const now = new Date();
    const { range, fromInclusiveYmd, toInclusiveYmd, effectivePreset } = resolveAnalyticsRange(
      preset,
      now,
      fromQ,
      toQ
    );

    const data = await loadSiteVisitAnalytics(
      range,
      {
        preset: effectivePreset,
        fromInclusiveYmd,
        toInclusiveYmd,
      },
      now
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (e) {
    console.error('[admin/analytics]', e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'query_failed' },
      { status: 500 }
    );
  }
}
