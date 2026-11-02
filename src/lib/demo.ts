import { addDays, createWorkspace, currentDay, emptyDay, weekStart } from './domain';
import type { Workspace } from './types';

export function createDemo(today = currentDay(createWorkspace().settings)): Workspace {
  const data = createWorkspace(addDays(today, -8));
  data.settings = { ...data.settings, name: 'Alex', configured: true };
  // Eight varied past days, so the board and the patterns have something real to show.
  const notes = [
    'Rough day after the morning loss. Walked away from the charts by noon.',
    'Late night, poor sleep, and everything felt harder than it needed to be.',
    'Quiet market, so I put the time into interview prep instead.',
    'Two good study blocks. Sent applications before lunch.',
    'Slipped in the evening. Wrote down what led to it before bed.',
    'Waited for the retest and it paid. Stayed patient.',
    'Solid focus until the news release, then called it.',
    'First proper week. Kept distractions out of my first study block.',
  ];
  const slipOn: Record<number, 'smoking' | 'abstinence'> = { 2: 'smoking', 5: 'abstinence' };
  for (let i = 1; i <= 8; i++) {
    const date = addDays(today, -i);
    const slipped = slipOn[i];
    data.days[date] = {
      ...emptyDay(),
      priorities: ['Keep the first study block free', 'One application', ''],
      smoking: slipped === 'smoking' ? 'slip' : 'kept',
      abstinence: slipped === 'abstinence' ? 'slip' : 'kept',
      careerMinutes: slipped ? 70 : 150 + i * 12,
      tradingMinutes: slipped ? 45 : 120 + i * 9,
      journal: notes[i - 1],
      mood: slipped ? 2 : i % 3 === 0 ? 3 : 4,
      noTrade: i === 3,
      noTradeReason: i === 3 ? 'No setup, spent the time on interview prep' : '',
    };
  }
  data.days[today] = {
    ...emptyDay(),
    priorities: [
      'Build something worth showing.',
      'Study one setup, deeply.',
      'Keep the promises I made to myself.',
    ],
    tasks: [
      {
        id: 'demo-task-1',
        title: 'Practice React interview questions',
        track: 'career',
        minutes: 60,
        done: true,
      },
      {
        id: 'demo-task-2',
        title: 'Ship one portfolio improvement',
        track: 'career',
        minutes: 90,
        done: false,
      },
      {
        id: 'demo-task-3',
        title: 'Review XAUUSD market structure',
        track: 'trading',
        minutes: 60,
        done: false,
      },
      {
        id: 'demo-task-4',
        title: 'Send two thoughtful job applications',
        track: 'career',
        minutes: 45,
        done: false,
      },
    ],
    careerMinutes: 60,
    tradingMinutes: 0,
  };
  data.learning = [
    {
      id: 'demo-learning-1',
      date: addDays(today, -1),
      topic: 'React rendering & memoization',
      notes:
        'Explain the problem before reaching for useMemo. Built a small example to test my understanding.',
      url: '',
    },
  ];
  const base = {
    time: '19:15',
    session: 'london' as const,
    account: 'demo' as const,
    status: 'closed' as const,
    size: '0.01 lots',
    risk: 20,
    fees: 1,
    emotion: 'Calm',
    followedPlan: 'yes' as const,
    grade: 'A' as const,
    mistakes: [] as string[],
    rulesChecked: [] as string[],
    thesis: 'Sample: retest of prior high with a clear invalidation.',
    review: 'Sample entry. Executed the plan.',
    attachments: [],
  };
  const sample = (
    index: number,
    daysAgo: number,
    symbol: string,
    direction: 'long' | 'short',
    setup: string,
    netPnl: number,
    extra = {},
  ) => ({
    ...base,
    id: `demo-trade-${index}`,
    date: addDays(today, -daysAgo),
    symbol,
    direction,
    setup,
    netPnl,
    entry: 2700,
    exit: 2710,
    stop: direction === 'long' ? 2690 : 2710,
    target: direction === 'long' ? 2720 : 2680,
    ...extra,
  });
  const offPlan = { followedPlan: 'no' as const, grade: 'C' as const };
  data.trades = [
    sample(1, 8, 'XAUUSD', 'long', 'Break and retest', 38),
    sample(2, 7, 'BTC', 'short', 'Range rejection', -21, {
      ...offPlan,
      emotion: 'FOMO',
      mistakes: ['Chased entry'],
    }),
    sample(3, 7, 'XAUUSD', 'long', 'Break and retest', 30),
    sample(4, 6, 'XAUUSD', 'long', 'Break and retest', 44),
    sample(5, 5, 'BTC', 'long', 'Trend pullback', -28, {
      ...offPlan,
      emotion: 'FOMO',
      mistakes: ['Chased entry'],
      session: 'newyork',
    }),
    sample(6, 4, 'ETH', 'long', 'Trend pullback', -19, { mistakes: ['Entered early'], grade: 'B' }),
    sample(7, 4, 'XAUUSD', 'short', 'Range rejection', 26, { session: 'newyork' }),
    sample(8, 2, 'XAUUSD', 'long', 'Break and retest', -34, {
      ...offPlan,
      emotion: 'Rushed',
      mistakes: ['Oversized'],
    }),
    sample(9, 1, 'XAUUSD', 'long', 'Break and retest', -41, {
      ...offPlan,
      emotion: 'Rushed',
      mistakes: ['Oversized', 'No setup'],
      review: '',
    }),
    {
      ...sample(10, 0, 'BTC', 'long', 'Trend pullback', 0),
      status: 'open' as const,
      netPnl: null,
      exit: null,
      followedPlan: 'unset' as const,
      review: '',
      grade: '' as const,
    },
  ];
  const urgeAt = (daysAgo: number, utc: string, habit: 'smoking' | 'abstinence', trigger: string) => ({
    id: `demo-urge-${daysAgo}-${utc}`,
    at: `${addDays(today, -daysAgo)}T${utc}:00.000Z`,
    date: addDays(today, -daysAgo),
    habit,
    intensity: 3,
    trigger,
    note: '',
    outcome: 'resisted' as const,
  });
  data.urges = [
    urgeAt(1, '17:30', 'smoking', 'Lost a trade'),
    urgeAt(2, '18:10', 'smoking', 'Late night'),
    urgeAt(3, '17:45', 'abstinence', 'Late night'),
    urgeAt(5, '19:00', 'abstinence', 'Late night'),
    urgeAt(6, '06:30', 'smoking', 'After a meal'),
  ];
  data.weeklyCommitments = { [weekStart(today)]: 'No trade within 15 minutes of a loss.' };
  data.applications = [
    {
      id: 'demo-app-1',
      company: 'Northwind Labs',
      role: 'Frontend developer',
      url: '',
      status: 'applied',
      appliedOn: addDays(today, -3),
      followUp: today,
      notes: 'Sample. Follow up with the recruiter.',
    },
  ];
  return data;
}
