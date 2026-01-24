/**
 * Utility functions for bulk link creation
 */
import type { Node, Edge } from '@xyflow/react';
import { FilterUtils } from '../../../../../helpers/filterUtils';
import { isSpecialEndpointId } from '../../../../shared/utilities/LinkTypes';
import type { CyElement } from '../../../../shared/types/messages';
import type { GraphChangeEntry } from '../../../hooks';

export type LinkCandidate = { sourceId: string; targetId: string };

interface ParsedInterfacePattern {
  prefix: string;
  suffix: string;
  startIndex: number;
}

type EndpointAllocator = {
  parsed: ParsedInterfacePattern;
  usedIndices: Set<number>;
};

const DEFAULT_INTERFACE_PATTERN = 'eth{n}' as const;

const DEFAULT_INTERFACE_PATTERNS: Record<string, string> = {
  nokia_srlinux: 'e1-{n}',
  nokia_srsim: '1/1/c{n}/1',
  nokia_sros: '1/1/{n}',
  cisco_xrd: 'Gi0-0-0-{n}',
  cisco_xrv: 'Gi0/0/0/{n}',
  cisco_xrv9k: 'Gi0/0/0/{n}',
  cisco_csr1000v: 'Gi{n}',
  cisco_c8000v: 'Gi{n}',
  cisco_cat9kv: 'Gi1/0/{n}',
  cisco_iol: 'e0/{n}'
};

const INTERFACE_PATTERN_REGEX = /^(.+)?\{n(?::(\d+))?\}(.+)?$/;

function parseInterfacePattern(pattern: string): ParsedInterfacePattern {
  const match = INTERFACE_PATTERN_REGEX.exec(pattern);
  if (!match) {
    return { prefix: pattern || 'eth', suffix: '', startIndex: 0 };
  }
  const [, prefix = '', startStr, suffix = ''] = match;
  const startIndex = startStr ? parseInt(startStr, 10) : 0;
  return { prefix, suffix, startIndex };
}

function generateInterfaceName(parsed: ParsedInterfacePattern, index: number): string {
  const num = parsed.startIndex + index;
  return `${parsed.prefix}${num}${parsed.suffix}`;
}

function getNodeInterfacePattern(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  const extraData = (data?.extraData as Record<string, unknown> | undefined) || {};
  const interfacePattern = extraData.interfacePattern;
  if (typeof interfacePattern === 'string' && interfacePattern.trim() !== '') return interfacePattern;

  const kind = (data?.kind ?? extraData.kind) as string | undefined;
  if (kind && DEFAULT_INTERFACE_PATTERNS[kind]) return DEFAULT_INTERFACE_PATTERNS[kind];
  return DEFAULT_INTERFACE_PATTERN;
}

