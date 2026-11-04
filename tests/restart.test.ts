import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, emptyDay } from '../src/lib/domain.ts';
import { isRestartDate, restartWorkspace } from '../src/lib/restart.ts';

test('restart clears every journal collection and preserves independent preferences', () => {
  const original = createWorkspace('2026-10-01');
  original.settings.name = 'Sample owner';
  original.settings.configured = true;
  original.settings.lastBackupAt = '2026-11-05T12:00:00Z';
  original.days['2026-11-05'] = { ...emptyDay(), journal: 'Sample reflection' };
  original.applications.push({
    id: 'a',
    company: 'Example',
    role: 'Engineer',
    url: '',
    status: 'saved',
    appliedOn: '',
    followUp: '',
    notes: 'Sample',
  });
  original.learning.push({ id: 'l', date: '2026-11-05', topic: 'Example', notes: 'Sample', url: '' });
  original.weeklyNotes['2026-11-02'] = 'Sample review';
  original.weeklyCommitments['2026-11-02'] = 'Sample commitment';
  original.urges.push({
    id: 'u',
    at: '2026-11-05T12:00:00Z',
    date: '2026-11-05',
    habit: 'smoking',
    intensity: 2,
    trigger: 'Stress',
    note: 'Sample',
    outcome: 'resisted',
  });
  original.trades.push({
    id: 't',
    date: '2026-11-05',
    time: '',
    session: '',
    symbol: 'EXAMPLE',
    account: 'demo',
    direction: 'long',
    status: 'open',
    setup: '',
    entry: 10,
    exit: null,
    stop: null,
    target: null,
    size: '',
    risk: null,
    netPnl: null,
    fees: 0,
    emotion: '',
    followedPlan: 'unset',
    grade: '',
    mistakes: [],
    rulesChecked: [],
    thesis: 'Sample',
    review: '',
    attachments: [],
  });
  const before = structuredClone(original);

  const reset = restartWorkspace(original, '2026-11-06');
  assert.deepEqual(reset, {
    ...createWorkspace('2026-11-06'),
    resetId: reset.resetId,
    settings: { ...before.settings, startDate: '2026-11-06', lastBackupAt: null },
  });
  assert.match(reset.resetId!, /^[0-9a-f-]{36}$/);
  assert.deepEqual(original, before);
  reset.settings.habitLabels.smoking = 'A different preference';
  reset.settings.symbols.push('OTHER');
  assert.deepEqual(original, before);
});

test('each restart has a new generation even when the requested start date is unchanged', () => {
  const first = restartWorkspace(createWorkspace(), '2026-11-06');
  const second = restartWorkspace(first, '2026-11-06');
  assert.notEqual(first.resetId, second.resetId);
});

test('restart dates must be real calendar days in the supported range', () => {
  for (const date of ['2020-01-01', '2024-02-29', '2026-11-06', '2100-12-31'])
    assert.equal(isRestartDate(date), true, date);
  for (const date of [
    '',
    '2026-2-03',
    '2026-02-29',
    '2026-04-31',
    '2100-02-29',
    '2019-12-31',
    '2101-01-01',
    '2026-11-06T00:00:00Z',
  ]) {
    assert.equal(isRestartDate(date), false, date);
    assert.throws(() => restartWorkspace(createWorkspace(), date), /valid start date/);
  }
});
