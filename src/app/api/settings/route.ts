import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db, ensureSqliteSchema } from '@/lib/db';
import { mergeSyncConfig, mirrorLegacyFromCurrencies, SYNC_CATEGORY_IDS, type SyncConfigV1 } from '@/lib/sync-config';
import { DEFAULT_LOGO_SIZES, parseLogoSizes, type LogoSizes } from '@/lib/logo-sizes';
import { normalizeSocialUrl } from '@/lib/social-url';

export const dynamic = 'force-dynamic';

function legacyFromRow(s: {
  updateInterval: number;
  adjustmentAmount: number;
  adjustmentType: string;
}) {
  return {
    updateIntervalHours: s.updateInterval ?? 6,
    adjustmentAmount: s.adjustmentAmount ?? 250,
    adjustmentType: (s.adjustmentType === 'addition' ? 'addition' : 'deduction') as 'deduction' | 'addition',
  };
}

// GET - Get all site settings
export async function GET() {
  try {
    await ensureSqliteSchema();
    const settings = await db.siteSettings.findFirst();
    const syncConfig = mergeSyncConfig(
      settings?.syncConfig,
      legacyFromRow(settings ?? { updateInterval: 6, adjustmentAmount: 250, adjustmentType: 'deduction' })
    );

    return NextResponse.json({
      success: true,
      settings: {
        // Site Identity
        siteName: settings?.siteName || 'سعر الليرة السورية',
        siteNameAr: settings?.siteNameAr || 'سعر الليرة السورية',
        siteNameEn: settings?.siteNameEn || 'Syrian Pound Exchange Rate',
        heroSubtitle: settings?.heroSubtitle || 'أسعار الصرف الحية',
        heroSubtitleAr: settings?.heroSubtitleAr || 'أسعار الصرف الحية',
        heroSubtitleEn: settings?.heroSubtitleEn || 'Live Exchange Rates',
        logoUrl: settings?.logoUrl || null,
        logoUrlAr: settings?.logoUrlAr ?? null,
        logoUrlNonAr: settings?.logoUrlNonAr ?? null,
        logoSizes: parseLogoSizes(settings?.logoSizes) as LogoSizes,
        
        // Sync Settings
        autoUpdateEnabled: settings?.autoUpdateEnabled ?? true,
        updateInterval: settings?.updateInterval ?? 6,
        adjustmentAmount: settings?.adjustmentAmount ?? 250,
        adjustmentType: settings?.adjustmentType ?? 'deduction',
        lastFetchTime: settings?.lastFetchTime,
        syncConfig,
        
        // Light Mode Colors
        lightPrimaryColor: settings?.lightPrimaryColor || '#0ea5e9',
        lightAccentColor: settings?.lightAccentColor || '#0284c7',
        lightBgColor: settings?.lightBgColor || '#ffffff',
        
        // Dark Mode Colors
        darkPrimaryColor: settings?.darkPrimaryColor || '#0ea5e9',
        darkAccentColor: settings?.darkAccentColor || '#38bdf8',
        darkBgColor: settings?.darkBgColor || '#0f172a',
        tickerMarqueeDurationSec: settings?.tickerMarqueeDurationSec ?? 42,
        platformApiUsdtTrc20: settings?.platformApiUsdtTrc20 ?? null,
        platformApiSubscriptionPriceUsd: settings?.platformApiSubscriptionPriceUsd ?? 50,
        platformApiSubscriptionDays: settings?.platformApiSubscriptionDays ?? 365,
        footerSocialFacebook: settings?.footerSocialFacebook ?? null,
        footerSocialX: settings?.footerSocialX ?? null,
        footerSocialTelegram: settings?.footerSocialTelegram ?? null,
        footerSocialInstagram: settings?.footerSocialInstagram ?? null,
        footerSocialYoutube: settings?.footerSocialYoutube ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update site settings
export async function PUT(request: Request) {
  try {
    await ensureSqliteSchema();
    const body = await request.json();
    
    const {
      // Site Identity
      siteName,
      siteNameAr,
      siteNameEn,
      heroSubtitle,
      heroSubtitleAr,
      heroSubtitleEn,
      logoUrl,
      logoUrlAr,
      logoUrlNonAr,
      logoSizes: logoSizesIn,
      
      // Sync Settings
      autoUpdateEnabled,
      updateInterval,
      adjustmentAmount,
      adjustmentType,
      syncConfig: partialSync,
      
      // Light Mode Colors
      lightPrimaryColor,
      lightAccentColor,
      lightBgColor,
      
      // Dark Mode Colors
      darkPrimaryColor,
      darkAccentColor,
      darkBgColor,
      tickerMarqueeDurationSec,
      platformApiUsdtTrc20,
      platformApiSubscriptionPriceUsd,
      platformApiSubscriptionDays,
      footerSocialFacebook,
      footerSocialX,
      footerSocialTelegram,
      footerSocialInstagram,
      footerSocialYoutube,
    } = body;

    const settings = await db.siteSettings.findFirst();

    const partialSyncObj =
      partialSync != null && typeof partialSync === 'object' && !Array.isArray(partialSync)
        ? (partialSync as Record<string, unknown>)
        : null;
    const hasSyncPatch =
      partialSyncObj != null &&
      Object.keys(partialSyncObj).length > 0 &&
      ('categories' in partialSyncObj || 'lastFetchedAt' in partialSyncObj || 'version' in partialSyncObj);

    let mergedSync: SyncConfigV1 | null = null;
    if (hasSyncPatch) {
      const legacy = legacyFromRow(
        settings ?? { updateInterval: 6, adjustmentAmount: 250, adjustmentType: 'deduction' }
      );
      mergedSync = mergeSyncConfig(settings?.syncConfig, legacy);
      const p = partialSync as Partial<SyncConfigV1>;
      if (p.categories && typeof p.categories === 'object') {
        for (const id of SYNC_CATEGORY_IDS) {
          const patch = (p.categories as Record<string, unknown>)[id];
          if (patch && typeof patch === 'object') {
            mergedSync.categories[id] = {
              ...mergedSync.categories[id],
              ...(patch as object),
            } as (typeof mergedSync.categories)[typeof id];
          }
        }
      }
      if (p.lastFetchedAt && typeof p.lastFetchedAt === 'object') {
        mergedSync.lastFetchedAt = { ...mergedSync.lastFetchedAt, ...(p.lastFetchedAt as object) };
      }
    }

    const mirror = mergedSync ? mirrorLegacyFromCurrencies(mergedSync) : null;

    const logoSizesJson: Prisma.InputJsonValue | undefined =
      logoSizesIn !== undefined
        ? (() => {
            const s = parseLogoSizes(logoSizesIn);
            return { header: s.header, footer: s.footer, loading: s.loading };
          })()
        : undefined;

    const updateData: Prisma.SiteSettingsUpdateInput = {
      lastUpdate: new Date(),
    };

    if (siteName !== undefined && siteName !== null) {
      updateData.siteName = String(siteName);
    }
    if (siteNameAr !== undefined) {
      updateData.siteNameAr = siteNameAr === null ? null : String(siteNameAr);
    }
    if (siteNameEn !== undefined) {
      updateData.siteNameEn = siteNameEn === null ? null : String(siteNameEn);
    }
    if (heroSubtitle !== undefined) {
      updateData.heroSubtitle = heroSubtitle === null ? null : String(heroSubtitle);
    }
    if (heroSubtitleAr !== undefined) {
      updateData.heroSubtitleAr = heroSubtitleAr === null ? null : String(heroSubtitleAr);
    }
    if (heroSubtitleEn !== undefined) {
      updateData.heroSubtitleEn = heroSubtitleEn === null ? null : String(heroSubtitleEn);
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl === null ? null : String(logoUrl);
    }
    if (logoUrlAr !== undefined) {
      updateData.logoUrlAr = logoUrlAr === null ? null : String(logoUrlAr);
    }
    if (logoUrlNonAr !== undefined) {
      updateData.logoUrlNonAr = logoUrlNonAr === null ? null : String(logoUrlNonAr);
    }
    if (logoSizesJson !== undefined) {
      updateData.logoSizes = logoSizesJson;
    }
    if (typeof autoUpdateEnabled === 'boolean') {
      updateData.autoUpdateEnabled = autoUpdateEnabled;
    }
    if (typeof updateInterval === 'number' && updateInterval > 0) {
      updateData.updateInterval = Math.round(updateInterval);
    }
    if (typeof adjustmentAmount === 'number' && adjustmentAmount >= 0) {
      updateData.adjustmentAmount = Math.round(adjustmentAmount);
    }
    if (adjustmentType === 'deduction' || adjustmentType === 'addition') {
      updateData.adjustmentType = adjustmentType;
    }
    if (lightPrimaryColor !== undefined && lightPrimaryColor !== null && String(lightPrimaryColor).trim() !== '') {
      updateData.lightPrimaryColor = String(lightPrimaryColor);
    }
    if (lightAccentColor !== undefined && lightAccentColor !== null && String(lightAccentColor).trim() !== '') {
      updateData.lightAccentColor = String(lightAccentColor);
    }
    if (lightBgColor !== undefined && lightBgColor !== null && String(lightBgColor).trim() !== '') {
      updateData.lightBgColor = String(lightBgColor);
    }
    if (darkPrimaryColor !== undefined && darkPrimaryColor !== null && String(darkPrimaryColor).trim() !== '') {
      updateData.darkPrimaryColor = String(darkPrimaryColor);
    }
    if (darkAccentColor !== undefined && darkAccentColor !== null && String(darkAccentColor).trim() !== '') {
      updateData.darkAccentColor = String(darkAccentColor);
    }
    if (darkBgColor !== undefined && darkBgColor !== null && String(darkBgColor).trim() !== '') {
      updateData.darkBgColor = String(darkBgColor);
    }
    if (typeof tickerMarqueeDurationSec === 'number' && Number.isFinite(tickerMarqueeDurationSec)) {
      const d = Math.round(tickerMarqueeDurationSec);
      if (d >= 8 && d <= 180) {
        updateData.tickerMarqueeDurationSec = d;
      }
    }
    if (platformApiUsdtTrc20 !== undefined) {
      const s =
        platformApiUsdtTrc20 === null || platformApiUsdtTrc20 === ''
          ? null
          : String(platformApiUsdtTrc20).trim().slice(0, 120);
      updateData.platformApiUsdtTrc20 = s;
    }
    if (platformApiSubscriptionPriceUsd !== undefined && platformApiSubscriptionPriceUsd !== null) {
      const p = Number(platformApiSubscriptionPriceUsd);
      if (Number.isFinite(p) && p >= 0 && p <= 1_000_000) {
        updateData.platformApiSubscriptionPriceUsd = p;
      }
    }
    if (platformApiSubscriptionDays !== undefined && platformApiSubscriptionDays !== null) {
      const d = Math.round(Number(platformApiSubscriptionDays));
      if (Number.isFinite(d) && d >= 1 && d <= 3650) {
        updateData.platformApiSubscriptionDays = d;
      }
    }
    if (footerSocialFacebook !== undefined) {
      updateData.footerSocialFacebook = normalizeSocialUrl(footerSocialFacebook);
    }
    if (footerSocialX !== undefined) {
      updateData.footerSocialX = normalizeSocialUrl(footerSocialX);
    }
    if (footerSocialTelegram !== undefined) {
      updateData.footerSocialTelegram = normalizeSocialUrl(footerSocialTelegram);
    }
    if (footerSocialInstagram !== undefined) {
      updateData.footerSocialInstagram = normalizeSocialUrl(footerSocialInstagram);
    }
    if (footerSocialYoutube !== undefined) {
      updateData.footerSocialYoutube = normalizeSocialUrl(footerSocialYoutube);
    }
    if (mergedSync) {
      updateData.syncConfig = JSON.parse(JSON.stringify(mergedSync)) as Prisma.InputJsonValue;
    }
    if (mirror) {
      updateData.updateInterval = mirror.updateInterval;
      updateData.adjustmentAmount = mirror.adjustmentAmount;
      updateData.adjustmentType = mirror.adjustmentType;
    }

    if (settings) {
      await db.siteSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      const createLogoSizes: Prisma.InputJsonValue =
        logoSizesJson ??
        ({
          header: DEFAULT_LOGO_SIZES.header,
          footer: DEFAULT_LOGO_SIZES.footer,
          loading: DEFAULT_LOGO_SIZES.loading,
        } as const);
      await db.siteSettings.create({
        data: {
          siteName: siteName != null ? String(siteName) : 'سعر الليرة السورية',
          siteNameAr: siteNameAr != null ? String(siteNameAr) : 'سعر الليرة السورية',
          siteNameEn: siteNameEn != null ? String(siteNameEn) : 'Syrian Pound Exchange Rate',
          heroSubtitle: heroSubtitle != null ? String(heroSubtitle) : 'أسعار الصرف الحية',
          heroSubtitleAr: heroSubtitleAr != null ? String(heroSubtitleAr) : 'أسعار الصرف الحية',
          heroSubtitleEn: heroSubtitleEn != null ? String(heroSubtitleEn) : 'Live Exchange Rates',
          logoUrl: logoUrl === undefined ? null : logoUrl === null ? null : String(logoUrl),
          logoUrlAr: logoUrlAr === undefined ? null : logoUrlAr === null ? null : String(logoUrlAr),
          logoUrlNonAr: logoUrlNonAr === undefined ? null : logoUrlNonAr === null ? null : String(logoUrlNonAr),
          logoSizes: createLogoSizes,
          autoUpdateEnabled: autoUpdateEnabled ?? true,
          updateInterval: mirror?.updateInterval ?? (typeof updateInterval === 'number' ? Math.round(updateInterval) : 6),
          adjustmentAmount:
            mirror?.adjustmentAmount ??
            (typeof adjustmentAmount === 'number' ? Math.round(adjustmentAmount) : 250),
          adjustmentType: mirror?.adjustmentType ?? adjustmentType ?? 'deduction',
          ...(mergedSync
            ? { syncConfig: JSON.parse(JSON.stringify(mergedSync)) as Prisma.InputJsonValue }
            : {}),
          lightPrimaryColor: lightPrimaryColor != null ? String(lightPrimaryColor) : '#0ea5e9',
          lightAccentColor: lightAccentColor != null ? String(lightAccentColor) : '#0284c7',
          lightBgColor: lightBgColor != null ? String(lightBgColor) : '#ffffff',
          darkPrimaryColor: darkPrimaryColor != null ? String(darkPrimaryColor) : '#0ea5e9',
          darkAccentColor: darkAccentColor != null ? String(darkAccentColor) : '#38bdf8',
          darkBgColor: darkBgColor != null ? String(darkBgColor) : '#0f172a',
          tickerMarqueeDurationSec:
            typeof tickerMarqueeDurationSec === 'number' && Number.isFinite(tickerMarqueeDurationSec)
              ? Math.min(180, Math.max(8, Math.round(tickerMarqueeDurationSec)))
              : 42,
          platformApiUsdtTrc20:
            platformApiUsdtTrc20 === undefined || platformApiUsdtTrc20 === null || platformApiUsdtTrc20 === ''
              ? null
              : String(platformApiUsdtTrc20).trim().slice(0, 120),
          platformApiSubscriptionPriceUsd:
            typeof platformApiSubscriptionPriceUsd === 'number' &&
            Number.isFinite(platformApiSubscriptionPriceUsd) &&
            platformApiSubscriptionPriceUsd >= 0 &&
            platformApiSubscriptionPriceUsd <= 1_000_000
              ? platformApiSubscriptionPriceUsd
              : 50,
          platformApiSubscriptionDays:
            typeof platformApiSubscriptionDays === 'number' &&
            Number.isFinite(platformApiSubscriptionDays) &&
            platformApiSubscriptionDays >= 1 &&
            platformApiSubscriptionDays <= 3650
              ? Math.round(platformApiSubscriptionDays)
              : 365,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings', details },
      { status: 500 }
    );
  }
}
