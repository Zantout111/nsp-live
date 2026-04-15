/** نسبة التغيير بين قيمة سابقة وقيمة حالية (مثلاً بعد آخر جلب). */
export function pctDeltaFromPrevious(
  prev: number | null | undefined,
  current: number
): number | null {
  if (prev == null || prev === undefined || !Number.isFinite(prev) || prev === 0) return null;
  const d = ((current - prev) / Math.abs(prev)) * 100;
  return Number.isFinite(d) ? d : null;
}
