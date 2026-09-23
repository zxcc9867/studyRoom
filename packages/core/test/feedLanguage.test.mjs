import test from 'node:test';
import assert from 'node:assert/strict';
import {feedOriginalLanguage} from '../src/feedLanguage.mjs';

test('language follows original text even with English technology names', () => {
  assert.equal(feedOriginalLanguage('Claude Code로 서비스 개발하기', '팀에서 사용한 구현 과정을 정리합니다.'), 'ko');
  assert.equal(feedOriginalLanguage('AWS architecture guide', 'This tutorial explains the implementation in detail.'), 'en');
  assert.equal(feedOriginalLanguage('Claude Code release', '새 버전의 변경 사항과 적용 방법을 설명합니다.'), 'ko');
});

test('uncertain or other-script snippets are not labelled English or Korean', () => {
  assert.equal(feedOriginalLanguage('AI', ''), 'unknown');
  assert.equal(feedOriginalLanguage('新しい技術', '日本語の記事を紹介します。'), 'unknown');
  assert.equal(feedOriginalLanguage('AWS', '클라우드'), 'unknown');
});
