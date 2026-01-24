/**
 * Node type registry for React Flow
 *
 * Note: We use type assertion here because our custom node data types extend
 * with index signatures ([key: string]: unknown) for flexibility, which causes
 * TypeScript to incorrectly infer that properties like 'width', 'height', and
 * 'parentId' are required when React Flow expects them to be optional.
 */
import type { NodeTypes } from '@xyflow/react';
import { TopologyNode } from './TopologyNode';
import { CloudNode } from './CloudNode';
import { GroupNode } from './GroupNode';
import { FreeTextNode } from './FreeTextNode';
import { FreeShapeNode } from './FreeShapeNode';

/**
 * Registry of all custom node types for React Flow
 */
export const nodeTypes = {
  'topology-node': TopologyNode,
  'cloud-node': CloudNode,
  'group-node': GroupNode,
  'free-text-node': FreeTextNode,
  'free-shape-node': FreeShapeNode
} as unknown as NodeTypes;
