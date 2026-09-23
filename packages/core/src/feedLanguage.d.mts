export type FeedOriginalLanguage = 'ko' | 'en' | 'unknown';
export function feedOriginalLanguage(title: unknown, excerpt?: unknown): FeedOriginalLanguage;
export const FEED_LANGUAGE_LABELS: Record<FeedOriginalLanguage, string>;
