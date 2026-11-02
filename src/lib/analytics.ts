import { addDays, tradeR, weekStart } from './domain.ts';
import type { HabitKey, Settings, Trade, Urge, Workspace } from './types.ts';

const closedOnly = (trades: Trade[]) => trades.filter(t => t.status === 'closed' && t.netPnl !== null);
const byTime = (a: Trade, b: Trade) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => (values.length ? sum(values) / values.length : null);

export type EquityPoint = { index: number; date: string; label: string; value: number };

export function tradeAnalytics(trades: Trade[]) {
  const closed = closedOnly(trades).sort(byTime);
  const results = closed.map(t => t.netPnl!);
  const wins = results.filter(value => value > 0);
  const losses = results.filter(value => value < 0);
  const grossLoss = Math.abs(sum(losses));
  const rs = closed.map(tradeR).filter((value): value is number => value !== null);
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equity: EquityPoint[] = closed.map((trade, index) => {
    running += trade.netPnl!;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    return {
      index: index + 1,
      date: trade.date,
      label: `${trade.symbol} ${trade.direction}`,
      value: running,
    };
  });
  let lossStreak = 0;
  for (let i = results.length - 1; i >= 0 && results[i] < 0; i--) lossStreak++;
  const reviewed = trades.filter(t => t.followedPlan !== 'unset');
  return {
    count: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: results.length - wins.length - losses.length,
    net: sum(results),
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    avgWin: average(wins),
    avgLoss: average(losses),
    /** null when there are no losses yet: an infinite ratio from three trades is not information. */
    profitFactor: grossLoss > 0 ? sum(wins) / grossLoss : null,
    expectancy: average(results),
    avgR: average(rs),
    totalR: rs.length ? sum(rs) : null,
    rCount: rs.length,
    maxDrawdown,
    lossStreak,
    equity,
    adherence: reviewed.length
      ? (reviewed.filter(t => t.followedPlan === 'yes').length / reviewed.length) * 100
      : null,
    reviewedCount: reviewed.length,
  };
}

export type BreakdownRow = { key: string; count: number; net: number; winRate: number; avgR: number | null };

export function breakdown(trades: Trade[], keyOf: (trade: Trade) => string | string[]): BreakdownRow[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of closedOnly(trades)) {
    const keys = keyOf(trade);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), trade]);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      count: group.length,
      net: sum(group.map(t => t.netPnl!)),
      winRate: (group.filter(t => t.netPnl! > 0).length / group.length) * 100,
      avgR: average(group.map(tradeR).filter((value): value is number => value !== null)),
    }))
    .sort((a, b) => a.net - b.net);
}

/** Guardrails for one calendar day, evaluated before and after logging a trade. */
export function dayGuardrails(
  trades: Trade[],
  date: string,
  settings: Pick<Settings, 'maxTradesPerDay' | 'maxDailyLoss'>,
) {
  const today = trades.filter(t => t.date === date && t.account === 'live');
  const practice = trades.filter(t => t.date === date);
  const loss = -Math.min(0, sum(closedOnly(today).map(t => t.netPnl!)));
  const tradeLimitHit = settings.maxTradesPerDay !== null && practice.length >= settings.maxTradesPerDay;
  const lossLimitHit =
    settings.maxDailyLoss !== null && settings.maxDailyLoss > 0 && loss >= settings.maxDailyLoss;
  return { count: practice.length, loss, tradeLimitHit, lossLimitHit };
}

export function plannedRR(trade: Pick<Trade, 'entry' | 'stop' | 'target'>): number | null {
  if (trade.stop === null || trade.target === null) return null;
  const risk = Math.abs(trade.entry - trade.stop);
  return risk > 0 ? Math.abs(trade.target - trade.entry) / risk : null;
}

