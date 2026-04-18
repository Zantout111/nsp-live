import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { resolvePublicUploadsDir } from '@/lib/public-uploads-path';

const MAX_BYTES = 4 * 1024 * 1024;

const EXT_BY_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/pjpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
]);

function extFromFilename(name: string): string | null {
  const m = name.trim().match(/\.([a-z0-9]+)$/i);
  if (!m) return null;
  const map: Record<string, string> = {
    png: '.png',
    jpg: '.jpg',
    jpeg: '.jpg',
    webp: '.webp',
    gif: '.gif',
    svg: '.svg',
  };
  return map[m[1].toLowerCase()] ?? null;
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const raw = form.get('file');
    if (raw == null || typeof raw !== 'object') {
      return NextResponse.json({ success: false, error: 'No file' }, { status: 400 });
    }
    const file = raw as Blob & { name?: string };
    if (typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, error: 'Invalid file' }, { status: 400 });
    }

    const fileName = typeof file.name === 'string' ? file.name : '';
    let type = (file.type || '').trim().toLowerCase();
    if (!type || type === 'application/octet-stream') type = '';

    let ext = type ? EXT_BY_MIME.get(type) : undefined;
    if (!ext && fileName) {
      ext = extFromFilename(fileName) ?? undefined;
    }
    if (!ext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported image type. Allowed: PNG, JPEG, WebP, GIF, SVG.',
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 4 MB)' },
        { status: 400 }
      );
    }

    const dir = resolvePublicUploadsDir();
    await mkdir(dir, { recursive: true });
    const name = `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const fsPath = path.join(dir, name);
    await writeFile(fsPath, buf);

    return NextResponse.json({ success: true, url: `/uploads/${name}` });
  } catch (error) {
    console.error('upload-article-image:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

