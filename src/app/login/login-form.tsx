'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    try {
      const client = createClient();
      if (recovery) {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        setMessage(
          'If this email belongs to your account, a password reset link is on its way. Check your inbox and spam folder.',
        );
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password: String(form.get('password') ?? ''),
        });
        if (error) throw error;
        router.replace('/journal');
        router.refresh();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Email address</span>
        <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </label>
      {!recovery && (
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <button className="button button-primary" disabled={busy} type="submit">
        {busy ? 'Please wait…' : recovery ? 'Send reset link' : 'Open my journal →'}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => {
          setRecovery(!recovery);
          setError('');
          setMessage('');
        }}
      >
        {recovery ? 'Back to sign in' : 'Forgot password?'}
      </button>
    </form>
  );
}
