import { feedIsRoundupTitle } from './feedContent.mjs';

export const FEED_CLASSIFICATION_RULES_VERSION = 2;

const VALID_CATEGORIES = new Set(['news', 'practice', 'deep_dive']);
const MAX_TEXT_LENGTH = 10_000;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 12;

const TOPICS = [
  ['Backend', ['backend', 'back-end', '백엔드']],
  ['Frontend', ['frontend', 'front-end', '프론트엔드']],
  ['AI', ['artificial intelligence', '인공지능', 'machine learning', '머신러닝', 'ai']],
  ['LLM', ['large language model', 'large language models', 'llm', 'llms']],
  ['AWS', ['amazon web services', 'aws']],
  ['Azure', ['microsoft azure', 'azure']],
  ['GCP', ['google cloud platform', 'google cloud', 'gcp']],
  ['PostgreSQL', ['postgresql', 'postgres']],
  ['Kubernetes', ['kubernetes', 'k8s']],
  ['Node.js', ['node.js', 'nodejs']],
  ['TypeScript', ['typescript']],
  ['JavaScript', ['javascript']],
  ['Python', ['python']],
  ['React', ['react.js', 'reactjs', 'react']],
  ['Vue', ['vue.js', 'vuejs', 'vue']],
  ['Redis', ['redis']],
  ['C#', ['c#', 'csharp']],
  ['.NET', ['.net', 'dotnet']],
  ['Supabase', ['supabase']],
  ['Claude Code', ['claude code']],
  ['Docker', ['docker']],
  ['Terraform', ['terraform']],
];

const CATEGORY_SIGNALS = {
  news: [
    /\b(?:introducing|announc(?:e|ed|ement|ing)|launch(?:ed|es|ing)?|release(?:d|s)?|now available|what['’]s new|general availability)\b/i,
    /(?:출시|릴리스|정식 공개|새 기능 공개|발표합니다|업데이트 소식|지원 종료)/u,
  ],
  practice: [
    /\b(?:tutorial|step[ -]by[ -]step|how to|getting started|hands[ -]on|implementation guide|setup guide|migration guide|best practices?)\b/i,
    /(?:튜토리얼|실습|따라 ?하기|설정 가이드|구현 가이드|사용 가이드|사용법|구현하는 방법|배포하는 방법|설정하는 방법)/u,
  ],
  deep_dive: [
    /\b(?:case stud(?:y|ies)|postmortem|incident analysis|architecture analysis|lessons learned|deep dive|benchmark analysis|design rationale|why we (?:built|chose|migrated|adopted))\b/i,
    /(?:도입 사례|도입기|장애 분석|사고 분석|심층 분석|아키텍처 분석|설계 근거|벤치마크 분석|회고)/u,
  ],
};

function boundedText(value, max = MAX_TEXT_LENGTH) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isWordCharacter(value) {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

function containsTerm(haystack, term) {
  const text = haystack.toLocaleLowerCase('en-US');
  const needle = term.toLocaleLowerCase('en-US');
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) return false;
    const before = text[index - 1];
    const after = text[index + needle.length];
    const leftOk = !isWordCharacter(needle[0]) || !isWordCharacter(before);
    const rightOk = !isWordCharacter(needle.at(-1)) || !isWordCharacter(after);
    if (leftOk && rightOk) return true;
    from = index + Math.max(1, needle.length);
  }
  return false;
}

function matchesKnownTopic(value) {
  return TOPICS.some(([, aliases]) => aliases.some((alias) => containsTerm(value, alias)));
}

function promptUnits(prompt) {
  return boundedText(prompt, MAX_PROMPT_LENGTH)
    .split(/[,;|/\n]+|\s+(?:and|or|및|그리고)\s+/iu)
    .map((unit) => unit.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/gu, ''))
    .filter((unit) => unit.length >= 2 && unit.length <= MAX_TAG_LENGTH)
    .filter((unit) => !/\b(?:with|using|about|for)\b/i.test(unit))
    .filter((unit) => !matchesKnownTopic(unit));
}

export function feedTopicTags(title, excerpt, prompt = '') {
  const text = `${boundedText(title)}\n${boundedText(excerpt)}`;
  const tags = [];
  const seen = new Set();
  const add = (label) => {
    const key = label.toLocaleLowerCase('en-US');
    if (label.length > MAX_TAG_LENGTH || seen.has(key) || tags.length >= MAX_TAGS) return;
    seen.add(key);
    tags.push(label);
  };

  for (const [label, aliases] of TOPICS) {
    if (aliases.some((alias) => containsTerm(text, alias))) add(label);
  }
  for (const unit of promptUnits(prompt)) {
    if (containsTerm(text, unit)) add(unit);
  }
  return tags;
}

export function classifyFeedArticle(article, prompt = '') {
  const value = article && typeof article === 'object' ? article : {};
  const tags = feedTopicTags(value.title, value.excerpt, prompt);
  if (
    value.summary_status === 'ready'
    && VALID_CATEGORIES.has(value.category)
    && (value.category_method == null || value.category_method === 'ai')
  ) {
    return {
      category: value.category,
      method: 'ai',
      rules_version: FEED_CLASSIFICATION_RULES_VERSION,
      tags,
    };
  }

  // A directory of other people's blogs/newsletters is never news, practice or a
  // deep dive, no matter which signal word its own description happens to use
  // (observed in production: an excerpt mentioning "tutorials" while describing
  // GitHub Blog mislabeled the roundup itself as "practice").
  if (feedIsRoundupTitle(value.title)) {
    return { category: null, method: null, rules_version: FEED_CLASSIFICATION_RULES_VERSION, tags };
  }

  const text = `${boundedText(value.title)}\n${boundedText(value.excerpt)}`;
  const matches = Object.entries(CATEGORY_SIGNALS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([category]) => category);
  const category = matches.length === 1 ? matches[0] : null;
  return {
    category,
    method: category ? 'rules' : null,
    rules_version: FEED_CLASSIFICATION_RULES_VERSION,
    tags,
  };
}
