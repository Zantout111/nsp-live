import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(appRoot, '.next', 'standalone');

function copyDirIfExists(relFromApp) {
  const src = join(appRoot, relFromApp);
  const dest = join(standalone, relFromApp);
  if (!existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[build] copied ${relFromApp} -> .next/standalone/${relFromApp}`);
}

copyDirIfExists('prisma/db');
copyDirIfExists('db');
