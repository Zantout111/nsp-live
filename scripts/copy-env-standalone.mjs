import { copyFileSync, existsSync } from 'node:fs';

const src = '.env';
const dest = '.next/standalone/.env';
if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log('[build] copied .env to .next/standalone/');
} else {
  console.warn('[build] no .env file; skip copy (create .env on server before start)');
}
