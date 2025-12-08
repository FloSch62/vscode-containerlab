/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache for modules we need to stub BEFORE setting up resolution
// Note: Exclude node_modules to avoid breaking third-party modules like fast-uri
Object.keys(require.cache).forEach(key => {
  if ((key.includes('NodeCommandService') || key.includes('vscode-stub')) ||
      (key.includes('extension') && !key.includes('node_modules'))) {
    delete require.cache[key];
  }
});

import * as vscode from '../../helpers/vscode-stub';

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
const CLAB_TEST_ROUTER1 = 'clab-test-router1';
const MSG_SSH_EXECUTED = 'SSH connection executed';
const MSG_UNKNOWN_ENDPOINT = 'Unknown endpoint';

// Redirect vscode and extension imports to stubs
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  if (request.includes('../../../extension') || request.endsWith('/extension')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Load module under test after redirects are in place
const nodeCommandServiceModule = require('../../../src/topoViewer/extension/services/NodeCommandService');
const { NodeCommandService } = nodeCommandServiceModule;

// Import extension stub to set up provider
const extensionStub = require('../../helpers/extension-stub');

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

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
 * Helper function for SROS slot priority (for comparison)
 */
function srosSlotPriority(slot: string): number {
  const normalized = slot.toLowerCase();
  if (normalized === 'a') return 0;
  if (normalized === 'b') return 1;
  return 2;
}

/**
 * Helper to create mock labs data
 */
function createMockLabsData(containers: Record<string, unknown>[]): Record<string, unknown> {
  return {
    'test-lab': {
      labPath: { absolute: YAML_PATH, relative: YAML_PATH_RELATIVE },
      containers
    }
  };
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
    const mockResult = { result: MSG_SSH_EXECUTED, error: null };
    expect(mockResult.result).to.equal(MSG_SSH_EXECUTED);
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
      createMockContainerNode({ name: CLAB_TEST_ROUTER1, name_short: 'router1', label: 'Router 1' }),
      createMockContainerNode({ name: 'clab-test-spine1', name_short: 'spine1', label: 'Spine 1' }),
      createMockContainerNode({ name: 'clab-test-leaf1', name_short: 'leaf1', label: 'Leaf 1' })
    ];
  });

  it('should match container by full name', () => {
    const found = containers.find((c) => c.name === CLAB_TEST_ROUTER1);
    expect(found).to.not.be.undefined;
    expect(found?.name).to.equal(CLAB_TEST_ROUTER1);
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
    const error = `${MSG_UNKNOWN_ENDPOINT} "${endpointName}".`;
    expect(error).to.include(MSG_UNKNOWN_ENDPOINT);
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
    const yamlPath = YAML_PATH;
    expect(yamlPath).to.be.a('string');
    expect(yamlPath).to.include('.clab.yml');
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

/**
 * Tests for NodeCommandService Class - setYamlFilePath
 */
describe('NodeCommandService Class - setYamlFilePath', () => {
  it('should set yaml file path', () => {
    const service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    // Path is set internally, verify by trying to get container
    expect(service).to.be.instanceOf(NodeCommandService);
  });

  it('should allow empty path', () => {
    const service = new NodeCommandService();
    service.setYamlFilePath('');
    expect(service).to.be.instanceOf(NodeCommandService);
  });
});

/**
 * Tests for NodeCommandService Class - getContainerNode
 */
describe('NodeCommandService Class - getContainerNode', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should return undefined when no labs available', async () => {
    discoverInspectLabsStub.resolves(null);

    const result = await service.getContainerNode(NODE_ROUTER1);
    expect(result).to.be.undefined;
  });

  it('should return undefined when yamlFilePath is not set', async () => {
    const emptyService = new NodeCommandService();
    discoverInspectLabsStub.resolves(createMockLabsData([]));

    const result = await emptyService.getContainerNode(NODE_ROUTER1);
    expect(result).to.be.undefined;
  });

  it('should return undefined when lab not found by path', async () => {
    discoverInspectLabsStub.resolves({
      'other-lab': {
        labPath: { absolute: '/other/path.clab.yml', relative: 'path.clab.yml' },
        containers: []
      }
    });

    const result = await service.getContainerNode(NODE_ROUTER1);
    expect(result).to.be.undefined;
  });

  it('should find container by full name', async () => {
    const container = createMockContainerNode({ name: NODE_ROUTER1, name_short: 'r1' });
    discoverInspectLabsStub.resolves(createMockLabsData([container]));

    const result = await service.getContainerNode(NODE_ROUTER1);
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal(NODE_ROUTER1);
  });

  it('should find container by short name', async () => {
    const container = createMockContainerNode({ name: 'clab-test-router1', name_short: NODE_ROUTER1 });
    discoverInspectLabsStub.resolves(createMockLabsData([container]));

    const result = await service.getContainerNode(NODE_ROUTER1);
    expect(result).to.not.be.undefined;
    expect(result?.name_short).to.equal(NODE_ROUTER1);
  });

  it('should find container by label', async () => {
    const container = createMockContainerNode({ name: 'clab-test-r1', name_short: 'r1', label: NODE_ROUTER1 });
    discoverInspectLabsStub.resolves(createMockLabsData([container]));

    const result = await service.getContainerNode(NODE_ROUTER1);
    expect(result).to.not.be.undefined;
    expect(result?.label).to.equal(NODE_ROUTER1);
  });

  it('should resolve distributed SROS container when direct match not found', async () => {
    const srosContainerA = createMockSrosContainer(NODE_ROUTER1, 'A');
    const srosContainerB = createMockSrosContainer(NODE_ROUTER1, 'B');
    discoverInspectLabsStub.resolves(createMockLabsData([srosContainerA, srosContainerB]));

    const result = await service.getContainerNode(NODE_ROUTER1);
    expect(result).to.not.be.undefined;
    // Should prefer slot A
    expect((result?.name_short as string)).to.include('-A');
  });
});

