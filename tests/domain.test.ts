import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  createWorkspace,
  dayDifference,
  emptyDay,
  formatDate,
  habitCount,
  habitStreak,
  safeUrl,
  todayIn,
  tradeR,
  tradeStats,
  weekStart,
} from '../src/lib/domain.ts';
import type { Trade, Workspace } from '../src/lib/types.ts';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'test-trade',
    date: '2026-11-01',
    symbol: 'XAUUSD',
    account: 'demo',
    direction: 'long',
    status: 'closed',
    setup: 'Retest',
    entry: 2700,
    exit: 2710,
    stop: 2695,
    target: 2710,
    size: '0.01 lots',
    risk: 10,
    netPnl: 20,
    fees: 2,
    emotion: 'Calm',
    followedPlan: 'yes',
    thesis: '',
    review: '',
    attachments: [],
    ...overrides,
  };
}

test('today follows the selected timezone across the India midnight boundary', () => {
  assert.equal(todayIn('Asia/Kolkata', new Date('2026-11-01T18:29:59Z')), '2026-11-01');
  assert.equal(todayIn('Asia/Kolkata', new Date('2026-11-01T18:30:00Z')), '2026-11-02');
  assert.equal(todayIn('UTC', new Date('2026-11-01T18:30:00Z')), '2026-11-01');
});

test('today can be the previous calendar day in a western timezone', () => {
  assert.equal(todayIn('America/Los_Angeles', new Date('2026-11-02T01:00:00Z')), '2026-11-01');
});

test('date arithmetic crosses leap days, month ends, and year ends without local-time drift', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(addDays('2025-02-28', 1), '2025-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('calendar arithmetic is stable across daylight saving transitions', () => {
  assert.equal(addDays('2026-03-07', 2), '2026-03-09');
  assert.equal(dayDifference('2026-03-07', '2026-03-09'), 2);
  assert.equal(dayDifference('2026-10-31', '2026-11-02'), 2);
});

test('week starts Monday even for Sunday or dates crossing a year boundary', () => {
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
  assert.equal(weekStart('2026-11-02'), '2026-11-02');
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
});

test('challenge days are inclusive and duration maps to the expected final day', () => {
  const start = '2026-11-01';
  assert.equal(dayDifference(start, start) + 1, 1);
  assert.equal(dayDifference(start, addDays(start, 59)) + 1, 60);
  assert.equal(addDays(start, 59), '2026-12-30');
  assert.equal(dayDifference(start, '2026-10-31') + 1, 0);
});

test('formatting a calendar date cannot shift it to a different day', () => {
  assert.equal(formatDate('2026-11-01', { year: 'numeric', month: '2-digit', day: '2-digit' }), '11/01/2026');
});

test('new private workspaces start empty with independent day templates', () => {
  const workspace = createWorkspace('2026-11-01');
  assert.deepEqual(workspace.days, {});
  assert.deepEqual(workspace.trades, []);
  assert.equal(workspace.settings.startDate, '2026-11-01');
  assert.equal(workspace.settings.configured, false);
  const first = emptyDay();
  const second = emptyDay();
  first.priorities[0] = 'Only on first';
  assert.equal(second.priorities[0], '');
  assert.equal(first.smoking, 'unset');
  assert.equal(first.abstinence, 'unset');
});

test('an unlogged today preserves yesterday’s ongoing streak', () => {
  const days: Workspace['days'] = {
    '2026-10-30': { ...emptyDay(), smoking: 'kept' },
    '2026-10-31': { ...emptyDay(), smoking: 'kept' },
  };
  assert.equal(habitStreak(days, 'smoking', '2026-11-01'), 2);
  days['2026-11-01'] = emptyDay();
  assert.equal(habitStreak(days, 'smoking', '2026-11-01'), 2);
});

test('a missed historical day breaks a streak without becoming a recorded slip', () => {
  const days: Workspace['days'] = {
    '2026-10-29': { ...emptyDay(), smoking: 'kept' },
    '2026-10-31': { ...emptyDay(), smoking: 'kept' },
    '2026-11-01': { ...emptyDay(), smoking: 'kept' },
  };
  assert.equal(habitStreak(days, 'smoking', '2026-11-01'), 2);
  assert.equal(habitCount(days, 'smoking', 'slip', '2026-11-01'), 0);
  assert.equal(habitCount(days, 'smoking', 'kept', '2026-11-01'), 3);
});

