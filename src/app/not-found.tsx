import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="loading-page">
      <div className="panel loading-panel">
        <h1>Page not found</h1>
        <Link className="button button-primary" href="/">
          Back to Journal26
        </Link>
      </div>
    </main>
  );
}
