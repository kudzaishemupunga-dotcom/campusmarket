import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CampusMarket · Wise Owl Westgate Student Project Marketplace',
    template: '%s · CampusMarket Wise Owl Westgate',
  },
  description:
    'A school-supervised digital marketplace showcasing real products designed and built through learner projects at Wise Owl High School Westgate, Harare.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('campusmarket-theme')==='dark')document.documentElement.dataset.theme='dark'}catch{}`,
          }}
        />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
