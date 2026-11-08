import { build } from 'esbuild';

await build({
  entryPoints:['api', 'init', 'dispatcher', 'worker'].map(name => `runtime/${name}.mjs`),
  bundle:true, platform:'node', format:'cjs', target:'node22',
  // The Lambda JavaScript runtime must not inherit the CDK compiler settings.
  tsconfigRaw:{},
  outdir:'.pilot-build/lambda', logLevel:'warning',
  external:['pg-native']
});
