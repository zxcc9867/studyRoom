import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("web app opts out of mobile browser automatic dark theming", () => {
  const html = readFileSync("apps/web/index.html", "utf8");
  const css = readFileSync("apps/web/src/styles.css", "utf8");

  assert.match(html, /<meta\s+name="color-scheme"\s+content="only light"\s*\/?>/i);
  assert.match(html, /<meta\s+name="supported-color-schemes"\s+content="light"\s*\/?>/i);
  assert.match(html, /<meta\s+name="theme-color"\s+content="#d9f0e3"\s*\/?>/i);
  assert.match(html, /<style>[\s\S]*color-scheme:\s*only light;[\s\S]*background:\s*#d9f0e3;[\s\S]*<\/style>/i);
  assert.match(css, /:root\s*{[^}]*color-scheme:\s*(?:only\s+)?light;/is);
  assert.match(css, /html\s*{[^}]*color-scheme:\s*only light;/is);
  assert.match(css, /html,\s*body,\s*#root\s*{[^}]*background-color:\s*#d9f0e3;/is);
  assert.match(css, /button,\s*input,\s*select,\s*textarea\s*{[^}]*color-scheme:\s*light;/is);
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*{[\s\S]*background-color:\s*#d9f0e3\s*!important;/i);
});
