import { emptyDay } from './domain.ts';
import type { Workspace } from './types.ts';

/**
 * Three-way merge for the journal document, used when two devices saved different edits.
 * Non-overlapping edits combine automatically. When both devices changed the same field to
 * different values, this device's value is kept and the path is reported, so the UI can ask
 * rather than silently dropping someone's words.
 */
export type MergeResult<T> = { value: T; conflicts: string[] };

type Dict = Record<string, unknown>;
const isObject = (value: unknown): value is Dict =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isIdList = (value: unknown): value is { id: string }[] =>
  Array.isArray(value) && value.every(item => isObject(item) && typeof item.id === 'string');

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => key in b && deepEqual(a[key], b[key]));
  }
  return false;
}

function mergeValue(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string,
  conflicts: string[],
): unknown {
  if (deepEqual(local, remote)) return local;
  if (deepEqual(base, local)) return remote;
  if (deepEqual(base, remote)) return local;
  if (isObject(local) && isObject(remote)) {
    const safeBase = isObject(base) ? base : {};
    const merged: Dict = {};
    for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const value = mergeValue(
        safeBase[key],
        local[key],
        remote[key],
        path ? `${path}.${key}` : key,
        conflicts,
      );
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  if (isIdList(local) && isIdList(remote)) {
    const baseList = isIdList(base) ? base : [];
    const find = (list: { id: string }[], id: string) => list.find(item => item.id === id);
    const ids = [
      ...local.map(item => item.id),
      ...remote.map(item => item.id).filter(id => !find(local, id)),
    ];
    const merged: unknown[] = [];
    for (const id of ids) {
      const value = mergeValue(
        find(baseList, id),
        find(local, id),
        find(remote, id),
        `${path}[${id}]`,
        conflicts,
      );
      if (value !== undefined) merged.push(value);
    }
    return merged;
  }
  if (
    Array.isArray(base) &&
    Array.isArray(local) &&
    Array.isArray(remote) &&
    base.length === local.length &&
    local.length === remote.length
  )
    return local.map((item, index) =>
      mergeValue(base[index], item, remote[index], `${path}[${index}]`, conflicts),
    );
  conflicts.push(path);
  return local === undefined ? remote : local;
}

export function mergeThreeWay<T>(base: T, local: T, remote: T): MergeResult<T> {
  const conflicts: string[] = [];
  const value = mergeValue(base, local, remote, '', conflicts) as T;
  return { value, conflicts };
}

/**
 * A day appears the moment it is first edited, so two devices often both "create" the same day.
 * Their shared ancestor is an empty day, not nothing: without this every field would collide.
 */
export function mergeWorkspaces(
  base: Workspace,
  local: Workspace,
  remote: Workspace,
): MergeResult<Workspace> {
  const days = { ...base.days };
  for (const date of [...Object.keys(local.days), ...Object.keys(remote.days)]) days[date] ??= emptyDay();
  return mergeThreeWay({ ...base, days }, local, remote);
}

/** Turns a conflict path into a phrase the user recognises. */
export function describeConflict(path: string): string {
  const [root, key, field] = path.split('.');
  if (root === 'days' && key) return `${key}${field ? ` · ${field}` : ''}`;
  if (root === 'settings') return `Settings · ${key}`;
  if (root === 'weeklyNotes') return `Weekly reflection · ${key}`;
  const list = root.match(/^(trades|applications|learning|urges)/)?.[1];
  if (list)
    return `${{ trades: 'A trade', applications: 'An application', learning: 'A learning note', urges: 'A logged urge' }[list]}${key ? ` · ${key}` : ''}`;
  return path;
}
