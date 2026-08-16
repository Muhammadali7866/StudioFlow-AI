import type { Metadata } from 'next';
import { StudioFlowProvider } from '@/providers/studioflow-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'StudioFlow AI',
    template: '%s · StudioFlow AI',
  },
  description: 'Agentic media workflows for creator publishing teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StudioFlowProvider>{children}</StudioFlowProvider>
      </body>
    </html>
  );
}
