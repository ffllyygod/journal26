import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isConfigured, supabaseConfig } from './config';

export async function createClient() {
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server components cannot write cookies; proxy refreshes them. */
        }
      },
    },
  });
}

export async function requireUser() {
  if (!isConfigured()) redirect('/login');
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect('/login');
  return user;
}
