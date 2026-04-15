/**
 * صورة JPG للمشاركة — خط Cairo، شعار زاوية بدون تداخل مع العناوين، وسطر ترويجي
 */

const W = 1200;
const H = 630;
const LOGO_MAX_W = 96;
const SIDE_PAD = 36;
/** مساحة محجوزة أسفل الصورة (اسم الموقع، آخر تحديث، الرابط) */
const FOOTER_H = 132;

function loadImageWithCors(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('logo-load-failed'));
    img.src = url;
  });
}

function canvasFontStack(): string {
  if (typeof document === 'undefined') return 'Cairo, sans-serif';
  const ff = getComputedStyle(document.body).fontFamily;
  return ff && ff !== 'inherit' ? ff : 'Cairo, sans-serif';
}

async function ensureShareFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await document.fonts.ready;
  const stack = canvasFontStack();
  const base = stack.split(',')[0]?.replace(/["']/g, '').trim() || 'Cairo';
  await Promise.all([
    document.fonts.load(`700 42px ${base}`),
    document.fonts.load(`600 26px ${base}`),
    document.fonts.load(`500 22px ${base}`),
    document.fonts.load(`500 16px ${base}`),
  ]).catch(() => undefined);
}

export type ShareImageRow = {
  label: string;
  value: string;
  tone?: 'buy' | 'sell' | 'neutral';
};

export type ShareImagePayload = {
  logoUrl: string;
  siteUrl: string;
  siteName: string;
  /** يظهر على الصورة فوق صندوق الأسعار */
  promoLine: string;
  locale: string;
  headline: string;
  subheadline?: string;
  rows: ShareImageRow[];
  /** آخر تحديث للأسعار في الموقع (نص جاهز للعرض) */
  lastUpdateLine?: string;
};

function measureLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    const test = `${current} ${w}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = w;
    }
  }
  lines.push(current);
  return lines;
}

/** yStart = أعلى الكتلة؛ تُرجع الموضع أسفل آخر سطر (للمسافة التالية) */
function drawLinesCentered(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  yStart: number,
  lineHeight: number,
  firstBaselineOffset: number
): number {
  let y = yStart + firstBaselineOffset;
  for (const line of lines) {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  }
  return y;
}

export async function generatePriceShareJpeg(params: ShareImagePayload): Promise<Blob> {
  const { logoUrl, siteUrl, siteName, promoLine, locale, headline, subheadline, rows, lastUpdateLine } = params;
  const isRtl = locale === 'ar';
  const ff = canvasFontStack();

  await ensureShareFontsReady();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-2d');

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f0f9ff');
  g.addColorStop(0.45, '#e0f2fe');
  g.addColorStop(1, '#dbeafe');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImageWithCors(logoUrl);
  } catch {
    /* بدون شعار */
  }

  if (logo && logo.width > 0) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    const wmMax = Math.min(W * 0.88, (logo.width / logo.height) * H * 0.72);
    const wmH = (wmMax * logo.height) / logo.width;
    const wmW = wmMax;
    ctx.drawImage(logo, (W - wmW) / 2, (H - wmH) / 2, wmW, wmH);
    ctx.restore();
  }

  const hdrW = LOGO_MAX_W;
  const hdrH = logo && logo.width > 0 ? (hdrW * logo.height) / logo.width : 0;

  if (logo && logo.width > 0) {
    ctx.globalAlpha = 1;
    const lx = isRtl ? W - SIDE_PAD - hdrW : SIDE_PAD;
    const ly = 26;
    ctx.drawImage(logo, lx, ly, hdrW, hdrH);
  }

  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';

  const textMaxW = W - 160;
  const blockTop = 26 + Math.max(hdrH, 56) + 24;
  let cursorY = blockTop;

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 40px ${ff}`;
  const headLines = measureLines(ctx, headline, textMaxW);
  cursorY = drawLinesCentered(ctx, headLines, W / 2, cursorY, 48, 38) + 12;

  if (subheadline?.trim()) {
    ctx.font = `600 26px ${ff}`;
    ctx.fillStyle = '#64748b';
    const subLines = measureLines(ctx, subheadline, textMaxW);
    cursorY = drawLinesCentered(ctx, subLines, W / 2, cursorY, 32, 26) + 12;
  }

  if (promoLine.trim()) {
    ctx.font = `600 21px ${ff}`;
    ctx.fillStyle = '#475569';
    const promoLines = measureLines(ctx, promoLine, textMaxW + 40).slice(0, 3);
    cursorY = drawLinesCentered(ctx, promoLines, W / 2, cursorY, 28, 20) + 14;
  }

  const boxW = Math.min(760, W - 80);
  const boxX = (W - boxW) / 2;
  const rowH = 58;
  const boxPad = 16;
  const innerRows = rows.length;
  const boxH = innerRows * rowH + boxPad * 2;

  const maxBoxBottom = H - FOOTER_H;
  let boxY = cursorY;
  if (boxY + boxH > maxBoxBottom) {
    boxY = Math.max(cursorY - 24, maxBoxBottom - boxH - 8);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.font = `600 24px ${ff}`;
  const pad = 36;
  rows.forEach((row, i) => {
    const y = boxY + boxPad + (i + 1) * rowH - 18;
    let color = '#0f172a';
    if (row.tone === 'buy') color = '#15803d';
    if (row.tone === 'sell') color = '#b91c1c';

    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillStyle = color;
    const tx = isRtl ? boxX + boxW - pad : boxX + pad;
    ctx.fillText(row.label, tx, y);

    ctx.textAlign = isRtl ? 'left' : 'right';
    ctx.fillStyle = '#0f172a';
    const vx = isRtl ? boxX + pad : boxX + boxW - pad;
    ctx.fillText(row.value, vx, y);
  });

  ctx.textAlign = 'center';
  let footY = H - 28;
  ctx.font = `500 19px ${ff}`;
  ctx.fillStyle = '#2563eb';
  ctx.fillText(siteUrl, W / 2, footY);

  footY -= 28;
  ctx.font = `600 17px ${ff}`;
  ctx.fillStyle = '#64748b';
  ctx.fillText(siteName, W / 2, footY);

  const updateText = lastUpdateLine?.trim();
  if (updateText) {
    ctx.font = `500 16px ${ff}`;
    ctx.fillStyle = '#475569';
    const updLines = measureLines(ctx, updateText, W - 100).slice(0, 2);
    for (let i = updLines.length - 1; i >= 0; i--) {
      footY -= 26;
      ctx.fillText(updLines[i]!, W / 2, footY);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('jpeg-blob'));
      },
      'image/jpeg',
      0.92
    );
  });
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

