import { cache } from 'react';
import { db, ensureSqliteSchema } from '@/lib/db';
import { normalizeCaPub } from '@/lib/adsense-config';
import { sanitizeGscExtraMeta } from '@/lib/gsc-html-verification';

/** قراءة واحدة لكل طلب (metadata + layout) */
export const getAdsenseLayoutData = cache(async () => {
  await ensureSqliteSchema();
  const s = await db.siteSettings.findFirst();
  const verification = s?.adsenseSiteVerification?.trim();
  const safeVerification =
    verification && !/[<>]/.test(verification) ? verification.slice(0, 200) : undefined;
  const extraRaw = s?.gscExtraSiteVerificationMeta ?? null;
  const verificationGoogleExtra = sanitizeGscExtraMeta(extraRaw) ?? undefined;
  const scriptClient =
    s?.adsenseEnabled === true ? normalizeCaPub(s.adsensePublisherId ?? null) : null;
  return {
    verificationGoogle: safeVerification,
    verificationGoogleExtra,
    scriptClient,
  };
});
