import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  createWorkspace,
  currentDay,
  emptyDay,
  normalizeWorkspace,
  sessionAt,
  todayIn,
} from '../src/lib/domain.ts';
import { describeConflict, mergeThreeWay, mergeWorkspaces } from '../src/lib/merge.ts';
import {
  bestStreak,
  breakdown,
  dayGuardrails,
  dayLoop,
  daysSinceBackup,
  levelProblem,
  loopStreak,
  needsReview,
  plannedRR,
  tradeAnalytics,
  urgeStats,
} from '../src/lib/analytics.ts';
import { buildReminderCalendar } from '../src/lib/reminders.ts';
import type { Trade, Workspace } from '../src/lib/types.ts';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(),
    date: '2026-11-01',
    time: '',
    session: '',
    symbol: 'XAUUSD',
    account: 'demo',
    direction: 'long',
    status: 'closed',
    setup: 'Retest',
    entry: 2700,
    exit: 2710,
    stop: 2695,
    target: 2710,
    size: '0.01',
    risk: 10,
    netPnl: 20,
    fees: 0,
    emotion: 'Calm',
    followedPlan: 'yes',
    grade: '',
    mistakes: [],
    rulesChecked: [],
    thesis: '',
    review: 'ok',
    attachments: [],
    ...overrides,
  };
}
const workspace = (): Workspace => createWorkspace('2026-11-01');

test('a 1am session belongs to the previous journal day; timezone still applies', () => {
  const oneAmIst = new Date('2026-11-01T19:30:00Z');
  assert.equal(todayIn('Asia/Kolkata', oneAmIst), '2026-11-02');
  assert.equal(currentDay({ timezone: 'Asia/Kolkata', dayStartHour: 3 }, oneAmIst), '2026-11-01');
  assert.equal(
    currentDay({ timezone: 'Asia/Kolkata', dayStartHour: 3 }, new Date('2026-11-01T21:30:00Z')),
    '2026-11-02',
  );
});

test('sessions follow UTC hour', () => {
  assert.equal(sessionAt(new Date('2026-11-01T08:00:00Z')), 'london');
  assert.equal(sessionAt(new Date('2026-11-01T14:00:00Z')), 'newyork');
  assert.equal(sessionAt(new Date('2026-11-01T23:00:00Z')), 'asia');
});

test('normalize upgrades an old document without losing data', () => {
  const old = JSON.parse(JSON.stringify(workspace()));
  delete old.urges;
  delete old.settings.habitLabels;
  delete old.settings.symbols;
  old.settings.name = 'Kept';
  old.days['2026-11-01'] = { journal: 'old words', tasks: [], priorities: [], smoking: 'kept' };
  old.trades = [
    {
      id: 't',
      date: '2026-11-01',
      symbol: 'BTC',
      status: 'open',
      netPnl: null,
      followedPlan: 'unset',
      review: '',
    },
  ];
  const doc = normalizeWorkspace(old);
  assert.equal(doc.settings.name, 'Kept');
  assert.deepEqual(doc.settings.symbols, ['XAUUSD', 'BTC', 'ETH']);
  assert.equal(doc.days['2026-11-01'].journal, 'old words');
  assert.equal(doc.days['2026-11-01'].closed, false);
  assert.deepEqual(doc.trades[0].mistakes, []);
  assert.deepEqual(doc.urges, []);
});

test('merge combines edits on different days and fields', () => {
  const base = workspace();
  base.days['2026-11-01'] = emptyDay();
  const phone = structuredClone(base);
  phone.days['2026-11-01'].journal = 'from phone';
  const laptop = structuredClone(base);
  laptop.days['2026-11-01'].smoking = 'kept';
  laptop.days['2026-11-02'] = { ...emptyDay(), win: 'x' };
  const { value, conflicts } = mergeThreeWay(base, laptop, phone);
  assert.deepEqual(conflicts, []);
  assert.equal(value.days['2026-11-01'].journal, 'from phone');
  assert.equal(value.days['2026-11-01'].smoking, 'kept');
  assert.equal(value.days['2026-11-02'].win, 'x');
});

test('two devices creating the same new day merge field by field', () => {
  const base = workspace();
  const phone = structuredClone(base);
  phone.days['2026-11-01'] = { ...emptyDay(), journal: 'phone words', priorities: ['', 'phone goal', ''] };
  const laptop = structuredClone(base);
  laptop.days['2026-11-01'] = { ...emptyDay(), smoking: 'kept', priorities: ['laptop goal', '', ''] };
  const { value, conflicts } = mergeWorkspaces(base, laptop, phone);
  assert.deepEqual(conflicts, []);
  const day = value.days['2026-11-01'];
  assert.equal(day.journal, 'phone words');
  assert.equal(day.smoking, 'kept');
  assert.deepEqual(day.priorities, ['laptop goal', 'phone goal', '']);
});

