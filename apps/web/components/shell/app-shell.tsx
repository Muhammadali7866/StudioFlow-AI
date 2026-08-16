'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <div className="min-w-0 flex-1">
        <Topbar onOpenNavigation={() => setNavigationOpen(true)} />
        {children}
      </div>
    </div>
  );
}
