const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const nativePackages = Object.fromEntries(
  ['react', 'react-native'].map((name) => [
    name,
    path.dirname(require.resolve(`${name}/package.json`)),
  ]),
);

// Expo 53's hoisted dependencies must use the native app's React instance,
// including JSX entry points, without changing the separate Vite web runtime.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' || platform === 'ios') {
    for (const [name, directory] of Object.entries(nativePackages)) {
      if (moduleName === name || moduleName.startsWith(`${name}/`)) {
        const target = path.join(directory, moduleName.slice(name.length));
        return context.resolveRequest(context, target, platform);
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
