import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Journal26 — A little better, every day', description: 'Your private space to plan, reflect, and build your next chapter.', robots: { index: false, follow: false }, applicationName: 'Journal26', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Journal26' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f8f3' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
