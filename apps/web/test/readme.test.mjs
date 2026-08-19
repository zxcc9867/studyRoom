import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const englishReadme = readFileSync("README.md", "utf8");
const koreanReadme = readFileSync("README.ko.md", "utf8");
const japaneseReadme = readFileSync("README.ja.md", "utf8");
const languageNav =
  "[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)";

test("multilingual READMEs are connected and the English default covers the current product", () => {
  for (const readme of [englishReadme, koreanReadme, japaneseReadme]) {
    assert.ok(readme.includes(languageNav));
  }

  assert.match(englishReadme, /End-of-session reflections/);
  assert.match(englishReadme, /Weekly comparison/);
  assert.match(englishReadme, /adaptive reminder/i);
  assert.match(englishReadme, /Three\.js/);
  assert.match(englishReadme, /Study Forest/);
  assert.match(englishReadme, /no more than two hours/);
  assert.match(englishReadme, /Expo/);
  assert.match(englishReadme, /memory-bank\//);
});

test("the preserved Korean README keeps detailed operating and interaction policies", () => {
  assert.match(koreanReadme, /세션 회고/);
  assert.match(koreanReadme, /주간 리뷰/);
  assert.match(koreanReadme, /숫자 표시 영역 어디를 클릭·더블클릭/);
  assert.match(koreanReadme, /지난주 시간·분 비교 및 오늘 기준 표시/);
  assert.match(koreanReadme, /적응형 알림/);
  assert.match(koreanReadme, /Three\.js/);
  assert.match(koreanReadme, /공부의 숲/);
  assert.match(koreanReadme, /최대 2시간/);
  assert.match(koreanReadme, /강을 직교해 건너는 다리/);
  assert.match(koreanReadme, /진행 방향 양옆 난간과 캐릭터 반경 기반 중앙 통로/);
  assert.match(koreanReadme, /잠금 항목은 이름 대신 `\?`/);
  assert.match(koreanReadme, /카메라 시작 응답을 15초/);
  assert.match(koreanReadme, /Expo 모바일/);
  assert.match(koreanReadme, /memory-bank\/prd-/);
});
