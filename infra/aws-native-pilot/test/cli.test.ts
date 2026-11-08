import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('the compiled deployment entry point prints help without AWS credentials', () => {
  const run = spawnSync(process.execPath, ['dist/scripts/deploy.js', '--help'], {encoding:'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--allow-cost/);
});

test('the compiled deployment entry point rejects a missing cost approval before starting deployment', () => {
  const run = spawnSync(process.execPath, ['dist/scripts/deploy.js', '--profile', 'sandbox'], {encoding:'utf8'});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /argument validation.*--allow-cost/);
});
