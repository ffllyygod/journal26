import { breakdown } from './analytics.ts';
import { money, tradeR } from './domain.ts';
import type { Trade, Workspace } from './types.ts';

/**
 * Patterns across habits, trades, focus and cravings. These are counts from a small personal
 * sample, so every rule has a minimum sample, reports its evidence, and never claims a cause.
 */
export type Insight = {
  id: string;
  tone: 'warn' | 'good' | 'info';
  title: string;
  evidence: string;
};

const MIN_GROUP = 3;
const closed = (trades: Trade[]) => trades.filter(t => t.status === 'closed' && t.netPnl !== null);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Average per trade, in R when every trade in both groups has a risk set, otherwise in money. */
function compare(a: Trade[], b: Trade[], currency: string) {
  const useR = [...a, ...b].every(t => tradeR(t) !== null);
  const score = (group: Trade[]) => mean(group.map(t => (useR ? tradeR(t)! : t.netPnl!)));
  const format = (value: number) =>
    useR ? `${value > 0 ? '+' : ''}${value.toFixed(2)}R` : money(value, currency);
  return { a: score(a), b: score(b), format };
}

export function hourIn(iso: string, timezone: string): number {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return Number(text);
}

const WINDOWS = [
  { name: 'late at night', label: '10pm to 2am', hours: [22, 23, 0, 1] },
  { name: 'in the early morning', label: '2am to 10am', hours: [2, 3, 4, 5, 6, 7, 8, 9] },
  { name: 'around midday', label: '10am to 4pm', hours: [10, 11, 12, 13, 14, 15] },
  { name: 'in the evening', label: '4pm to 10pm', hours: [16, 17, 18, 19, 20, 21] },
];

function tradingInsights(data: Workspace, slipDates: Set<string>): Insight[] {
  const currency = data.settings.currency;
  const trades = closed(data.trades);
  const out: Insight[] = [];

  const onPlan = trades.filter(t => t.followedPlan === 'yes');
  const offPlan = trades.filter(t => t.followedPlan === 'no');
  if (onPlan.length >= MIN_GROUP && offPlan.length >= MIN_GROUP) {
    const { a, b, format } = compare(onPlan, offPlan, currency);
    if (a !== b)
      out.push({
        id: 'plan',
        tone: a > b ? 'warn' : 'info',
        title:
          a > b
            ? `Breaking your plan costs you: ${format(b)} a trade off plan, ${format(a)} on plan.`
            : `Off-plan trades are doing better (${format(b)} against ${format(a)}). Your plan may need rewriting.`,
        evidence: `${onPlan.length} on plan, ${offPlan.length} off plan`,
      });
  }

  const slipTrades = trades.filter(t => slipDates.has(t.date));
  const cleanTrades = trades.filter(t => !slipDates.has(t.date));
  if (slipTrades.length >= 2 && cleanTrades.length >= MIN_GROUP) {
    const { a, b, format } = compare(slipTrades, cleanTrades, currency);
    if (a < b)
      out.push({
        id: 'slip-trades',
        tone: 'warn',
        title: `You trade worse on slip days: ${format(a)} a trade, against ${format(b)} on other days.`,
        evidence: `${plural(slipTrades.length, 'trade')} on slip days, ${cleanTrades.length} on other days`,
      });
  }

  const feeling = breakdown(trades, t => t.emotion)[0];
  if (feeling && feeling.count >= 2 && feeling.net < 0)
    out.push({
      id: 'feeling',
      tone: 'warn',
      title: `Trades entered feeling ${feeling.key.toLowerCase()} have cost you ${money(-feeling.net, currency)}.`,
      evidence: plural(feeling.count, 'trade'),
    });

  const mistake = breakdown(trades, t => t.mistakes)[0];
  if (mistake && mistake.count >= 2 && mistake.net < 0)
    out.push({
      id: 'mistake',
      tone: 'warn',
      title: `Your most expensive mistake is “${mistake.key.toLowerCase()}”: ${money(-mistake.net, currency)} so far.`,
      evidence: plural(mistake.count, 'trade'),
    });

  const setups = breakdown(trades, t => t.setup).filter(row => row.count >= MIN_GROUP);
  const best = setups[setups.length - 1];
  if (best && best.net > 0)
    out.push({
      id: 'setup',
      tone: 'good',
      title: `“${best.key}” is your best setup: ${money(best.net, currency)} at a ${Math.round(best.winRate)}% win rate.`,
      evidence: plural(best.count, 'trade'),
    });
  return out;
}

