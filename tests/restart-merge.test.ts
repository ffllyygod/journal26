import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, emptyDay, isWorkspace, normalizeWorkspace } from '../src/lib/domain.ts';
import { describeConflict, mergeWorkspaces } from '../src/lib/merge.ts';
import { restartWorkspace } from '../src/lib/restart.ts';

function oldJournal() {
  const doc = createWorkspace('2026-10-01');
  doc.days['2026-11-05'] = { ...emptyDay(), journal: 'Before restart' };
  return doc;
}

test('a remote restart discards stale local records instead of merging them into the new journal', () => {
  const base = oldJournal();
  const local = structuredClone(base);
  local.days['2026-11-05'].journal += ' with an offline edit';
  local.days['2026-11-06'] = { ...emptyDay(), journal: 'A new entry in the stale tab' };
  const remote = restartWorkspace(base, '2026-11-06');
  remote.days['2026-11-06'] = { ...emptyDay(), win: 'A new beginning' };
  const result = mergeWorkspaces(base, local, remote);
  assert.deepEqual(result.value, remote);
  assert.deepEqual(result.conflicts, ['resetId']);
});

test('an intentional local restart remains whole when another device edited the old generation', () => {
  const base = oldJournal();
  const local = restartWorkspace(base, '2026-11-06');
  const remote = structuredClone(base);
  remote.days['2026-11-05'].lesson = 'An old-generation edit';
  const result = mergeWorkspaces(base, local, remote);
  assert.deepEqual(result.value, local);
  assert.deepEqual(result.value.days, {});
  assert.deepEqual(result.conflicts, ['resetId']);
});

test('competing restarts prefer the persisted generation without combining either history', () => {
  const base = oldJournal();
  const local = restartWorkspace(base, '2026-11-06');
  local.days['2026-11-06'] = { ...emptyDay(), journal: 'Local new journal' };
  const remote = restartWorkspace(base, '2026-11-07');
  remote.days['2026-11-07'] = { ...emptyDay(), journal: 'Remote new journal' };
  assert.deepEqual(mergeWorkspaces(base, local, remote), { value: remote, conflicts: ['resetId'] });
});

test('an old backup without a generation cannot silently replace a restarted cloud journal during merge', () => {
  const local = oldJournal();
  const base = restartWorkspace(local, '2026-11-06');
  const remote = structuredClone(base);
  remote.days['2026-11-06'] = { ...emptyDay(), journal: 'New generation' };
  assert.deepEqual(mergeWorkspaces(base, local, remote), { value: remote, conflicts: ['resetId'] });
});

test('normal edits within the same restarted generation still merge field by field', () => {
  const base = restartWorkspace(oldJournal(), '2026-11-06');
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.days['2026-11-06'] = { ...emptyDay(), journal: 'Local writing' };
  remote.days['2026-11-06'] = { ...emptyDay(), win: 'Remote win' };
  const result = mergeWorkspaces(base, local, remote);
  assert.equal(result.value.resetId, base.resetId);
  assert.equal(result.value.days['2026-11-06'].journal, 'Local writing');
  assert.equal(result.value.days['2026-11-06'].win, 'Remote win');
  assert.deepEqual(result.conflicts, []);
});

test('the second save merge cannot reintroduce edits typed while a remote restart was being read', () => {
  const base = oldJournal();
  const snapshot = structuredClone(base);
  snapshot.days['2026-11-05'].win = 'Before request';
  const latest = structuredClone(snapshot);
  latest.days['2026-11-05'].lesson = 'Typed during request';
  const remote = restartWorkspace(base, '2026-11-06');
  const first = mergeWorkspaces(base, snapshot, remote);
  const second = mergeWorkspaces(snapshot, latest, first.value);
  assert.deepEqual(second.value, remote);
  assert.deepEqual(second.conflicts, ['resetId']);
});

test('legacy workspaces remain valid and normalization does not add an undefined generation', () => {
  const old = oldJournal();
  assert.equal(isWorkspace(old), true);
  assert.equal('resetId' in normalizeWorkspace(old), false);
  const restarted = restartWorkspace(old, '2026-11-06');
  assert.equal(isWorkspace(restarted), true);
  assert.equal(normalizeWorkspace(restarted).resetId, restarted.resetId);
  assert.equal(isWorkspace({ ...old, resetId: 123 }), false);
  assert.equal(isWorkspace({ ...old, resetId: 'not-a-uuid' }), false);
  assert.equal(describeConflict('resetId'), 'This journal was restarted or restored on another device');
});
