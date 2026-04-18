'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** يسجّل زيارة عامة (لا يُستدعى من مسار /admin) */
export function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;

    void fetch('/api/analytics/hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      /* ignore */
    });
  }, [pathname]);

  return null;
}
