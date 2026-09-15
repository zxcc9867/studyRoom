import test from 'node:test';
import assert from 'node:assert/strict';
import { feedContentKind, feedIsRoundupTitle } from '../src/feedContent.mjs';

test('a roundup title makes an ordinary article URL a listing, matching the real case that slipped through', () => {
  // Observed in production: URL shape alone (a normal /blog/<slug> article
  // permalink) never triggers 'listing'; only the title gives it away.
  assert.equal(
    feedContentKind('https://zencoder.ai/blog/ai-blogs-for-developers-engineers', 'Top AI Blogs Every Software Developer Must Follow in 2026'),
    'listing',
  );
  assert.equal(feedContentKind('https://zencoder.ai/blog/ai-blogs-for-developers-engineers'), 'article', 'without a title, URL shape still governs');
});

test('feedIsRoundupTitle recognizes a directory of other sources, in English and Korean', () => {
  for (const title of [
    'Top AI Blogs Every Software Developer Must Follow in 2026',
    '10 Best Tech Blogs You Should Follow',
    'Must-Read Newsletters for Backend Engineers',
    'Best Engineering Podcasts to Follow in 2026',
    '개발자라면 꼭 구독해야 할 블로그 모음',
    '2026 추천 기술 블로그 리스트',
    '지금 팔로우해야 할 AI 뉴스레터 추천',
  ]) {
    assert.equal(feedIsRoundupTitle(title), true, title);
  }
});

test('feedIsRoundupTitle leaves genuine technical titles alone, including ones that name a technology in list form', () => {
  for (const title of [
    'Top 10 PostgreSQL Features You Should Know',
    'Best Practices for Kubernetes Deployment',
    'AWS Blog: Announcing New S3 Feature',
    'How to configure Redis',
    'Kubernetes 1.30 release and migration tutorial',
    '',
  ]) {
    assert.equal(feedIsRoundupTitle(title), false, title);
  }
  assert.equal(feedIsRoundupTitle(null), false);
  assert.equal(feedIsRoundupTitle(undefined), false);
});
