import test from 'node:test';
import assert from 'node:assert/strict';

const markdown = await import('../src/feedMarkdown.mjs').catch(() => ({}));

function requireFunction(name) {
  assert.equal(typeof markdown[name], 'function', `${name} must be exported`);
  return markdown[name];
}

test('preview removes structural markdown while preserving C# and #include', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  assert.equal(
    feedMarkdownPreview('### Title\n\nUse **C#** and `#include`.'),
    'Title Use C# and #include.',
  );
  assert.equal(
    feedMarkdownPreview('- [Guide](https://example.com)\n- ~~old~~ and *new*\n```c\n#include <stdio.h>\n```'),
    'Guide old and new #include <stdio.h>',
  );
  assert.equal(feedMarkdownPreview('**1234567890**', 6), '123456');
});

test('parser emits literal heading, paragraph, inline-code, and emphasis tokens', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  assert.deepEqual(parseFeedMarkdown('### 제목\n\n첫 **강조**와 *기울임*, `const x = 1`. C#.'), [
    {type: 'heading', level: 3, children: [{type: 'text', text: '제목'}]},
    {type: 'paragraph', children: [
      {type: 'text', text: '첫 '},
      {type: 'strong', children: [{type: 'text', text: '강조'}]},
      {type: 'text', text: '와 '},
      {type: 'emphasis', children: [{type: 'text', text: '기울임'}]},
      {type: 'text', text: ', '},
      {type: 'code', text: 'const x = 1'},
      {type: 'text', text: '. C#.'},
    ]},
  ]);
});

test('parser groups ordered and unordered lists without inventing missing structure', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  assert.deepEqual(parseFeedMarkdown('- Redis 설정\n- **안전한** 캐시\n\n1. Install\n2. Run'), [
    {type: 'list', ordered: false, start: null, items: [
      [{type: 'text', text: 'Redis 설정'}],
      [{type: 'strong', children: [{type: 'text', text: '안전한'}]}, {type: 'text', text: ' 캐시'}],
    ]},
    {type: 'list', ordered: true, start: 1, items: [
      [{type: 'text', text: 'Install'}],
      [{type: 'text', text: 'Run'}],
    ]},
  ]);
  assert.deepEqual(parseFeedMarkdown('one line\nstill the same paragraph'), [
    {type: 'paragraph', children: [{type: 'text', text: 'one line\nstill the same paragraph'}]},
  ]);
});

test('parser preserves fenced code and its short language label', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  assert.deepEqual(parseFeedMarkdown('```c\n#include <stdio.h>\nint main(void) {}\n```'), [
    {type: 'code_block', language: 'c', text: '#include <stdio.h>\nint main(void) {}'},
  ]);
  assert.deepEqual(parseFeedMarkdown('```language-name-that-is-far-too-long\nx\n```'), [
    {type: 'code_block', language: null, text: 'x'},
  ]);
});

test('parser exposes only HTTP links and keeps images, unsafe links, and raw HTML inert text', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  const blocks = parseFeedMarkdown(
    '[safe](https://example.com/docs?q=1) [http](http://example.com) '
      + '[bad](javascript:alert) ![remote](https://example.com/x.png) '
      + '<img src=x onerror=alert(1)> <script>alert(2)</script>',
  );
  assert.deepEqual(blocks, [{type: 'paragraph', children: [
    {type: 'link', href: 'https://example.com/docs?q=1', children: [{type: 'text', text: 'safe'}]},
    {type: 'text', text: ' '},
    {type: 'link', href: 'http://example.com/', children: [{type: 'text', text: 'http'}]},
    {type: 'text', text: ' bad remote <img src=x onerror=alert(1)> <script>alert(2)</script>'},
  ]}]);
  const tokenTypes = JSON.stringify(blocks);
  assert.doesNotMatch(tokenTypes, /javascript:|raw_?html|image/i);
});

