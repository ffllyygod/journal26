const DAY_MS = 86_400_000;
const FIRST_DAY = Date.UTC(2026, 10, 1);

export const writingPromptCategories = [
  {
    label: 'Small win',
    questions: [
      'What is one small thing you are glad you did?',
      'What felt a little easier today than it used to?',
      'Where did you give yourself a little credit today?',
      'What did you make time for, even briefly?',
    ],
  },
  {
    label: 'On my mind',
    questions: [
      'What has been taking up space in your head?',
      'What would you like to understand a little better?',
      'What do you need more of right now?',
      'What thought would feel lighter if you wrote it down?',
    ],
  },
  {
    label: 'A moment',
    questions: [
      'What is one moment from today you want to remember?',
      'What small detail caught your attention today?',
      'What surprised you, even a little?',
      'When did you feel most present today?',
    ],
  },
  {
    label: 'Let it go',
    questions: [
      'What can you leave on this page for tonight?',
      'What can wait until tomorrow?',
      'What would you say to a friend who had your day?',
      'What expectation can you loosen for tonight?',
    ],
  },
] as const;

/** Calendar dates choose prompts without depending on the device clock or timezone. */
export function writingPrompt(date: string, category: number, advances = 0): string {
  const group = writingPromptCategories[category] ?? writingPromptCategories[0];
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === date;
  const day = valid ? Math.round((timestamp - FIRST_DAY) / DAY_MS) : 0;
  const offset = Number.isFinite(advances) ? Math.trunc(advances) : 0;
  const index = (((day + offset) % group.questions.length) + group.questions.length) % group.questions.length;
  return group.questions[index];
}
