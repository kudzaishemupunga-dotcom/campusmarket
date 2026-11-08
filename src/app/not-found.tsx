import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="standalone-state">
      <p className="eyebrow">404 · PAGE NOT FOUND</p>
      <h1>This page or project listing could not be found.</h1>
      <p>The address may have changed, or the product is awaiting school administrator review.</p>
      <div className="button-row">
        <Link className="button primary" href="/">
          Return home
        </Link>
        <Link className="button secondary" href="/marketplace">
          Open marketplace
        </Link>
      </div>
    </main>
  );
}
