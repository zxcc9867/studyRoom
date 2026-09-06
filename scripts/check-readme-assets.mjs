import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Validate actual published assets, not screenshot-shaped placeholders.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['README.md', 'README.ko.md', 'README.ja.md'];
const failures = [];
let checked = 0;
for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8');
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split(/\s+"/)[0];
    if (/^(?:https?:|data:)/.test(target)) continue;
    const imagePath = resolve(root, decodeURIComponent(target.split('#')[0]));
    if (relative(root, imagePath).startsWith('..')) { failures.push(`${file}: image escapes repository`); continue; }
    if (!existsSync(imagePath) || !statSync(imagePath).isFile()) { failures.push(`${file}: missing ${target}`); continue; }
    const data = readFileSync(imagePath);
    const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = data[0] === 255 && data[1] === 216;
    const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    const svg = data.toString('utf8', 0, Math.min(1024, data.length)).includes('<svg');
    if (!png && !jpeg && !webp && !svg) failures.push(`${file}: unsupported or invalid image ${target}`);
    checked++;
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`README image references verified: ${checked} across ${files.length} languages.`);
