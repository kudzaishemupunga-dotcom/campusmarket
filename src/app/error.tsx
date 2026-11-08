'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main id="main" className="standalone-state"><p className="eyebrow">LET’S TRY THAT AGAIN</p><h1>Something didn’t load.</h1><p>We couldn’t reach the marketplace. Your changes may not have been saved.</p><div className="button-row"><button className="button primary" onClick={reset}>Try again</button><Link className="button secondary" href="/">Back to home</Link></div></main>; }
