import type { PrismaClient } from '@prisma/client';
import { normalizeSocialUrl } from '@/lib/social-url';

/** قراءة TikTok من العمود حتى لو كان Prisma Client قديماً ولم يُعدَّ generate بعد. */
export async function readFooterSocialTiktok(
  db: PrismaClient,
  siteSettingsId: string
): Promise<string | null> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ footerSocialTiktok: string | null }>>(
      'SELECT footerSocialTiktok FROM SiteSettings WHERE id = ? LIMIT 1',
      siteSettingsId
    );
    return rows[0]?.footerSocialTiktok ?? null;
  } catch {
    return null;
  }
}

export async function writeFooterSocialTiktok(
  db: PrismaClient,
  siteSettingsId: string,
  footerSocialTiktok: unknown
): Promise<void> {
  const v = normalizeSocialUrl(footerSocialTiktok);
  await db.$executeRawUnsafe(
    'UPDATE SiteSettings SET footerSocialTiktok = ? WHERE id = ?',
    v,
    siteSettingsId
  );
}
