export type FeedCategory = 'news' | 'practice' | 'deep_dive';
export type FeedClassificationMethod = 'ai' | 'rules';
export interface FeedClassificationArticle {
  title?: string;
  excerpt?: string;
  category?: string | null;
  summary_status?: string;
  category_method?: string | null;
}
export interface FeedClassification {
  category: FeedCategory | null;
  method: FeedClassificationMethod | null;
  rules_version: number;
  tags: string[];
}
export const FEED_CLASSIFICATION_RULES_VERSION: number;
export function classifyFeedArticle(article: FeedClassificationArticle, prompt?: string): FeedClassification;
export function feedTopicTags(title: string, excerpt: string, prompt?: string): string[];
