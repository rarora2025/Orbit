import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import './welcome.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Orbit',
  description:
    'Orbit helps you organize the people, projects, and opportunities shaping your career.',
};

export default function WelcomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${jakarta.variable} ${plexMono.variable}`}>{children}</div>;
}
