/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache for modules we need to stub BEFORE setting up resolution
const MODULE_PATH = '../../../src/topoViewer/extension/services/CustomNodeConfigManager';
Object.keys(require.cache).forEach(key => {
  // Clear all topoViewer modules and stubs to ensure fresh loads
  if (key.includes('topoViewer') || key.includes('vscode-stub') || key.includes('extensionLogger-stub')) {
    delete require.cache[key];
  }
});

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Now import stubs and module under test
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';

const customNodeModule = require(MODULE_PATH) as typeof import('../../../src/topoViewer/extension/services/CustomNodeConfigManager');
const { CustomNodeConfigManager } = customNodeModule;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

// Constants to avoid duplicate strings
const NODE_NAME_1 = 'my-custom-node';
const NODE_NAME_2 = 'another-node';
const NODE_NAME_3 = 'third-node';
const KIND_NOKIA_SRLINUX = 'nokia_srlinux';
const KIND_NOKIA_SROS = 'nokia_sros';
const IMAGE_SRLINUX = 'ghcr.io/nokia/srlinux:latest';
const IMAGE_SROS = 'vr-sros:latest';
const INTERFACE_PATTERN_E1 = 'e1-{n}';
const INTERFACE_PATTERN_1_1 = '1/1/{n}';
const CONFIG_KEY_CUSTOM_NODES = 'containerlab.editor.customNodes';
const CONFIG_KEY_IFACE_MAPPING = 'containerlab.editor.interfacePatternMapping';
const CONFIG_SECTION = 'containerlab.editor';
const IFACE_LEGACY_PATTERN = 'eth{n}';
const IFACE_CUSTOM_PATTERN = 'ethernet-1/{n}';

describe('CustomNodeConfigManager - saveCustomNode', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new CustomNodeConfigManager();
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, []);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('adds a new custom node to empty list', async () => {
    const data = { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, image: IMAGE_SRLINUX };
    const result = await manager.saveCustomNode(data);

    expect(result.error).to.be.null;
    expect(result.result).to.be.an('object');
    const { customNodes } = result.result as any;
    expect(customNodes).to.have.length(1);
    expect(customNodes[0].name).to.equal(NODE_NAME_1);
    expect(customNodes[0].kind).to.equal(KIND_NOKIA_SRLINUX);
  });

  it('updates existing node by name', async () => {
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [{ name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX }]);

    const data = { name: NODE_NAME_1, kind: KIND_NOKIA_SROS, image: IMAGE_SROS };
    const result = await manager.saveCustomNode(data);

    expect(result.error).to.be.null;
    const { customNodes } = result.result as any;
    expect(customNodes).to.have.length(1);
    expect(customNodes[0].kind).to.equal(KIND_NOKIA_SROS);
    expect(customNodes[0].image).to.equal(IMAGE_SROS);
  });

  it('renames node when oldName is provided', async () => {
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [{ name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX }]);

    const data = { name: NODE_NAME_2, oldName: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX };
    const result = await manager.saveCustomNode(data);

    expect(result.error).to.be.null;
    const { customNodes } = result.result as any;
    expect(customNodes).to.have.length(1);
    expect(customNodes[0].name).to.equal(NODE_NAME_2);
    expect(customNodes[0].oldName).to.be.undefined;
  });

  it('adds new node when oldName not found', async () => {
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [{ name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX }]);

    const data = { name: NODE_NAME_2, oldName: 'non-existent', kind: KIND_NOKIA_SROS };
    const result = await manager.saveCustomNode(data);

    expect(result.error).to.be.null;
    const { customNodes } = result.result as any;
    expect(customNodes).to.have.length(2);
  });

  it('resets defaults when setDefault is true', async () => {
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [
      { name: NODE_NAME_1, setDefault: true },
      { name: NODE_NAME_2, setDefault: false }
    ]);

    const data = { name: NODE_NAME_2, setDefault: true };
    const result = await manager.saveCustomNode(data);

    expect(result.error).to.be.null;
    const { customNodes, defaultNode } = result.result as any;
    expect(customNodes.find((n: any) => n.name === NODE_NAME_1).setDefault).to.be.false;
    expect(customNodes.find((n: any) => n.name === NODE_NAME_2).setDefault).to.be.true;
    expect(defaultNode).to.equal(NODE_NAME_2);
  });
});

