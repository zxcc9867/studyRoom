import test from 'node:test';
import assert from 'node:assert/strict';

const classification = await import('../src/feedClassification.mjs').catch(() => ({}));

function requireFunction(name) {
  assert.equal(typeof classification[name], 'function', `${name} must be exported`);
  return classification[name];
}

test('classifies only articles with a single strong content-type signal', () => {
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  const fixtures = [
    [{title: 'Introducing PostgreSQL 18', excerpt: 'New release available'}, 'news'],
    [{title: '새로운 React 기능 출시', excerpt: '정식 버전을 공개합니다.'}, 'news'],
    [{title: 'Redis cache tutorial', excerpt: 'A step-by-step implementation guide.'}, 'practice'],
    [{title: '쿠버네티스 설정 가이드', excerpt: '실습으로 배포하는 방법을 설명합니다.'}, 'practice'],
    [{title: 'Database incident postmortem', excerpt: 'Architecture analysis and lessons learned.'}, 'deep_dive'],
    [{title: '결제 장애 분석과 회고', excerpt: '아키텍처 선택의 근거와 도입 사례입니다.'}, 'deep_dive'],
  ];
  for (const [article, expected] of fixtures) {
    const result = classifyFeedArticle(article);
    assert.equal(result.category, expected, article.title);
    assert.equal(result.method, 'rules', article.title);
    assert.equal(result.rules_version, 2, article.title);
  }
});

test('leaves unrelated, weak, and conflicting text unclassified', () => {
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  for (const [article, tags] of [
    [{title: 'A walk in the park', excerpt: 'Notes from a calm weekend.'}, []],
    [{title: 'Thoughts about software', excerpt: 'A short personal note.'}, []],
    [{title: 'Kubernetes 1.30 release and migration tutorial', excerpt: 'What changed and how to upgrade.'}, ['Kubernetes']],
    [{title: '새 버전 출시와 실습 가이드', excerpt: '변경 사항을 따라 하는 방법'}, []],
  ]) {
    assert.deepEqual(classifyFeedArticle(article), {
      category: null,
      method: null,
      rules_version: 2,
      tags,
    }, article.title);
  }
});

test('preserves a valid ready AI category but never labels a prior rules result as AI', () => {
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  assert.deepEqual(
    classifyFeedArticle({
      title: 'How to configure Redis',
      excerpt: 'Tutorial and guide',
      category: 'deep_dive',
      summary_status: 'ready',
    }),
    {category: 'deep_dive', method: 'ai', rules_version: 2, tags: ['Redis']},
  );
  assert.equal(classifyFeedArticle({
    title: 'How to configure Redis',
    excerpt: 'Tutorial and guide',
    category: 'news',
    summary_status: 'ready',
    category_method: 'rules',
  }).method, 'rules');
  assert.equal(classifyFeedArticle({
    title: 'How to configure Redis',
    excerpt: 'Tutorial and guide',
    category: 'news',
    summary_status: 'pending',
  }).category, 'practice');
});

test('derives alias-aware concise tags and adds prompt units only on article-text match', () => {
  const feedTopicTags = requireFunction('feedTopicTags');
  assert.deepEqual(
    feedTopicTags(
      'Backend with Postgres, k8s, and Node.js',
      'An event sourcing guide for TypeScript services',
      'event sourcing; private unrelated prompt; Backend with Postgres',
    ),
    ['Backend', 'PostgreSQL', 'Kubernetes', 'Node.js', 'TypeScript', 'event sourcing'],
  );
  const tags = feedTopicTags('C# on .NET', 'Use Redis without losing C# names', 'private unrelated prompt');
  assert.deepEqual(tags, ['Redis', 'C#', '.NET']);
  assert.deepEqual(feedTopicTags('AI safety patterns', 'Production service notes', ''), ['AI']);
  assert.ok(!tags.includes('private unrelated prompt'));
  assert.ok(tags.every((tag) => tag.length <= 32));
});

test('classification returns the same bounded unique tags as the tag helper', () => {
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  const feedTopicTags = requireFunction('feedTopicTags');
  const article = {title: 'Postgres / PostgreSQL tutorial', excerpt: 'A Redis guide'};
  const prompt = 'Redis; a deliberately overlong private topic phrase that must never become a label';
  assert.deepEqual(classifyFeedArticle(article, prompt).tags, feedTopicTags(article.title, article.excerpt, prompt));
  assert.deepEqual(classifyFeedArticle(article, prompt).tags, ['PostgreSQL', 'Redis']);
});

test('never classifies list-of-sources roundups, even when a content-type word appears elsewhere', () => {
  // Observed in production: 'Top AI Blogs Every Software Developer Must Follow in
  // 2026' was labeled 'practice' only because its excerpt happened to mention
  // 'tutorials' while describing GitHub Blog, not because the article teaches one.
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  for (const article of [
    {title: 'Top AI Blogs Every Software Developer Must Follow in 2026', excerpt: 'This blog offers a wealth of tutorials and community highlights.'},
    {title: 'Best Engineering Newsletters You Should Follow', excerpt: 'A step-by-step implementation guide is featured weekly.'},
    {title: '개발자라면 꼭 구독해야 할 블로그 모음', excerpt: '실습 가이드도 함께 소개합니다.'},
    {title: '2026 추천 기술 블로그 리스트', excerpt: '아키텍처 분석 글도 포함되어 있습니다.'},
  ]) {
    const result = classifyFeedArticle(article);
    assert.equal(result.category, null, article.title);
    assert.equal(result.method, null, article.title);
    assert.equal(result.rules_version, 2, article.title);
  }
});

test('a roundup title never suppresses an already-verified AI category', () => {
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  const result = classifyFeedArticle({
    title: 'Top AI Blogs Every Software Developer Must Follow in 2026',
    excerpt: 'context',
    category: 'deep_dive',
    summary_status: 'ready',
  });
  assert.equal(result.category, 'deep_dive');
  assert.equal(result.method, 'ai');
});

test('a listicle about a technology itself, not about other sources, keeps its real category', () => {
  const classifyFeedArticle = requireFunction('classifyFeedArticle');
  const result = classifyFeedArticle({title: 'Top 10 PostgreSQL Features You Should Know', excerpt: 'A step-by-step implementation guide.'});
  assert.equal(result.category, 'practice');
  assert.equal(result.method, 'rules');
});