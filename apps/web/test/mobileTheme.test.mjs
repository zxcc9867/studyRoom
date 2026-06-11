import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("web app opts out of mobile browser automatic dark theming", () => {
  const html = readFileSync("apps/web/index.html", "utf8");
  const css = readFileSync("apps/web/src/styles.css", "utf8");

  assert.match(html, /<meta\s+name="color-scheme"\s+content="light"\s*\/?>/i);
  assert.match(html, /<meta\s+name="theme-color"\s+content="#d9f0e3"\s*\/?>/i);
  assert.match(css, /:root\s*{[^}]*color-scheme:\s*(?:only\s+)?light;/is);
  assert.match(css, /html,\s*body,\s*#root\s*{[^}]*background-color:\s*#d9f0e3;/is);
  assert.match(css, /button,\s*input,\s*select,\s*textarea\s*{[^}]*color-scheme:\s*light;/is);
});
