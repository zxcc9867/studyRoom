// Classify the original title and introduction, never translated text or the page locale.
// A short or mixed-script snippet is intentionally left unclassified.
export function feedOriginalLanguage(title, excerpt = '') {
  const counts = value => {
    const text = typeof value === 'string' ? value : '';
    return {
      ko: (text.match(/[\uAC00-\uD7A3]/gu) || []).length,
      latin: (text.match(/[A-Za-z]/g) || []).length,
      other: (text.match(/[\u3040-\u30ff\u3400-\u9fff\u0400-\u04ff\u0600-\u06ff]/gu) || []).length,
    };
  };
  const heading = counts(title), body = counts(excerpt);
  if (heading.ko >= 3 && heading.ko * 5 >= heading.latin && heading.ko >= heading.other) return 'ko';
  if (body.ko >= 8 && body.ko * 3 >= body.latin && body.ko >= body.other) return 'ko';
  if (heading.latin >= 8 && heading.ko === 0 && heading.other === 0 && body.ko < 8 && body.other === 0) return 'en';
  if (body.latin >= 20 && body.ko === 0 && body.other === 0 && heading.other === 0) return 'en';
  return 'unknown';
}

export const FEED_LANGUAGE_LABELS = {ko: '한국어 원문', en: '영어 원문', unknown: '원문 언어 미확인'};
