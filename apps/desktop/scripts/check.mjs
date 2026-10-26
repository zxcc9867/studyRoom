import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(desktop, 'package.json'), 'utf8'));
if (manifest.dependencies['@supabase/supabase-js'] !== '2.107.0'
  || manifest.devDependencies.electron !== '45.0.0'
  || manifest.devDependencies['electron-builder'] !== '26.18.0') throw Error('UNPINNED_DESKTOP_DEPENDENCY');
const files = ['main.cjs', 'preload.cjs'];
for (const folder of ['src', 'scripts']) {
  for (const name of await readdir(path.join(desktop, folder))) if (name.endsWith('.mjs')) files.push(path.join(folder, name));
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(desktop, file)], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error(`DESKTOP_SYNTAX_CHECK_FAILED: ${file}`);
}
console.log(`Desktop syntax and pinned dependency checks passed (${files.length} files; Electron binary not required).`);
