/**
 * Hook for bulk link panel state and handlers
 */
import React from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { GraphChangeEntry } from '../../../hooks';
import type { LinkCandidate } from './bulkLinkUtils';
import { computeAndValidateCandidates, confirmAndCreateLinks } from './bulkLinkHandlers';

interface UseBulkLinkPanelOptions {
  isVisible: boolean;
  mode: 'edit' | 'view';
  isLocked: boolean;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  updateEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  onClose: () => void;
  recordGraphChanges?: (before: GraphChangeEntry[], after: GraphChangeEntry[]) => void;
}

export function useBulkLinkPanel({
  isVisible,
  mode,
  isLocked,
  getNodes,
  getEdges,
  updateEdges,
  onClose,
  recordGraphChanges
}: UseBulkLinkPanelOptions) {
  const [sourcePattern, setSourcePattern] = React.useState('');
  const [targetPattern, setTargetPattern] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [pendingCandidates, setPendingCandidates] = React.useState<LinkCandidate[] | null>(null);
  const sourceInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isVisible) {
      setStatus(null);
      setPendingCandidates(null);
      setTimeout(() => sourceInputRef.current?.focus(), 0);
    }
  }, [isVisible]);

  const canApply = mode === 'edit' && !isLocked;

  const handleCancel = React.useCallback(() => {
    setPendingCandidates(null);
    setStatus(null);
    onClose();
  }, [onClose]);

  const handleCompute = React.useCallback(() => {
    computeAndValidateCandidates(
      getNodes(),
      getEdges(),
      sourcePattern,
      targetPattern,
      setStatus,
      setPendingCandidates
    );
  }, [getNodes, getEdges, sourcePattern, targetPattern]);

  const handleConfirmCreate = React.useCallback(() => {
    confirmAndCreateLinks({
      nodes: getNodes(),
      edges: getEdges(),
      pendingCandidates,
      canApply,
      updateEdges,
      recordGraphChanges,
      setStatus,
      setPendingCandidates,
      onClose
    });
  }, [getNodes, getEdges, pendingCandidates, canApply, updateEdges, recordGraphChanges, onClose]);

  const handleDismissConfirm = React.useCallback(() => {
    setPendingCandidates(null);
  }, []);

  return {
    sourcePattern,
    setSourcePattern,
    targetPattern,
    setTargetPattern,
    status,
    pendingCandidates,
    sourceInputRef,
    canApply,
    handleCancel,
    handleCompute,
    handleConfirmCreate,
    handleDismissConfirm
  };
}
