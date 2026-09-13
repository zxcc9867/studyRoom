async (page) => {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));let videoRequests=0;
 await page.route('https://images.example.com/**',route=>route.request().url().includes('broken')?route.abort():route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#e4eddb"/><rect x="70" y="170" width="220" height="180" rx="24" fill="#376653"/><rect x="670" y="170" width="220" height="180" rx="24" fill="#376653"/><path d="M310 260H650" stroke="#c9a24c" stroke-width="12"/><text x="480" y="95" text-anchor="middle" font-size="34" fill="#294d3e">LOCAL MEDIA TEST</text><text x="180" y="275" text-anchor="middle" font-size="30" fill="white">CLIENT</text><text x="780" y="275" text-anchor="middle" font-size="30" fill="white">API</text></svg>'}));
 await page.route('https://www.youtube-nocookie.com/**',route=>{videoRequests++;return route.fulfill({status:200,contentType:'text/html',body:'<html><body style="background:#173c30;color:white">Controlled video fixture · no real playback</body></html>'});});
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await page.reload();await page.getByRole('button',{name:'영상 불러오기'}).waitFor();
  const first=page.locator('.feed-card').first();await first.scrollIntoViewIfNeeded();
  await first.locator('img').waitFor();await page.waitForFunction(()=>document.querySelector('.feed-card img')?.naturalWidth>0);
  check(await page.locator('iframe').count()===0,'player loaded before click');
  const before=videoRequests;await first.screenshot({path:'output/playwright/feed-media-'+width+'.png'});
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,fit:getComputedStyle(document.querySelector('.feed-card img')).objectFit,overlay:!!document.querySelector('vite-error-overlay')}));
  check(!layout.overflow&&!layout.overlay&&layout.fit==='contain','layout failed '+JSON.stringify(layout));
  await first.getByRole('button',{name:'영상 불러오기'}).click();await first.locator('iframe').waitFor();
  check((await first.locator('iframe').getAttribute('src')).includes('autoplay=0'),'autoplay enabled');
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow!=null);
  check(videoRequests===before+1,'click must load exactly one video');
  await first.getByRole('button',{name:'영상 닫기'}).click();check(await page.locator('iframe').count()===0,'close did not remove player');
  const second=page.locator('.feed-card').nth(1);await second.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelectorAll('.feed-card')[1].querySelector('.feed-media')===null);
  check(await second.getByRole('link',{name:'원문 읽기',exact:true}).count()===1,'broken media lost original link');
 }
 check(errors.length===0,'runtime errors '+JSON.stringify(errors));
 return {viewports:[390,1440],videoRequests,runtimeErrors:errors.length,brokenImageFallback:true,noAutoplay:true,overflow:false};
}
