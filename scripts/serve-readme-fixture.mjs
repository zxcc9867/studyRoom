// Render the real Dashboard and TeamStudySection with the existing mounted-test
// backend. No production login, external model call, or remote write is used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = process.env.README_SOURCE_ROOT
  ? pathToFileURL(resolve(process.env.README_SOURCE_ROOT) + '/')
  : new URL('../', import.meta.url);
function template(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Mounted fixture boundary missing: ${start}`);
  return source.slice(first + start.length, last);
}
const personalSource = (await readFile(new URL('apps/web/test/actualStudyMounted.test.mjs', root), 'utf8')).replace(/\r\n/g, '\n');
const teamSource = (await readFile(new URL('apps/web/test/team-study-mounted.test.mjs', root), 'utf8')).replace(/\r\n/g, '\n');
const personal = template(personalSource, 'const backend = `', '\n`;\n');
const team = template(teamSource, 'const teamBoundary=`', '\n`;\n').replaceAll('${token}', 'a'.repeat(64));
const result = await build({
  entryPoints: [fileURLToPath(new URL('apps/web/src/main.tsx', root))],
  bundle: true, write: false, outdir: 'fixture', platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'readme-local-boundary', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'backend', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: personal + '\n' + team, loader: 'js' }));
    builder.onLoad({ filter: /bodyPresenceDetection\.mjs$/ }, () => ({ contents: 'export async function createUpperBodyPresenceDetector(){return {detect:()=>true,close(){}}}', loader: 'js' }));
  }}],
});
const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/app.css' : '/app.js', file.contents]));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudyRoom README — local synthetic fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
export const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', request.url === '/app.css' ? 'text/css; charset=utf-8' : request.url === '/app.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  response.end(assets.get(request.url) ?? html);
});
server.listen(Number(process.env.README_FIXTURE_PORT) || 4184, '127.0.0.1', () => console.log(`Actual React UI / synthetic local data: http://127.0.0.1:${server.address().port}/?mode=start#together`));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
