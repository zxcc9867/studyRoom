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

export function feedExcerptView(value) {
  const full=typeof value==='string'?value.trim():'';
  const characters=Array.from(full);
  const expandable=characters.length>260;
  return {full,preview:expandable?characters.slice(0,260).join('').trimEnd()+'…':full,expandable};
}
