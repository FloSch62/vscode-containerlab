import type { ClabDetailedJSON } from '../../src/treeView/common';
import type { ClabInterfaceSnapshot } from '../../src/types/containerlab';

// Internal state
let groupedContainers: Record<string, ClabDetailedJSON[]> = {};
const interfaceSnapshots: Map<string, ClabInterfaceSnapshot[]> = new Map();
const interfaceVersions: Map<string, number> = new Map();
const dataListeners: Set<() => void> = new Set();
const stateListeners: Set<(id: string, state: string) => void> = new Set();

// Test helpers (not in real module)
export function setGroupedContainers(data: Record<string, ClabDetailedJSON[]>) {
  groupedContainers = data;
}

export function setInterfaceSnapshot(shortId: string, data: ClabInterfaceSnapshot[]) {
  interfaceSnapshots.set(shortId, data);
}

export function setInterfaceVersion(shortId: string, version: number) {
  interfaceVersions.set(shortId, version);
}

export function triggerDataChanged() {
  dataListeners.forEach(listener => listener());
}

export function triggerContainerStateChanged(id: string, state: string) {
  stateListeners.forEach(listener => listener(id, state));
}

// Real exports (must match src/services/containerlabEvents.ts)
export async function ensureEventStream(_runtime: string): Promise<void> {
  // No-op in tests - data set via setGroupedContainers
}

export function getGroupedContainers(): Record<string, ClabDetailedJSON[]> {
  return groupedContainers;
}

export function getInterfaceSnapshot(containerShortId: string, containerName: string): ClabInterfaceSnapshot[] {
  const data = interfaceSnapshots.get(containerShortId);
  if (data) return data;
  // Return empty snapshot matching expected shape
  return [{ name: containerName, interfaces: [] }];
}

export function getInterfaceVersion(containerShortId: string): number {
  return interfaceVersions.get(containerShortId) ?? 0;
}

export function resetForTests(): void {
  groupedContainers = {};
  interfaceSnapshots.clear();
  interfaceVersions.clear();
  dataListeners.clear();
  stateListeners.clear();
}

export function onDataChanged(listener: () => void): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

export function onContainerStateChanged(listener: (id: string, state: string) => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}
