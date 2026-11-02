import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Newsreader } from 'next/font/google';
import './globals.css';

// The interface speaks in the sans. Anything the owner wrote is set in the serif.
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Journal26',
  description: 'A private daily log for a 60-day challenge: habits, trades, focus and job search.',
  robots: { index: false, follow: false },
  applicationName: 'Journal26',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Journal26' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef0f4' },
    { media: '(prefers-color-scheme: dark)', color: '#10131c' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