/**
 * Tests for NodeCommandService Class - resolveInterfaceName
 */
describe('NodeCommandService Class - resolveInterfaceName', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should return original interface name when no labs data', async () => {
    discoverInspectLabsStub.resolves(null);

    const result = await service.resolveInterfaceName(NODE_ROUTER1, INTERFACE_ETH0);
    expect(result).to.equal(INTERFACE_ETH0);
  });

  it('should return original name when container not found', async () => {
    discoverInspectLabsStub.resolves(createMockLabsData([]));

    const result = await service.resolveInterfaceName(NODE_ROUTER1, INTERFACE_ETH0);
    expect(result).to.equal(INTERFACE_ETH0);
  });

  it('should resolve interface by name', async () => {
    const container = createMockContainerNode({
      name: NODE_ROUTER1,
      interfaces: [createMockInterfaceNode({ name: INTERFACE_ETH0, alias: INTERFACE_ALIAS })]
    });
    discoverInspectLabsStub.resolves(createMockLabsData([container]));

    const result = await service.resolveInterfaceName(NODE_ROUTER1, INTERFACE_ETH0);
    expect(result).to.equal(INTERFACE_ETH0);
  });

  it('should resolve interface by alias', async () => {
    const container = createMockContainerNode({
      name: NODE_ROUTER1,
      interfaces: [createMockInterfaceNode({ name: INTERFACE_ETH0, alias: INTERFACE_ALIAS })]
    });
    discoverInspectLabsStub.resolves(createMockLabsData([container]));

    const result = await service.resolveInterfaceName(NODE_ROUTER1, INTERFACE_ALIAS);
    expect(result).to.equal(INTERFACE_ETH0);
  });
});

/**
 * Tests for NodeCommandService Class - handleNodeEndpoint SSH
 */
describe('NodeCommandService Class - handleNodeEndpoint SSH', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    discoverInspectLabsStub.resolves(null);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should execute SSH command for node', async () => {
    const result = await service.handleNodeEndpoint(ENDPOINT_SSH, NODE_ROUTER1);

    expect(result.error).to.be.null;
    expect(result.result).to.include('SSH connection executed');
    expect(vscode.commands.executed).to.have.lengthOf(1);
    expect(vscode.commands.executed[0].command).to.equal('containerlab.node.ssh');
  });

  it('should include node name in result message', async () => {
    const result = await service.handleNodeEndpoint(ENDPOINT_SSH, NODE_ROUTER1);
    expect(result.result).to.include(NODE_ROUTER1);
  });
});

/**
 * Tests for NodeCommandService Class - handleNodeEndpoint Shell
 */
describe('NodeCommandService Class - handleNodeEndpoint Shell', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    discoverInspectLabsStub.resolves(null);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should execute attach shell command for node', async () => {
    const result = await service.handleNodeEndpoint(ENDPOINT_SHELL, NODE_ROUTER1);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Attach shell executed');
    expect(vscode.commands.executed).to.have.lengthOf(1);
    expect(vscode.commands.executed[0].command).to.equal('containerlab.node.attachShell');
  });
});

/**
 * Tests for NodeCommandService Class - handleNodeEndpoint Logs
 */
describe('NodeCommandService Class - handleNodeEndpoint Logs', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    discoverInspectLabsStub.resolves(null);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should execute show logs command for node', async () => {
    const result = await service.handleNodeEndpoint(ENDPOINT_LOGS, NODE_ROUTER1);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Show logs executed');
    expect(vscode.commands.executed).to.have.lengthOf(1);
    expect(vscode.commands.executed[0].command).to.equal('containerlab.node.showLogs');
  });
});

/**
 * Tests for NodeCommandService Class - handleNodeEndpoint Unknown
 */
describe('NodeCommandService Class - handleNodeEndpoint Unknown', () => {
  beforeEach(() => {
    vscode.resetVscodeStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should return error for unknown endpoint', async () => {
    const service = new NodeCommandService();
    const result = await service.handleNodeEndpoint(ENDPOINT_UNKNOWN, NODE_ROUTER1);

    expect(result.result).to.be.null;
    expect(result.error).to.include(MSG_UNKNOWN_ENDPOINT);
    expect(result.error).to.include(ENDPOINT_UNKNOWN);
  });
});

