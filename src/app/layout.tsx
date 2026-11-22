import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Wise Owl Hub · Study & Student Project Marketplace',
    template: '%s · Wise Owl Hub Westgate',
  },
  description:
    'Wise Owl Hub 5.0 unites Cambridge IGCSE study tools (OwlAid Study Mode, Interactive Quizzes, Flashcards) with CampusMarket for Wise Owl High School Westgate, Harare.',
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