test('a lapse resets only its own streak and preserves previous successful days', () => {
  const days: Workspace['days'] = {
    '2026-10-30': { ...emptyDay(), smoking: 'kept', abstinence: 'kept' },
    '2026-10-31': { ...emptyDay(), smoking: 'kept', abstinence: 'kept' },
    '2026-11-01': { ...emptyDay(), smoking: 'slip', abstinence: 'kept' },
  };
  assert.equal(habitStreak(days, 'smoking', '2026-11-01'), 0);
  assert.equal(habitStreak(days, 'abstinence', '2026-11-01'), 3);
  assert.equal(habitCount(days, 'smoking', 'kept', '2026-11-01'), 2);
});

test('future habit entries cannot increase today’s totals or streak', () => {
  const days: Workspace['days'] = {
    '2026-11-01': { ...emptyDay(), smoking: 'kept' },
    '2026-11-02': { ...emptyDay(), smoking: 'kept' },
  };
  assert.equal(habitCount(days, 'smoking', 'kept', '2026-11-01'), 1);
  assert.equal(habitStreak(days, 'smoking', '2026-11-01'), 1);
  assert.equal(habitStreak({}, 'smoking', '2026-11-01'), 0);
});

test('empty or only-open trade logs have no realised win rate', () => {
  assert.deepEqual(tradeStats([]), { count: 0, net: 0, winRate: null, adherence: null });
  const stats = tradeStats([trade({ status: 'open', netPnl: 999 })]);
  assert.equal(stats.count, 0);
  assert.equal(stats.net, 0);
  assert.equal(stats.winRate, null);
});

test('closed zero results are real trades but absent results are excluded', () => {
  const stats = tradeStats([
    trade({ netPnl: 20 }),
    trade({ netPnl: -10 }),
    trade({ netPnl: 0 }),
    trade({ netPnl: null }),
    trade({ status: 'open', netPnl: 100 }),
  ]);
  assert.equal(stats.count, 3);
  assert.equal(stats.net, 10);
  assert.equal(stats.winRate, 100 / 3);
});

test('broker net P&L is not reduced by fees a second time', () => {
  const stats = tradeStats([trade({ netPnl: 18, fees: 2 })]);
  assert.equal(stats.net, 18);
});

test('separately filtered demo and live accounts produce separate results', () => {
  const trades = [
    trade({ account: 'demo', netPnl: 100 }),
    trade({ account: 'live', netPnl: -25 }),
    trade({ account: 'live', status: 'open', netPnl: null }),
  ];
  assert.equal(tradeStats(trades.filter(t => t.account === 'demo')).net, 100);
  assert.equal(tradeStats(trades.filter(t => t.account === 'live')).net, -25);
  assert.equal(tradeStats(trades.filter(t => t.account === 'live')).count, 1);
});

test('R uses monetary initial risk and correctly represents wins, losses, and break-even', () => {
  assert.equal(tradeR(trade({ netPnl: 25, risk: 10 })), 2.5);
  assert.equal(tradeR(trade({ netPnl: -10, risk: 10 })), -1);
  assert.equal(tradeR(trade({ netPnl: 0, risk: 10 })), 0);
});

test('R remains unknown for open trades, absent results, or nonpositive risk', () => {
  for (const overrides of [
    { status: 'open' as const },
    { netPnl: null },
    { risk: null },
    { risk: 0 },
    { risk: -10 },
  ]) {
    assert.equal(tradeR(trade(overrides)), null);
  }
});

test('evidence links permit web URLs and reject executable or malformed URLs', () => {
  assert.equal(safeUrl('https://example.com/project?q=journal'), 'https://example.com/project?q=journal');
  assert.equal(safeUrl('http://localhost:3000/'), 'http://localhost:3000/');
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///etc/passwd',
    '//example.com',
    '/relative',
    'not a url',
    '',
  ]) {
    assert.equal(safeUrl(value), undefined, value);
  }
});
