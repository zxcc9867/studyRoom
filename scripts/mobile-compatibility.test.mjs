import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { checkMobileCompatibility, resolveMobileImport, runRendererVersionGuard } from './mobile-compatibility.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const rendererDirectory = path.join(
  path.dirname(mobileRequire.resolve('react-native/package.json')),
  'Libraries/Renderer/implementations',
);

for (const mode of ['dev', 'prod']) {
  const source = readFileSync(path.join(rendererDirectory, `ReactNativeRenderer-${mode}.js`), 'utf8');

  test(`native ${mode} renderer accepts React resolved by the mobile app`, () => {
    assert.doesNotThrow(() => runRendererVersionGuard(source, mobileRequire('react')));
  });

  test(`native ${mode} renderer rejects the separately resolved web React`, () => {
    assert.throws(() => runRendererVersionGuard(source, webRequire('react')), /Incompatible React versions/);
  });
}

test('an unrecognized renderer guard fails closed instead of silently passing', () => {
  assert.throws(() => runRendererVersionGuard('/* no compatible guard */', mobileRequire('react')), /version guard/);
});

test('installed native dependency graph satisfies Expo while web React remains current', () => {
  const result = checkMobileCompatibility(root);
  assert.equal(result.mobileReact, '19.0.0');
  assert.equal(result.webReact, '19.2.7');
  assert.equal(result.webReactDom, '19.2.7');
  assert.equal(result.reactNative, '0.79.6');
  assert.equal(result.asyncStorage, '2.1.2');
});

for (const platform of ['android', 'ios']) {
  test(`Expo ${platform} entry registers the mobile App, even when Expo is hoisted`, () => {
    const { resolveEntryPoint } = mobileRequire('@expo/config/paths');
    const entryPath = resolveEntryPoint(path.join(root, 'apps/mobile'), { platform });
    const source = readFileSync(entryPath, 'utf8');
    const { transformSync } = mobileRequire('@babel/core');
    const code = transformSync(source, {
      filename: entryPath,
      babelrc: false,
      configFile: false,
      plugins: [mobileRequire.resolve('@babel/plugin-transform-modules-commonjs')],
    }).code;
    // Loading the native App or Expo host needs a device. Replace only that host
    // boundary while executing the real entry and Metro-resolving its App import.
    const App = function NativeApp() {};
    const registrations = [];
    let backgroundRegistered = false;
    const registerRootComponent = (component) => {
      assert.equal(backgroundRegistered, true, 'focus background task must load before the app mounts');
      registrations.push(component);
    };
    const entryRequire = (name) => {
      if (name === 'expo') return { registerRootComponent };
      if (name === 'expo/src/launch/registerRootComponent') return { __esModule: true, default: registerRootComponent };
      const resolved = resolveMobileImport(root, entryPath, name, platform);
      if (name === './src/focusBackground') {
        assert.equal(resolved.filePath, path.join(root, 'apps/mobile/src/focusBackground.ts'));
        backgroundRegistered = true;
        return {};
      }
      assert.equal(resolved.filePath, path.join(root, 'apps/mobile/App.tsx'));
      return { __esModule: true, default: App };
    };
    runInNewContext(code, { require: entryRequire, exports: {} }, { timeout: 1000 });
    assert.deepEqual(registrations, [App]);
  });
}

test('native aliases do not redirect Expo web React to the native React copy', () => {
  const resolved = resolveMobileImport(root, mobileRequire.resolve('expo/package.json'), 'react', 'web');
  assert.equal(resolved.filePath, webRequire.resolve('react'));
});

test('native aliases retain default resolution for unrelated packages', () => {
  const origin = mobileRequire.resolve('expo/package.json');
  const resolved = resolveMobileImport(root, origin, 'react-is', 'android');
  assert.equal(resolved.filePath, createRequire(origin).resolve('react-is'));
});

test('shared study-day module remains visible when native builds disable the workspace root', () => {
  const configPath = path.join(root, 'apps/mobile/metro.config.cjs');
  const previous = process.env.EXPO_NO_METRO_WORKSPACE_ROOT;
  try {
    process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';
    delete mobileRequire.cache[configPath];
    const config = mobileRequire(configPath);
    const sharedRoot = path.join(root, 'packages/core');
    assert.ok(config.watchFolders.some((folder) => path.resolve(folder) === sharedRoot));
    const resolved = resolveMobileImport(root, path.join(root, 'apps/mobile/App.tsx'), '../../packages/core/src/index.mjs', 'android');
    assert.equal(resolved.filePath, path.join(sharedRoot, 'src/index.mjs'));
  } finally {
    if (previous === undefined) delete process.env.EXPO_NO_METRO_WORKSPACE_ROOT;
    else process.env.EXPO_NO_METRO_WORKSPACE_ROOT = previous;
    delete mobileRequire.cache[configPath];
  }
});
