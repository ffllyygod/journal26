import { Workspace } from '@/components/workspace';
import { requireUser } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function JournalPage() {
  const user = await requireUser();
  return <Workspace userId={user.id} />;
}
