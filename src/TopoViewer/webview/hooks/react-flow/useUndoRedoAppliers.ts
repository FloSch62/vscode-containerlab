/**
 * Undo/Redo Action Appliers
 * Functions to apply undo/redo actions to the graph state
 */
import React, { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { CyElement } from '../../../shared/types/messages';
import type {
  NodePositionEntry,
  GraphChange,
  UndoRedoActionPropertyEdit,
  UndoRedoActionAnnotation,
  UndoRedoAction
} from '../state/useUndoRedo';
import { log } from '../../utils/logger';
import { createNode as createNodeService, createLink as createLinkService, deleteNode as deleteNodeService, deleteLink as deleteLinkService, editNode as editNodeService, editLink as editLinkService, type NodeSaveData, type LinkSaveData } from '../../services';
import { convertEditorDataToNodeSaveData } from '../../../shared/utilities/nodeEditorConversions';
import { convertEditorDataToLinkSaveData } from '../../utils/linkEditorConversions';

const TOPOLOGY_NODE_TYPE = 'topology-node';
const TOPOLOGY_EDGE_TYPE = 'topology-edge';

// Action type constants
const ACTION_MOVE = 'move';
const ACTION_GRAPH = 'graph';
const ACTION_PROPERTY_EDIT = 'property-edit';
const ACTION_ANNOTATION = 'annotation';

const NODE_FALLBACK_PROPS = ['kind', 'type', 'image', 'group', 'topoViewerRole', 'iconColor', 'iconCornerRadius', 'interfacePattern'] as const;

function mergeNodeExtraData(data: Record<string, unknown>): NodeSaveData['extraData'] {
  const extraData = (data.extraData ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...extraData };
  for (const key of NODE_FALLBACK_PROPS) {
    if (merged[key] === undefined && data[key] !== undefined) {
      merged[key] = data[key];
    }
  }
  return merged;
}

function buildNodeSaveDataFromElement(element: CyElement): NodeSaveData {
  const data = element.data as Record<string, unknown>;
  const position = element.position ?? (data.extraData as Record<string, unknown> | undefined)?.position as { x: number; y: number } | undefined;
  return {
    id: data.id as string,
    name: (data.name as string) || (data.id as string),
    position: position ?? { x: 0, y: 0 },
    extraData: mergeNodeExtraData(data)
  };
}

function buildLinkSaveDataFromElement(element: CyElement): LinkSaveData {
  const data = element.data as Record<string, unknown>;
  return {
    id: data.id as string,
    source: data.source as string,
    target: data.target as string,
    sourceEndpoint: (data.sourceEndpoint as string) || '',
    targetEndpoint: (data.targetEndpoint as string) || ''
  };
}

/** Helper context for graph change handlers */
interface ChangeContext {
  addNode: (node: CyElement) => void;
  addEdge: (edge: CyElement) => void;
  removeNodeAndEdges: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNodes: (updater: (nodes: Node[]) => Node[]) => void;
  updateEdges: (updater: (edges: Edge[]) => Edge[]) => void;
}

/** Restore a deleted node (undo delete) */
function restoreNode(element: CyElement, ctx: ChangeContext): void {
  const data = element.data as Record<string, unknown>;
  const extraData = data.extraData as Record<string, unknown> || {};
  const position = extraData.position as { x: number; y: number } || { x: 0, y: 0 };
  log.info(`[UndoRedo] Restoring deleted node: ${data.id}`);
  ctx.addNode(element);
  ctx.updateNodes(nds => [...nds, { id: data.id as string, type: TOPOLOGY_NODE_TYPE, position, data }]);
  void createNodeService(buildNodeSaveDataFromElement(element));
}

/** Re-delete a node (redo delete) */
function reDeleteNode(element: CyElement, ctx: ChangeContext): void {
  const nodeId = (element.data as Record<string, unknown>).id as string;
  log.info(`[UndoRedo] Re-deleting node: ${nodeId}`);
  ctx.removeNodeAndEdges(nodeId);
  ctx.updateNodes(nds => nds.filter(n => n.id !== nodeId));
  ctx.updateEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  void deleteNodeService(nodeId);
}

/** Restore a deleted edge (undo delete) */
function restoreEdge(element: CyElement, ctx: ChangeContext): void {
  const data = element.data as Record<string, unknown>;
  log.info(`[UndoRedo] Restoring deleted edge: ${data.id}`);
  ctx.addEdge(element);
  ctx.updateEdges(eds => [...eds, {
    id: data.id as string,
    source: data.source as string,
    target: data.target as string,
    type: TOPOLOGY_EDGE_TYPE,
    data
  }]);
  void createLinkService(buildLinkSaveDataFromElement(element));
}

/** Re-delete an edge (redo delete) */
function reDeleteEdge(element: CyElement, ctx: ChangeContext): void {
  const edgeId = (element.data as Record<string, unknown>).id as string;
  log.info(`[UndoRedo] Re-deleting edge: ${edgeId}`);
  ctx.removeEdge(edgeId);
  ctx.updateEdges(eds => eds.filter(e => e.id !== edgeId));
  void deleteLinkService(buildLinkSaveDataFromElement(element));
}

/** Apply a single graph change */
function applySingleChange(change: GraphChange, isUndo: boolean, ctx: ChangeContext): void {
  if (change.kind === 'delete') {
    if (change.entity === 'node') {
      if (isUndo && change.before) restoreNode(change.before, ctx);
      else if (!isUndo && change.after) reDeleteNode(change.after, ctx);
    } else if (change.entity === 'edge') {
      if (isUndo && change.before) restoreEdge(change.before, ctx);
      else if (!isUndo && change.after) reDeleteEdge(change.after, ctx);
    }
    return;
  }

  if (change.kind === 'add') {
    const element = change.after ?? change.before;
    if (!element) return;
    if (change.entity === 'node') {
      if (isUndo) reDeleteNode(element, ctx);
      else restoreNode(element, ctx);
    } else if (change.entity === 'edge') {
      if (isUndo) reDeleteEdge(element, ctx);
      else restoreEdge(element, ctx);
    }
  }
}

export interface UseUndoRedoAppliersOptions {
  setNodePositions: (positions: NodePositionEntry[]) => void;
  addNode: (node: CyElement) => void;
  addEdge: (edge: CyElement) => void;
  removeNodeAndEdges: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNodes: (updater: (nodes: Node[]) => Node[]) => void;
  updateEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  applyAnnotationChange?: (action: UndoRedoActionAnnotation, isUndo: boolean) => void;
  isApplyingRef: React.RefObject<boolean>;
}

export interface UseUndoRedoAppliersReturn {
  applyAction: (action: UndoRedoAction, isUndo: boolean) => void;
}

/** Apply property edit action */
function applyPropertyEditAction(action: UndoRedoActionPropertyEdit, isUndo: boolean): void {
  const dataToApply = isUndo ? action.before : action.after;
  if (action.entityType === 'node') {
    const saveData = convertEditorDataToNodeSaveData(dataToApply as any);
    void editNodeService(saveData);
  } else {
    const saveData = convertEditorDataToLinkSaveData(dataToApply as any);
    void editLinkService(saveData);
  }
  log.info(`[UndoRedo] Applied ${action.entityType} property ${isUndo ? 'undo' : 'redo'} for ${action.entityId}`);
}

/** Create the apply action callback */
function createApplyAction(
  ctx: ChangeContext,
  setNodePositions: (positions: NodePositionEntry[]) => void,
  isApplyingRef: React.RefObject<boolean>,
  applyAnnotationChange?: (action: UndoRedoActionAnnotation, isUndo: boolean) => void
) {
  return (action: UndoRedoAction, isUndo: boolean) => {
    switch (action.type) {
      case ACTION_MOVE:
        setNodePositions(isUndo ? action.before : action.after);
        break;
      case ACTION_GRAPH:
        isApplyingRef.current = true;
        for (const change of (isUndo ? action.before : action.after)) applySingleChange(change, isUndo, ctx);
        isApplyingRef.current = false;
        break;
      case ACTION_PROPERTY_EDIT:
        applyPropertyEditAction(action, isUndo);
        break;
      case ACTION_ANNOTATION:
        applyAnnotationChange?.(action, isUndo);
        break;
    }
  };
}

/**
 * Hook for undo/redo action appliers
 */
export function useUndoRedoAppliers(options: UseUndoRedoAppliersOptions): UseUndoRedoAppliersReturn {
  const {
    setNodePositions, addNode, addEdge, removeNodeAndEdges, removeEdge,
    updateNodes, updateEdges, applyAnnotationChange, isApplyingRef
  } = options;

  const applyAction = useMemo(() => {
    const ctx: ChangeContext = { addNode, addEdge, removeNodeAndEdges, removeEdge, updateNodes, updateEdges };
    return createApplyAction(ctx, setNodePositions, isApplyingRef, applyAnnotationChange);
  }, [addNode, addEdge, removeNodeAndEdges, removeEdge, updateNodes, updateEdges, setNodePositions, isApplyingRef, applyAnnotationChange]);

  return { applyAction };
}
