export type FeedTextInline = {type: 'text'; text: string};
export type FeedStrongInline = {type: 'strong'; children: FeedInline[]};
export type FeedEmphasisInline = {type: 'emphasis'; children: FeedInline[]};
export type FeedCodeInline = {type: 'code'; text: string};
export type FeedLinkInline = {type: 'link'; href: string; children: FeedInline[]};
export type FeedInline = FeedTextInline | FeedStrongInline | FeedEmphasisInline | FeedCodeInline | FeedLinkInline;

export type FeedHeadingBlock = {type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: FeedInline[]};
export type FeedParagraphBlock = {type: 'paragraph'; children: FeedInline[]};
export type FeedListBlock = {type: 'list'; ordered: boolean; start: number | null; items: FeedInline[][]};
export type FeedCodeBlock = {type: 'code_block'; language: string | null; text: string};
export type FeedBlock = FeedHeadingBlock | FeedParagraphBlock | FeedListBlock | FeedCodeBlock;

export function feedMarkdownPreview(text: string, limit?: number): string;
export function parseFeedMarkdown(text: string): FeedBlock[];
