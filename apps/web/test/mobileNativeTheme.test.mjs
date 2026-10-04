import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mobileSource = readFileSync("apps/mobile/App.tsx", "utf8");
const appConfig = JSON.parse(readFileSync("apps/mobile/app.json", "utf8"));

test("Expo mobile UI uses the same semantic palette and AA contrast as the web dashboard", () => {
  const declaration=mobileSource.match(/const mobilePalette = (\{[\s\S]*?\}) as const;/)[1];
  const palette=Function(`return (${declaration})`)();
  const webTheme=readFileSync("apps/web/src/dashboardRedesign.css", "utf8");
  const color=token=>webTheme.match(new RegExp(`--study-${token}:\\s*(#[\\da-f]+)`,'i'))[1];
  for(const [native,web] of [['canvas','bg'],['surface','surface'],['primarySoft','soft'],['border','border'],['text','ink'],['muted','muted'],['coral','danger']])assert.equal(palette[native],color(web),native);
  const lum=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  for(const [fg,bg] of [['text','surface'],['muted','surface'],['surface','primary'],['surface','coral']]){
    const a=lum(palette[fg]),b=lum(palette[bg]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg}/${bg}`);
  }
  assert.doesNotMatch(mobileSource, /#f8f4ea|#1d1a16/i);
  assert.match(mobileSource, /<StatusBar[^>]*barStyle="dark-content"/);
  assert.equal(appConfig.expo.userInterfaceStyle, "light");
  assert.equal(appConfig.expo.android.adaptiveIcon.backgroundColor, palette.primary);
  assert.equal(appConfig.expo.icon, "./assets/study-room-icon.png");
  assert.equal(appConfig.expo.android.adaptiveIcon.foregroundImage, "./assets/study-room-adaptive-icon.png");
});
