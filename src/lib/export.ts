import { attachmentUrl } from './storage';
import type { Workspace } from './types';

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJson(data: Workspace) {
  download(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        attachmentNote:
          'Cloud attachments are private storage paths. Use the complete backup to include image bytes.',
        workspace: data,
      },
      null,
      2,
    ),
    `journal26-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
  );
}
export async function exportComplete(data: Workspace, demo: boolean) {
  const images: Record<string, string> = {};
  const attachments = [
    ...Object.values(data.days).flatMap(d => d.attachments),
    ...data.trades.flatMap(t => t.attachments),
  ];
  for (const attachment of attachments) {
    if (images[attachment.id]) continue;
    const url = await attachmentUrl(attachment, demo);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Could not download ${attachment.name}. Retry the backup; the text-only export is still available.`,
      );
    const blob = await response.blob();
    images[attachment.id] = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read an image.'));
      reader.readAsDataURL(blob);
    });
  }
  download(
    JSON.stringify({ exportedAt: new Date().toISOString(), workspace: data, images }, null, 2),
    `journal26-complete-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
  );
}
export function exportMarkdown(data: Workspace) {
  const lines = [
    '# Journal26',
    '',
    data.settings.intention,
    '',
    `Challenge: ${data.settings.startDate} · ${data.settings.duration} days`,
    '',
  ];
  for (const [date, day] of Object.entries(data.days).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(
      `## ${date}`,
      '',
      '### Priorities',
      ...day.priorities.filter(Boolean).map(p => `- ${p}`),
      '',
      '### Tasks',
      ...day.tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title} (${t.track}, ${t.minutes} min)`),
      '',
      `Focus: career ${day.careerMinutes} min; trading ${day.tradingMinutes} min`,
      `${data.settings.habitLabels.smoking}: ${day.smoking}; ${data.settings.habitLabels.abstinence}: ${day.abstinence}`,
      day.noTrade ? `No trade: ${day.noTradeReason || 'by decision'}` : '',
      '',
      day.journal,
      '',
      `Win: ${day.win}`,
      `Lesson: ${day.lesson}`,
      day.trigger ? `Trigger reflection: ${day.trigger}` : '',
      day.attachments.length
        ? `Images: ${day.attachments.map(a => a.name).join(', ')} (use complete JSON backup for image files)`
        : '',
      '',
    );
  }
  lines.push('## Trades', '');
  for (const trade of data.trades)
    lines.push(
      `### ${trade.date} · ${trade.symbol} · ${trade.direction} · ${trade.account}`,
      `Setup: ${trade.setup}`,
      `Status: ${trade.status}; Entry: ${trade.entry}; Exit: ${trade.exit ?? '—'}; Net P&L: ${trade.netPnl ?? '—'} ${data.settings.currency}`,
      '',
      trade.thesis,
      '',
      trade.review,
      '',
    );
  lines.push('## Career', '');
  for (const app of data.applications)
    lines.push(
      `- ${app.company} — ${app.role} (${app.status}). Follow-up: ${app.followUp || 'none'}. ${app.notes}`,
    );
  lines.push('', '## Learning', '');
  for (const note of data.learning) lines.push(`### ${note.date}: ${note.topic}`, note.notes, note.url, '');
  lines.push('## Weekly reflections', '');
  for (const [week, reflection] of Object.entries(data.weeklyNotes))
    lines.push(`### Week of ${week}`, reflection, '');
  lines.push('## One change for each week', '');
  for (const [week, change] of Object.entries(data.weeklyCommitments))
    if (change.trim()) lines.push(`- Week of ${week}: ${change}`);
  lines.push('');
  download(lines.join('\n'), 'journal26-journal.md', 'text/markdown;charset=utf-8');
}
