import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const result = await build({ entryPoints: [fileURLToPath(new URL("apps/web/test/fixtures/study-report-browser.tsx", root))], bundle: true, write: false, outdir: "fixture", entryNames: "report", format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' } });
const assets = new Map(result.outputFiles.map(file => [file.path.endsWith(".css") ? "/report.css" : "/report.js", file.contents]));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Study report local fixture</title><link rel="stylesheet" href="/report.css"></head><body><div id="root"></div><script>window.__consoleErrors=[];addEventListener("error",e=>window.__consoleErrors.push(e.message));addEventListener("unhandledrejection",e=>window.__consoleErrors.push(String(e.reason)));</script><script src="/report.js"></script></body></html>';
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  const asset = assets.get(request.url);
  response.setHeader("Content-Type", request.url?.endsWith(".css") ? "text/css" : asset ? "text/javascript" : "text/html; charset=utf-8");
  response.end(asset ?? html);
});
server.listen(4179, "127.0.0.1", () => console.log("Synthetic study report fixture: http://127.0.0.1:4179 (no remote data)"));
process.on("SIGINT", () => server.close());
