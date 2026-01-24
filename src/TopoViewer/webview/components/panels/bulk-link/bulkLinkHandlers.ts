/**
 * Handler functions for bulk link operations
 */
import type { Edge, Node } from '@xyflow/react';
import { beginBatch, endBatch, createLink } from '../../../services';
import type { GraphChangeEntry } from '../../../hooks';
import { computeCandidates, buildBulkEdges, buildUndoRedoEntries, type LinkCandidate } from './bulkLinkUtils';
import type { CyElement } from '../../../../shared/types/messages';

type SetStatus = (status: string | null) => void;
type SetCandidates = (candidates: LinkCandidate[] | null) => void;

type UpdateEdges = (updater: (edges: Edge[]) => Edge[]) => void;

function cyEdgeToReactFlow(edge: CyElement): Edge {
  const data = edge.data as Record<string, unknown>;
  return {
    id: String(data.id || ''),
    source: String(data.source || ''),
    target: String(data.target || ''),
    type: 'topology-edge',
    data: {
      sourceEndpoint: String(data.sourceEndpoint || ''),
      targetEndpoint: String(data.targetEndpoint || ''),
      linkStatus: 'unknown'
    }
  };
}

export async function sendBulkEdgesToExtension(edges: CyElement[]): Promise<void> {
  beginBatch();
  try {
    for (const edge of edges) {
      const data = edge.data as Record<string, unknown>;
      await createLink({
        id: String(data.id || ''),
        source: String(data.source || ''),
        target: String(data.target || ''),
        sourceEndpoint: String(data.sourceEndpoint || ''),
        targetEndpoint: String(data.targetEndpoint || '')
      });
    }
  } finally {
    await endBatch();
  }
}

export function computeAndValidateCandidates(
  nodes: Node[],
  edges: Edge[],
  sourcePattern: string,
  targetPattern: string,
  setStatus: SetStatus,
  setPendingCandidates: SetCandidates
): void {
  if (!nodes.length) {
    setStatus('Topology not ready yet.');
    return;
  }
  if (!sourcePattern.trim() || !targetPattern.trim()) {
    setStatus('Enter both Source Pattern and Target Pattern.');
    return;
  }

  const candidates = computeCandidates(nodes, edges, sourcePattern.trim(), targetPattern.trim());
  if (candidates.length === 0) {
    setStatus('No new links would be created with the specified patterns.');
    return;
  }

  setPendingCandidates(candidates);
  setStatus(null);
}

interface ConfirmCreateParams {
  nodes: Node[];
  edges: Edge[];
  pendingCandidates: LinkCandidate[] | null;
  canApply: boolean;
  updateEdges?: UpdateEdges;
  recordGraphChanges?: (before: GraphChangeEntry[], after: GraphChangeEntry[]) => void;
  setStatus: SetStatus;
  setPendingCandidates: SetCandidates;
  onClose: () => void;
}

export function confirmAndCreateLinks({
  nodes,
  edges,
  pendingCandidates,
  canApply,
  updateEdges,
  recordGraphChanges,
  setStatus,
  setPendingCandidates,
  onClose
}: ConfirmCreateParams): void {
  if (!pendingCandidates) return;
  if (!canApply) {
    setStatus('Unlock the lab to create links.');
    setPendingCandidates(null);
    return;
  }

  const newEdges = buildBulkEdges(nodes, edges, pendingCandidates);
  if (newEdges.length === 0) {
    setStatus('No new links to create.');
    setPendingCandidates(null);
    return;
  }

  const { before, after } = buildUndoRedoEntries(newEdges);
  void sendBulkEdgesToExtension(newEdges);
  updateEdges?.((current) => [...current, ...newEdges.map(cyEdgeToReactFlow)]);
  recordGraphChanges?.(before, after);

  setPendingCandidates(null);
  setStatus(null);
  onClose();
}