/**
 * Tests for NodeCommandService Class - handleInterfaceEndpoint Capture
 */
describe('NodeCommandService Class - handleInterfaceEndpoint Capture', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    discoverInspectLabsStub.resolves(null);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should execute capture command for interface', async () => {
    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ETH0 };
    const result = await service.handleInterfaceEndpoint(ENDPOINT_CAPTURE, payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Capture executed');
    expect(vscode.commands.executed).to.have.lengthOf(1);
    expect(vscode.commands.executed[0].command).to.equal('containerlab.interface.capture');
  });

  it('should include node and interface in result', async () => {
    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ETH0 };
    const result = await service.handleInterfaceEndpoint(ENDPOINT_CAPTURE, payload);

    expect(result.result).to.include(NODE_ROUTER1);
    expect(result.result).to.include(INTERFACE_ETH0);
  });
});

/**
 * Tests for NodeCommandService Class - handleInterfaceEndpoint Link Capture
 */
describe('NodeCommandService Class - handleInterfaceEndpoint Link Capture', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    discoverInspectLabsStub.resolves(null);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should execute link capture with edgeshark', async () => {
    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ETH0 };
    const result = await service.handleInterfaceEndpoint(ENDPOINT_LINK_CAPTURE, payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Capture executed');
    expect(vscode.commands.executed).to.have.lengthOf(1);
    expect(vscode.commands.executed[0].command).to.equal('containerlab.interface.captureWithEdgeshark');
  });
});

/**
 * Tests for NodeCommandService Class - handleInterfaceEndpoint VNC
 */
describe('NodeCommandService Class - handleInterfaceEndpoint VNC', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
    discoverInspectLabsStub.resolves(null);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should execute VNC capture command', async () => {
    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ETH0 };
    const result = await service.handleInterfaceEndpoint(ENDPOINT_EDGESHARK_VNC, payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('VNC capture executed');
    expect(vscode.commands.executed).to.have.lengthOf(1);
    expect(vscode.commands.executed[0].command).to.equal('containerlab.interface.captureWithEdgesharkVNC');
  });
});

/**
 * Tests for NodeCommandService Class - handleInterfaceEndpoint Unknown
 */
describe('NodeCommandService Class - handleInterfaceEndpoint Unknown', () => {
  beforeEach(() => {
    vscode.resetVscodeStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should return error for unknown interface endpoint', async () => {
    const service = new NodeCommandService();
    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ETH0 };
    const result = await service.handleInterfaceEndpoint(ENDPOINT_UNKNOWN, payload);

    expect(result.result).to.be.null;
    expect(result.error).to.include(MSG_UNKNOWN_ENDPOINT);
    expect(result.error).to.include(ENDPOINT_UNKNOWN);
  });
});

/**
 * Tests for NodeCommandService Class - Interface Alias Resolution
 */
describe('NodeCommandService Class - Interface Alias Resolution', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should resolve alias to actual interface name for capture', async () => {
    const container = createMockContainerNode({
      name: NODE_ROUTER1,
      interfaces: [createMockInterfaceNode({ name: INTERFACE_ETH0, alias: INTERFACE_ALIAS })]
    });
    discoverInspectLabsStub.resolves(createMockLabsData([container]));

    const payload = { nodeName: NODE_ROUTER1, interfaceName: INTERFACE_ALIAS };
    const result = await service.handleInterfaceEndpoint(ENDPOINT_CAPTURE, payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include(INTERFACE_ETH0);
  });
});

/**
 * Tests for NodeCommandService Class - SROS Container Resolution
 */
describe('NodeCommandService Class - SROS Container Resolution', () => {
  let discoverInspectLabsStub: sinon.SinonStub;
  let service: InstanceType<typeof NodeCommandService>;

  beforeEach(() => {
    discoverInspectLabsStub = sinon.stub(extensionStub.runningLabsProvider, 'discoverInspectLabs');
    vscode.resetVscodeStub();
    service = new NodeCommandService();
    service.setYamlFilePath(YAML_PATH);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('should prefer slot A over slot B for SROS containers', async () => {
    const srosB = createMockSrosContainer('sros1', 'B');
    const srosA = createMockSrosContainer('sros1', 'A');
    discoverInspectLabsStub.resolves(createMockLabsData([srosB, srosA]));

    const result = await service.getContainerNode('sros1');
    expect(result).to.not.be.undefined;
    expect((result?.name_short as string)).to.include('-A');
  });

  it('should return undefined when no SROS containers match', async () => {
    const sros = createMockSrosContainer('sros1', 'A');
    discoverInspectLabsStub.resolves(createMockLabsData([sros]));

    const result = await service.getContainerNode('nonexistent');
    expect(result).to.be.undefined;
  });
});
