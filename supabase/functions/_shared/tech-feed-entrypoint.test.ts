// Inspect the same statically discoverable dependency graph used for Edge bundles.
// A locally cached dynamic import must not hide a missing deployed dependency.
for (const name of ['tech-feed', 'tech-feed-worker']) {
  Deno.test(`${name} bundles its XML parser without a runtime package download`, async () => {
    const entrypoint = new URL(`../${name}/index.ts`, import.meta.url).href;
    const result = await new Deno.Command(Deno.execPath(), {
      args: ['info', '--json', '--no-config', '--node-modules-dir=none', entrypoint],
      stdout: 'piped', stderr: 'piped',
    }).output();
    if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
    const graph = JSON.parse(new TextDecoder().decode(result.stdout));
    const parser = Object.values(graph.npmPackages ?? {}).find(
      (pkg: any) => pkg.name === 'fast-xml-parser' && pkg.version === '5.11.1',
    );
    if (!parser) throw new Error('XML parser is absent from the deployable dependency graph');
  });
}