/** Catches the classic typo where stop and target are on the wrong side of entry. */
export function levelProblem(
  direction: Trade['direction'],
  entry: number,
  stop: number | null,
  target: number | null,
): string | null {
  const long = direction === 'long';
  if (stop !== null && (long ? stop >= entry : stop <= entry))
    return `A ${long ? 'long' : 'short'} stop belongs ${long ? 'below' : 'above'} the entry price.`;
  if (target !== null && (long ? target <= entry : target >= entry))
    return `A ${long ? 'long' : 'short'} target belongs ${long ? 'above' : 'below'} the entry price.`;
  return null;
}

export function needsReview(trade: Trade): boolean {
  return trade.status === 'closed' && (trade.followedPlan === 'unset' || !trade.review.trim());
}

/** Longest and most recent run of kept days. Unlogged days break a run; they are never counted as kept. */
export function bestStreak(days: Workspace['days'], habit: HabitKey, through: string): number {
  const kept = Object.keys(days)
    .filter(date => date <= through && days[date][habit] === 'kept')
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of kept) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

export function urgeStats(urges: Urge[], from: string, to: string) {
  const inRange = urges.filter(urge => urge.date >= from && urge.date <= to);
  const counts = new Map<string, number>();
  for (const urge of inRange) if (urge.trigger) counts.set(urge.trigger, (counts.get(urge.trigger) ?? 0) + 1);
  return {
    total: inRange.length,
    resisted: inRange.filter(urge => urge.outcome === 'resisted').length,
    slipped: inRange.filter(urge => urge.outcome === 'slipped').length,
    topTriggers: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}

export type LoopStep = {
  id: 'plan' | 'checkin' | 'trades' | 'journal' | 'tomorrow';
  label: string;
  done: boolean;
  hint: string;
};

/** The five things that make a day "journaled". Everything on the Today screen hangs off this list. */
export function dayLoop(data: Workspace, date: string): LoopStep[] {
  const day = data.days[date];
  const tomorrow = data.days[addDays(date, 1)];
  const trades = data.trades.filter(trade => trade.date === date);
  const planned = !!day && (day.tasks.length > 0 || day.priorities.some(p => p.trim()));
  const checkedIn = !!day && day.smoking !== 'unset' && day.abstinence !== 'unset';
  const tradesDone =
    trades.length > 0
      ? trades.every(trade =>
          trade.status === 'closed'
            ? !needsReview(trade)
            : !!trade.thesis.trim() && trade.followedPlan !== 'unset',
        )
      : !!day?.noTrade;
  const journaled = !!day && !!(day.journal.trim() || day.win.trim() || day.lesson.trim());
  const tomorrowPlanned =
    !!tomorrow && (tomorrow.tasks.length > 0 || tomorrow.priorities.some(p => p.trim()));
  return [
    { id: 'plan', label: 'Plan', done: planned, hint: 'Set priorities or tasks' },
    { id: 'checkin', label: 'Check-in', done: checkedIn, hint: 'Log both habits' },
    {
      id: 'trades',
      label: 'Trades',
      done: tradesDone,
      hint: trades.length ? 'Document open trades and review closed trades' : 'Log a trade or mark no trade',
    },
    { id: 'journal', label: 'Journal', done: journaled, hint: 'Write a line' },
    { id: 'tomorrow', label: 'Tomorrow', done: tomorrowPlanned, hint: 'Plan tomorrow' },
  ];
}

/** Consecutive fully completed days, ending today if complete, otherwise yesterday. */
export function loopStreak(data: Workspace, today: string): number {
  const complete = (date: string) => dayLoop(data, date).every(step => step.done);
  let cursor = complete(today) ? today : addDays(today, -1);
  let streak = 0;
  while (complete(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function applicationsThisWeek(data: Workspace, date: string): number {
  const start = weekStart(date);
  const end = addDays(start, 6);
  return data.applications.filter(app => app.appliedOn >= start && app.appliedOn <= end).length;
}

export function daysSinceBackup(lastBackupAt: string | null, today: string): number | null {
  if (!lastBackupAt) return null;
  return Math.round(
    (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastBackupAt.slice(0, 10)}T12:00:00Z`)) / 86400000,
  );
}
