// Serve the actual feed UI with local fixture data only. Not included in the production build.
import {context} from 'esbuild';
import {mkdirSync,copyFileSync} from 'node:fs';
mkdirSync('output/playwright/feed-ui',{recursive:true});
copyFileSync('apps/web/test/fixtures/feed-ui.html','output/playwright/feed-ui/index.html');
const contextValue=await context({entryPoints:['apps/web/test/fixtures/feed-ui.tsx'],bundle:true,outfile:'output/playwright/feed-ui/bundle.js',jsx:'automatic',loader:{'.woff2':'file','.woff':'file'},define:{'process.env.NODE_ENV':'"development"'}});
await contextValue.watch();
const server=await contextValue.serve({host:'127.0.0.1',port:5184,servedir:'output/playwright/feed-ui'});
console.log(`Feed fixture: http://127.0.0.1:${server.port} (local example data only)`);
