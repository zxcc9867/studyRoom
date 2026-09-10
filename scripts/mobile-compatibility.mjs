import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Execute the installed renderer's actual guard, not a duplicated version rule.
// A changed upstream layout must be reviewed instead of silently skipping it.
export function runRendererVersionGuard(source, React) {
  const guard = source.match(/var isomorphicReactPackageVersion = React\.version;\s*if \([\s\S]*?\n\s*\);/g);
  assert.equal(guard?.length, 1, 'Expected exactly one recognizable native renderer version guard');
  assert.ok(guard[0].includes('Incompatible React versions'), 'Missing native renderer version guard');
  runInNewContext(guard[0], { React }, { timeout: 1000 });
}

export function resolveMobileImport(root, originModulePath, name, platform) {
  const appRoot = path.join(root, 'apps/mobile');
  const appRequire = createRequire(path.join(appRoot, 'package.json'));
  const configPath = path.join(appRoot, 'metro.config.cjs');
  const config = existsSync(configPath) ? appRequire(configPath) : appRequire('expo/metro-config').getDefaultConfig(appRoot);
  const { resolve } = appRequire('metro-resolver');
  const getPackage = (filename) => existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : null;
  const context = {
    ...config.resolver,
    originModulePath,
    mainFields: config.resolver.resolverMainFields,
    assetExts: new Set(config.resolver.assetExts),
    allowHaste: false,
    preferNativePlatform: platform !== 'web',
    dev: false,
    isESMImport: false,
    customResolverOptions: {},
    doesFileExist: (filename) => existsSync(filename) && statSync(filename).isFile(),
    fileSystemLookup: (filename) => {
      if (!existsSync(filename)) return { exists: false };
      return { exists: true, type: statSync(filename).isDirectory() ? 'd' : 'f', realPath: realpathSync(filename) };
    },
    getPackage,
    getPackageForModule: (filename) => {
      let directory = path.dirname(filename);
      while (directory !== path.dirname(directory) && path.basename(directory) !== 'node_modules') {
        const packageJson = getPackage(path.join(directory, 'package.json'));
        if (packageJson) return { packageJson, rootPath: directory, packageRelativePath: path.relative(directory, filename) };
        directory = path.dirname(directory);
      }
      return null;
    },
    resolveAsset: () => null,
    unstable_logWarning: (message) => { throw new Error(message); },
  };
  return resolve(context, name, platform);
}

export function checkMobileCompatibility(root) {
  const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
  const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
  const expoPath = mobileRequire.resolve('expo/package.json');
  const expoRequire = createRequire(expoPath);
  const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
  const semver = cliRequire('semver');
  const bundled = JSON.parse(readFileSync(path.join(path.dirname(expoPath), 'bundledNativeModules.json'), 'utf8'));
  const manifest = mobileRequire('./package.json');
  const React = mobileRequire('react');

  for (const name of Object.keys(manifest.dependencies)) {
    if (!bundled[name]) continue;
    const installed = mobileRequire(`${name}/package.json`).version;
    assert.ok(semver.satisfies(installed, bundled[name]), `${name}: installed ${installed}; Expo expects ${bundled[name]}`);
  }

  const reactNativePath = mobileRequire.resolve('react-native/package.json');
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const nativeInstallations = Object.keys(lock.packages).filter((entry) => entry.endsWith('node_modules/react-native'));
  assert.equal(nativeInstallations.length, 1, 'Expo 53 requires one React Native installation in this monorepo');
  // Exercise Metro against the installed filesystem from both local and hoisted
  // importers; Node resolution alone does not include the app's native aliases.
  for (const platform of ['android', 'ios']) {
    for (const packagePath of [path.join(root, 'apps/mobile/App.tsx'), reactNativePath, expoPath]) {
      for (const name of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-native']) {
        const resolved = resolveMobileImport(root, packagePath, name, platform);
        assert.equal(resolved.type, 'sourceFile');
        assert.equal(resolved.filePath, mobileRequire.resolve(name), `${name} from ${packagePath} resolves outside the mobile dependency on ${platform}`);
      }
    }
  }
  for (const mode of ['dev', 'prod']) {
    const rendererPath = path.join(path.dirname(reactNativePath), 'Libraries/Renderer/implementations', `ReactNativeRenderer-${mode}.js`);
    runRendererVersionGuard(readFileSync(rendererPath, 'utf8'), React);
  }

  const webReact = webRequire('react');
  const webReactDom = webRequire('react-dom/package.json').version;
  assert.equal(webReact.version, webReactDom, 'Web React and React DOM must remain compatible');
  assert.equal(webReact.version, '19.2.7', 'This native repair must not change the web React version');

  return {
    expo: mobileRequire('expo/package.json').version,
    mobileReact: React.version,
    reactNative: mobileRequire('react-native/package.json').version,
    asyncStorage: mobileRequire('@react-native-async-storage/async-storage/package.json').version,
    webReact: webReact.version,
    webReactDom,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    console.log('Native compatibility passed:', JSON.stringify(checkMobileCompatibility(root)));
  } catch (error) {
    console.error(`Native compatibility failed: ${error.message}`);
    process.exitCode = 1;
  }
}
