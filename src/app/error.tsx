'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <div className="panel loading-panel">
        <h1>This page could not load</h1>
        <p>Your saved journal has not been changed.</p>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
