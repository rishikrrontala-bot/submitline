import type { Metadata } from 'next';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Submitline — final checks before the judges arrive',
  description: 'Check your hackathon submission links and rules from a judge’s point of view. See evidence, blockers, and what still needs human review.',
  authors: [{ name: 'Rishik Rontala' }],
  openGraph: {
    title: 'Submitline',
    description: 'A judge-view preflight for hackathon submissions.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
