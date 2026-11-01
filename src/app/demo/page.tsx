import { redirect } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import { isConfigured } from '@/lib/supabase/config';

export default function DemoPage() {
  // Once the private journal exists, the browser-only sandbox is a place to lose real entries.
  if (isConfigured()) redirect('/journal');
  return <Workspace demo />;
}
