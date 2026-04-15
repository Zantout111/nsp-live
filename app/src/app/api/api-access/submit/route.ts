import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { db, ensureSqliteSchema } from '@/lib/db';
import { resolvePublicUploadsDir } from '@/lib/public-uploads-path';

export const dynamic = 'force-dynamic';

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

const EXT_BY_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/pjpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

const formSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(5).max(40),
  websiteName: z.string().trim().min(2).max(200),
  websiteUrl: z.string().trim().min(3).max(500),
  usagePurpose: z.string().trim().min(3).max(2000),
  programmingType: z.string().trim().min(2).max(200),
});

function extFromFilename(name: string): string | null {
  const m = name.trim().match(/\.([a-z0-9]+)$/i);
  if (!m) return null;
  const map: Record<string, string> = {
    png: '.png',
    jpg: '.jpg',
    jpeg: '.jpg',
    webp: '.webp',
  };
  return map[m[1].toLowerCase()] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    await ensureSqliteSchema();
    const form = await request.formData();

    const parsed = formSchema.safeParse({
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      websiteName: String(form.get('websiteName') ?? ''),
      websiteUrl: String(form.get('websiteUrl') ?? ''),
      usagePurpose: String(form.get('usagePurpose') ?? ''),
      programmingType: String(form.get('programmingType') ?? ''),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid form data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let websiteUrl = parsed.data.websiteUrl.trim();
    if (!/^https?:\/\//i.test(websiteUrl)) {
      websiteUrl = `https://${websiteUrl}`;
    }
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid website URL' }, { status: 400 });
    }

    const rawFile = form.get('receipt');
    let receiptImageUrl: string | null = null;

    if (rawFile != null && typeof rawFile === 'object' && 'arrayBuffer' in rawFile) {
      const file = rawFile as Blob & { name?: string };
      const fileName = typeof file.name === 'string' ? file.name : '';
      let type = (file.type || '').trim().toLowerCase();
      if (!type || type === 'application/octet-stream') type = '';

      let ext = type ? EXT_BY_MIME.get(type) : undefined;
      if (!ext && fileName) ext = extFromFilename(fileName) ?? undefined;
      if (!ext) {
        return NextResponse.json(
          { success: false, error: 'Receipt must be PNG, JPEG, or WebP' },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > MAX_RECEIPT_BYTES) {
        return NextResponse.json({ success: false, error: 'Receipt too large (max 4 MB)' }, { status: 400 });
      }

      const dir = resolvePublicUploadsDir();
      await mkdir(dir, { recursive: true });
      const name = `receipt-${Date.now()}${ext}`;
      await writeFile(path.join(dir, name), buf);
      receiptImageUrl = `/uploads/${name}`;
    }

    await db.apiAccessRequest.create({
      data: {
        ...parsed.data,
        websiteUrl,
        receiptImageUrl,
      },
    });

    return NextResponse.json({ success: true, message: 'Request received' });
  } catch (e) {
    console.error('api-access submit:', e);
    return NextResponse.json({ success: false, error: 'Submit failed' }, { status: 500 });
  }
}
