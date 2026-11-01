'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function ResetForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirm'))) { setError('The passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace('/journal');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not reset your password. Try again.'); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}><p>Choose a new password of at least 12 characters.</p>
    <label className="field"><span>New password</span><input type="password" name="password" autoComplete="new-password" minLength={12} required/></label>
    <label className="field"><span>Confirm password</span><input type="password" name="confirm" autoComplete="new-password" minLength={12} required/></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password & open journal'}</button>
  </form>;
}
