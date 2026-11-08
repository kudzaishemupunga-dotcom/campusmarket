import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
export const metadata: Metadata = { title: { default: 'CampusMarket · A little less new. A lot more you.', template: '%s · CampusMarket' }, description: 'A private school marketplace for pre-loved books, supplies and everyday essentials.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('campusmarket-theme')==='dark')document.documentElement.dataset.theme='dark'}catch{}` }} /><a className="skip-link" href="#main">Skip to content</a>{children}<Toaster position="bottom-right" richColors closeButton /></body></html>;
}
