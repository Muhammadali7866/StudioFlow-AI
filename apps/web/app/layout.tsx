import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StudioFlow AI — Video Production Engine',
  description: 'Production-ready AI video workspace foundation built with Next.js, Express, and Google ADK',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
