import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const result=await build({entryPoints:[fileURLToPath(new URL('../apps/web/test/fixtures/tech-feed-browser.tsx',import.meta.url))],bundle:true,write:false,outdir:'fixture',entryNames:'feed',format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const assets=new Map(result.outputFiles.map(file=>[file.path.endsWith('.css')?'/feed.css':'/feed.js',file.contents]));
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Local tech feed fixture</title><link rel="stylesheet" href="/feed.css"><div id="root"></div><script src="/feed.js"></script></html>';
const server=createServer((request,response)=>{const asset=assets.get(request.url);response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type',request.url?.endsWith('.css')?'text/css':asset?'text/javascript':'text/html; charset=utf-8');response.end(asset??html);});
server.listen(4180,'127.0.0.1',()=>console.log('Synthetic tech feed: http://127.0.0.1:4180 (no remote data)'));
process.on('SIGINT',()=>server.close());
