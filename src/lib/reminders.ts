import type { Settings } from './types.ts';

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const clock = (value: string) => value.replace(':', '') + '00';

function event(
  uid: string,
  start: string,
  time: string,
  count: number,
  summary: string,
  description: string,
  url: string,
  stamp: string,
) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@journal26`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start.replace(/-/g, '')}T${clock(time)}`,
    'DURATION:PT10M',
    `RRULE:FREQ=DAILY;COUNT=${count}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(`${description}\n${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/**
 * A repeating calendar file: phone-native reminders with no push server, no extra service and
 * no cost. Times are floating, so they follow the phone's local clock. Stable UIDs mean
 * re-importing updates the events on calendars that honour UIDs.
 */
export function buildReminderCalendar(
  settings: Pick<Settings, 'startDate' | 'duration' | 'morningReminder' | 'eveningReminder'>,
  origin: string,
  now = new Date(),
): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const url = `${origin}/journal`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Journal26//Reminders//EN',
    'CALSCALE:GREGORIAN',
    ...event(
      'morning',
      settings.startDate,
      settings.morningReminder,
      settings.duration,
      'Journal26: start your day',
      'Open today’s plan and pick your first task.',
      url,
      stamp,
    ),
    ...event(
      'evening',
      settings.startDate,
      settings.eveningReminder,
      settings.duration,
      'Journal26: close the day',
      'Check in, review trades, write one line, plan tomorrow.',
      url,
      stamp,
    ),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
