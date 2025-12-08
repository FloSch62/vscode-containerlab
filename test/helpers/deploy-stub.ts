// Stub for deploy module
import { ClabLabTreeNode } from '../../src/treeView/common';

export interface DeployCall {
  node?: ClabLabTreeNode;
}

export const deployCalls: DeployCall[] = [];

export async function deploy(node?: ClabLabTreeNode): Promise<void> {
  deployCalls.push({ node });
}

export async function deployCleanup(_node?: ClabLabTreeNode): Promise<void> {
  // Stub implementation
}

export async function deploySpecificFile(): Promise<void> {
  // Stub implementation
}

export function resetDeployStub(): void {
  deployCalls.length = 0;
}