function extractInterfaceIndex(endpoint: string, parsed: ParsedInterfacePattern): number {
  const escapedPrefix = parsed.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = parsed.suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}(\\d+)${escapedSuffix}$`);
  const match = regex.exec(endpoint);
  if (match) {
    return parseInt(match[1], 10) - parsed.startIndex;
  }
  return -1;
}

function collectUsedIndices(edges: Edge[], nodeId: string, parsed: ParsedInterfacePattern): Set<number> {
  const usedIndices = new Set<number>();
  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const data = (edge.data as Record<string, unknown> | undefined) || {};

    if (edge.source === nodeId && typeof data.sourceEndpoint === 'string') {
      const idx = extractInterfaceIndex(data.sourceEndpoint, parsed);
      if (idx >= 0) usedIndices.add(idx);
    }

    if (edge.target === nodeId && typeof data.targetEndpoint === 'string') {
      const idx = extractInterfaceIndex(data.targetEndpoint, parsed);
      if (idx >= 0) usedIndices.add(idx);
    }
  }
  return usedIndices;
}

function getOrCreateAllocator(
  allocators: Map<string, EndpointAllocator>,
  edges: Edge[],
  node: Node
): EndpointAllocator {
  const nodeId = node.id;
  const cached = allocators.get(nodeId);
  if (cached) return cached;

  const pattern = getNodeInterfacePattern(node);
  const parsed = parseInterfacePattern(pattern);
  const usedIndices = collectUsedIndices(edges, nodeId, parsed);
  const created = { parsed, usedIndices };
  allocators.set(nodeId, created);
  return created;
}

function allocateEndpoint(
  allocators: Map<string, EndpointAllocator>,
  edges: Edge[],
  node: Node
): string {
  if (isSpecialEndpointId(node.id)) return '';

  const allocator = getOrCreateAllocator(allocators, edges, node);
  let nextIndex = 0;
  while (allocator.usedIndices.has(nextIndex)) nextIndex++;
  allocator.usedIndices.add(nextIndex);
  return generateInterfaceName(allocator.parsed, nextIndex);
}

function applyBackreferences(pattern: string, match: RegExpMatchArray | null): string {
  if (!pattern) return pattern;

  return pattern.replace(
    /\$\$|\$<([^>]+)>|\$(\d+)/g,
    (fullMatch: string, namedGroup?: string, numberedGroup?: string) => {
      if (fullMatch === '$$') return '$';
      if (!match) return fullMatch;

      if (fullMatch.startsWith('$<')) {
        if (namedGroup && match.groups && Object.prototype.hasOwnProperty.call(match.groups, namedGroup)) {
          return match.groups[namedGroup] ?? '';
        }
        return fullMatch;
      }

      if (numberedGroup) {
        const index = Number(numberedGroup);
        if (!Number.isNaN(index) && index < match.length) {
          return match[index] ?? '';
        }
        return fullMatch;
      }

      return fullMatch;
    }
  );
}

function getSourceMatch(
  name: string,
  sourceRegex: RegExp | null,
  fallbackFilter: ReturnType<typeof FilterUtils.createFilter> | null
): RegExpMatchArray | null | undefined {
  if (sourceRegex) {
    const execResult = sourceRegex.exec(name);
    return execResult ?? undefined;
  }

  if (!fallbackFilter) return null;
  return fallbackFilter(name) ? null : undefined;
}

function getNodeName(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  const name = data?.name ?? data?.label ?? node.id;
  return String(name);
}

function isBulkLinkEligible(node: Node): boolean {
  if (node.type && ['group-node', 'free-text-node', 'free-shape-node'].includes(node.type)) return false;
  const role = (node.data as Record<string, unknown> | undefined)?.topoViewerRole as string | undefined;
  if (role && ['group', 'freeText', 'freeShape'].includes(role)) return false;
  return true;
}

function hasEdgeBetween(edges: Edge[], sourceId: string, targetId: string): boolean {
  return edges.some(edge =>
    (edge.source === sourceId && edge.target === targetId) ||
    (edge.source === targetId && edge.target === sourceId)
  );
}

export function computeCandidates(
  nodes: Node[],
  edges: Edge[],
  sourceFilterText: string,
  targetFilterText: string
): LinkCandidate[] {
  const eligibleNodes = nodes.filter(isBulkLinkEligible);
  const candidates: LinkCandidate[] = [];

  const sourceRegex = FilterUtils.tryCreateRegExp(sourceFilterText);
  const sourceFallbackFilter = sourceRegex ? null : FilterUtils.createFilter(sourceFilterText);

  for (const sourceNode of eligibleNodes) {
    const sourceName = getNodeName(sourceNode);
    const match = getSourceMatch(sourceName, sourceRegex, sourceFallbackFilter);
    if (match === undefined) continue;

    const substitutedTargetPattern = applyBackreferences(targetFilterText, match);
    const targetFilter = FilterUtils.createFilter(substitutedTargetPattern);

    for (const targetNode of eligibleNodes) {
      if (sourceNode.id === targetNode.id) continue;
      if (!targetFilter(getNodeName(targetNode))) continue;
      if (hasEdgeBetween(edges, sourceNode.id, targetNode.id)) continue;

      candidates.push({ sourceId: sourceNode.id, targetId: targetNode.id });
    }
  }

  return candidates;
}

export function buildBulkEdges(nodes: Node[], edges: Edge[], candidates: LinkCandidate[]): CyElement[] {
  const allocators = new Map<string, EndpointAllocator>();
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const createdEdges: CyElement[] = [];

  for (const { sourceId, targetId } of candidates) {
    if (hasEdgeBetween(edges, sourceId, targetId)) continue;

    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);
    if (!sourceNode || !targetNode) continue;
    if (!isBulkLinkEligible(sourceNode) || !isBulkLinkEligible(targetNode)) continue;

    const sourceEndpoint = allocateEndpoint(allocators, edges, sourceNode);
    const targetEndpoint = allocateEndpoint(allocators, edges, targetNode);
    const edgeId = `${sourceId}-${targetId}`;

    createdEdges.push({
      group: 'edges',
      data: {
        id: edgeId,
        source: sourceId,
        target: targetId,
        sourceEndpoint,
        targetEndpoint,
        editor: 'true'
      },
      classes: isSpecialEndpointId(sourceId) || isSpecialEndpointId(targetId) ? 'stub-link' : ''
    });
  }

  return createdEdges;
}

export function buildUndoRedoEntries(edges: CyElement[]): { before: GraphChangeEntry[]; after: GraphChangeEntry[] } {
  const changes: GraphChangeEntry[] = edges.map(edge => ({
    entity: 'edge',
    kind: 'add',
    after: { ...edge, data: { ...edge.data } }
  }));

  return {
    before: changes.map(change => ({ ...change, after: change.after ? { ...change.after, data: { ...(change.after.data as Record<string, unknown>) } } : undefined })),
    after: changes.map(change => ({ ...change, after: change.after ? { ...change.after, data: { ...(change.after.data as Record<string, unknown>) } } : undefined }))
  };
}
