import { readFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { resolvePublicUploadsDir } from '@/lib/public-uploads-path';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function safeFileUnderBase(base: string, segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => s === '..' || s.includes('/') || s.includes('\\'))) {
    return null;
  }
  const resolved = path.resolve(base, ...segments);
  const rel = path.relative(base, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments = [] } = await context.params;
  const base = resolvePublicUploadsDir();
  const filePath = safeFileUnderBase(base, segments);
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const body = await readFile(filePath);
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
