import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { isAdminAuthenticated } from '@/lib/admin-session';

/**
 * مسار public الفعلي الذي يقرأ منه خادم Next في وضع standalone.
 * عند التشغيل بـ `node .next/standalone/server.js` من جذر المشروع، cwd هو الجذر
 * لكن الملفات الثابتة تُخدم من `.next/standalone/public` — الكتابة إلى `public/`
 * في الجذر كانت تُخفي الشعار عن المتصفح.
 */
function resolvePublicUploadsDir(): string {
  const cwd = process.cwd();
  const standalonePublic = path.join(cwd, '.next', 'standalone', 'public');
  if (
    existsSync(path.join(cwd, '.next', 'standalone', 'server.js')) &&
    existsSync(standalonePublic)
  ) {
    return path.join(standalonePublic, 'uploads');
  }
  if (existsSync(path.join(cwd, 'server.js'))) {
    return path.join(cwd, 'public', 'uploads');
  }
  return path.join(cwd, 'public', 'uploads');
}

const MAX_BYTES = 2 * 1024 * 1024;

/** امتداد الملف على القرص */
const EXT_BY_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/pjpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
]);

/** عندما يكون type فارغاً (شائع على Windows) نستنتج من اسم الملف */
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
    if (!type || type === 'application/octet-stream') {
      type = '';
    }

    let ext = type ? EXT_BY_MIME.get(type) : undefined;
    if (!ext && fileName) {
      ext = extFromFilename(fileName) ?? undefined;
    }
    if (!ext) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unsupported or unknown image type. Use PNG, JPEG, WebP, GIF, or SVG (check the file extension).',
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File too large (max 2 MB)' }, { status: 400 });
    }

    const dir = resolvePublicUploadsDir();
    await mkdir(dir, { recursive: true });
    const name = `logo-${Date.now()}${ext}`;
    const fsPath = path.join(dir, name);
    await writeFile(fsPath, buf);

    const url = `/uploads/${name}`;
    return NextResponse.json({ success: true, url });
  } catch (e) {
    console.error('upload-logo:', e);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
