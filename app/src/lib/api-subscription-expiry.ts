/** تاريخ انتهاء الاشتراك من الآن (بالأيام، مع حدود معقولة). */
export function subscriptionExpiresAtFromNow(days: number): Date {
  const n = Math.floor(Number(days));
  const clamped = Number.isFinite(n) ? Math.min(3650, Math.max(1, n)) : 365;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + clamped);
  return d;
}
