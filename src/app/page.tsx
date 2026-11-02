import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConfigured } from '@/lib/supabase/config';

export default function Home() {
  if (isConfigured()) redirect('/journal');
  return (
    <main className="setup-page">
      <div className="setup-card">
        <span className="brand">journal26</span>
        <h1>Sixty days, one square at a time</h1>
        <p>
          A private daily log for quitting two habits, learning to trade and landing a job. Each evening takes
          five steps, and the data starts to show how they affect each other.
        </p>
        <div className="welcome-board" aria-hidden="true">
          {Array.from({ length: 60 }, (_, index) => (
            <i key={index} className={`board-level-${index < 21 ? [5, 4, 5, 3, 5, 5, 2][index % 7] : 0}`} />
          ))}
        </div>
        <Link className="button button-primary" href="/demo">
          Open the demo
        </Link>
        <p className="muted">
          The demo uses sample data and stays in this browser. To connect the private journal, follow{' '}
          <code>docs/SETUP.md</code>, then <Link href="/login">sign in</Link>.
        </p>
      </div>
    </main>
  );
}
