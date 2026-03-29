import { existsSync } from 'fs';
import path from 'path';

/**
 * مجلد رفع الملفات تحت public/uploads (متوافق مع وضع standalone).
 */
export function resolvePublicUploadsDir(): string {
  const cwd = process.cwd();
  // `next dev` يخدم الملفات الثابتة من `public/` فقط. بعد `next build` يبقى مجلد
  // `.next/standalone` على القرص؛ لو كتبنا الإيصالات هناك فلن تُجد عند /uploads/... في التطوير.
  if (process.env.NODE_ENV === 'development') {
    return path.join(cwd, 'public', 'uploads');
  }
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