test('a day planned on one device is a plain addition, not a conflict', () => {
  const base = workspace();
  base.days['2026-11-01'] = emptyDay();
  const laptop = structuredClone(base);
  laptop.days['2026-11-02'] = { ...emptyDay(), priorities: ['Plan for tomorrow', '', ''] };
  const phone = structuredClone(base);
  phone.days['2026-11-01'].journal = 'Written on the phone';
  for (const [local, remote] of [
    [laptop, phone],
    [phone, laptop],
  ]) {
    const { value, conflicts } = mergeWorkspaces(base, local, remote);
    assert.deepEqual(conflicts, []);
    assert.equal(value.days['2026-11-02'].priorities[0], 'Plan for tomorrow');
    assert.equal(value.days['2026-11-01'].journal, 'Written on the phone');
  }
});

test('merge unions trades by id and honours deletes', () => {
  const a = trade({ id: 'a' });
  const b = trade({ id: 'b' });
  const base = { ...workspace(), trades: [a, b] };
  const local = { ...base, trades: [trade({ id: 'c' }), a, b] };
  const remote = { ...base, trades: [a] };
  const { value, conflicts } = mergeThreeWay(base, local, remote);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(
    value.trades.map(t => t.id),
    ['c', 'a'],
  );
});

test('merge edit-versus-delete keeps the edited record', () => {
  const a = trade({ id: 'a', review: 'old' });
  const base = { ...workspace(), trades: [a] };
  const { value, conflicts } = mergeThreeWay(
    base,
    { ...base, trades: [{ ...a, review: 'new' }] },
    { ...base, trades: [] },
  );
  assert.equal(value.trades[0].review, 'new');
  assert.equal(conflicts.length, 1);
});

test('merge reports a true conflict rather than dropping words silently', () => {
  const base = workspace();
  base.days['2026-11-01'] = emptyDay();
  const local = structuredClone(base);
  local.days['2026-11-01'].journal = 'mine';
  const remote = structuredClone(base);
  remote.days['2026-11-01'].journal = 'theirs';
  const { value, conflicts } = mergeThreeWay(base, local, remote);
  assert.deepEqual(conflicts, ['days.2026-11-01.journal']);
  assert.equal(value.days['2026-11-01'].journal, 'mine');
  assert.equal(describeConflict(conflicts[0]), '2026-11-01 · journal');
});

test('analytics compute expectancy, profit factor, R and drawdown from closed trades only', () => {
  const stats = tradeAnalytics([
    trade({ date: '2026-11-01', netPnl: 30, risk: 10 }),
    trade({ date: '2026-11-02', netPnl: -10, risk: 10 }),
    trade({ date: '2026-11-03', netPnl: -20, risk: 10 }),
    trade({ date: '2026-11-04', netPnl: 40, risk: null }),
    trade({ date: '2026-11-05', status: 'open', netPnl: null }),
  ]);
  assert.equal(stats.count, 4);
  assert.equal(stats.net, 40);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.profitFactor, 70 / 30);
  assert.equal(stats.expectancy, 10);
  assert.equal(stats.maxDrawdown, 30);
  assert.equal(stats.totalR, 0);
  assert.equal(stats.rCount, 3);
  assert.equal(stats.lossStreak, 0);
  assert.deepEqual(
    stats.equity.map(p => p.value),
    [30, 20, 0, 40],
  );
});

test('analytics stay honest with no data and no losses', () => {
  const empty = tradeAnalytics([]);
  assert.equal(empty.winRate, null);
  assert.equal(empty.expectancy, null);
  assert.equal(tradeAnalytics([trade({ netPnl: 5 })]).profitFactor, null);
});

test('consecutive recent losses are counted for the cool-off warning', () => {
  assert.equal(
    tradeAnalytics([
      trade({ date: '2026-11-01', netPnl: 5 }),
      trade({ date: '2026-11-02', netPnl: -1 }),
      trade({ date: '2026-11-03', netPnl: -1 }),
    ]).lossStreak,
    2,
  );
});

test('breakdown groups by key, supports multi-tag and sorts worst first', () => {
  const rows = breakdown(
    [
      trade({ netPnl: -30, mistakes: ['Oversized', 'Chased entry'] }),
      trade({ netPnl: 10, mistakes: ['Oversized'] }),
      trade({ netPnl: 99 }),
    ],
    t => t.mistakes,
  );
  assert.deepEqual(
    rows.map(r => [r.key, r.count, r.net]),
    [
      ['Chased entry', 1, -30],
      ['Oversized', 2, -20],
    ],
  );
});

test('guardrails flag trade count across accounts and loss limit on live only', () => {
  const trades = [
    trade({ account: 'live', netPnl: -60 }),
    trade({ account: 'demo', netPnl: -500 }),
    trade({ date: '2026-11-02' }),
  ];
  const g = dayGuardrails(trades, '2026-11-01', { maxTradesPerDay: 2, maxDailyLoss: 50 });
  assert.equal(g.count, 2);
  assert.equal(g.loss, 60);
  assert.equal(g.tradeLimitHit, true);
  assert.equal(g.lossLimitHit, true);
  assert.equal(
    dayGuardrails(trades, '2026-11-03', { maxTradesPerDay: null, maxDailyLoss: null }).tradeLimitHit,
    false,
  );
});

