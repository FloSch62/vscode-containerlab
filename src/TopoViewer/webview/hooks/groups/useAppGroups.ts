/**
 * App-level hook for group management.
 * Provides handlers for group operations with UI integration.
 *
 * [MIGRATION] Migrate to @xyflow/react - replace node selection logic
 */
import { useCallback, useEffect } from 'react';
import type { GroupStyleAnnotation, NodeAnnotation } from '../../../shared/types/topology';
import { useGroups } from './useGroups';
import { buildGroupId } from './groupHelpers';

interface InitialData {
  groupStyleAnnotations?: unknown[];
  nodeAnnotations?: NodeAnnotation[];
}

interface TopologyDataMessage {
  type: string;
  data?: {
    groupStyleAnnotations?: GroupStyleAnnotation[];
    nodeAnnotations?: NodeAnnotation[];
  };
}

type MembershipEntry = { nodeId: string; groupId: string };

/**
 * Extract group memberships from node annotations.
 */
function extractMemberships(nodeAnnotations: NodeAnnotation[] | undefined): MembershipEntry[] {
  if (!nodeAnnotations) return [];
  return nodeAnnotations
    .map(ann => {
      if (ann.groupId) {
        return { nodeId: ann.id, groupId: ann.groupId };
      }
      if (ann.group && ann.level) {
        return { nodeId: ann.id, groupId: buildGroupId(ann.group, ann.level) };
      }
      return null;
    })
    .filter((entry): entry is MembershipEntry => entry !== null);
}

  // [MIGRATION] TODO: Add canBeGrouped filter when ReactFlow node selection is implemented
// Will filter out annotation nodes (freeText, freeShape) from group membership

interface UseAppGroupsOptions {
  mode: 'edit' | 'view';
  isLocked: boolean;
  onLockedAction?: () => void;
  nodes?: Array<{ id: string; position: { x: number; y: number }; data: Record<string, unknown> }>;
  viewport?: { x: number; y: number; zoom: number };
  containerSize?: { width: number; height: number };
}

/**
 * Hook for loading groups and memberships from initial data.
 */
function useGroupDataLoader(
  loadGroups: (groups: GroupStyleAnnotation[]) => void,
  initializeMembership: (memberships: MembershipEntry[]) => void
): void {
  useEffect(() => {
    const initialData = (window as unknown as { __INITIAL_DATA__?: InitialData }).__INITIAL_DATA__;
    const groups = initialData?.groupStyleAnnotations as GroupStyleAnnotation[] | undefined;
    if (groups?.length) loadGroups(groups);

    const memberships = extractMemberships(initialData?.nodeAnnotations);
    if (memberships.length) initializeMembership(memberships);

    const handleMessage = (event: MessageEvent<TopologyDataMessage>) => {
      const data = event.data?.data;
      if (event.data?.type !== 'topology-data' || !data) return;
      if (data.groupStyleAnnotations) loadGroups(data.groupStyleAnnotations);
      initializeMembership(extractMemberships(data.nodeAnnotations));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadGroups, initializeMembership]);
}

export function useAppGroups(options: UseAppGroupsOptions) {
  const { mode, isLocked, onLockedAction, nodes, viewport, containerSize } = options;

  const groupsHook = useGroups({ mode, isLocked, onLockedAction, nodes, viewport, containerSize });
  useGroupDataLoader(groupsHook.loadGroups, groupsHook.initializeMembership);

  const handleAddGroup = useCallback(() => {
    // [MIGRATION] Use ReactFlow selection instead of legacy selection
    const groupId = groupsHook.createGroup();
    if (groupId) groupsHook.editGroup(groupId);
  }, [groupsHook]);

  return { groups: groupsHook, handleAddGroup };
}