describe('CustomNodeConfigManager - setDefaultCustomNode', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new CustomNodeConfigManager();
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [
      { name: NODE_NAME_1, setDefault: false },
      { name: NODE_NAME_2, setDefault: true }
    ]);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('sets a node as default', async () => {
    const result = await manager.setDefaultCustomNode(NODE_NAME_1);

    expect(result.error).to.be.null;
    const { customNodes, defaultNode } = result.result as any;
    expect(customNodes.find((n: any) => n.name === NODE_NAME_1).setDefault).to.be.true;
    expect(customNodes.find((n: any) => n.name === NODE_NAME_2).setDefault).to.be.false;
    expect(defaultNode).to.equal(NODE_NAME_1);
  });

  it('returns error for empty name', async () => {
    const result = await manager.setDefaultCustomNode('');

    expect(result.result).to.be.null;
    expect(result.error).to.include('Missing custom node name');
  });

  it('returns error when node not found', async () => {
    const result = await manager.setDefaultCustomNode('non-existent');

    expect(result.result).to.be.null;
    expect(result.error).to.include('not found');
  });
});

describe('CustomNodeConfigManager - deleteCustomNode', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new CustomNodeConfigManager();
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [
      { name: NODE_NAME_1, setDefault: true },
      { name: NODE_NAME_2, setDefault: false }
    ]);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('deletes an existing node', async () => {
    const result = await manager.deleteCustomNode(NODE_NAME_1);

    expect(result.error).to.be.null;
    const { customNodes } = result.result as any;
    expect(customNodes).to.have.length(1);
    expect(customNodes[0].name).to.equal(NODE_NAME_2);
  });

  it('preserves default tracking after deletion', async () => {
    const result = await manager.deleteCustomNode(NODE_NAME_2);

    expect(result.error).to.be.null;
    const { defaultNode } = result.result as any;
    expect(defaultNode).to.equal(NODE_NAME_1);
  });

  it('clears defaultNode when deleting the default', async () => {
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, [{ name: NODE_NAME_1, setDefault: true }]);

    const result = await manager.deleteCustomNode(NODE_NAME_1);

    expect(result.error).to.be.null;
    const { customNodes, defaultNode } = result.result as any;
    expect(customNodes).to.have.length(0);
    expect(defaultNode).to.equal('');
  });
});

describe('CustomNodeConfigManager - getDefaultCustomNode', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    manager = new CustomNodeConfigManager();
  });

  it('returns default node info when found', () => {
    const customNodes = [
      { name: NODE_NAME_1, setDefault: false, kind: KIND_NOKIA_SROS },
      { name: NODE_NAME_2, setDefault: true, kind: KIND_NOKIA_SRLINUX, type: 'ixrd2' }
    ];

    const result = manager.getDefaultCustomNode(customNodes);

    expect(result.defaultNode).to.equal(NODE_NAME_2);
    expect(result.defaultKind).to.equal(KIND_NOKIA_SRLINUX);
    expect(result.defaultType).to.equal('ixrd2');
  });

  it('returns fallback values when no default set', () => {
    const customNodes = [
      { name: NODE_NAME_1, setDefault: false }
    ];

    const result = manager.getDefaultCustomNode(customNodes);

    expect(result.defaultNode).to.equal('');
    expect(result.defaultKind).to.equal(KIND_NOKIA_SRLINUX);
    expect(result.defaultType).to.equal('');
  });

  it('returns fallback values for empty array', () => {
    const result = manager.getDefaultCustomNode([]);

    expect(result.defaultNode).to.equal('');
    expect(result.defaultKind).to.equal(KIND_NOKIA_SRLINUX);
    expect(result.defaultType).to.equal('');
  });
});