test('parser bounds oversized and malformed input without recursive token growth', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  const blocks = parseFeedMarkdown(`${'*'.repeat(12000)}\n\n${'x'.repeat(12000)}\n\nignored tail`);
  assert.ok(blocks.length <= 200);
  assert.ok(JSON.stringify(blocks).length < 22000);
});

test('inline token cap keeps the remaining bounded source as inert text', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const source = `${'*a*'.repeat(300)}TAIL`;
  const blocks = parseFeedMarkdown(source);
  assert.ok(blocks[0].children.length <= 256);
  assert.match(JSON.stringify(blocks), /TAIL/u);
  assert.equal(feedMarkdownPreview(source, 2000), `${'a'.repeat(300)}TAIL`);
  assert.equal(feedMarkdownPreview(source), 'a'.repeat(260));
});

test('block cap keeps the remaining bounded source as one inert paragraph', () => {
  const parseFeedMarkdown = requireFunction('parseFeedMarkdown');
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const source = `${Array.from({length: 205}, (_, index) => `# H${index}`).join('\n\n')}\n\nBLOCK_TAIL`;
  const blocks = parseFeedMarkdown(source);
  assert.equal(blocks.length, 200);
  assert.equal(blocks.at(-1).type, 'paragraph');
  assert.equal(blocks.at(-1).children.length, 1);
  assert.equal(blocks.at(-1).children[0].type, 'text');
  assert.match(blocks.at(-1).children[0].text, /BLOCK_TAIL$/u);
  const preview = feedMarkdownPreview(source, 2000);
  assert.match(preview, /BLOCK_TAIL$/u);
  assert.doesNotMatch(preview, /(?:^|\s)#\s/u);
});

test('preview defaults to the literal 260 character boundary', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const boundary = '1234567890'.repeat(26);
  assert.equal(feedMarkdownPreview(`${boundary}Z`), boundary);
});

test('preview preserves Markdown-like punctuation inside inline code only', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  assert.equal(
    feedMarkdownPreview('Use **normal** and `**literal** __value__ #include [label](javascript:bad)` now.'),
    'Use normal and **literal** __value__ #include [label](javascript:bad) now.',
  );
});

test('preview preserves fenced code punctuation while cleaning surrounding Markdown', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const source = [
    '### Example',
    '**outside**',
    '```js',
    "const pattern = '**literal**';",
    "const key = '__value__';",
    "const link = '[label](javascript:bad)';",
    '#include <stdio.h>',
    '```',
  ].join('\n');
  assert.equal(
    feedMarkdownPreview(source, 2000),
    "Example outside const pattern = '**literal**'; const key = '__value__'; const link = '[label](javascript:bad)'; #include <stdio.h>",
  );
});

test('preview removes outer Markdown spanning inline code without changing code literals', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const cases = [
    ['[use `x`](https://example.com)', 'use x'],
    ['**use `x` now**', 'use x now'],
    ['*use `**literal**` now*', 'use **literal** now'],
    ['__use `__value__` now__', 'use __value__ now'],
    ['~~use `#include` now~~', 'use #include now'],
    ['![use `[label](javascript:bad)`](https://example.com)', 'use [label](javascript:bad)'],
    ['### [**Use `**literal**` and `__value__`**](https://example.com)', 'Use **literal** and __value__'],
  ];
  for (const [source, expected] of cases) {
    assert.equal(feedMarkdownPreview(source), expected, source);
  }
});

test('preview protection never replaces user text resembling internal code tokens', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const source = '\u{F0000}0\u{F0000} \u{F0001}1\u{F0001} **use `**literal**`**';
  assert.equal(feedMarkdownPreview(source), '\u{F0000}0\u{F0000} \u{F0001}1\u{F0001} use **literal**');
});

test('preview cleans code wrappers beyond the AST token cap before truncation', () => {
  const feedMarkdownPreview = requireFunction('feedMarkdownPreview');
  const source = `${'**`*`** '.repeat(300)}TAIL`;
  assert.equal(feedMarkdownPreview(source, 2000), `${'* '.repeat(300)}TAIL`);
  assert.equal(feedMarkdownPreview(source, 7), '* * * *');
});
