// Pure content policy shared by collection and rendering. No provider calls or
// generated facts: questionable text falls back to the original article link.
export const FEED_VIDEO_DOMAINS = ['youtube.com','youtu.be','vimeo.com','tiktok.com','dailymotion.com'];

// Roundups point at other people's blogs/newsletters/podcasts instead of explaining
// a technology themselves. URL shape alone never reveals this — the observed case
// (zencoder.ai/blog/ai-blogs-for-developers-engineers) is a perfectly normal article
// permalink; only the title says it is a directory. Checked on the title only,
// never the excerpt, so a real explainer that merely mentions 'follow our blog' in
// passing is not caught by its own body text.
const ROUNDUP_TARGETS='blogs?|newsletters?|podcasts?|websites?|influencers?|creators?|accounts?|channels?';
const ROUNDUP_PATTERNS=[
  new RegExp('\\b(?:top\\s*\\d+|best|\\d+)\\b[^.!?]{0,40}\\b(?:'+ROUNDUP_TARGETS+')\\b','i'),
  new RegExp('\\b(?:'+ROUNDUP_TARGETS+')\\b[^.!?]{0,30}\\bmust[- ]?(?:follow|read|know)\\b','i'),
  new RegExp('\\bmust[- ]?(?:follow|read|know)\\b[^.!?]{0,30}\\b(?:'+ROUNDUP_TARGETS+')\\b','i'),
  new RegExp('\\blists? of\\b[^.!?]{0,30}\\b(?:'+ROUNDUP_TARGETS+')\\b','i'),
  /(?:블로그|뉴스레터|팟캐스트)\s*(?:모음|추천|리스트|목록)/u,
  /추천\s*(?:블로그|뉴스레터|팟캐스트)/u,
  /팔로우해야\s*할\s*(?:블로그|뉴스레터|팟캐스트|채널)/u,
  /구독해야\s*할\s*(?:블로그|뉴스레터|팟캐스트|채널)/u,
  /블로그\s*\d+\s*선/u,
];

// A blog announcing or describing itself is not a technology either: its launch
// post, its homepage tagline. The trailing site name ("… | AWS 기술 블로그") is on
// every post from that blog, good and bad alike, so it is never the signal —
// these look at how the title opens or what it claims to be.
const BLOG_META_PATTERNS=[
  /블로그를?\s*(?:새로\s*)?(?:시작|오픈|개설|런칭|열며|열었|오픈했)/u,
  /블로그\s*(?:소개|안내|개편|리뉴얼)/u,
  /^(?:engineering|tech(?:nical)?|developer|dev)\s+blog\b/i,
  /\bwelcome to\b[^.!?]{0,30}\bblog\b/i,
  /\bintroducing\b[^.!?]{0,20}\b(?:our|the)\b[^.!?]{0,20}\bblog\b/i,
];

// "… | CloudQuery Blog" trails every post on that site. Judging the headline
// without it keeps a real article ("Best Practices 2026") from being read as a
// list of blogs, while a launch post or homepage still gives itself away in the
// part that remains.
const SITE_SUFFIX=/\s*[|｜]\s*[^|｜]{1,60}$/u;
const BLOG_NAME_ONLY=/^.{0,25}(?:기술|개발|엔지니어링)?\s*블로그$/u;

export function feedIsRoundupTitle(value) {
  const text=typeof value==='string'?value.trim():'';
  if(!text.length)return false;
  const headline=text.replace(SITE_SUFFIX,'').trim()||text;
  return ROUNDUP_PATTERNS.some(pattern=>pattern.test(headline))
    ||BLOG_META_PATTERNS.some(pattern=>pattern.test(headline))
    ||BLOG_NAME_ONLY.test(headline);
}
export function feedContentKind(value,title) {
  try {
    const url=new URL(value),host=url.hostname.toLowerCase();
    if(FEED_VIDEO_DOMAINS.some(domain=>host===domain||host.endsWith('.'+domain)))return 'video';
    if(feedIsRoundupTitle(title))return 'listing';
    // Query-based permalinks are common. Unknown document parameters are not
    // evidence of an index; preserve them rather than dropping a real article.
    if([...url.searchParams].some(([key,value])=>value&&!/^(?:utm_.+|fbclid|gclid|s|q|search|page|paged|lang)$/i.test(key)))return 'article';
    const path=url.pathname.replace(/\/+$/,'');
    if(!path||/^\/(?:[a-z]{2}\/)?(?:blogs?|tags?|categories|search|posts|articles)(?:\/(?:tags?|categories)\/[^/]+)?$/i.test(path))return 'listing';
    return 'article';
  } catch { return 'unknown'; }
}

export function cleanFeedIntroduction(value) {
  if(typeof value!=='string')return '';
  let text=value.trim();
  // Only an explicit chapter-list pattern (multiple timestamp + dash labels).
  // A single deadline or a time in a technical explanation is not a chapter.
  const chapters=[...text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*/g)];
  const first=chapters[0],last=chapters.at(-1);
  const labels=chapters.slice(0,-1).map((chapter,index)=>text.slice(chapter.index+chapter[0].length,chapters[index+1].index).trim());
  // Zero-start short labels, not sentence-based incident/experiment timelines.
  if(chapters.length>=2 && /^0{1,2}:00(?::00)?\s*[-–—]/.test(first[0]) &&
    labels.every(label=>label.length<=100&&!/[.!?。]/.test(label))) {
    const tail=text.slice(last.index+last[0].length);
    const marker=/\[(?:\.{3}|…)\]|\n\s*\n/.exec(tail);
    // An explicit boundary is safe. Without one, retain any sentence-bearing
    // tail: it may be the actual technical paragraph after the final label.
    const remainder=marker?tail.slice(marker.index+marker[0].length):(/[.!?。]/.test(tail)?tail:'');
    text=text.slice(0,first.index)+' '+remainder;
  }
  const promotion=/^(?:subscribe to (?:our|the|this) (?:newsletter|channel)|follow us (?:on|for)|sign up for (?:our|the) newsletter|(?:저희|우리) (?:채널|뉴스레터)를? 구독|뉴스레터를 구독|구독과 좋아요|좋아요와 구독)/i;
  return text.split(/(?<=[.!?。])\s+|\n+/u)
    .filter(sentence=>!promotion.test(sentence.trim()))
    .join(' ').replace(/\[(?:\.{3}|…)\]/g,' ').replace(/\s+/g,' ').trim();
}
