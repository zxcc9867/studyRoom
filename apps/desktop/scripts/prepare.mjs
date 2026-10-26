import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseEnv } from 'node:util';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://study-room-attendance.vercel.app';
const publicNames = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const invalid = () => { throw new Error('INVALID_PUBLIC_CONFIG'); };

/** Only these public values may enter an installed application. Never serialize the environment. */
export function publicConfig(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.origin !== supabaseUrl || typeof supabaseAnonKey !== 'string'
      || supabaseAnonKey.length > 4096 || /\s/.test(supabaseAnonKey)) invalid();
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(supabaseAnonKey)) {
      const parts = supabaseAnonKey.split('.');
      if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))
        || JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role !== 'anon') invalid();
    }
    return { origin, supabaseUrl, supabaseAnonKey };
  } catch { invalid(); }
}

export async function prepareDesktop({ output = path.join(desktop, 'resources'), env = process.env, envFile,
  icon = path.resolve(desktop, '../mobile/assets/study-room-icon.png') } = {}) {
  let selected = Object.fromEntries(publicNames.map(name => [name, env[name]]));
  if (envFile) {
    // Parse only the two public single-line assignments, never private entries.
    const lines = (await readFile(path.resolve(envFile), 'utf8')).split(/\r?\n/)
      .filter(line => /^(?:export\s+)?VITE_SUPABASE_(?:URL|ANON_KEY)\s*=/.test(line));
    const parsed = parseEnv(lines.join('\n'));
    selected = Object.fromEntries(publicNames.map(name => [name, selected[name] ?? parsed[name]]));
  }
  const config = publicConfig(selected);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'public-config.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  await copyFile(icon, path.join(output, 'study-room-icon.png'));
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const envArgument = args.find(arg => arg.startsWith('--env-file='));
  if (args.some(arg => !arg.startsWith('--env-file=')) || args.length > 1) throw new Error('BAD_PREPARE_ARGUMENTS');
  await prepareDesktop({ envFile: envArgument?.slice('--env-file='.length) });
  console.log('Desktop public configuration and existing icon prepared.');
}
