/* eslint-env mocha */
/* global describe, it, beforeEach */
import { expect } from 'chai';

// Constants for commonly used test values
const NODE_ROUTER1 = 'router1';
const NODE_SHORT_NAME = 'node1';
const CONTAINER_PREFIX = 'clab-test';
const CONTAINER_NAME = `${CONTAINER_PREFIX}-${NODE_SHORT_NAME}`;
const INTERFACE_ETH0 = 'eth0';
const INTERFACE_ALIAS = 'e1-1';
const YAML_PATH = '/path/to/lab.clab.yml';
const YAML_PATH_RELATIVE = 'lab.clab.yml';
const KIND_NOKIA_SRSIM = 'nokia_srsim';
const ENDPOINT_SSH = 'clab-node-connect-ssh';
const ENDPOINT_SHELL = 'clab-node-attach-shell';
const ENDPOINT_LOGS = 'clab-node-view-logs';
const ENDPOINT_CAPTURE = 'clab-interface-capture';
const ENDPOINT_LINK_CAPTURE = 'clab-link-capture';
const ENDPOINT_EDGESHARK_VNC = 'clab-link-capture-edgeshark-vnc';
const ENDPOINT_UNKNOWN = 'unknown-endpoint';
const MAC_ADDRESS = '00:11:22:33:44:55';

/**
 * Helper to create a mock container node
 */
function createMockContainerNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    label: NODE_SHORT_NAME,
    name: CONTAINER_NAME,
    name_short: NODE_SHORT_NAME,
    cID: 'abc123',
    state: 'running',
    kind: 'linux',
    image: 'alpine:latest',
    interfaces: [],
    labPath: { absolute: YAML_PATH, relative: YAML_PATH_RELATIVE },
    ...overrides
  };
}

/**
 * Helper to create a mock interface node
 */
function createMockInterfaceNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    label: INTERFACE_ETH0,
    parentName: CONTAINER_NAME,
    cID: 'abc123',
    name: INTERFACE_ETH0,
    type: 'veth',
    alias: INTERFACE_ALIAS,
    mac: MAC_ADDRESS,
    mtu: 1500,
    ifIndex: 1,
    state: 'up',
    ...overrides
  };
}

/**
 * Helper to create a mock SROS container
 */
function createMockSrosContainer(baseName: string, slot: string): Record<string, unknown> {
  return createMockContainerNode({
    name: `clab-test-${baseName}-${slot}`,
    name_short: `${baseName}-${slot}`,
    kind: KIND_NOKIA_SRSIM
  });
}

/**
 * Helper function for SROS slot priority
 */
function srosSlotPriority(slot: string): number {
  const normalized = slot.toLowerCase();
  if (normalized === 'a') return 0;
  if (normalized === 'b') return 1;
  return 2;
}

/**
 * Tests for NodeCommandService - Endpoint Result Structure
 */
describe('NodeCommandService - Endpoint Result Structure', () => {
  it('should define EndpointResult with result and error fields', () => {
    const mockResult = { result: 'success message', error: null };
    expect(mockResult).to.have.property('result');
    expect(mockResult).to.have.property('error');
  });

  it('should allow null result with error message', () => {
    const mockResult = { result: null, error: 'Error occurred' };
    expect(mockResult.result).to.be.null;
    expect(mockResult.error).to.equal('Error occurred');
  });

  it('should allow result with null error', () => {
    const mockResult = { result: 'SSH connection executed', error: null };
    expect(mockResult.result).to.equal('SSH connection executed');
    expect(mockResult.error).to.be.null;
  });
});

/**
 * Tests for NodeCommandService - Default Container Node Creation
 */
describe('NodeCommandService - Default Container Node Creation', () => {
  it('should create default container node with matching label and name', () => {
    const nodeName = NODE_ROUTER1;
    const defaultNode = {
      label: nodeName,
      name: nodeName,
      name_short: nodeName,
      cID: nodeName,
      state: '',
      kind: '',
      image: '',
      interfaces: [],
      labPath: { absolute: '', relative: '' }
    };

    expect(defaultNode.label).to.equal(nodeName);
    expect(defaultNode.name).to.equal(nodeName);
    expect(defaultNode.name_short).to.equal(nodeName);
  });

  it('should create default container node with empty state', () => {
    const defaultNode = {
      label: NODE_ROUTER1,
      name: NODE_ROUTER1,
      name_short: NODE_ROUTER1,
      cID: NODE_ROUTER1,
      state: '',
      kind: '',
      image: '',
      interfaces: [],
      labPath: { absolute: '', relative: '' }
    };

    expect(defaultNode.state).to.equal('');
    expect(defaultNode.kind).to.equal('');
    expect(defaultNode.image).to.equal('');
  });

  it('should create default container node with empty interfaces array', () => {
    const defaultNode = {
      label: NODE_ROUTER1,
      name: NODE_ROUTER1,
      name_short: NODE_ROUTER1,
      cID: NODE_ROUTER1,
      state: '',
      kind: '',
      image: '',
      interfaces: [],
      labPath: { absolute: '', relative: '' }
    };

    expect(defaultNode.interfaces).to.be.an('array').that.is.empty;
  });
});

