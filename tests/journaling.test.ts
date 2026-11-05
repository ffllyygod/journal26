import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDay } from '../src/lib/domain.ts';
import { writingProgress } from '../src/lib/journaling.ts';

test('empty writing progress contains seven calendar days ending today', () => {
  const result = writingProgress({}, '2026-11-02');
  assert.equal(result.total, 0);
  assert.deepEqual(result.recent, [
    { date: '2026-10-27', written: false },
    { date: '2026-10-28', written: false },
    { date: '2026-10-29', written: false },
    { date: '2026-10-30', written: false },
    { date: '2026-10-31', written: false },
    { date: '2026-11-01', written: false },
    { date: '2026-11-02', written: false },
  ]);
});

test('journal, win and lesson count once per day without requiring other steps', () => {
  const result = writingProgress(
    {
      '2026-10-20': { ...emptyDay(), journal: 'An older entry' },
      '2026-10-30': { ...emptyDay(), journal: 'One line', win: 'A win', lesson: 'A lesson' },
      '2026-10-31': { ...emptyDay(), win: 'A small win' },
      '2026-11-01': { ...emptyDay(), lesson: 'Something learned' },
      '2026-11-02': { ...emptyDay(), journal: '  \n', win: '\t', lesson: ' ' },
      '2026-11-03': { ...emptyDay(), journal: 'Future notes' },
    },
    '2026-11-02',
  );
  assert.equal(result.total, 4);
  assert.deepEqual(
    result.recent.filter(day => day.written).map(day => day.date),
    ['2026-10-30', '2026-10-31', '2026-11-01'],
  );
});

test('a new challenge excludes older and out-of-range writing from its trail and milestones', () => {
  const days = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `2026-11-${String(index + 1).padStart(2, '0')}`,
      { ...emptyDay(), journal: 'A reflection' },
    ]),
  );
  const restarted = writingProgress(days, '2026-11-06', '2026-11-06', 7);
  assert.equal(restarted.total, 1);
  assert.equal(restarted.milestone, 1);
  assert.equal(restarted.recent.filter(day => day.written).length, 1);
  const finished = writingProgress(days, '2026-11-20', '2026-11-06', 7);
  assert.equal(finished.total, 7);
  assert.equal(finished.milestone, 7);
  assert.equal(finished.recent.filter(day => day.written).length, 0);
});
