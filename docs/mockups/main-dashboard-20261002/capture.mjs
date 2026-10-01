import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.MOCKUP_PLAYWRIGHT_MODULE||'C:/Users/zxcc9/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs').href);

const root=dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:process.env.MOCKUP_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
let assertions=0;
try{
  for(const width of [1440,375]){
    const page=await browser.newPage({viewport:{width,height:width===1440?1000:812},deviceScaleFactor:1});
    const errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
    await page.goto(pathToFileURL(join(root,'index.html')).href);
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:join(root,width===1440?'desktop-1440.png':'mobile-375.png'),fullPage:true});
    if(width===375)await page.screenshot({path:join(root,'mobile-first-screen-375.png'),fullPage:false});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(overflow,false);assertions++;
    assert.equal(await page.locator('#main-action').innerText(),'잠시 쉬기');assertions++;
    await page.locator('#main-action').click();
    assert.equal(await page.locator('#state-select').inputValue(),'break');assertions++;
    assert.equal(await page.locator('#timer').innerText(),'00:32:18');assertions++;
    await page.screenshot({path:join(root,`break-${width}.png`),fullPage:true});
    await page.locator('#main-action').click();
    assert.equal(await page.locator('#state-select').inputValue(),'active');assertions++;
    await page.locator('#state-select').selectOption('idle');
    assert.equal(await page.locator('#end-action').isVisible(),false);assertions++;
    await page.screenshot({path:join(root,`idle-${width}.png`),fullPage:true});
    await page.locator('#main-action').click();
    assert.equal(await page.locator('#task-dialog').isVisible(),true);assertions++;
    await page.locator('input[value="AWS 아키텍처 사례 읽기"]').check();
    await page.locator('#choice-form .primary').click();
    assert.equal(await page.locator('#task-title').innerText(),'AWS 아키텍처 사례 읽기');assertions++;
    assert.equal(await page.locator('#state-select').inputValue(),'idle');assertions++;
    await page.locator('#state-select').selectOption('recovery');
    assert.equal(await page.locator('#recovery').isVisible(),true);assertions++;
    await page.screenshot({path:join(root,`recovery-${width}.png`),fullPage:true});
    await page.locator('#state-select').selectOption('error');
    assert.equal(await page.locator('#main-action').isDisabled(),true);assertions++;
    await page.locator('#retry').click();
    assert.equal(await page.locator('#state-select').inputValue(),'idle');assertions++;
    await page.locator('#tab-focus').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-plan').getAttribute('aria-selected'),'true');assertions++;
    assert.equal(await page.locator('#panel-plan').isVisible(),true);assertions++;
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#panel-record').isVisible(),true);assertions++;
    await page.locator('#tab-focus').click();
    await page.locator('#state-select').selectOption('active');
    await page.locator('#toast').evaluate(el=>el.hidden=true);
    await page.locator('#change-task').click();await page.keyboard.press('Escape');
    assert.equal(await page.locator('#task-dialog').isVisible(),false);assertions++;
    if(width===375){await page.locator('#more-menu').click();assert.equal(await page.locator('#more-dialog').isVisible(),true);assertions++;await page.keyboard.press('Escape')}
    assert.deepEqual(errors,[]);assertions++;
    assert.equal(requests.some(url=>/^https?:/.test(url)),false);assertions++;
    results.push({width,overflow,pageErrors:errors.length,externalRequests:0});
    await page.close();
  }
  const luminance=hex=>{let rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
  const contrast=(a,b)=>{const l=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (l[0]+.05)/(l[1]+.05)};
  const contrasts=[['text / surface','#28372e','#fffdf5'],['muted / surface','#4e5b50','#fffdf5'],['primary button','#ffffff','#2f6b52'],['status text','#4e5b50','#e9eee4']].map(([name,fg,bg])=>({name,ratio:Number(contrast(fg,bg).toFixed(2))}));
  for(const result of contrasts){assert.ok(result.ratio>=4.5);assertions++}
  console.log(JSON.stringify({assertions,results,contrasts},null,2));
}finally{await browser.close()}
