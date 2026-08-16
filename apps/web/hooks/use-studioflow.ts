'use client';

import { useContext } from 'react';
import { StudioFlowContext } from '@/providers/studioflow-provider';

export function useStudioFlow() {
  const context = useContext(StudioFlowContext);

  if (!context) {
    throw new Error('useStudioFlow must be used within StudioFlowProvider.');
  }

  return context;
}
