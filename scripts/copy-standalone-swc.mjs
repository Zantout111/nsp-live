import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const src = resolve(root, 'node_modules/@swc/helpers');
const dest = resolve(root, '.next/standalone/node_modules/@swc/helpers');

if (!existsSync(src)) {
  console.warn('[build] @swc/helpers not in node_modules; skip copy');
  process.exit(0);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, {
  recursive: true,
  dereference: true,
});
console.log('[build] copied @swc/helpers → .next/standalone/node_modules/ (dereference symlinks)');
