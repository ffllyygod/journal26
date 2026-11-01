import type { DayEntry, HabitStatus, Trade, Workspace } from './types';

export function todayIn(timezone = 'Asia/Kolkata', now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
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
  };
}
export function createWorkspace(start = todayIn()): Workspace {
  return {
    version: 1,
    settings: {
      name: '',
      startDate: start,
      duration: 60,
      timezone: 'Asia/Kolkata',
      careerTarget: 210,
      tradingTarget: 210,
      currency: 'USD',
      intention: 'Build a life I can be proud of, one honest day at a time.',
      configured: false,
    },
    days: {},
    trades: [],
    applications: [],
    learning: [],
    weeklyNotes: {},
  };
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
  return {
    count: closed.length,
    net: closed.reduce((sum, t) => sum + t.netPnl!, 0),
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    adherence: trades.length
      ? (trades.filter(t => t.followedPlan === 'yes').length / trades.length) * 100
      : null,
  };
}
export function hours(minutes: number): string {
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
