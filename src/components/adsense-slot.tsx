'use client';

import { useEffect, useRef } from 'react';

type Props = {
  client: string;
  slot: string;
  labelAr: string;
  labelEn: string;
  locale: string;
};

/**
 * وحدة عرض AdSense مع تسمية «إعلان» وفصل بصري عن المحتوى (ممارسات موصى بها لسياسات الإعلانات).
 */
export function AdSenseSlot({ client, slot, labelAr, labelEn, locale }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !slot || !client) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* ignore */
    }
  }, [client, slot]);

  if (!client || !slot) return null;
  const label = locale === 'ar' ? labelAr : labelEn;

  return (
    <aside
      className="my-8 flex w-full max-w-4xl flex-col items-center gap-2 self-center px-4"
      aria-label={label}
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground dark:text-slate-500">
        {label}
      </p>
      <div className="flex min-h-[100px] w-full max-w-[728px] justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/20 dark:border-slate-700/60 dark:bg-slate-900/30">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