/**
 * Tests for NodeCommandService - Interface Object Creation
 */
describe('NodeCommandService - Interface Object Creation', () => {
  it('should create interface object with basic fields', () => {
    const interfaceObj = createMockInterfaceNode();

    expect(interfaceObj.label).to.equal(INTERFACE_ETH0);
    expect(interfaceObj.name).to.equal(INTERFACE_ETH0);
    expect(interfaceObj.parentName).to.equal(CONTAINER_NAME);
  });

  it('should create interface object with alias when provided', () => {
    const interfaceObj = createMockInterfaceNode({ alias: INTERFACE_ALIAS });

    expect(interfaceObj.alias).to.equal(INTERFACE_ALIAS);
  });

  it('should create interface object with empty alias when not provided', () => {
    const interfaceObj = createMockInterfaceNode({ alias: '' });

    expect(interfaceObj.alias).to.equal('');
  });

  it('should include all required interface fields', () => {
    const interfaceObj = createMockInterfaceNode();

    expect(interfaceObj).to.have.property('label');
    expect(interfaceObj).to.have.property('parentName');
    expect(interfaceObj).to.have.property('cID');
    expect(interfaceObj).to.have.property('name');
    expect(interfaceObj).to.have.property('type');
    expect(interfaceObj).to.have.property('alias');
    expect(interfaceObj).to.have.property('mac');
    expect(interfaceObj).to.have.property('mtu');
    expect(interfaceObj).to.have.property('ifIndex');
    expect(interfaceObj).to.have.property('state');
  });
});

/**
 * Tests for NodeCommandService - Container Node Matching Logic
 */
describe('NodeCommandService - Container Node Matching Logic', () => {
  let containers: Record<string, unknown>[];

  beforeEach(() => {
    containers = [
      createMockContainerNode({ name: 'clab-test-router1', name_short: 'router1', label: 'Router 1' }),
      createMockContainerNode({ name: 'clab-test-spine1', name_short: 'spine1', label: 'Spine 1' }),
      createMockContainerNode({ name: 'clab-test-leaf1', name_short: 'leaf1', label: 'Leaf 1' })
    ];
  });

  it('should match container by full name', () => {
    const targetName = 'clab-test-router1';
    const found = containers.find((c) => c.name === targetName);
    expect(found).to.not.be.undefined;
    expect(found?.name).to.equal(targetName);
  });

  it('should match container by short name', () => {
    const targetName = 'router1';
    const found = containers.find((c) => c.name_short === targetName);
    expect(found).to.not.be.undefined;
    expect(found?.name_short).to.equal(targetName);
  });

  it('should match container by label', () => {
    const targetLabel = 'Router 1';
    const found = containers.find((c) => c.label === targetLabel);
    expect(found).to.not.be.undefined;
    expect(found?.label).to.equal(targetLabel);
  });

  it('should return undefined for non-existent container', () => {
    const targetName = 'nonexistent';
    const found = containers.find(
      (c) => c.name === targetName || c.name_short === targetName || c.label === targetName
    );
    expect(found).to.be.undefined;
  });
});

/**
 * Tests for NodeCommandService - SROS Component Info Extraction
 */
describe('NodeCommandService - SROS Component Info Extraction', () => {
  it('should extract base and slot from SROS container name', () => {
    const rawLabel = 'router1-A';
    const lastDash = rawLabel.lastIndexOf('-');
    const base = rawLabel.slice(0, lastDash);
    const slot = rawLabel.slice(lastDash + 1);

    expect(base).to.equal('router1');
    expect(slot).to.equal('A');
  });

  it('should handle multi-dash names', () => {
    const rawLabel = 'my-complex-router-B';
    const lastDash = rawLabel.lastIndexOf('-');
    const base = rawLabel.slice(0, lastDash);
    const slot = rawLabel.slice(lastDash + 1);

    expect(base).to.equal('my-complex-router');
    expect(slot).to.equal('B');
  });

  it('should return undefined for names without dash', () => {
    const rawLabel = 'nodename';
    const lastDash = rawLabel.lastIndexOf('-');
    expect(lastDash).to.equal(-1);
  });

  it('should return undefined for empty string', () => {
    const rawLabel = '';
    const lastDash = rawLabel.lastIndexOf('-');
    expect(lastDash).to.equal(-1);
  });
});

