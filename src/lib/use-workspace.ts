'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkspace, isWorkspace, normalizeWorkspace, todayIn } from './domain';
import { createDemo } from './demo';
import { deepEqual, mergeWorkspaces } from './merge';
import { createClient } from './supabase/client';
import type { UpdateWorkspace, Workspace } from './types';

export type SaveStatus = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';

const DEMO_KEY = 'journal26-demo-v1';
const RETRY_DELAYS = [5000, 15000, 30000, 60000];
const SAVE_DELAY = 600;

/** Unsaved work on this device. Survives a closed tab, a dead battery and a lost connection. */
type Draft = { doc: Workspace; base: Workspace; at: string };
const draftKey = (userId: string) => `journal26-draft-${userId}`;

function readDraft(userId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    return isWorkspace(draft.doc) && isWorkspace(draft.base) ? draft : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String(error.message);
  return 'Could not connect.';
}

export function useWorkspace({ demo, userId }: { demo: boolean; userId?: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const current = useRef<Workspace | null>(null);
  /** Last version known to be in the cloud: the common ancestor for three-way merges. */
  const base = useRef<Workspace | null>(null);
  const resolved = useRef<Workspace | null>(null);
  const revision = useRef(0);
  const editSequence = useRef(0);
  const savedSequence = useRef(0);
  const saving = useRef(false);
  const blocked = useRef(false);
  const mounted = useRef(true);
  const failures = useRef(0);
  const loadGeneration = useRef(0);
  const demoSnapshot = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const forgotten = useRef(false);

  const hasUnsaved = () => editSequence.current !== savedSequence.current;

  const writeDraft = useCallback(() => {
    if (forgotten.current || demo || !userId || !current.current || !base.current) return false;
    try {
      const draft: Draft = { doc: current.current, base: base.current, at: new Date().toISOString() };
      localStorage.setItem(draftKey(userId), JSON.stringify(draft));
      return true;
    } catch {
      /* Storage full or disabled: the leave-page warning and unsaved banner still protect the user. */
      return false;
    }
  }, [demo, userId]);

  const clearDraft = useCallback(() => {
    if (!userId) return;
    try {
      localStorage.removeItem(draftKey(userId));
    } catch {
      /* Nothing to clear if storage is unavailable. */
    }
  }, [userId]);

  const schedule = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), delay);
  }, []);

  /** Another device saved first. Combine both sets of edits, and only ask when they truly collide. */
  const resolveStale = useCallback(
    async (snapshot: Workspace) => {
      const { data: row, error: readError } = await createClient()
        .from('workspaces')
        .select('document, revision')
        .eq('user_id', userId!)
        .single();
      if (readError) throw readError;
      if (!isWorkspace(row.document)) throw new Error('The saved journal format is not supported.');
      const remote = normalizeWorkspace(row.document);
      const first = mergeWorkspaces(base.current ?? snapshot, snapshot, remote);
      const latest = current.current ?? snapshot;
      const second = latest === snapshot ? first : mergeWorkspaces(snapshot, latest, first.value);
      const paths = [...first.conflicts, ...(latest === snapshot ? [] : second.conflicts)];
      revision.current = row.revision;
      base.current = remote;
      current.current = second.value;
      if (mounted.current) setData(second.value);
      if (paths.length) {
        blocked.current = true;
        resolved.current = second.value;
        writeDraft();
        if (mounted.current) {
          setConflicts(paths);
          setStatus('conflict');
          setError('The same field was edited on two devices. Everything else has been combined.');
        }
        return;
      }
      if (deepEqual(second.value, remote)) {
        savedSequence.current = editSequence.current;
        clearDraft();
        if (mounted.current) {
          setPending(false);
          setStatus('saved');
        }
        return;
      }
      editSequence.current++;
    },
    [userId, writeDraft, clearDraft],
  );

  const flush = useCallback(async () => {
    if (!current.current || saving.current || blocked.current || !hasUnsaved()) return;
    saving.current = true;
    let failed = false;
    setStatus('saving');
    const snapshot = current.current;
    const sequence = editSequence.current;
    try {
      if (demo) {
        const json = JSON.stringify(snapshot);
        if (localStorage.getItem(DEMO_KEY) !== demoSnapshot.current) {
          blocked.current = true;
          setStatus('conflict');
          setError('The local demo changed in another tab. Reload to see the latest version.');
          return;
        }
        localStorage.setItem(DEMO_KEY, json);
        demoSnapshot.current = json;
      } else {
        if (!userId) throw new Error('Your session is missing. Sign in again.');
        const expected = revision.current;
        const { data: row, error: saveError } = await createClient()
          .from('workspaces')
          .update({ document: snapshot, revision: expected + 1 })
          .eq('user_id', userId)
          .eq('revision', expected)
          .select('revision')
          .maybeSingle();
        if (saveError) throw saveError;
        if (!row) {
          await resolveStale(snapshot);
          failures.current = 0;
          if (mounted.current)
            setError(
              blocked.current
                ? 'The same field was edited on two devices. Everything else has been combined.'
                : null,
            );
          return;
        }
        revision.current = row.revision;
        base.current = snapshot;
      }
      failures.current = 0;
      savedSequence.current = sequence;
      if (!hasUnsaved()) clearDraft();
      else writeDraft();
      if (!mounted.current) return;
      setError(null);
      setPending(hasUnsaved());
      setStatus(hasUnsaved() ? 'saving' : 'saved');
    } catch (failure) {
      failed = true;
      writeDraft();
      const delay = RETRY_DELAYS[Math.min(failures.current, RETRY_DELAYS.length - 1)];
      failures.current++;
      if (mounted.current) {
        setStatus('error');
        setError(
          demo
            ? `Could not save in this browser. Storage may be full. ${errorMessage(failure)}`
            : `Not synced yet, but your changes are kept on this device and will retry automatically. ${errorMessage(failure)}`,
        );
        schedule(delay);
      }
    } finally {
      saving.current = false;
      if (mounted.current && !failed && !blocked.current && hasUnsaved()) schedule(0);
    }
  }, [demo, userId, resolveStale, clearDraft, writeDraft, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setStatus('loading');
    setError(null);
    try {
      let document: unknown;
      let rowRevision = 0;
      if (demo) {
        const stored = localStorage.getItem(DEMO_KEY);
        document = stored ? JSON.parse(stored) : createDemo(todayIn());
        const snapshot = stored ?? JSON.stringify(document);
        if (!stored) localStorage.setItem(DEMO_KEY, snapshot);
        demoSnapshot.current = snapshot;
      } else {
        if (!userId) throw new Error('Sign in to load your private journal.');
        const client = createClient();
        const { data: row, error: readError } = await client
          .from('workspaces')
          .select('document, revision')
          .eq('user_id', userId)
          .maybeSingle();
        if (readError) throw readError;
        if (row) {
          document = row.document;
          rowRevision = row.revision;
        } else {
          const { data: created, error: createError } = await client
            .from('workspaces')
            .insert({ user_id: userId, document: createWorkspace(), revision: 0 })
            .select('document, revision')
            .single();
          if (createError?.code === '23505') {
            const { data: existing, error: reloadError } = await client
              .from('workspaces')
              .select('document, revision')
              .eq('user_id', userId)
              .single();
            if (reloadError) throw reloadError;
            document = existing.document;
            rowRevision = existing.revision;
          } else {
            if (createError) throw createError;
            document = created.document;
            rowRevision = created.revision;
          }
        }
      }
      if (!isWorkspace(document))
        throw new Error('The saved journal format is not supported. Existing data has not been replaced.');
      if (!mounted.current || generation !== loadGeneration.current) return;
      const remote = normalizeWorkspace(document);
      revision.current = rowRevision;
      base.current = remote;
      blocked.current = false;
      failures.current = 0;
      resolved.current = null;
      setConflicts([]);

      const draft = !demo && userId ? readDraft(userId) : null;
      const merged = draft
        ? mergeWorkspaces(normalizeWorkspace(draft.base), normalizeWorkspace(draft.doc), remote)
        : null;
      if (merged && !deepEqual(merged.value, remote)) {
        current.current = merged.value;
        editSequence.current = 1;
        savedSequence.current = 0;
        setData(merged.value);
        setPending(true);
        setNotice('Recovered changes from this device that had not reached the cloud.');
        if (merged.conflicts.length) {
          blocked.current = true;
          resolved.current = merged.value;
          setConflicts(merged.conflicts);
          setStatus('conflict');
          setError('The same field was edited on two devices. Everything else has been combined.');
        } else {
          setStatus('saving');
          schedule(0);
        }
        return;
      }
      if (draft) clearDraft();
      current.current = remote;
      editSequence.current = 0;
      savedSequence.current = 0;
      setData(remote);
      setPending(false);
      setStatus('saved');
    } catch (failure) {
      if (!mounted.current || generation !== loadGeneration.current) return;
      setStatus('error');
      setError(`Could not load your journal. No existing data was replaced. ${errorMessage(failure)}`);
    }
  }, [demo, userId, clearDraft, schedule]);

  /** Pulls edits made on another device when you return to this one, before you can collide with them. */
  const refresh = useCallback(async () => {
    if (demo || !userId || !current.current || blocked.current || saving.current) return;
    if (hasUnsaved()) {
      void flushRef.current();
      return;
    }
    const sequence = editSequence.current;
    const client = createClient();
    const { data: head, error: headError } = await client
      .from('workspaces')
      .select('revision')
      .eq('user_id', userId)
      .maybeSingle();
    if (headError || !head || head.revision === revision.current) return;
    const { data: row, error: rowError } = await client
      .from('workspaces')
      .select('document, revision')
      .eq('user_id', userId)
      .single();
    if (rowError || !isWorkspace(row.document)) return;
    // Anything typed during the fetch wins this race; the save path will merge it.
    if (!mounted.current || editSequence.current !== sequence || saving.current) return;
    const remote = normalizeWorkspace(row.document);
    revision.current = row.revision;
    base.current = remote;
    current.current = remote;
    setData(remote);
  }, [demo, userId]);

  useEffect(() => {
    mounted.current = true;
    const start = setTimeout(() => void load(), 0);
    const generation = loadGeneration;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (forgotten.current || !hasUnsaved()) return;
      if (!writeDraft()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const onHide = () => {
      if (hasUnsaved()) {
        writeDraft();
        void flushRef.current();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
      else void refresh();
    };
    const onOnline = () => {
      failures.current = 0;
      void flushRef.current();
      void refresh();
    };
    const onFocus = () => void refresh();
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false;
      generation.current++;
      clearTimeout(start);
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, refresh, writeDraft, demo]);

  const update: UpdateWorkspace = useCallback(
    updater => {
      if (!current.current) return;
      const next = updater(current.current);
      if (next === current.current) return;
      current.current = next;
      editSequence.current++;
      setData(next);
      setPending(true);
      setNotice(null);
      if (!blocked.current) setStatus('saving');
      writeDraft();
      schedule(SAVE_DELAY);
    },
    [writeDraft, schedule],
  );

  const retry = useCallback(() => {
    if (!current.current) {
      void load();
      return;
    }
    if (status === 'conflict') return;
    failures.current = 0;
    void flushRef.current();
  }, [load, status]);

  /** Resolve a true conflict in favour of this device, keeping everything already combined. */
  const keepMine = useCallback(() => {
    if (!resolved.current) return;
    current.current = resolved.current;
    resolved.current = null;
    blocked.current = false;
    editSequence.current++;
    setConflicts([]);
    setError(null);
    setPending(true);
    setStatus('saving');
    void flushRef.current();
  }, []);

  /** Resolve a true conflict in favour of the cloud. The discarded draft is downloaded first. */
  const reload = useCallback(() => {
    if (saving.current) {
      setError('A save is still in progress. Please wait before reloading.');
      return;
    }
    if (current.current && hasUnsaved()) {
      const blob = new Blob([JSON.stringify(current.current, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `journal26-unsaved-${todayIn()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (
        !window.confirm(
          'Your unsaved draft was downloaded as JSON. Replace it here with the latest cloud version?',
        )
      )
        return;
    }
    clearDraft();
    if (timer.current) clearTimeout(timer.current);
    editSequence.current = 0;
    savedSequence.current = 0;
    void load();
  }, [load, clearDraft]);

  /** Called on sign-out: nothing from this account stays on the device, and nothing is written back. */
  const forgetDevice = useCallback(() => {
    forgotten.current = true;
    clearDraft();
  }, [clearDraft]);

  return { data, update, status, error, notice, conflicts, retry, reload, keepMine, forgetDevice, pending };
}
