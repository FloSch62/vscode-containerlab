/**
 * RunningLabsProvider stub for testing
 *
 * Provides mock implementations for the running labs provider
 * used to query container and lab data without requiring a real Docker daemon.
 */

import type { LabPath } from '../../src/treeView/common';

/**
 * Simplified interface tree node for tests
 */
export interface MockInterfaceNode {
  label: string;
  parentName: string;
  cID: string;
  name: string;
  type: string;
  alias: string;
  mac: string;
  mtu: number;
  ifIndex: number;
  state: string;
}

/**
 * Simplified container tree node for tests
 */
export interface MockContainerNode {
  label: string;
  name: string;
  name_short: string;
  cID: string;
  state: string;
  kind: string;
  image: string;
  interfaces: MockInterfaceNode[];
  labPath: LabPath;
  v4Address?: string;
  v6Address?: string;
  nodeType?: string;
  nodeGroup?: string;
  status?: string;
}

/**
 * Simplified lab tree node for tests
 */
export interface MockLabNode {
  label: string;
  labPath: LabPath;
  name?: string;
  owner?: string;
  containers?: MockContainerNode[];
  favorite?: boolean;
  sshxLink?: string;
  gottyLink?: string;
}

// Internal state
let mockLabs: Record<string, MockLabNode> = {};
let discoverError: Error | null = null;

/**
 * Mock RunningLabsProvider
 */
export const runningLabsProvider = {
  async discoverInspectLabs(): Promise<Record<string, MockLabNode>> {
    if (discoverError) {
      throw discoverError;
    }
    return mockLabs;
  },

  refresh(): void {
    // no-op in tests
  },

  getTreeItem(_element: any): any {
    return _element;
  },

  async getChildren(_element?: any): Promise<any[]> {
    if (!_element) {
      return Object.values(mockLabs);
    }
    if (_element.containers) {
      return _element.containers;
    }
    if (_element.interfaces) {
      return _element.interfaces;
    }
    return [];
  }
};

// Test helpers

/**
 * Set the mock labs data
 */
export function setMockLabs(labs: Record<string, MockLabNode>): void {
  mockLabs = labs;
}

/**
 * Clear all mock labs
 */
export function clearMockLabs(): void {
  mockLabs = {};
  discoverError = null;
}

/**
 * Add a single mock lab
 */
export function addMockLab(name: string, lab: MockLabNode): void {
  mockLabs[name] = lab;
}

/**
 * Remove a single mock lab
 */
export function removeMockLab(name: string): void {
  delete mockLabs[name];
}

/**
 * Set an error to be thrown by discoverInspectLabs
 */
export function setDiscoverError(error: Error | null): void {
  discoverError = error;
}

/**
 * Create a mock container node with defaults
 */
export function createMockContainer(overrides: Partial<MockContainerNode> = {}): MockContainerNode {
  return {
    label: 'node1',
    name: 'clab-test-node1',
    name_short: 'node1',
    cID: 'abc123def456',
    state: 'running',
    kind: 'linux',
    image: 'alpine:latest',
    interfaces: [],
    labPath: { absolute: '/path/to/lab.clab.yml', relative: 'lab.clab.yml' },
    ...overrides
  };
}

/**
 * Create a mock interface node with defaults
 */
export function createMockInterface(overrides: Partial<MockInterfaceNode> = {}): MockInterfaceNode {
  return {
    label: 'eth0',
    parentName: 'clab-test-node1',
    cID: 'abc123def456',
    name: 'eth0',
    type: 'veth',
    alias: '',
    mac: '00:00:00:00:00:01',
    mtu: 1500,
    ifIndex: 1,
    state: 'up',
    ...overrides
  };
}

/**
 * Create a mock lab node with defaults
 */
export function createMockLab(overrides: Partial<MockLabNode> = {}): MockLabNode {
  return {
    label: 'test-lab',
    labPath: { absolute: '/path/to/lab.clab.yml', relative: 'lab.clab.yml' },
    name: 'test-lab',
    owner: 'testuser',
    containers: [],
    favorite: false,
    ...overrides
  };
}

/**
 * Create a fully populated mock lab with containers and interfaces
 */
export function createPopulatedMockLab(labName: string, containerCount: number = 2): MockLabNode {
  const labPath = { absolute: `/path/to/${labName}.clab.yml`, relative: `${labName}.clab.yml` };
  const containers: MockContainerNode[] = [];

  for (let i = 1; i <= containerCount; i++) {
    const interfaces: MockInterfaceNode[] = [
      createMockInterface({
        label: `eth${i}`,
        parentName: `clab-${labName}-node${i}`,
        cID: `container${i}`,
        name: `eth${i}`,
        alias: `e1-${i}`
      })
    ];

    containers.push(createMockContainer({
      label: `node${i}`,
      name: `clab-${labName}-node${i}`,
      name_short: `node${i}`,
      cID: `container${i}`,
      interfaces,
      labPath
    }));
  }

  return createMockLab({
    label: labName,
    labPath,
    name: labName,
    containers
  });
}

/**
 * Reset the stub to initial state
 */
export function resetRunningLabsProviderStub(): void {
  clearMockLabs();
}