function cravingInsights(data: Workspace): Insight[] {
  const out: Insight[] = [];
  const urges = data.urges;
  if (urges.length < 4) return out;
  const counts = WINDOWS.map(window => ({
    window,
    count: urges.filter(urge => window.hours.includes(hourIn(urge.at, data.settings.timezone))).length,
  })).sort((a, b) => b.count - a.count);
  const peak = counts[0];
  if (peak.count >= 3 && peak.count / urges.length >= 0.5)
    out.push({
      id: 'craving-time',
      tone: 'info',
      title: `Cravings cluster ${peak.window.name} (${peak.window.label}). Plan that window in advance.`,
      evidence: `${peak.count} of ${urges.length} logged cravings`,
    });
  const triggers = new Map<string, number>();
  for (const urge of urges)
    if (urge.trigger) triggers.set(urge.trigger, (triggers.get(urge.trigger) ?? 0) + 1);
  const top = [...triggers.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3 && top[1] / urges.length >= 0.4)
    out.push({
      id: 'craving-trigger',
      tone: 'info',
      title: `“${top[0]}” is your most common trigger.`,
      evidence: `${top[1]} of ${urges.length} logged cravings`,
    });
  return out;
}

function dayInsights(data: Workspace, today: string, slipDates: Set<string>): Insight[] {
  const out: Insight[] = [];
  const past = Object.entries(data.days).filter(([date]) => date < today);
  const focus = (day: (typeof past)[number][1]) => day.careerMinutes + day.tradingMinutes;

  const slipDays = past.filter(([date]) => slipDates.has(date));
  const cleanDays = past.filter(
    ([date, day]) => !slipDates.has(date) && (day.smoking === 'kept' || day.abstinence === 'kept'),
  );
  if (slipDays.length >= 2 && cleanDays.length >= MIN_GROUP) {
    const slip = mean(slipDays.map(([, day]) => focus(day)));
    const clean = mean(cleanDays.map(([, day]) => focus(day)));
    if (clean - slip >= 45)
      out.push({
        id: 'slip-focus',
        tone: 'warn',
        title: `Slip days cost focus: about ${Math.round(((clean - slip) / 60) * 10) / 10}h less than other days.`,
        evidence: `${slipDays.length} slip days, ${cleanDays.length} other days`,
      });
  }

  const target = data.settings.careerTarget + data.settings.tradingTarget;
  const moodDays = past.filter(([, day]) => day.mood !== null);
  const high = moodDays.filter(([, day]) => focus(day) >= target * 0.75);
  const low = moodDays.filter(([, day]) => focus(day) < target * 0.75);
  if (high.length >= MIN_GROUP && low.length >= MIN_GROUP) {
    const highMood = mean(high.map(([, day]) => day.mood!));
    const lowMood = mean(low.map(([, day]) => day.mood!));
    if (highMood - lowMood >= 0.5)
      out.push({
        id: 'focus-mood',
        tone: 'good',
        title: `You feel better on days you do the work: mood ${highMood.toFixed(1)} of 5 near your focus target, ${lowMood.toFixed(1)} below it.`,
        evidence: `${high.length} days near target, ${low.length} below`,
      });
  }

  const applied = data.applications.filter(app => app.appliedOn);
  const reached = applied.filter(app => app.status === 'interview' || app.status === 'offer');
  if (applied.length >= 8 && reached.length === 0)
    out.push({
      id: 'applications',
      tone: 'warn',
      title: `${applied.length} applications and no interviews yet. Change the resume or the roles before sending more.`,
      evidence: `${applied.length} applications`,
    });
  else if (applied.length >= 8)
    out.push({
      id: 'applications',
      tone: 'info',
      title: `${Math.round((reached.length / applied.length) * 100)}% of your applications reach an interview.`,
      evidence: `${reached.length} of ${applied.length} applications`,
    });
  return out;
}

const TONE_ORDER = { warn: 0, good: 1, info: 2 };

export function findInsights(data: Workspace, today: string): Insight[] {
  const slipDates = new Set(
    Object.entries(data.days)
      .filter(([date, day]) => date <= today && (day.smoking === 'slip' || day.abstinence === 'slip'))
      .map(([date]) => date),
  );
  return [
    ...tradingInsights(data, slipDates),
    ...dayInsights(data, today, slipDates),
    ...cravingInsights(data),
  ].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