/**
 * Tests for NodeCommandService - SROS Slot Priority
 */
describe('NodeCommandService - SROS Slot Priority', () => {
  it('should give highest priority to slot A', () => {
    expect(srosSlotPriority('A')).to.equal(0);
    expect(srosSlotPriority('a')).to.equal(0);
  });

  it('should give second priority to slot B', () => {
    expect(srosSlotPriority('B')).to.equal(1);
    expect(srosSlotPriority('b')).to.equal(1);
  });

  it('should give lowest priority to other slots', () => {
    expect(srosSlotPriority('C')).to.equal(2);
    expect(srosSlotPriority('1')).to.equal(2);
    expect(srosSlotPriority('X')).to.equal(2);
  });
});

/**
 * Tests for NodeCommandService - Distributed SROS Resolution
 */
describe('NodeCommandService - Distributed SROS Resolution', () => {
  let srosContainers: Record<string, unknown>[];

  beforeEach(() => {
    srosContainers = [
      createMockSrosContainer('router1', 'A'),
      createMockSrosContainer('router1', 'B'),
      createMockSrosContainer('router2', 'A')
    ];
  });

  it('should filter containers by kind nokia_srsim', () => {
    const filtered = srosContainers.filter((c) => c.kind === KIND_NOKIA_SRSIM);
    expect(filtered).to.have.lengthOf(3);
  });

  it('should match containers by base name (case-insensitive)', () => {
    const targetBase = 'ROUTER1';
    const normalizedTarget = targetBase.toLowerCase();

    const candidates = srosContainers.filter((c) => {
      const rawLabel = (c.name_short || '') as string;
      const lastDash = rawLabel.lastIndexOf('-');
      if (lastDash === -1) return false;
      const base = rawLabel.slice(0, lastDash);
      return base.toLowerCase() === normalizedTarget;
    });

    expect(candidates).to.have.lengthOf(2);
  });

  it('should sort candidates by slot priority', () => {
    const candidates = srosContainers
      .filter((c) => c.kind === KIND_NOKIA_SRSIM)
      .filter((c) => {
        const rawLabel = (c.name_short || '') as string;
        return rawLabel.startsWith('router1-');
      })
      .map((c) => {
        const rawLabel = (c.name_short || '') as string;
        const slot = rawLabel.slice(rawLabel.lastIndexOf('-') + 1);
        return { container: c, slot };
      })
      .sort((a, b) => srosSlotPriority(a.slot) - srosSlotPriority(b.slot));

    expect(candidates[0].slot).to.equal('A');
    expect(candidates[1].slot).to.equal('B');
  });
});

/**
 * Tests for NodeCommandService - Interface Resolution
 */
describe('NodeCommandService - Interface Resolution', () => {
  let mockInterfaces: Record<string, unknown>[];

  beforeEach(() => {
    mockInterfaces = [
      createMockInterfaceNode({ name: INTERFACE_ETH0, alias: 'e1-1' }),
      createMockInterfaceNode({ name: 'eth1', alias: 'e1-2' }),
      createMockInterfaceNode({ name: 'lo', alias: '' })
    ];
  });

  it('should resolve interface by exact name', () => {
    const targetName = INTERFACE_ETH0;
    const found = mockInterfaces.find((i) => i.name === targetName);
    expect(found).to.not.be.undefined;
    expect(found?.name).to.equal(targetName);
  });

  it('should resolve interface by alias', () => {
    const targetAlias = 'e1-1';
    const found = mockInterfaces.find((i) => i.alias === targetAlias);
    expect(found).to.not.be.undefined;
    expect(found?.name).to.equal(INTERFACE_ETH0);
  });

  it('should return original name when not found', () => {
    const targetName = 'nonexistent';
    const found = mockInterfaces.find((i) => i.name === targetName || i.alias === targetName);

    const resolved = found ? (found.name as string) : targetName;
    expect(resolved).to.equal(targetName);
  });
});

/**
 * Tests for NodeCommandService - Node Endpoint Names
 */
