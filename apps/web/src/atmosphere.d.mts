export type AtmosphereBackground = 'charcoal' | 'dawn-city' | 'night-alley' | 'star-sea' | 'sunset-sky' | 'rain-library' | 'cloud-sky' | 'ocean-waves';
export type AtmospherePreferences = {background: AtmosphereBackground; motion: 'static' | 'live'; intensity: 'subtle' | 'normal'; paused?: boolean};
export type VideoStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type AtmosphereSnapshot = Readonly<AtmospherePreferences & {paused: boolean; persistent: boolean; reducedMotion: boolean; hidden: boolean; focused: boolean; playing: boolean; videoStatus: VideoStatus; videoRequest: number}>;
export type AtmosphereTheme = Readonly<{id: AtmosphereBackground; name: string; live: boolean; video?: string; poster?: string; thumbnail?: string; author?: string; source?: string; license?: string; licenseUrl?: string}>;
export const atmosphereThemes: readonly AtmosphereTheme[];
export function atmosphereKind(theme: AtmosphereTheme): string;
export function atmospherePlayback(snapshot: AtmosphereSnapshot): string;
export type AtmosphereController = {
  getSnapshot(): AtmosphereSnapshot;
  subscribe(listener: () => void): () => void;
  setPreferences(value: AtmospherePreferences): void;
  reportVideoPlayback(background: AtmosphereBackground, status: VideoStatus): void;
  retryVideo(): void;
};
export function createAtmosphereController(host: Window): AtmosphereController;
export function getAtmosphereController(host: Window): AtmosphereController;
