import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { prepareDesktop } from './prepare.mjs';

const require = createRequire(import.meta.url);
const desktop = fileURLToPath(new URL('../', import.meta.url));
const [mode, ...args] = process.argv.slice(2);
if (!['start', 'build', 'integration'].includes(mode)) throw Error('BAD_DESKTOP_COMMAND');
const envArgs = args.filter(arg => arg.startsWith('--env-file='));
const runtimeArgs = args.filter(arg => /^--desktop-(?:origin|user-data)=/.test(arg));
if (envArgs.length > 1 || args.length !== envArgs.length + runtimeArgs.length || (mode !== 'start' && runtimeArgs.length)) throw Error('BAD_DESKTOP_ARGUMENTS');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

function execute(executable, parameters, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, parameters, { cwd, stdio: 'inherit', env, windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}
if (mode === 'integration') {
  const packagePath = path.dirname(require.resolve('electron/package.json'));
  const binaryName = await readFile(path.join(packagePath, 'path.txt'), 'utf8').catch(() => '');
  const executable = env.STUDY_ROOM_ELECTRON_EXECUTABLE || (binaryName && path.join(packagePath, 'dist', binaryName));
  if (typeof executable !== 'string' || !existsSync(executable)) throw Error('ELECTRON_EXECUTABLE_REQUIRED');
  const directory = path.join(desktop, 'test/integration');
  const files = existsSync(directory) ? (await readdir(directory)).filter(name => name.endsWith('.mjs')).map(name => path.join(directory, name)) : [];
  if (!files.length) throw Error('ELECTRON_INTEGRATION_TESTS_REQUIRED');
  env.STUDY_ROOM_ELECTRON_EXECUTABLE = executable;
  process.exitCode = await execute(process.execPath, ['--test', ...files], path.resolve(desktop, '../..'));
} else {
  await prepareDesktop({ envFile: envArgs[0]?.slice('--env-file='.length) });
  if (mode === 'start') {
    const executable = require('electron');
    if (typeof executable !== 'string' || !existsSync(executable)) throw Error('ELECTRON_EXECUTABLE_REQUIRED');
    process.exitCode = await execute(executable, [desktop, ...runtimeArgs], desktop);
  } else {
    delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
    process.exitCode = await execute(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), '--win', 'nsis', '--x64', '--publish', 'never'], desktop);
  }
}
