async (page) => {
 const check=(ok,label)=>{if(!ok)throw new Error(label)};
 await page.reload();
 await page.getByRole('heading',{name:'새로운 발견 1페이지'}).waitFor();
 const results=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  const metrics=await page.evaluate(async()=>{
   await document.fonts.ready;
   const card=document.querySelector('.feed-card');
   const intro=card.querySelector('.feed-excerpt');
   const source=card.querySelector('.feed-citation a');
   return {
    width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
    bodySize:parseFloat(getComputedStyle(intro).fontSize),bodyColor:getComputedStyle(intro).color,
    family:getComputedStyle(intro).fontFamily,fontLoaded:document.fonts.check('16px "Pretendard Variable"','기술 블로그'),
    sourceSize:parseFloat(getComputedStyle(source).fontSize),sourceHeight:source.getBoundingClientRect().height,
    headingUrl:card.querySelector('h3 a').href,sourceUrl:source.href,originalUrl:card.querySelector('.feed-original').href,
   };
  });
  check(!metrics.overflow,'horizontal overflow at '+width);
  check(metrics.bodySize>=(width===390?16:17),'readable body size at '+width);
  check(metrics.sourceSize>=13&&metrics.sourceHeight>=44,'source readable and touchable');
  check(metrics.family.includes('Pretendard Variable')&&metrics.fontLoaded,'Korean webfont loaded');
  check(metrics.headingUrl===metrics.originalUrl&&metrics.sourceUrl===metrics.originalUrl,'server original URL preserved');
  await page.screenshot({path:'output/playwright/feed-quality-'+width+'.png'});
  results.push(metrics);
 }
 return results;
}