export function downloadImageBlob(blob: Blob, fileName: string): void {
  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(href);
}

/**
 * يستدعى navigator.share فقط — يُفضَّل من معالج نقرة مباشر (بعد await لتوليد الصورة
 * تفقد المتصفحات الجوال «لمسة المستخدم» فيُرفض المشاركة ويُنزَّل الملف).
 */
export async function execNavigatorShareOnly(
  blob: Blob,
  fileName: string,
  shareTitle: string,
  shareText: string,
  url: string
): Promise<'shared' | 'shared-text' | 'failed' | 'cancelled'> {
  if (typeof navigator === 'undefined' || !navigator.share) return 'failed';

  const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });

  try {
    const withFiles = { files: [file], title: shareTitle, text: shareText, url };
    if (!navigator.canShare || navigator.canShare(withFiles)) {
      await navigator.share(withFiles);
      return 'shared';
    }
  } catch (e) {
    if (isAbortError(e)) return 'cancelled';
  }

  try {
    const textPayload = `${shareText}\n\n${url}`;
    if (!navigator.canShare || navigator.canShare({ text: textPayload })) {
      await navigator.share({ title: shareTitle, text: textPayload, url });
      return 'shared-text';
    }
  } catch (e) {
    if (isAbortError(e)) return 'cancelled';
  }

  try {
    await navigator.share({ title: shareTitle, text: `${shareText}\n\n${url}` });
    return 'shared-text';
  } catch (e) {
    if (isAbortError(e)) return 'cancelled';
  }

  return 'failed';
}

/** مسار قديم: محاولة مشاركة ثم تنزيل — يُفضَّل استخدام execNavigatorShareOnly بعد نقرة ثانية على الجوال */
export async function sharePriceImageBlob(
  blob: Blob,
  fileName: string,
  shareTitle: string,
  shareText: string,
  url: string
): Promise<'shared' | 'shared-text' | 'downloaded' | 'cancelled'> {
  const r = await execNavigatorShareOnly(blob, fileName, shareTitle, shareText, url);
  if (r === 'shared' || r === 'shared-text') return r;
  if (r === 'cancelled') return 'cancelled';
  downloadImageBlob(blob, fileName);
  return 'downloaded';
}
