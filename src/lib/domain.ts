import type { DayEntry, HabitStatus, Settings, Trade, TradeSession, Workspace } from './types';

export function todayIn(timezone = 'Asia/Kolkata', now = new Date(), dayStartHour = 0): string {
  const shifted = new Date(now.getTime() - dayStartHour * 3600000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
/** The journal day right now, honouring the user's timezone and late-night day boundary. */
export function currentDay(settings: Pick<Settings, 'timezone' | 'dayStartHour'>, now = new Date()): string {
  return todayIn(settings.timezone, now, settings.dayStartHour);
}
export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function dayDifference(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' },
): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}
export function emptyDay(): DayEntry {
  return {
    priorities: ['', '', ''],
    tasks: [],
    journal: '',
    win: '',
    lesson: '',
    mood: null,
    careerMinutes: 0,
    tradingMinutes: 0,
    smoking: 'unset',
    abstinence: 'unset',
    trigger: '',
    noTrade: false,
    noTradeReason: '',
    attachments: [],
    closed: false,
  };
}
export const DEFAULT_RULES = [
  'Setup is in my playbook, not an impulse',
  'Stop is set before entry',
  'Risk is within my per-trade limit',
  'No high-impact news in the next 30 minutes',
  'I am calm, not chasing or revenge trading',
];
export const MISTAKE_TAGS = [
  'Entered early',
  'Chased entry',
  'Moved stop',
  'Oversized',
  'Exited early',
  'No setup',
  'Revenge trade',
  'Ignored news',
];
export const URGE_TRIGGERS = [
  'Stress',
  'Boredom',
  'After a meal',
  'Late night',
  'Lost a trade',
  'Phone / scrolling',
  'Social',
  'Lonely',
];
export function defaultSettings(start: string): Settings {
  return {
    name: '',
    startDate: start,
    duration: 60,
    timezone: 'Asia/Kolkata',
    careerTarget: 210,
    tradingTarget: 210,
    currency: 'USD',
    intention: 'Build a life I can be proud of, one honest day at a time.',
    configured: false,
    habitLabels: { smoking: 'Smoke-free', abstinence: 'Abstinence' },
    dayStartHour: 3,
    symbols: ['XAUUSD', 'BTC', 'ETH'],
    tradingRules: [...DEFAULT_RULES],
    maxTradesPerDay: 3,
    maxDailyLoss: null,
    weeklyApplicationTarget: 10,
    morningReminder: '08:00',
    eveningReminder: '22:00',
    urgePlan: '',
    lastBackupAt: null,
  };
}
export function createWorkspace(start = todayIn()): Workspace {
  return {
    version: 1,
    settings: defaultSettings(start),
    days: {},
    trades: [],
    applications: [],
    learning: [],
    weeklyNotes: {},
    weeklyCommitments: {},
    urges: [],
  };
}
/** Fills fields added after a document was first saved. Never removes anything it does not recognise. */
export function normalizeWorkspace(doc: Workspace): Workspace {
  const defaults = defaultSettings(doc.settings.startDate);
  const days: Workspace['days'] = {};
  for (const [date, day] of Object.entries(doc.days)) days[date] = { ...emptyDay(), ...day };
  return {
    ...doc,
    settings: {
      ...defaults,
      ...doc.settings,
      habitLabels: { ...defaults.habitLabels, ...doc.settings.habitLabels },
    },
    days,
    trades: doc.trades.map(trade => ({
      ...trade,
      time: trade.time ?? '',
      session: trade.session ?? '',
      grade: trade.grade ?? '',
      mistakes: trade.mistakes ?? [],
      rulesChecked: trade.rulesChecked ?? [],
    })),
    urges: doc.urges ?? [],
    weeklyCommitments: doc.weeklyCommitments ?? {},
  };
}
/** Approximate market session for an instant, by UTC hour. Editable on the trade form. */
export function sessionAt(now = new Date()): TradeSession {
  const hour = now.getUTCHours();
  if (hour >= 7 && hour < 13) return 'london';
  if (hour >= 13 && hour < 22) return 'newyork';
  return 'asia';
}
export function habitStreak(days: Workspace['days'], habit: 'smoking' | 'abstinence', today: string): number {
  let cursor = days[today]?.[habit] === 'unset' || !days[today] ? addDays(today, -1) : today;
  let streak = 0;
  while (days[cursor]?.[habit] === 'kept') {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
export function habitCount(
  days: Workspace['days'],
  habit: 'smoking' | 'abstinence',
  status: HabitStatus,
  through: string,
): number {
  return Object.entries(days).filter(([date, day]) => date <= through && day[habit] === status).length;
}
export function tradeR(trade: Trade): number | null {
  return trade.status === 'closed' && trade.netPnl !== null && trade.risk !== null && trade.risk > 0
    ? trade.netPnl / trade.risk
    : null;
}
export function tradeStats(trades: Trade[]) {
  const closed = trades.filter(t => t.status === 'closed' && t.netPnl !== null);
  const wins = closed.filter(t => t.netPnl! > 0);
  const reviewed = trades.filter(t => t.followedPlan !== 'unset');
  return {
    count: closed.length,
    net: closed.reduce((sum, t) => sum + t.netPnl!, 0),
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    adherence: reviewed.length
      ? (reviewed.filter(t => t.followedPlan === 'yes').length / reviewed.length) * 100
      : null,
  };
}
export function hours(minutes: number): string {
  if (minutes > 0 && minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}
export function money(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    amount,
  );
}
export function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Workspace>;
  return (
    v.version === 1 &&
    (v.resetId === undefined ||
      (typeof v.resetId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.resetId))) &&
    !!v.settings &&
    typeof v.settings.startDate === 'string' &&
    !!v.days &&
    typeof v.days === 'object' &&
    Array.isArray(v.trades) &&
    Array.isArray(v.applications) &&
    Array.isArray(v.learning) &&
    !!v.weeklyNotes
  );
}
