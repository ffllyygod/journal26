import { addDays, createWorkspace, emptyDay } from './domain';
import type { Workspace } from './types';

export function createDemo(today: string): Workspace {
  const data = createWorkspace(addDays(today, -8));
  data.settings = { ...data.settings, name: 'Alex', configured: true };
  for (let i = 1; i <= 8; i++) {
    const date = addDays(today, -i);
    data.days[date] = {
      ...emptyDay(),
      smoking: 'kept',
      abstinence: i === 5 ? 'slip' : 'kept',
      careerMinutes: 150 + i * 5,
      tradingMinutes: 120 + i * 10,
      journal: 'Showed up for the work. Kept distractions out of my first study block.',
      win: 'Finished the practice session I planned.',
      mood: 4,
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
  data.trades = [
    sample(1, 8, 'XAUUSD', 'long', 'Break and retest', 38),
    sample(2, 7, 'BTC', 'short', 'Range rejection', -21, {
      emotion: 'FOMO',
      followedPlan: 'no',
      grade: 'C',
      mistakes: ['Chased entry'],
    }),
    sample(3, 6, 'XAUUSD', 'long', 'Break and retest', 44),
    sample(4, 4, 'ETH', 'long', 'Trend pullback', -19, { mistakes: ['Entered early'], grade: 'B' }),
    sample(5, 3, 'XAUUSD', 'short', 'Range rejection', 26, { session: 'newyork' }),
    sample(6, 1, 'XAUUSD', 'long', 'Break and retest', -41, {
      emotion: 'Rushed',
      followedPlan: 'no',
      grade: 'C',
      mistakes: ['Oversized', 'No setup'],
      review: '',
    }),
    {
      ...sample(7, 0, 'BTC', 'long', 'Trend pullback', 0),
      status: 'open' as const,
      netPnl: null,
      exit: null,
      followedPlan: 'unset' as const,
      review: '',
      grade: '' as const,
    },
  ];
  data.urges = [
    {
      id: 'demo-urge-1',
      at: `${addDays(today, -1)}T15:30:00.000Z`,
      date: addDays(today, -1),
      habit: 'smoking',
      intensity: 4,
      trigger: 'Lost a trade',
      note: '',
      outcome: 'resisted',
    },
    {
      id: 'demo-urge-2',
      at: `${addDays(today, -2)}T17:30:00.000Z`,
      date: addDays(today, -2),
      habit: 'abstinence',
      intensity: 3,
      trigger: 'Late night',
      note: '',
      outcome: 'resisted',
    },
  ];
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
