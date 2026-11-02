import Link from 'next/link';
import { isConfigured } from '@/lib/supabase/config';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link className="brand" href="/">
          journal26
        </Link>
        <h1>Sign in</h1>
        {isConfigured() ? (
          <LoginForm />
        ) : (
          <div className="setup-notice">
            <h2>Connect your private journal</h2>
            <p>
              The database is not connected yet. Add the Supabase environment variables and run the database
              migration using the setup guide in the repository.
            </p>
            <p>
              Your private journal will require an email and password. The demo below is separate and saves
              only on this browser.
            </p>
          </div>
        )}
        {!isConfigured() && (
          <Link className="text-button auth-demo" href="/demo">
            Open the demo
          </Link>
        )}
      </div>
    </main>
  );
}
