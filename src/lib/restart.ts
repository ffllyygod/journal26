import { createWorkspace } from './domain.ts';
import type { Workspace } from './types.ts';

/** Matches the date range supported by challenge settings, without normalizing invalid days. */
export function isRestartDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2020-01-01' || value > '2100-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Erases journal records while retaining preferences. The caller handles backup and confirmation. */
export function restartWorkspace(workspace: Workspace, startDate: string): Workspace {
  if (!isRestartDate(startDate)) throw new Error('Choose a valid start date between 2020 and 2100.');
  return {
    ...createWorkspace(startDate),
    resetId: crypto.randomUUID(),
    settings: { ...structuredClone(workspace.settings), startDate, lastBackupAt: null },
  };
}
