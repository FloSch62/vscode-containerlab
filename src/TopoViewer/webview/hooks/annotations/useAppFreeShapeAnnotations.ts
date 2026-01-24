/**
 * Hook for integrating free shape annotations into App.tsx
 */
import React from 'react';
import { FreeShapeAnnotation } from '../../../shared/types/topology';
import { useFreeShapeAnnotations } from './useFreeShapeAnnotations';

interface InitialData {
  freeShapeAnnotations?: unknown[];
}

interface TopologyDataMessage {
  type: string;
  data?: {
    freeShapeAnnotations?: FreeShapeAnnotation[];
  };
}

interface UseAppFreeShapeAnnotationsOptions {
  mode: 'edit' | 'view';
  isLocked: boolean;
  onLockedAction: () => void;
}

export function useAppFreeShapeAnnotations(options: UseAppFreeShapeAnnotationsOptions) {
  const { mode, isLocked, onLockedAction } = options;

  const freeShapeAnnotations = useFreeShapeAnnotations({
    mode,
    isLocked,
    onLockedAction
  });

  const { loadAnnotations } = freeShapeAnnotations;

  React.useEffect(() => {
    const initialData = (window as unknown as { __INITIAL_DATA__?: InitialData }).__INITIAL_DATA__;
    if (initialData?.freeShapeAnnotations?.length) {
      loadAnnotations(initialData.freeShapeAnnotations as FreeShapeAnnotation[]);
    }

    const handleMessage = (event: MessageEvent<TopologyDataMessage>) => {
      const message = event.data;
      if (message?.type === 'topology-data' && message.data?.freeShapeAnnotations) {
        loadAnnotations(message.data.freeShapeAnnotations);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAnnotations]);

  return freeShapeAnnotations;
}