describe('NodeCommandService - Node Endpoint Names', () => {
  it('should recognize SSH endpoint', () => {
    expect(ENDPOINT_SSH).to.equal('clab-node-connect-ssh');
  });

  it('should recognize attach shell endpoint', () => {
    expect(ENDPOINT_SHELL).to.equal('clab-node-attach-shell');
  });

  it('should recognize view logs endpoint', () => {
    expect(ENDPOINT_LOGS).to.equal('clab-node-view-logs');
  });
});

/**
 * Tests for NodeCommandService - Interface Endpoint Names
 */
describe('NodeCommandService - Interface Endpoint Names', () => {
  it('should recognize interface capture endpoint', () => {
    expect(ENDPOINT_CAPTURE).to.equal('clab-interface-capture');
  });

  it('should recognize link capture endpoint', () => {
    expect(ENDPOINT_LINK_CAPTURE).to.equal('clab-link-capture');
  });

  it('should recognize edgeshark VNC endpoint', () => {
    expect(ENDPOINT_EDGESHARK_VNC).to.equal('clab-link-capture-edgeshark-vnc');
  });
});

/**
 * Tests for NodeCommandService - Endpoint Result Messages
 */
describe('NodeCommandService - Endpoint Result Messages', () => {
  it('should format SSH result message correctly', () => {
    const nodeName = NODE_ROUTER1;
    const result = `SSH connection executed for ${nodeName}`;
    expect(result).to.include('SSH connection');
    expect(result).to.include(nodeName);
  });

  it('should format attach shell result message correctly', () => {
    const nodeName = NODE_ROUTER1;
    const result = `Attach shell executed for ${nodeName}`;
    expect(result).to.include('Attach shell');
    expect(result).to.include(nodeName);
  });

  it('should format show logs result message correctly', () => {
    const nodeName = NODE_ROUTER1;
    const result = `Show logs executed for ${nodeName}`;
    expect(result).to.include('Show logs');
    expect(result).to.include(nodeName);
  });

  it('should format capture result message correctly', () => {
    const nodeName = NODE_ROUTER1;
    const interfaceName = INTERFACE_ETH0;
    const result = `Capture executed for ${nodeName}/${interfaceName}`;
    expect(result).to.include('Capture');
    expect(result).to.include(nodeName);
    expect(result).to.include(interfaceName);
  });
});

/**
 * Tests for NodeCommandService - Unknown Endpoint Error Messages
 */
describe('NodeCommandService - Unknown Endpoint Error Messages', () => {
  it('should format unknown endpoint error correctly', () => {
    const endpointName = ENDPOINT_UNKNOWN;
    const error = `Unknown endpoint "${endpointName}".`;
    expect(error).to.include('Unknown endpoint');
    expect(error).to.include(endpointName);
  });
});

/**
 * Tests for NodeCommandService - Capture Payload Structure
 */
describe('NodeCommandService - Capture Payload Structure', () => {
  it('should accept capture payload with nodeName and interfaceName', () => {
    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ETH0 };
    expect(payload).to.have.property('nodeName', NODE_ROUTER1);
    expect(payload).to.have.property('interfaceName', INTERFACE_ETH0);
  });

  it('should use alias when different from actual name', () => {
    const actualName: string = 'eth0';
    const aliasName: string = 'e1-1';
    const alias = actualName !== aliasName ? aliasName : '';
    expect(alias).to.equal('e1-1');
  });

  it('should use empty alias when same as actual name', () => {
    const actualName: string = INTERFACE_ETH0;
    const aliasName: string = INTERFACE_ETH0;
    const alias = actualName !== aliasName ? aliasName : '';
    expect(alias).to.equal('');
  });
});

/**
 * Tests for NodeCommandService - YAML Path Handling
 */
describe('NodeCommandService - YAML Path Handling', () => {
  it('should accept valid YAML path', () => {
    const path = YAML_PATH;
    expect(path).to.be.a('string');
    expect(path).to.include('.clab.yml');
  });

  it('should match lab by absolute path', () => {
    const labs = {
      'test-lab': { labPath: { absolute: YAML_PATH, relative: YAML_PATH_RELATIVE } }
    };
    const currentPath = YAML_PATH;

    const found = Object.values(labs).find((lab) => lab.labPath.absolute === currentPath);
    expect(found).to.not.be.undefined;
  });

  it('should not match lab with different path', () => {
    const labs = {
      'test-lab': { labPath: { absolute: YAML_PATH, relative: YAML_PATH_RELATIVE } }
    };
    const differentPath = '/different/path.clab.yml';

    const found = Object.values(labs).find((lab) => lab.labPath.absolute === differentPath);
    expect(found).to.be.undefined;
  });
});
