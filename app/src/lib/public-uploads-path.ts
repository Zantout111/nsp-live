import { existsSync } from 'fs';
import path from 'path';

/**
 * جذر المشروع في الإنتاج: عند تشغيل standalone من `.next/standalone` يكون cwd هناك،
 * و`npm run build` يحذف ذلك المجلد بالكامل فيُفقد `public/uploads` (الشعار والمرفقات).
 * لذلك نخزّن الرفع تحت `<جذر_المشروع>/uploads` ونخدمها عبر `app/uploads/[[...path]]/route.ts`.
 */
function resolveProductionProjectRoot(): string {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, 'server.js'))) {
    return path.resolve(cwd, '..', '..');
  }
  return cwd;
}

/**
 * مجلد رفع الملفات. التطوير: `public/uploads`. الإنتاج: مجلد `uploads` بجانب المشروع
 * أو المسار في `UPLOADS_DIR` (مسار مطلق).
 */
export function resolvePublicUploadsDir(): string {
  const cwd = process.cwd();
  const fromEnv = process.env.UPLOADS_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  if (process.env.NODE_ENV === 'development') {
    return path.join(cwd, 'public', 'uploads');
  }
  return path.join(resolveProductionProjectRoot(), 'uploads');
}
