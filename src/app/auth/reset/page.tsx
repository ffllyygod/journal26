import Link from 'next/link';
import { isConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { ResetForm } from './reset-form';

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const client = isConfigured() ? await createClient() : null;
  const user = client ? (await client.auth.getUser()).data.user : null;
  return <main className="auth-page"><div className="auth-card"><Link className="brand" href="/">journal<span>26</span>.</Link><h1>A fresh start.</h1>
    {query.error || !user ? <><p className="form-error" role="alert">This reset link is invalid or expired. Request a new link and open it in the same browser you used to request it.</p><Link className="button button-primary" href="/login">Back to sign in</Link></> : <ResetForm/>}
  </div></main>;
}
