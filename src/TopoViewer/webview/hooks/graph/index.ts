/**
 * Graph manipulation hooks
 *
 * [MIGRATION] React Flow is the canvas source of truth. Keep graph change
 * typings aligned with the undo/redo system.
 */

import type { GraphChange } from '../state/useUndoRedo';

// Graph change types for undo/redo (alias to core undo/redo type)
export type GraphChangeEntry = GraphChange;
