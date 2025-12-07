import type { ClabDetailedJSON } from '../../src/treeView/common';
import type { ClabInterfaceSnapshot } from '../../src/types/containerlab';

// Mutable raw inspect data for tests
export let rawInspectData: Record<string, ClabDetailedJSON[]> | undefined;

// Internal test state
let forcedPollingMode = false;
const interfaceSnapshots: Map<string, ClabInterfaceSnapshot[]> = new Map();
const interfaceVersions: Map<string, number> = new Map();

// Test helpers
export function setRawInspectData(data: Record<string, ClabDetailedJSON[]> | undefined) {
  rawInspectData = data;
}

export function setInterfaceSnapshot(shortId: string, data: ClabInterfaceSnapshot[]) {
  interfaceSnapshots.set(shortId, data);
}

export function setInterfaceVersion(shortId: string, version: number) {
  interfaceVersions.set(shortId, version);
}

export function setForcedPollingMode(value: boolean) {
  forcedPollingMode = value;
}

export function resetForTests(): void {
  rawInspectData = undefined;
  forcedPollingMode = false;
  interfaceSnapshots.clear();
  interfaceVersions.clear();
}

// Real exports matching src/treeView/inspector.ts
export function isPollingMode(): boolean {
  return forcedPollingMode;
}

export function isInterfaceStatsEnabled(): boolean {
  return true;
}

export function isUsingForcedPolling(): boolean {
  return forcedPollingMode;
}

export async function update(): Promise<void> {
  // No-op in tests - data set via setRawInspectData
}

export function getInterfacesSnapshot(containerShortId: string, containerName: string): ClabInterfaceSnapshot[] {
  const data = interfaceSnapshots.get(containerShortId);
  if (data) return data;
  // Return empty snapshot matching expected shape
  return [{ name: containerName, interfaces: [] }];
}

export function getInterfaceVersion(containerShortId: string): number {
  return interfaceVersions.get(containerShortId) ?? 0;
}

export function refreshFromEventStream(): void {
  // No-op in tests
}

export function resetForcedPollingMode(): void {
  forcedPollingMode = false;
}
