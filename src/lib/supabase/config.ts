// The Vercel Marketplace Supabase integration may provide either key name.
const publicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey());
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicKey();
  if (!url || !key)
    throw new Error('Supabase is not configured. Follow docs/SETUP.md to connect your private journal.');
  return { url, key };
}
