export type AppearancePreference = 'system' | 'light' | 'dark';
export type AppearanceSnapshot = Readonly<{preference: AppearancePreference; theme: 'light' | 'dark'; persistent: boolean}>;
export type AppearanceController = {
  getSnapshot(): AppearanceSnapshot;
  subscribe(listener: () => void): () => void;
  setPreference(value: AppearancePreference): void;
};
export function createAppearanceController(host: Window): AppearanceController;
export function getAppearanceController(host: Window): AppearanceController;
