import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const persistent = join(root, 'uploads');
const standalonePublic = join(root, '.next/standalone/public');
const linkPath = join(standalonePublic, 'uploads');

if (!existsSync(join(root, '.next/standalone/server.js'))) {
  console.warn('[build] skip link uploads: standalone not found');
  process.exit(0);
}

mkdirSync(persistent, { recursive: true });
mkdirSync(standalonePublic, { recursive: true });

if (existsSync(linkPath)) {
  try {
    const st = lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      rmSync(linkPath);
    } else {
      rmSync(linkPath, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

const relTarget = relative(dirname(linkPath), persistent);
try {
  symlinkSync(relTarget || '.', linkPath, 'dir');
  console.log('[build] public/uploads →', persistent, '(symlink)');
} catch (e) {
  console.warn(
    '[build] symlink uploads failed (permissions/OS); rely on app/uploads route or UPLOADS_DIR:',
    e instanceof Error ? e.message : e
  );
}