test('levels validate by direction and planned R:R is computed', () => {
  assert.match(levelProblem('long', 100, 105, null)!, /below/);
  assert.match(levelProblem('short', 100, 95, null)!, /above/);
  assert.match(levelProblem('long', 100, 95, 90)!, /target/);
  assert.equal(levelProblem('short', 100, 105, 90), null);
  assert.equal(plannedRR({ entry: 100, stop: 95, target: 115 }), 3);
  assert.equal(plannedRR({ entry: 100, stop: null, target: 115 }), null);
});

test('a closed trade without a review is not finished', () => {
  assert.equal(needsReview(trade({ followedPlan: 'unset' })), true);
  assert.equal(needsReview(trade({ review: ' ' })), true);
  assert.equal(needsReview(trade()), false);
  assert.equal(needsReview(trade({ status: 'open', followedPlan: 'unset' })), false);
});

test('best streak survives a slip and unlogged days break runs', () => {
  const days: Workspace['days'] = {};
  for (const date of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06'])
    days[date] = { ...emptyDay(), smoking: 'kept' };
  days['2026-11-04'] = { ...emptyDay(), smoking: 'slip' };
  assert.equal(bestStreak(days, 'smoking', '2026-11-30'), 3);
  assert.equal(bestStreak(days, 'smoking', '2026-11-02'), 2);
});

test('urge stats rank triggers inside the range', () => {
  const base = { id: 'u', at: '', habit: 'smoking' as const, intensity: 3, note: '' };
  const stats = urgeStats(
    [
      { ...base, date: '2026-11-02', trigger: 'Stress', outcome: 'resisted' },
      { ...base, date: '2026-11-03', trigger: 'Stress', outcome: 'slipped' },
      { ...base, date: '2026-11-03', trigger: 'Boredom', outcome: 'resisted' },
      { ...base, date: '2026-12-01', trigger: 'Late night', outcome: 'resisted' },
    ],
    '2026-11-01',
    '2026-11-07',
  );
  assert.equal(stats.total, 3);
  assert.equal(stats.resisted, 2);
  assert.equal(stats.slipped, 1);
  assert.deepEqual(stats.topTriggers[0], ['Stress', 2]);
});

test('the daily loop requires an explicit no-trade decision, and open trades keep it incomplete', () => {
  const data = workspace();
  const date = '2026-11-01';
  const step = (id: string) => dayLoop(data, date).find(s => s.id === id)!.done;
  assert.equal(step('trades'), false);
  data.days[date] = { ...emptyDay(), noTrade: true };
  assert.equal(step('trades'), true);
  data.trades = [trade({ date, status: 'open', netPnl: null })];
  assert.equal(step('trades'), false);
  data.trades = [trade({ date })];
  assert.equal(step('trades'), true);
});

test('loop streak counts only fully completed days', () => {
  const data = workspace();
  const full = () => ({
    ...emptyDay(),
    priorities: ['x', '', ''],
    smoking: 'kept' as const,
    abstinence: 'kept' as const,
    noTrade: true,
    journal: 'y',
  });
  data.days['2026-11-01'] = full();
  data.days['2026-11-02'] = full();
  data.days['2026-11-03'] = { ...emptyDay(), priorities: ['x', '', ''] };
  // An unfinished today must not zero the run earned through yesterday.
  assert.equal(loopStreak(data, '2026-11-03'), 2);
  data.days['2026-11-02'].journal = '';
  assert.equal(loopStreak(data, '2026-11-03'), 0);
  assert.equal(addDays('2026-11-02', 1), '2026-11-03');
});

test('backup age is days between calendar dates', () => {
  assert.equal(daysSinceBackup(null, '2026-11-10'), null);
  assert.equal(daysSinceBackup('2026-11-01T22:00:00.000Z', '2026-11-10'), 9);
});

test('reminder calendar is a valid repeating two-event file with escaped text', () => {
  const ics = buildReminderCalendar(
    { startDate: '2026-11-02', duration: 60, morningReminder: '07:30', eveningReminder: '22:00' },
    'https://j.example',
    new Date('2026-11-01T00:00:00Z'),
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.equal(ics.match(/BEGIN:VEVENT/g)!.length, 2);
  assert.match(ics, /DTSTART:20261102T073000\r\n/);
  assert.match(ics, /RRULE:FREQ=DAILY;COUNT=60/);
  assert.match(ics, /Check in\\, review trades\\, write one line\\, plan tomorrow\./);
  assert.match(ics, /DTSTAMP:20261101T000000Z/);
});
