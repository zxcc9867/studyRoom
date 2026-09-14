const MAX_INPUT_LENGTH = 20_000;
const MAX_BLOCKS = 200;
const MAX_INLINE_TOKENS = 256;
const MAX_PREVIEW_LENGTH = 2_000;

function boundedText(value) {
  return typeof value === 'string' ? value.slice(0, MAX_INPUT_LENGTH).replace(/\r\n?/g, '\n') : '';
}

function safeMarkdownHref(value) {
  if (!value || value.length > 2_048 || /[\u0000-\u0020\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function appendText(tokens, text) {
  if (!text) return;
  const last = tokens.at(-1);
  if (last?.type === 'text') {
    last.text += text;
    return;
  }
  if (tokens.length < MAX_INLINE_TOKENS) tokens.push({type: 'text', text});
}

function canAppendStructured(tokens, pendingText) {
  const pendingSlot = pendingText && tokens.at(-1)?.type !== 'text' ? 1 : 0;
  return tokens.length + pendingSlot + 1 < MAX_INLINE_TOKENS;
}

function parseInline(value, formatting = true) {
  const source = value.slice(0, MAX_INPUT_LENGTH);
  const tokens = [];
  let cursor = 0;
  let plainStart = 0;
  const flush = (end) => {
    appendText(tokens, source.slice(plainStart, end));
  };

  while (cursor < source.length) {
    if (source.startsWith('![', cursor)) {
      const labelEnd = source.indexOf('](', cursor + 2);
      const targetEnd = labelEnd >= 0 ? source.indexOf(')', labelEnd + 2) : -1;
      if (labelEnd >= 0 && targetEnd >= 0) {
        flush(cursor);
        appendText(tokens, source.slice(cursor + 2, labelEnd));
        cursor = targetEnd + 1;
        plainStart = cursor;
        continue;
      }
    }

    if (source[cursor] === '[') {
      const labelEnd = source.indexOf('](', cursor + 1);
      const targetEnd = labelEnd >= 0 ? source.indexOf(')', labelEnd + 2) : -1;
      if (labelEnd >= 0 && targetEnd >= 0) {
        const label = source.slice(cursor + 1, labelEnd);
        const href = safeMarkdownHref(source.slice(labelEnd + 2, targetEnd));
        if (href && !canAppendStructured(tokens, source.slice(plainStart, cursor))) break;
        flush(cursor);
        if (href) {
          const children = parseInline(label, false);
          tokens.push({type: 'link', href, children});
        } else {
          appendText(tokens, label);
        }
        cursor = targetEnd + 1;
        plainStart = cursor;
        continue;
      }
    }

    if (source[cursor] === '`') {
      const end = source.indexOf('`', cursor + 1);
      if (end > cursor + 1) {
        if (!canAppendStructured(tokens, source.slice(plainStart, cursor))) break;
        flush(cursor);
        tokens.push({type: 'code', text: source.slice(cursor + 1, end)});
        cursor = end + 1;
        plainStart = cursor;
        continue;
      }
    }

    const pair = source.slice(cursor, cursor + 2);
    if (formatting && (pair === '**' || pair === '__' || pair === '~~')) {
      const end = source.indexOf(pair, cursor + 2);
      if (end > cursor + 2) {
        if (pair !== '~~' && !canAppendStructured(tokens, source.slice(plainStart, cursor))) break;
        flush(cursor);
        const children = parseInline(source.slice(cursor + 2, end), false);
        if (pair === '~~') appendText(tokens, source.slice(cursor + 2, end));
        else tokens.push({type: 'strong', children});
        cursor = end + 2;
        plainStart = cursor;
        continue;
      }
    }

    if (formatting && (source[cursor] === '*' || source[cursor] === '_')) {
      const marker = source[cursor];
      const end = source.indexOf(marker, cursor + 1);
      if (end > cursor + 1) {
        if (!canAppendStructured(tokens, source.slice(plainStart, cursor))) break;
        flush(cursor);
        tokens.push({type: 'emphasis', children: parseInline(source.slice(cursor + 1, end), false)});
        cursor = end + 1;
        plainStart = cursor;
        continue;
      }
    }
    cursor += 1;
  }
  if (cursor < source.length) appendText(tokens, source.slice(plainStart));
  else flush(source.length);
  return tokens;
}

function listMatch(line) {
  const unordered = /^\s{0,3}[-+*]\s+(.+)$/u.exec(line);
  if (unordered) return {ordered: false, start: null, content: unordered[1]};
  const ordered = /^\s{0,3}(\d{1,6})[.)]\s+(.+)$/u.exec(line);
  if (ordered) return {ordered: true, start: Number(ordered[1]), content: ordered[2]};
  return null;
}

function isBlockStart(line) {
  return /^\s{0,3}```/u.test(line) || /^\s{0,3}#{1,6}\s+/u.test(line) || Boolean(listMatch(line));
}

export function parseFeedMarkdown(value) {
  const lines = boundedText(value).split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length && blocks.length < MAX_BLOCKS - 1) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^\s{0,3}```(.*)$/u.exec(line);
    if (fence) {
      const candidate = fence[1].trim();
      const language = /^[\w+#.-]{1,20}$/u.test(candidate) ? candidate : null;
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s{0,3}```\s*$/u.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({type: 'code_block', language, text: code.join('\n')});
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      blocks.push({type: 'heading', level: heading[1].length, children: parseInline(heading[2])});
      index += 1;
      continue;
    }

    const firstItem = listMatch(line);
    if (firstItem) {
      const items = [];
      const ordered = firstItem.ordered;
      const start = firstItem.start;
      while (index < lines.length) {
        const item = listMatch(lines[index]);
        if (!item || item.ordered !== ordered) break;
        items.push(parseInline(item.content));
        index += 1;
      }
      blocks.push({type: 'list', ordered, start, items});
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({type: 'paragraph', children: parseInline(paragraph.join('\n'))});
  }
  if (index < lines.length) {
    const remainder = lines.slice(index).join('\n');
    if (remainder) blocks.push({type: 'paragraph', children: [{type: 'text', text: remainder}]});
  }
  return blocks;
}

function previewBlockSegments(value) {
  const segments = [];
  let code = false;
  let lines = [];

  const flush = () => {
    if (!lines.length) return;
    segments.push({code, text: lines.join('\n')});
    lines = [];
  };

  for (const line of boundedText(value).split('\n')) {
    if (!code && /^\s{0,3}```/u.test(line)) {
      flush();
      code = true;
      continue;
    }
    if (code && /^\s{0,3}```\s*$/u.test(line)) {
      flush();
      code = false;
      continue;
    }
    lines.push(line);
  }
  flush();
  return segments;
}

function cleanPreviewMarkdown(text) {
  const unwrap = (_match, text) => text;
  let cleaned = text
    .replace(/^\s{0,3}#{1,6}\s+/gmu, '')
    .replace(/^\s{0,3}(?:[-+*]|\d{1,6}[.)])\s+/gmu, '')
    .replace(/!\[([^\]\n]*)\]\([^\n)]*\)/gu, unwrap)
    .replace(/\[([^\]\n]*)\]\([^\n)]*\)/gu, unwrap);
  for (let pass = 0; pass < 3; pass += 1) {
    const before = cleaned;
    cleaned = cleaned
      .replace(/~~([^~\n]+)~~/gu, unwrap)
      .replace(/\*([^*\n]+)\*/gu, unwrap)
      .replace(/\*\*([^*\n]+)\*\*/gu, unwrap)
      .replace(/_([^_\n]+)_/gu, unwrap)
      .replace(/__([^_\n]+)__/gu, unwrap);
    if (cleaned === before) break;
  }
  return cleaned;
}

function cleanPreviewInlineCode(text) {
  // Keep outer Markdown contiguous while hiding code punctuation from cleanup.
  // This private-use range has more characters than our bounded input can hold,
  // so a marker absent from all user text (including code) always exists.
  const characters = new Set(text);
  let markerPoint = 0xF0000;
  while (characters.has(String.fromCodePoint(markerPoint))) markerPoint += 1;
  const marker = String.fromCodePoint(markerPoint);
  const code = [];
  let protectedText = '';
  let cursor = 0;
  while (cursor < text.length) {
    const opening = text.indexOf('`', cursor);
    if (opening < 0) break;
    const closing = text.indexOf('`', opening + 1);
    const newline = text.indexOf('\n', opening + 1);
    if (closing < 0 || (newline >= 0 && newline < closing)) break;
    protectedText += text.slice(cursor, opening);
    protectedText += `${marker}${code.length}${marker}`;
    code.push(text.slice(opening + 1, closing));
    cursor = closing + 1;
  }
  protectedText += text.slice(cursor);
  return cleanPreviewMarkdown(protectedText).replace(
    new RegExp(`${marker}(\\d+)${marker}`, 'gu'),
    (_match, index) => code[Number(index)],
  );
}

function plainMarkdownText(value) {
  const text = previewBlockSegments(value)
    .map((segment) => segment.code ? segment.text : cleanPreviewInlineCode(segment.text))
    .join('\n');
  return text.replace(/\s+/gu, ' ').trim();
}

export function feedMarkdownPreview(value, limit = 260) {
  const requested = Number.isFinite(limit) ? Math.trunc(limit) : 260;
  const boundedLimit = Math.min(MAX_PREVIEW_LENGTH, Math.max(0, requested));
  if (!boundedLimit) return '';
  const text = plainMarkdownText(value);
  return text.slice(0, boundedLimit).trimEnd();
}
