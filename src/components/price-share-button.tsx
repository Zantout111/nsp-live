'use client';

import { useState, useCallback } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  generatePriceShareJpeg,
  downloadImageBlob,
  execNavigatorShareOnly,
  type ShareImageRow,
} from '@/lib/generate-price-share-image';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type PriceShareButtonProps = {
  logoUrl: string;
  siteName: string;
  locale: string;
  promoLine: string;
  headline: string;
  subheadline?: string;
  rows: ShareImageRow[];
  fileNameSlug: string;
  /** سطر يصف السعر في نص المشاركة */
  detailLine: string;
  shareLabel: string;
  successShared: string;
  successDownload: string;
  errorMessage: string;
  /** آخر تحديث للأسعار (يُعرض على الصورة ويُرفق بنص المشاركة) */
  lastUpdateLine?: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
};

type PendingShare = {
  blob: Blob;
  fileName: string;
  shareTitle: string;
  shareText: string;
  siteUrl: string;
};

function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 0;
}

export function PriceShareButton({
  logoUrl,
  siteName,
  locale,
  promoLine,
  headline,
  subheadline,
  rows,
  fileNameSlug,
  detailLine,
  shareLabel,
  successShared,
  successDownload,
  errorMessage,
  lastUpdateLine,
  className,
  size = 'sm',
}: PriceShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(null);
  const { toast } = useToast();
  const t = useTranslations('currency');

  const finishShareResult = useCallback(
    (result: 'shared' | 'shared-text' | 'failed' | 'cancelled') => {
      if (result === 'cancelled') return;
      if (result === 'failed') {
        toast({ title: errorMessage, variant: 'destructive' });
        return;
      }
      toast({ title: successShared });
    },
    [errorMessage, successShared, toast]
  );

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    setBusy(true);
    try {
      const siteUrl = window.location.origin;
      const resolvedLogo =
        logoUrl.startsWith('http://') || logoUrl.startsWith('https://')
          ? logoUrl
          : `${siteUrl}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`;
      const blob = await generatePriceShareJpeg({
        logoUrl: resolvedLogo,
        siteUrl,
        siteName,
        promoLine,
        locale,
        headline,
        subheadline,
        rows,
        lastUpdateLine,
      });
      const safe = fileNameSlug.replace(/[^\w\-]+/g, '_').slice(0, 80);
      const fileName = `share-${safe}.jpg`;
      const shareTitle = siteName;
      const updateBlock = lastUpdateLine?.trim() ? `\n\n${lastUpdateLine.trim()}` : '';
      const shareText = `${siteName}\n\n${promoLine}\n\n${detailLine}${updateBlock}\n\n${siteUrl}`;

      const hasShare = typeof navigator !== 'undefined' && !!navigator.share;

      if (hasShare && !isTouchDevice()) {
        const result = await execNavigatorShareOnly(blob, fileName, shareTitle, shareText, siteUrl);
        if (result === 'shared' || result === 'shared-text') {
          finishShareResult(result);
          return;
        }
        if (result === 'cancelled') return;
        downloadImageBlob(blob, fileName);
        toast({ title: successDownload });
        return;
      }

      if (hasShare && isTouchDevice()) {
        setPendingShare({ blob, fileName, shareTitle, shareText, siteUrl });
        setShareSheetOpen(true);
        return;
      }

      downloadImageBlob(blob, fileName);
      toast({ title: successDownload });
    } catch {
      toast({ title: errorMessage, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const runShareFromSheet = async () => {
    const p = pendingShare;
    if (!p) return;
    /** لا تغلق الحوار قبل share — إغلاق React قد يستهلك تفعيل المستخدم قبل استدعاء المشاركة */
    const result = await execNavigatorShareOnly(
      p.blob,
      p.fileName,
      p.shareTitle,
      p.shareText,
      p.siteUrl
    );
    setShareSheetOpen(false);
    setPendingShare(null);
    if (result === 'shared' || result === 'shared-text') {
      finishShareResult(result);
      return;
    }
    if (result === 'cancelled') return;
    downloadImageBlob(p.blob, p.fileName);
    toast({ title: successDownload });
  };

  const runDownloadFromSheet = () => {
    const p = pendingShare;
    setShareSheetOpen(false);
    setPendingShare(null);
    if (!p) return;
    downloadImageBlob(p.blob, p.fileName);
    toast({ title: successDownload });
  };

  const dismissSheet = (open: boolean) => {
    setShareSheetOpen(open);
    if (!open) setPendingShare(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size === 'icon' ? 'icon' : size}
        className={
          size === 'icon'
            ? className
            : `h-8 gap-1.5 px-2 text-xs ${className ?? ''}`
        }
        disabled={busy}
        onClick={handleShare}
        aria-label={shareLabel}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        {size !== 'icon' && <span className="hidden sm:inline">{shareLabel}</span>}
      </Button>

      <AlertDialog open={shareSheetOpen} onOpenChange={dismissSheet}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shareReadyTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('shareReadyDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" className="w-full sm:w-auto" onClick={() => void runShareFromSheet()}>
              {t('shareOpenSheet')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={runDownloadFromSheet}
            >
              {t('shareDownloadOnly')}
            </Button>
            <AlertDialogCancel className="w-full sm:mt-0">{t('shareDialogCancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