describe('CustomNodeConfigManager - buildImageMapping', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    manager = new CustomNodeConfigManager();
  });

  it('builds mapping from kind to image', () => {
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, image: IMAGE_SRLINUX },
      { name: NODE_NAME_2, kind: KIND_NOKIA_SROS, image: IMAGE_SROS }
    ];

    const result = manager.buildImageMapping(customNodes);

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(IMAGE_SRLINUX);
    expect(result[KIND_NOKIA_SROS]).to.equal(IMAGE_SROS);
  });

  it('skips nodes without image', () => {
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX },
      { name: NODE_NAME_2, kind: KIND_NOKIA_SROS, image: IMAGE_SROS }
    ];

    const result = manager.buildImageMapping(customNodes);

    expect(result[KIND_NOKIA_SRLINUX]).to.be.undefined;
    expect(result[KIND_NOKIA_SROS]).to.equal(IMAGE_SROS);
  });

  it('skips nodes without kind', () => {
    const customNodes = [
      { name: NODE_NAME_1, image: IMAGE_SRLINUX }
    ];

    const result = manager.buildImageMapping(customNodes);

    expect(Object.keys(result)).to.have.length(0);
  });

  it('returns empty object for empty array', () => {
    const result = manager.buildImageMapping([]);

    expect(result).to.deep.equal({});
  });
});

describe('CustomNodeConfigManager - getLegacyInterfacePatternMapping', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new CustomNodeConfigManager();
  });

  afterEach(() => {
    vscode.resetVscodeStub();
  });

  it('returns legacy mapping when present', () => {
    vscode.setConfigValue(CONFIG_KEY_IFACE_MAPPING, {
      [KIND_NOKIA_SRLINUX]: INTERFACE_PATTERN_E1,
      [KIND_NOKIA_SROS]: INTERFACE_PATTERN_1_1
    });
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const result = manager.getLegacyInterfacePatternMapping(config as any);

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(INTERFACE_PATTERN_E1);
    expect(result[KIND_NOKIA_SROS]).to.equal(INTERFACE_PATTERN_1_1);
  });

  it('trims whitespace from patterns', () => {
    vscode.setConfigValue(CONFIG_KEY_IFACE_MAPPING, {
      [KIND_NOKIA_SRLINUX]: '  e1-{n}  '
    });
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const result = manager.getLegacyInterfacePatternMapping(config as any);

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(INTERFACE_PATTERN_E1);
  });

  it('filters empty strings after trimming', () => {
    vscode.setConfigValue(CONFIG_KEY_IFACE_MAPPING, {
      [KIND_NOKIA_SRLINUX]: '   ',
      [KIND_NOKIA_SROS]: INTERFACE_PATTERN_1_1
    });
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const result = manager.getLegacyInterfacePatternMapping(config as any);

    expect(result[KIND_NOKIA_SRLINUX]).to.be.undefined;
    expect(result[KIND_NOKIA_SROS]).to.equal(INTERFACE_PATTERN_1_1);
  });

  it('filters non-string values', () => {
    vscode.setConfigValue(CONFIG_KEY_IFACE_MAPPING, {
      [KIND_NOKIA_SRLINUX]: 123,
      [KIND_NOKIA_SROS]: INTERFACE_PATTERN_1_1
    });
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const result = manager.getLegacyInterfacePatternMapping(config as any);

    expect(result[KIND_NOKIA_SRLINUX]).to.be.undefined;
    expect(result[KIND_NOKIA_SROS]).to.equal(INTERFACE_PATTERN_1_1);
  });

  it('returns empty object when config not set', () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const result = manager.getLegacyInterfacePatternMapping(config as any);

    expect(result).to.deep.equal({});
  });
});

