export type AtmosphereBackground = 'charcoal' | 'dawn-city' | 'night-alley' | 'star-sea' | 'sunset-sky' | 'rain-library';
export type AtmospherePreferences = {background: AtmosphereBackground; motion: 'static' | 'live'; intensity: 'subtle' | 'normal'; paused?: boolean};
export type AtmosphereSnapshot = Readonly<AtmospherePreferences & {paused: boolean; persistent: boolean; reducedMotion: boolean; hidden: boolean; focused: boolean; playing: boolean}>;
export const atmosphereThemes: readonly Readonly<{id: AtmosphereBackground; name: string; live: boolean}>[];
export type AtmosphereController = {
  getSnapshot(): AtmosphereSnapshot;
  subscribe(listener: () => void): () => void;
  setPreferences(value: AtmospherePreferences): void;
};
export function createAtmosphereController(host: Window): AtmosphereController;
export function getAtmosphereController(host: Window): AtmosphereController;
