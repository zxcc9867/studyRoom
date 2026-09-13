// Pure content policy shared by collection and rendering. No provider calls or
// generated facts: questionable text falls back to the original article link.
export const FEED_VIDEO_DOMAINS = ['youtube.com','youtu.be','vimeo.com','tiktok.com','dailymotion.com'];

export function feedContentKind(value) {
  try {
    const url=new URL(value),host=url.hostname.toLowerCase();
    if(FEED_VIDEO_DOMAINS.some(domain=>host===domain||host.endsWith('.'+domain)))return 'video';
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
