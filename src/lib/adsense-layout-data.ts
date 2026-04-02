import { cache } from 'react';
import { db, ensureSqliteSchema } from '@/lib/db';
import { normalizeCaPub } from '@/lib/adsense-config';

/** قراءة واحدة لكل طلب (metadata + layout) */
export const getAdsenseLayoutData = cache(async () => {
  await ensureSqliteSchema();
  const s = await db.siteSettings.findFirst();
  const verification = s?.adsenseSiteVerification?.trim();
  const safeVerification =
    verification && !/[<>]/.test(verification) ? verification.slice(0, 200) : undefined;
  const scriptClient =
    s?.adsenseEnabled === true ? normalizeCaPub(s.adsensePublisherId ?? null) : null;
  return {
    verificationGoogle: safeVerification,
    scriptClient,
  };
});
