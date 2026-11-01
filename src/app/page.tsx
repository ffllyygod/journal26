import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConfigured } from '@/lib/supabase/config';
import { Icon } from '@/components/ui';
export default function Home() {
  if (isConfigured()) redirect('/journal');
  return (
    <main className="welcome-page">
      <header>
        <Link className="brand" href="/">
          journal<span>26</span>
          <i />
        </Link>
        <span className="eyebrow">A LITTLE BETTER, EVERY DAY.</span>
      </header>
      <div className="welcome-content">
        <div className="welcome-copy">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Make a little
            <br />
            room for <em>you.</em>
          </h1>
          <p>
            A quiet space for your plans, your progress, and the person you’re becoming. One honest day at a
            time.
          </p>
          <Link className="button button-primary" href="/demo">
            Explore the working demo <Icon name="arrow" size={18} />
          </Link>
          <span className="welcome-note">
            No account needed for the demo. Sample data stays on this device.
          </span>
          <div className="welcome-features">
            <span>
              <Icon name="sun" size={18} /> Plan with intention
            </span>
            <span>
              <Icon name="book" size={18} /> Reflect honestly
            </span>
            <span>
              <Icon name="leaf" size={18} /> Keep showing up
            </span>
          </div>
        </div>
        <div className="welcome-journal">
          <span className="eyebrow">A NOTE TO MY FUTURE SELF</span>
          <h2>
            These days
            <br />
            will add up.
          </h2>
          <p>
            I don’t need a perfect plan.
            <br />I need a place to begin.
          </p>
          <div className="welcome-line" />
          <span className="handwritten">one day at a time.</span>
          <Icon name="leaf" size={85} />
        </div>
      </div>
      <section className="welcome-setup">
        <Icon name="lock" size={21} />
        <div>
          <strong>Your private journal needs one more step.</strong>
          <p>
            Connect Supabase to enable password sign-in, private images, and cloud sync. Deployment
            instructions are in the repository’s <code>docs/SETUP.md</code>.
          </p>
        </div>
        <Link className="text-button" href="/login">
          Set up sign-in <Icon name="arrow" size={16} />
        </Link>
      </section>
    </main>
  );
}
