import Link from 'next/link';
import { isConfigured } from '@/lib/supabase/config';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return <main className="auth-page"><div className="auth-card">
    <Link className="brand" href="/">journal<span>26</span><span className="brand-dot">.</span></Link>
    <p className="eyebrow">A LITTLE BETTER, EVERY DAY</p>
    <h1>Your next chapter<br/><em>starts here.</em></h1>
    <p className="muted">A private place for your plans, progress, and honest reflections.</p>
    {isConfigured() ? <LoginForm/> : <div className="setup-notice">
      <h2>Connect your private journal</h2>
      <p>The database is not connected yet. Add the Supabase environment variables and run the database migration using the setup guide in the repository.</p>
      <p>Your private journal will require an email and password. The demo below is separate and saves only on this browser.</p>
    </div>}
    <Link className="text-button auth-demo" href="/demo">Explore the local demo →</Link>
    <p className="auth-footnote">Your journal. Your pace. One day at a time.</p>
  </div></main>;
}
