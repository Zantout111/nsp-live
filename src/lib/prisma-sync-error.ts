/** رسالة واضحة للمستخدم عند فشل عمليات تتعلق بـ Prisma / syncConfig */
export function prismaErrorForUser(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('no such column') || lower.includes('unknown column')) {
    return 'عمود ناقص في قاعدة SQLite. من مجلد app نفّذ: npx prisma db push';
  }

  if (
    lower.includes('unknown arg') ||
    lower.includes('invalid `prisma.') ||
    (lower.includes('syncconfig') &&
      (lower.includes('unknown') || lower.includes('available') || lower.includes('object')))
  ) {
    return (
      'عميل Prisma غير متطابق مع المخطط (غالباً لأن npx prisma generate لم يكتمل — الملفات مقفولة أثناء تشغيل الخادم). ' +
      'أوقف خادم Next.js بالكامل، ثم من مجلد app نفّذ: npx prisma generate ثم أعد التشغيل.'
    );
  }

  if (lower.includes('eperm') || lower.includes('operation not permitted')) {
    return (
      'تعذّر الوصول لملفات Prisma (EPERM). أوقف خادم التطوير وأغلق أي عملية node تستخدم المشروع، ثم نفّذ: npx prisma generate'
    );
  }

  return msg;
}
