'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkspace, isWorkspace, todayIn } from './domain';
import { createDemo } from './demo';
import { createClient } from './supabase/client';
import type { UpdateWorkspace, Workspace } from './types';

export type SaveStatus = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';
const DEMO_KEY = 'journal26-demo-v1';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Could not connect. Your unsaved changes are still here. Please retry.';
}

export function useWorkspace({ demo, userId }: { demo: boolean; userId?: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = useRef<Workspace | null>(null);
  const revision = useRef(0);
  const editSequence = useRef(0);
  const savedSequence = useRef(0);
  const saving = useRef(false);
  const blocked = useRef(false);
  const mounted = useRef(true);
  const loadGeneration = useRef(0);
  const demoSnapshot = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const flush = useCallback(async () => {
    if (!current.current || saving.current || blocked.current || editSequence.current === savedSequence.current) return;
    saving.current = true;
    setStatus('saving'); setError(null);
    const snapshot = current.current;
    const sequence = editSequence.current;
    try {
      if (demo) {
        const json = JSON.stringify(snapshot);
        if (localStorage.getItem(DEMO_KEY) !== demoSnapshot.current) {
          blocked.current = true;
          setStatus('conflict');
          setError('The local demo changed in another tab. Export this draft, then reload the latest saved version.');
          return;
        }
        localStorage.setItem(DEMO_KEY, json);
        demoSnapshot.current = json;
      } else {
        if (!userId) throw new Error('Your session is missing. Export your changes, then sign in again.');
        const expected = revision.current;
        const { data: row, error: saveError } = await createClient().from('workspaces')
          .update({ document: snapshot, revision: expected + 1 })
          .eq('user_id', userId).eq('revision', expected).select('revision').maybeSingle();
        if (saveError) throw saveError;
        if (!row) {
          blocked.current = true;
          setStatus('conflict');
          setError('This journal changed in another tab or device. Export your local draft, then reload the latest version. Your current draft has not been overwritten.');
          return;
        }
        revision.current = row.revision;
      }
      savedSequence.current = sequence;
      if (!mounted.current) return;
      const stillPending = editSequence.current !== sequence;
      setPending(stillPending);
      setStatus(stillPending ? 'saving' : 'saved');
    } catch (failure) {
      blocked.current = true;
      if (mounted.current) {
        setStatus('error');
        setError(demo ? `Could not save on this browser. Storage may be full or disabled. Export your draft before leaving. ${errorMessage(failure)}` : `Cloud save failed. Your changes remain in this tab; export them before closing. ${errorMessage(failure)}`);
      }
    } finally {
      saving.current = false;
      if (mounted.current && !blocked.current && editSequence.current !== savedSequence.current) {
        timer.current = setTimeout(() => void flushRef.current(), 0);
      }
    }
  }, [demo, userId]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setStatus('loading'); setError(null);
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
        const { data: row, error: readError } = await client.from('workspaces').select('document, revision').eq('user_id', userId).maybeSingle();
        if (readError) throw readError;
        if (row) { document = row.document; rowRevision = row.revision; }
        else {
          const fresh = createWorkspace();
          const { data: created, error: createError } = await client.from('workspaces').insert({ user_id: userId, document: fresh, revision: 0 }).select('document, revision').single();
          if (createError?.code === '23505') {
            const { data: existing, error: reloadError } = await client.from('workspaces').select('document, revision').eq('user_id', userId).single();
            if (reloadError) throw reloadError;
            document = existing.document; rowRevision = existing.revision;
          } else {
            if (createError) throw createError;
            document = created.document; rowRevision = created.revision;
          }
        }
      }
      if (!isWorkspace(document)) throw new Error('The saved journal format is not supported. Existing data has not been replaced.');
      if (!mounted.current || generation !== loadGeneration.current) return;
      revision.current = rowRevision;
      current.current = document;
      editSequence.current = 0; savedSequence.current = 0; blocked.current = false;
      setData(document); setPending(false); setStatus('saved');
    } catch (failure) {
      if (!mounted.current || generation !== loadGeneration.current) return;
      blocked.current = true;
      setStatus('error');
      setError(`Could not load your journal. No existing data was replaced. ${errorMessage(failure)}`);
    }
  }, [demo, userId]);

  const invalidateLoad = useCallback(() => { loadGeneration.current++; }, []);

  useEffect(() => {
    mounted.current = true;
    const start = setTimeout(() => void load(), 0);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (editSequence.current !== savedSequence.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false;
      invalidateLoad();
      clearTimeout(start);
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [load, invalidateLoad]);

  const update: UpdateWorkspace = useCallback(updater => {
    if (!current.current) return;
    const next = updater(current.current);
    if (next === current.current) return;
    current.current = next;
    editSequence.current++;
    setData(next); setPending(true);
    if (!blocked.current) setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 600);
  }, []);

  const retry = useCallback(() => {
    if (!current.current) { void load(); return; }
    if (status === 'conflict') return;
    blocked.current = false;
    void flushRef.current();
  }, [load, status]);

  const reload = useCallback(() => {
    if (saving.current) { setError('A save is still in progress. Please wait before reloading.'); return; }
    if (current.current && editSequence.current !== savedSequence.current) {
      const blob = new Blob([JSON.stringify(current.current, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `journal26-unsaved-${todayIn()}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (!window.confirm('Your unsaved draft was exported as JSON. Reload the latest saved journal and replace the draft in this tab?')) return;
    }
    if (timer.current) clearTimeout(timer.current);
    void load();
  }, [load]);

  return { data, update, status, error, retry, reload, pending };
}
