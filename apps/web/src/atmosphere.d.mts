export type AtmosphereBackground = 'charcoal' | 'dawn-city' | 'night-alley' | 'star-sea' | 'sunset-sky' | 'rain-library' | 'cloud-sky' | 'ocean-waves' | 'starry-night' | 'rain-window' | 'city-night' | 'fireplace' | 'snow-night' | 'lake-sunset' | 'anime-sea';
export type VideoQuality = 'auto' | 'saver' | 'high';
export type AtmospherePreferences = {background: AtmosphereBackground; motion: 'static' | 'live'; intensity: 'subtle' | 'normal'; paused?: boolean; quality?: VideoQuality};
export type VideoStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type AtmosphereSnapshot = Readonly<AtmospherePreferences & {quality: VideoQuality; paused: boolean; persistent: boolean; reducedMotion: boolean; hidden: boolean; focused: boolean; playing: boolean; videoStatus: VideoStatus; videoRequest: number; mobile: boolean; videoSource?: string; videoResolution?: 720 | 1080}>;
export type AtmosphereTheme = Readonly<{id: AtmosphereBackground; name: string; live: boolean; video?: string; videoSources?: Readonly<Partial<Record<720 | 1080, string>>>; poster?: string; thumbnail?: string; author?: string; source?: string; license?: string; licenseUrl?: string; attribution?: string; changes?: string}>;
export const atmosphereThemes: readonly AtmosphereTheme[];
export function atmosphereKind(theme: AtmosphereTheme): string;
export function atmospherePlayback(snapshot: AtmosphereSnapshot): string;
export function atmosphereVideoSource(theme: AtmosphereTheme, quality?: VideoQuality, mobile?: boolean): {src: string; resolution: 720 | 1080} | null;
export type AtmosphereController = {
  getSnapshot(): AtmosphereSnapshot;
  subscribe(listener: () => void): () => void;
  setPreferences(value: AtmospherePreferences): void;
  reportVideoPlayback(background: AtmosphereBackground, status: VideoStatus, request?: number): void;
  retryVideo(): void;
};
export function createAtmosphereController(host: Window): AtmosphereController;
export function getAtmosphereController(host: Window): AtmosphereController;