describe('CustomNodeConfigManager - ensureCustomNodeInterfacePatterns', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new CustomNodeConfigManager();
    vscode.setConfigValue(CONFIG_KEY_CUSTOM_NODES, []);
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('preserves existing patterns', async () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, interfacePattern: 'eth{n}' }
    ];

    const result = await manager.ensureCustomNodeInterfacePatterns(config as any, customNodes, {});

    expect(result[0].interfacePattern).to.equal('eth{n}');
  });

  it('trims whitespace from existing patterns', async () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, interfacePattern: '  eth{n}  ' }
    ];

    const result = await manager.ensureCustomNodeInterfacePatterns(config as any, customNodes, {});

    expect(result[0].interfacePattern).to.equal('eth{n}');
  });

  it('applies legacy fallback when pattern missing', async () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX }
    ];
    const legacyMapping = { [KIND_NOKIA_SRLINUX]: IFACE_LEGACY_PATTERN };

    const result = await manager.ensureCustomNodeInterfacePatterns(config as any, customNodes, legacyMapping);

    expect(result[0].interfacePattern).to.equal(IFACE_LEGACY_PATTERN);
  });

  it('applies default fallback when no legacy', async () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX }
    ];

    const result = await manager.ensureCustomNodeInterfacePatterns(config as any, customNodes, {});

    expect(result[0].interfacePattern).to.equal(INTERFACE_PATTERN_E1);
  });

  it('skips nodes without kind', async () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customNodes = [
      { name: NODE_NAME_1 }
    ];

    const result = await manager.ensureCustomNodeInterfacePatterns(config as any, customNodes, {});

    expect(result[0].interfacePattern).to.be.undefined;
  });

  it('handles null/undefined nodes', async () => {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customNodes = [null, undefined, { name: NODE_NAME_1 }] as any[];

    const result = await manager.ensureCustomNodeInterfacePatterns(config as any, customNodes, {});

    expect(result[0]).to.be.null;
    expect(result[1]).to.be.undefined;
    expect(result[2].name).to.equal(NODE_NAME_1);
  });
});

describe('CustomNodeConfigManager - buildInterfacePatternMapping', () => {
  let manager: InstanceType<typeof CustomNodeConfigManager>;

  beforeEach(() => {
    manager = new CustomNodeConfigManager();
  });

  it('includes default patterns', () => {
    const result = manager.buildInterfacePatternMapping([], {});

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(INTERFACE_PATTERN_E1);
    expect(result[KIND_NOKIA_SROS]).to.equal(INTERFACE_PATTERN_1_1);
  });

  it('merges legacy patterns over defaults', () => {
    const legacyMapping = { [KIND_NOKIA_SRLINUX]: IFACE_LEGACY_PATTERN };

    const result = manager.buildInterfacePatternMapping([], legacyMapping);

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(IFACE_LEGACY_PATTERN);
    expect(result[KIND_NOKIA_SROS]).to.equal(INTERFACE_PATTERN_1_1);
  });

  it('merges custom node patterns over legacy', () => {
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, interfacePattern: IFACE_CUSTOM_PATTERN }
    ];
    const legacyMapping = { [KIND_NOKIA_SRLINUX]: IFACE_LEGACY_PATTERN };

    const result = manager.buildInterfacePatternMapping(customNodes, legacyMapping);

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(IFACE_CUSTOM_PATTERN);
  });

  it('skips nodes without kind or pattern', () => {
    const customNodes = [
      { name: NODE_NAME_1, kind: '', interfacePattern: IFACE_CUSTOM_PATTERN },
      { name: NODE_NAME_2, kind: KIND_NOKIA_SROS, interfacePattern: '' },
      { name: NODE_NAME_3, kind: KIND_NOKIA_SRLINUX, interfacePattern: 'valid-{n}' }
    ];

    const result = manager.buildInterfacePatternMapping(customNodes, {});

    expect(result[KIND_NOKIA_SRLINUX]).to.equal('valid-{n}');
    expect(result[KIND_NOKIA_SROS]).to.equal(INTERFACE_PATTERN_1_1);
  });

  it('trims whitespace from custom patterns', () => {
    const customNodes = [
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, interfacePattern: `  ${IFACE_CUSTOM_PATTERN}  ` }
    ];

    const result = manager.buildInterfacePatternMapping(customNodes, {});

    expect(result[KIND_NOKIA_SRLINUX]).to.equal(IFACE_CUSTOM_PATTERN);
  });

  it('handles invalid node entries gracefully', () => {
    const customNodes = [
      null,
      undefined,
      'invalid',
      { name: NODE_NAME_1, kind: KIND_NOKIA_SRLINUX, interfacePattern: 'valid-{n}' }
    ] as any[];

    const result = manager.buildInterfacePatternMapping(customNodes, {});

    expect(result[KIND_NOKIA_SRLINUX]).to.equal('valid-{n}');
  });
});
