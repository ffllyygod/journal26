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
  return data;
}
