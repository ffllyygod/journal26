import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, createWorkspace, emptyDay } from '../src/lib/domain.ts';
import { findInsights, hourIn } from '../src/lib/insights.ts';
import type { Trade, Urge, Workspace } from '../src/lib/types.ts';

const TODAY = '2026-11-20';
const workspace = (): Workspace => createWorkspace('2026-11-01');
let serial = 0;
const trade = (overrides: Partial<Trade> = {}): Trade => ({
  id: `t${serial++}`,
  date: '2026-11-05',
  time: '10:00',
  session: 'london',
  symbol: 'XAUUSD',
  account: 'demo',
  direction: 'long',
  status: 'closed',
  setup: '',
  entry: 100,
  exit: 101,
  stop: 99,
  target: 102,
  size: '',
  risk: 10,
  netPnl: 10,
  fees: 0,
  emotion: '',
  followedPlan: 'yes',
  grade: '',
  mistakes: [],
  rulesChecked: [],
  thesis: '',
  review: 'x',
  attachments: [],
  ...overrides,
});
const urge = (at: string, trigger = ''): Urge => ({
  id: at,
  at,
  date: at.slice(0, 10),
  habit: 'smoking',
  intensity: 3,
  trigger,
  note: '',
  outcome: 'resisted',
});
const ids = (data: Workspace) => findInsights(data, TODAY).map(insight => insight.id);

test('an empty journal claims nothing', () => {
  assert.deepEqual(findInsights(workspace(), TODAY), []);
});

test('plan comparison needs three trades on each side', () => {
  const data = workspace();
  data.trades = [
    trade(),
    trade(),
    trade(),
    trade({ followedPlan: 'no', netPnl: -10 }),
    trade({ followedPlan: 'no', netPnl: -10 }),
  ];
  assert.ok(!ids(data).includes('plan'));
  data.trades.push(trade({ followedPlan: 'no', netPnl: -20 }));
  const insight = findInsights(data, TODAY).find(item => item.id === 'plan')!;
  assert.match(insight.title, /-1\.33R a trade off plan, \+1\.00R on plan/);
  assert.equal(insight.evidence, '3 on plan, 3 off plan');
});

test('the plan comparison falls back to money when a risk is missing', () => {
  const data = workspace();
  data.trades = [
    trade({ risk: null }),
    trade(),
    trade(),
    trade({ followedPlan: 'no', netPnl: -30 }),
    trade({ followedPlan: 'no', netPnl: -30 }),
    trade({ followedPlan: 'no', netPnl: -30 }),
  ];
  assert.match(findInsights(data, TODAY).find(item => item.id === 'plan')!.title, /-\$30\.00 a trade/);
});

test('slip days are compared with other days across trades and focus', () => {
  const data = workspace();
  const slipDay = () => ({ ...emptyDay(), smoking: 'slip' as const, careerMinutes: 30 });
  for (let i = 0; i < 2; i++) {
    const date = addDays('2026-11-01', i);
    data.days[date] = slipDay();
    data.trades.push(trade({ date, netPnl: -10 }));
  }
  for (let i = 2; i < 5; i++) {
    const date = addDays('2026-11-01', i);
    data.days[date] = { ...emptyDay(), smoking: 'kept', careerMinutes: 180 };
    data.trades.push(trade({ date, netPnl: 20 }));
  }
  assert.ok(ids(data).includes('slip-trades'));
  assert.ok(ids(data).includes('slip-focus'));
});

test('today does not count toward day comparisons until it is over', () => {
  const data = workspace();
  data.days[TODAY] = { ...emptyDay(), smoking: 'slip' };
  data.days['2026-11-02'] = { ...emptyDay(), smoking: 'slip' };
  for (let i = 3; i < 6; i++)
    data.days[addDays('2026-11-01', i)] = { ...emptyDay(), smoking: 'kept', careerMinutes: 180 };
  assert.ok(!ids(data).includes('slip-focus'));
});

test('a mistake or feeling needs two trades and a net loss', () => {
  const data = workspace();
  data.trades = [trade({ mistakes: ['Chased entry'], emotion: 'FOMO', netPnl: -10 })];
  assert.deepEqual(ids(data), []);
  data.trades.push(trade({ mistakes: ['Chased entry'], emotion: 'FOMO', netPnl: -15 }));
  const found = findInsights(data, TODAY);
  assert.match(found.find(item => item.id === 'mistake')!.title, /chased entry.*\$25\.00/);
  assert.match(found.find(item => item.id === 'feeling')!.title, /fomo.*\$25\.00/);
});

test('craving timing uses the owner timezone and needs a real cluster', () => {
  assert.equal(hourIn('2026-11-01T18:00:00.000Z', 'Asia/Kolkata'), 23);
  const data = workspace();
  // 23:30, 23:00 and 00:30 in Kolkata; the fourth is mid-morning.
  data.urges = [
    urge('2026-11-01T18:00:00.000Z', 'Stress'),
    urge('2026-11-02T17:30:00.000Z', 'Stress'),
    urge('2026-11-03T19:00:00.000Z', 'Stress'),
    urge('2026-11-04T05:00:00.000Z'),
  ];
  const found = findInsights(data, TODAY);
  assert.match(found.find(item => item.id === 'craving-time')!.title, /late at night/);
  assert.match(found.find(item => item.id === 'craving-trigger')!.title, /Stress/);
  data.urges = data.urges.slice(0, 3);
  assert.deepEqual(ids(data), []);
});

test('warnings come before everything else', () => {
  const data = workspace();
  data.trades = [
    trade({ setup: 'Retest' }),
    trade({ setup: 'Retest' }),
    trade({ setup: 'Retest' }),
    trade({ mistakes: ['Oversized'], netPnl: -5 }),
    trade({ mistakes: ['Oversized'], netPnl: -5 }),
  ];
  const found = findInsights(data, TODAY);
  assert.equal(found[0].tone, 'warn');
  assert.equal(found[found.length - 1].id, 'setup');
});
