import {cleanFeedIntroduction} from '../../../packages/core/src/feedContent.mjs';
import {feedMarkdownPreview} from '../../../packages/core/src/feedMarkdown.mjs';
export function feedPageView(articles,requestedPage,cursor,savedOnly=false) {
  const size=20;
  // Retain unsaved entries as page slots; removing them would skip unseen cursor results.
  let loadedPages=Math.max(1,Math.ceil(articles.length/size));
  const visible=items=>savedOnly?items.filter(item=>item.saved):items;
  while(savedOnly && !cursor && loadedPages>1 && visible(articles.slice((loadedPages-1)*size,loadedPages*size)).length===0)loadedPages--;
  const page=Math.min(loadedPages,Math.max(1,Number.isInteger(requestedPage)?requestedPage:1));
  const start=Math.max(1,Math.min(page-2,loadedPages-4));
  return {
    page,loadedPages,
    items:visible(articles.slice((page-1)*size,page*size)),
    numbers:Array.from({length:Math.min(5,loadedPages)},(_,index)=>start+index),
    hasNext:page<loadedPages || Boolean(cursor),
  };
}

// Reuse the content policy's exact retained words, restoring only whitespace
// between adjacent original words. Removed chapters/promotions cannot return.
export function feedStructuredIntroduction(value) {
  if(typeof value!=='string')return '';
  const source=value.replace(/\[(?:\.{3}|…)\]/g,' ').trim();
  const cleaned=cleanFeedIntroduction(source);
  if(!cleaned)return '';
  const words=[...source.matchAll(/\S+/g)];
  let cursor=0,previous=-1,result='';
  for(const word of cleaned.split(/\s+/)){
    while(cursor<words.length&&words[cursor][0]!==word)cursor++;
    if(cursor===words.length)return cleaned;
    if(previous>=0)result+=cursor===previous+1?source.slice(words[previous].index+words[previous][0].length,words[cursor].index):'\n\n';
    result+=word;previous=cursor++;
  }
  return result;
}

export function feedExcerptView(value) {
  const full=typeof value==='string'?value.trim():'';
  const plain=feedMarkdownPreview(full,2000);
  const preview=feedMarkdownPreview(full,260)+(Array.from(plain).length>260?'…':'');
  const expandable=Array.from(plain).length>260 || /\n|\*\*|\x60|^#{1,6} |\[[^\]]+\]\(/m.test(full);
  return {full,preview,expandable};
}
