async (page) => {
 const check=(ok,label)=>{if(!ok)throw new Error(label)};
 const cards=()=>page.locator('.feed-card');
 await page.reload();
 await page.getByRole('heading',{name:'새로운 발견 1페이지'}).waitFor();
 await page.getByRole('button',{name:'다음 목록 실패',exact:true}).click();
 await page.getByRole('button',{name:'다음 페이지',exact:true}).click();
 await page.getByRole('alert').waitFor();
 check(await cards().count()===20,'failed next keeps current content');
 check((await cards().first().locator('h3').innerText()).endsWith('· 1'),'failed next keeps current page');
 await page.getByRole('button',{name:'다음 페이지',exact:true}).click();
 await page.getByRole('heading',{name:'새로운 발견 2페이지'}).waitFor();
 await page.getByRole('combobox',{name:'관심 분야',exact:true}).selectOption('backend');
 await page.getByRole('heading',{name:'새로운 발견 1페이지'}).waitFor();
 check(await cards().count()===14,'filter resets and shows only matching articles');
 await page.reload();
 await page.getByRole('heading',{name:'새로운 발견 1페이지'}).waitFor();
 await page.getByRole('button',{name:'저장',exact:true}).first().click();
 await page.getByRole('heading',{name:'저장한 발견 1페이지'}).waitFor();
 for(let remaining=20;remaining>0;remaining--){
  await cards().first().getByRole('button',{name:'저장됨',exact:true}).click();
  await page.waitForFunction(count=>document.querySelectorAll('.feed-card').length===count,remaining-1);
 }
 check(await page.getByRole('button',{name:'다음 페이지',exact:true}).isEnabled(),'empty cached saved page retains next');
 await page.getByRole('button',{name:'다음 페이지',exact:true}).click();
 await page.getByRole('heading',{name:'저장한 발견 2페이지'}).waitFor();
 check((await cards().first().locator('h3').innerText()).endsWith('· 21'),'remaining remote saved article reachable');
 await page.reload();
 await page.getByRole('heading',{name:'새로운 발견 1페이지'}).waitFor();
 await page.getByRole('button',{name:'다음 목록 지연',exact:true}).click();
 await page.getByRole('button',{name:'다음 페이지',exact:true}).click();
 await page.getByRole('button',{name:'계정 전환',exact:true}).click();
 await page.getByRole('heading',{name:'아직 도착한 소식이 없어요'}).waitFor();
 await page.waitForTimeout(1800);
 check(await cards().count()===0,'late prior account response is discarded');
 check((await page.locator('.feed-page-heading').innerText()).includes('1페이지'),'account page resets');
 return 'PASS: failed next preserves page, filter reset, empty saved page can advance, account switch discards delayed response';
}
