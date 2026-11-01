'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="loading-page"><div className="panel loading-panel"><h1>Let’s try that again.</h1><p>This page couldn’t load. Your saved journal hasn’t been changed.</p><button className="button button-primary" onClick={reset}>Try again</button></div></main>; }
