import { cache } from 'react';
import { db, ensureSqliteSchema } from '@/lib/db';
import { normalizeCaPub } from '@/lib/adsense-config';
import { sanitizeGscExtraMeta } from '@/lib/gsc-html-verification';

/** قراءة واحدة لكل طلب (metadata + layout) */
export const getAdsenseLayoutData = cache(async () => {
  await ensureSqliteSchema();
  const s = await db.siteSettings.findFirst();
  const articleAdsRows =
    s?.id != null
      ? await db.$queryRawUnsafe<
          Array<{
            adsenseSlotArticle: string | null;
            adsenseArticleTopEnabled: number | null;
            adsenseArticleInlineEnabled: number | null;
            adsenseArticleBottomEnabled: number | null;
          }>
        >(
          `SELECT adsenseSlotArticle, adsenseArticleTopEnabled, adsenseArticleInlineEnabled, adsenseArticleBottomEnabled
           FROM SiteSettings WHERE id = ? LIMIT 1`,
          s.id
        )
      : [];
  const articleAds = articleAdsRows[0] ?? null;
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
    articleSlot: articleAds?.adsenseSlotArticle ?? null,
    articleTopEnabled: Boolean(articleAds?.adsenseArticleTopEnabled),
    articleInlineEnabled: Boolean(articleAds?.adsenseArticleInlineEnabled),
    articleBottomEnabled: Boolean(articleAds?.adsenseArticleBottomEnabled),
  };
});
