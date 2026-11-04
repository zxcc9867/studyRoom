import test from 'node:test';
import assert from 'node:assert/strict';

let sceneAt;
try { ({sceneAt} = await import('../../../docs/media/anime-sea/scene.mjs')); } catch {}

test('anime sea authoring: wave phase is deterministic and closes the 24 second loop', () => {
  assert.equal(typeof sceneAt, 'function', 'the offline renderer needs a seekable scene');
  assert.deepEqual(sceneAt(0), sceneAt(24));
  const earlier = sceneAt(3);
  sceneAt(19);
  assert.deepEqual(sceneAt(3), earlier, 'seeking must not depend on previous frames');
  assert.equal(sceneAt(6).phase, Math.PI / 2);
  assert.notEqual(sceneAt(2).phase, sceneAt(3).phase);
});

test('anime sea authoring: meteors are occasional, move across the sky and fade before the loop seam', () => {
  assert.equal(typeof sceneAt, 'function');
  for (const time of [0, 2, 5, 8, 12, 16, 20, 23.99, 24]) assert.equal(sceneAt(time).meteor, null);
  const first = sceneAt(6.3).meteor, later = sceneAt(6.8).meteor;
  assert.ok(first && later);
  assert.ok(later.x < first.x && later.y > first.y);
  assert.ok(first.y < .6 && later.y < .6);
  assert.ok(first.opacity > 0 && first.opacity <= 1);
  assert.ok(sceneAt(18.5).meteor);
});
