/**
 * Stub for containerlabInspectFallback service
 *
 * Provides mock implementations for polling-based lab data fetching.
 */
import type { ClabDetailedJSON } from '../../src/treeView/common';
import type { ClabInterfaceSnapshot } from '../../src/types/containerlab';

// Internal state
let groupedContainers: Record<string, ClabDetailedJSON[]> = {};
const interfaceSnapshots: Map<string, ClabInterfaceSnapshot[]> = new Map();
const interfaceVersions: Map<string, number> = new Map();
let pollingState = false;

// Test helpers
export function setGroupedContainers(data: Record<string, ClabDetailedJSON[]>): void {
  groupedContainers = data;
}

export function setInterfaceSnapshot(shortId: string, data: ClabInterfaceSnapshot[]): void {
  interfaceSnapshots.set(shortId, data);
}

export function setInterfaceVersion(shortId: string, version: number): void {
  interfaceVersions.set(shortId, version);
}

export function setIsPolling(value: boolean): void {
  pollingState = value;
}

export function getIsPolling(): boolean {
  return pollingState;
}

export function resetForTests(): void {
  groupedContainers = {};
  interfaceSnapshots.clear();
  interfaceVersions.clear();
  pollingState = false;
}

// Real exports matching src/services/containerlabInspectFallback.ts
export async function ensureFallback(_runtime: string): Promise<void> {
  // No-op in tests - data set via setGroupedContainers
}

export function startPolling(_runtime: string, _intervalMs?: number): void {
  pollingState = true;
}

export function stopPolling(): void {
  pollingState = false;
}

export function getGroupedContainers(): Record<string, ClabDetailedJSON[]> {
  return groupedContainers;
}

export async function forceUpdate(_runtime: string): Promise<void> {
  // No-op in tests
}

export function getInterfaceSnapshot(containerShortId: string, containerName: string): ClabInterfaceSnapshot[] {
  const data = interfaceSnapshots.get(containerShortId);
  if (data) return data;
  return [{ name: containerName, interfaces: [] }];
}

export function getInterfaceVersion(containerShortId: string): number {
  return interfaceVersions.get(containerShortId) ?? 0;
}

export function onDataChanged(_listener: () => void): () => void {
  // No-op in tests, return empty dispose function
  return () => {};
}
