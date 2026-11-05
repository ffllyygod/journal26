import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDay } from '../src/lib/domain.ts';
import { journalHistory, journalPreview } from '../src/lib/journal-history.ts';
import type { DayEntry } from '../src/lib/types.ts';

const photo = { id: 'photo', name: 'walk.png', path: 'sample/walk.png', mime: 'image/png', size: 100 };
const days: Record<string, DayEntry> = {
  '2026-11-01': { ...emptyDay(), journal: 'A quiet WALK', mood: 4, attachments: [photo] },
  '2026-11-02': { ...emptyDay(), win: 'Asked for help', mood: 2 },
  '2026-11-03': { ...emptyDay(), lesson: 'Rest matters' },
  '2026-11-04': { ...emptyDay(), mood: 5 },
  '2026-11-05': { ...emptyDay(), attachments: [photo] },
  '2026-11-06': { ...emptyDay(), journal: '  \n', win: '\t', lesson: '  ' },
  '2026-11-07': { ...emptyDay(), priorities: ['Planned only', '', ''] },
};

test('history includes mood-only and photo-only days while excluding whitespace and plans', () => {
  assert.deepEqual(
    journalHistory(days).map(([date]) => date),
    ['2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01'],
  );
  assert.equal(journalHistory(days, { query: ' \n ' }).length, 5);
});

test('search trims its query and matches reflection fields or the ISO date', () => {
  assert.equal(journalHistory(days, { query: ' WALK  ' })[0][0], '2026-11-01');
  assert.equal(journalHistory(days, { query: 'HELP' })[0][0], '2026-11-02');
  assert.equal(journalHistory(days, { query: 'rest' })[0][0], '2026-11-03');
  assert.equal(journalHistory(days, { query: '2026-11-04' })[0][0], '2026-11-04');
  assert.deepEqual(journalHistory(days, { query: 'missing' }), []);
});

test('mood and photo filters combine with search rather than replacing it', () => {
  assert.equal(journalHistory(days, { mood: 5 })[0][0], '2026-11-04');
  assert.equal(journalHistory(days, { photosOnly: true }).length, 2);
  assert.equal(journalHistory(days, { query: 'walk', mood: 4, photosOnly: true }).length, 1);
  assert.equal(journalHistory(days, { query: 'walk', mood: 2, photosOnly: true }).length, 0);
});

test('previews explain mood-only and photo-only records without displaying blank text', () => {
  assert.equal(
    journalPreview({ ...emptyDay(), journal: '  ', lesson: ' Learned something ' }),
    'Learned something',
  );
  assert.equal(journalPreview(days['2026-11-04']), 'Mood: Great');
  assert.equal(journalPreview(days['2026-11-05']), '1 photo');
  assert.equal(
    journalPreview({ ...emptyDay(), attachments: [photo, { ...photo, id: 'second' }] }),
    '2 photos',
  );
  assert.equal(journalPreview(emptyDay()), '');
});
