'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnalyticsPreset = 'today' | '7d' | '30d' | '90d' | '365d' | 'all' | 'custom';

type AnalyticsPayload = {
  preset: string;
  fromInclusiveYmd: string;
  toInclusiveYmd: string;
  pageViewsInRange: number;
  uniqueVisitorsInRange: number;
  avgPageViewsPerDay: number;
  peakDay: { day: string; views: number } | null;
  todayPageViewsUtc: number;
  todayUniqueVisitorsUtc: number;
  byCountry: { country: string; visits: number }[];
  daily: { day: string; views: number }[];
};

function countryLabel(code: string, locale: string): string {
  if (code === 'LO') return locale === 'ar' ? 'محلي / شبكة داخلية' : 'Local / private';
  if (code === 'XX') return locale === 'ar' ? 'غير معروف' : 'Unknown';
  try {
    const dn = new Intl.DisplayNames([locale === 'ar' ? 'ar' : 'en'], { type: 'region' });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export function AdminAnalyticsTab({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [preset, setPreset] = useState<AnalyticsPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preset === 'custom' && (!customFrom || !customTo)) {
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      p.set('preset', preset);
      if (preset === 'custom') {
        p.set('from', customFrom);
        p.set('to', customTo);
      }
      p.set('ts', String(Date.now()));
      const res = await fetch(`/api/admin/analytics?${p.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const j = (await res.json()) as { success?: boolean; data?: AnalyticsPayload; message?: string };
      if (!res.ok || !j.success || !j.data) {
        setError(j.message || `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(isAr ? 'ar-SY' : 'en-US', { maximumFractionDigits: 0 }).format(Math.round(n));

  const fmtDec = (n: number, frac = 1) =>
    new Intl.NumberFormat(isAr ? 'ar-SY' : 'en-US', {
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    }).format(n);

  const presets: { id: AnalyticsPreset; ar: string; en: string }[] = [
    { id: 'today', ar: 'اليوم', en: 'Today' },
    { id: '7d', ar: '7 أيام', en: '7 days' },
    { id: '30d', ar: '30 يومًا', en: '30 days' },
    { id: '90d', ar: '90 يومًا', en: '90 days' },
    { id: '365d', ar: 'سنة', en: '365 days' },
    { id: 'all', ar: 'كل الوقت', en: 'All time' },
    { id: 'custom', ar: 'مخصص', en: 'Custom' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <BarChart3 className="h-6 w-6 text-primary" />
          {isAr ? 'إحصائيات الزيارات' : 'Visit analytics'}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ms-2">{isAr ? 'تحديث' : 'Refresh'}</span>
        </Button>
      </div>

      <Card className="border-border/80 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isAr ? 'الفلتر الزمني (UTC)' : 'Time filter (UTC)'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={preset === p.id ? 'default' : 'outline'}
                className={cn(preset === p.id && 'shadow-sm')}
                onClick={() => setPreset(p.id)}
              >
                {isAr ? p.ar : p.en}
              </Button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="space-y-1">
                <Label htmlFor="analytics-from">{isAr ? 'من' : 'From'}</Label>
                <Input
                  id="analytics-from"
                  type="date"
                  className="w-full sm:w-44"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="analytics-to">{isAr ? 'إلى' : 'To'}</Label>
                <Input
                  id="analytics-to"
                  type="date"
                  className="w-full sm:w-44"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={() => void load()}
                disabled={!customFrom || !customTo || loading}
              >
                {isAr ? 'تطبيق' : 'Apply'}
              </Button>
            </div>
          ) : null}
          {preset === 'custom' && (!customFrom || !customTo) ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {isAr ? 'اختر تاريخ البداية والنهاية ثم اضغط «تطبيق».' : 'Pick start and end dates, then click «Apply».'}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {isAr
              ? 'النطاق يُحسب بتوقيت UTC. الفلتر يؤثر على البطاقات الأولى وجداول البلدان والأيام. «اليوم» أسفل يعني تقويم اليوم الحالي UTC.'
              : 'Ranges use UTC. The filter applies to the main metrics and tables. «Today» below means the current UTC calendar day.'}
          </p>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {isAr ? 'جاري التحميل…' : 'Loading…'}
        </div>
      ) : null}

      {data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {isAr ? 'النطاق المعروض:' : 'Selected range:'}{' '}
            <span className="font-mono font-medium text-foreground">
              {data.fromInclusiveYmd} — {data.toInclusiveYmd}
            </span>
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isAr ? 'زيارات الصفحات (ضمن الفلتر)' : 'Page views (in range)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{fmt(data.pageViewsInRange)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isAr ? 'زوار مميّزون (ضمن الفلتر)' : 'Unique visitors (in range)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{fmt(data.uniqueVisitorsInRange)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAr ? 'تقدير بالكوكي' : 'Cookie-based estimate'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isAr ? 'متوسط زيارات يوميًا' : 'Avg page views / day'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{fmtDec(data.avgPageViewsPerDay, 1)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isAr ? 'أعلى يوم في الفلتر' : 'Peak day (in range)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.peakDay ? (
                  <>
                    <p className="font-mono text-lg font-bold">{data.peakDay.day}</p>
                    <p className="text-sm text-muted-foreground">{fmt(data.peakDay.views)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isAr ? 'زيارات اليوم (UTC) — ثابت' : 'Today page views (UTC)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold tabular-nums">{fmt(data.todayPageViewsUtc)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isAr ? 'زوار مميّزون اليوم (UTC)' : 'Unique visitors today (UTC)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold tabular-nums">{fmt(data.todayUniqueVisitorsUtc)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle>{isAr ? 'الزيارات حسب البلد (ضمن الفلتر)' : 'Visits by country (in range)'}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byCountry.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{isAr ? 'لا توجد بيانات.' : 'No data.'}</p>
                ) : (
                  <div className="max-h-80 overflow-auto rounded-md border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr className="border-b border-border text-start">
                          <th className="p-2 font-medium">{isAr ? 'البلد' : 'Country'}</th>
                          <th className="p-2 font-medium">{isAr ? 'الزيارات' : 'Visits'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byCountry.map((row) => (
                          <tr key={row.country} className="border-b border-border/40 last:border-0">
                            <td className="p-2">
                              <span className="font-mono text-xs text-muted-foreground">{row.country}</span>{' '}
                              <span>{countryLabel(row.country, locale)}</span>
                            </td>
                            <td className="p-2 tabular-nums font-medium">{fmt(row.visits)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle>{isAr ? 'زيارات يومية (ضمن الفلتر)' : 'Daily page views (in range)'}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.daily.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{isAr ? 'لا توجد بيانات.' : 'No data.'}</p>
                ) : (
                  <div className="max-h-80 overflow-auto rounded-md border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr className="border-b border-border text-start">
                          <th className="p-2 font-medium">{isAr ? 'اليوم' : 'Day'}</th>
                          <th className="p-2 font-medium">{isAr ? 'الزيارات' : 'Views'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((row) => (
                          <tr key={row.day} className="border-b border-border/40 last:border-0">
                            <td className="p-2 font-mono">{row.day}</td>
                            <td className="p-2 tabular-nums font-medium">{fmt(row.views)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
