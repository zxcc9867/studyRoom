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

test('blog meta pages are recognized too: a launch post, a blog homepage and a numbered list',()=>{
  // All observed in the live feed. None is a roundup of other blogs, so the
  // earlier title patterns missed them, yet none teaches any technology either.
  for (const title of [
    'AWS 기술 블로그를 시작합니다! | AWS 기술 블로그',
    'Engineering blog – Insights for developers & builders | Eightfold AI',
    'A List of Software Engineering Blogs: Tech Company Engineering Blogs',
    '국내 유명 기업 기술 블로그 30선 (Tech Blog)',
    '인프라·DevOps 기술 블로그 모음 - 클라우드·Kubernetes | Tech Blog Together',
    'Welcome to our engineering blog',
    '개발 블로그를 오픈했습니다',
  ]) {
    assert.equal(feedIsRoundupTitle(title), true, title);
  }
});

test('a real article from the same blog keeps its site-name suffix and is still collected',()=>{
  // The site name trails every post on that blog, good and bad alike, so it can
  // never be the signal on its own.
  for (const title of [
    'AWS Glue로 SAP OData 데이터를 수집하는 방법 | AWS 기술 블로그',
    'S3 성능 최적화 사례 | AWS 기술 블로그',
    'Amazon Bedrock 기반 RAG 아키텍처 구성 | AWS 기술 블로그',
  ]) {
    assert.equal(feedIsRoundupTitle(title), false, title);
  }
});

test('an English trailing site name never turns a real article into a roundup',()=>{
  // Observed false positive: 'Best Practices ... | CloudQuery Blog' matched only
  // because the site name that trails every post on that site ends in 'Blog'.
  for (const title of [
    'Cloud Governance: Best Practices 2026 | CloudQuery Blog',
    'Top 5 Postgres Index Mistakes | Percona Blog',
    '10 Kubernetes Anti-Patterns We Fixed | Datadog Blog',
  ]) {
    assert.equal(feedIsRoundupTitle(title), false, title);
  }
});

test('a title that is only the blog name is still a homepage, in either language',()=>{
  for (const title of [
    '트웰브랩스 기술 블로그 | 영상 AI를 만드는 사람들의 이야기',
    '카카오 기술 블로그',
    'Engineering Blog',
  ]) {
    assert.equal(feedIsRoundupTitle(title), true, title);
  }
});