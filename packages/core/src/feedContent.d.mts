export const FEED_VIDEO_DOMAINS: string[];
export function feedContentKind(value: string): 'video' | 'listing' | 'article' | 'unknown';
export function cleanFeedIntroduction(value: unknown): string;
